// ─── MYRA AI: локальный умный подбор ─────────────────────────────────────────
// История прослушиваний + вкусовой профиль. Волна не повторяет недавние треки.

import { ls, type Track } from "./data";

const HIST_MAX = 48;

export const getHistory = () => ls.get<number[]>("history", []);

export const pushHistory = (id: number) => {
  const h = [id, ...getHistory().filter(x => x !== id)].slice(0, HIST_MAX);
  ls.set("history", h);
};

export const getTaste = () => new Set(ls.get<string[]>("taste", []));

export interface SmartPick { track: Track; reason: string }

type RankedTrack = SmartPick & { score: number };

const stableNoise = (id: number) => {
  const day = Math.floor(Date.now() / 86_400_000);
  const value = Math.sin(id * 12.9898 + day * 0.731) * 43758.5453;
  return value - Math.floor(value);
};

const recommendationReason = (
  track: Track,
  taste: Set<string>,
  likedIds: Set<number>,
  followed: Set<string>,
  lang: "ru" | "en",
) => {
  const ru = taste.has(track.genre) ? `в твоём вкусе: ${track.genre}`
    : followed.has(track.artist) ? `ты следишь за ${track.artist}`
    : likedIds.has(track.id) ? "из любимых релизов"
    : track.local ? "из твоей медиатеки"
    : "новое звучание для тебя";
  const en = taste.has(track.genre) ? `matches your taste: ${track.genre}`
    : followed.has(track.artist) ? `because you follow ${track.artist}`
    : likedIds.has(track.id) ? "from your favorite releases"
    : track.local ? "from your library"
    : "a fresh sound for you";
  return lang === "ru" ? ru : en;
};

/**
 * Стабильная персональная полка: учитывает вкусы, лайки и подписки,
 * понижает недавно прослушанное и сохраняет разнообразие артистов и жанров.
 */
export function smartRecommendations(
  all: Track[],
  likedIds: Set<number>,
  followed: Set<string>,
  currentId?: number,
  lang: "ru" | "en" = "ru",
  limit = 8,
): SmartPick[] {
  if (!all.length || limit <= 0) return [];
  const history = getHistory();
  const taste = getTaste();
  const current = all.find(track => track.id === currentId);

  const ranked: RankedTrack[] = all
    .filter(track => track.id !== currentId)
    .map(track => {
      let score = stableNoise(track.id) * 0.75;
      if (taste.has(track.genre)) score += 3.2;
      if (followed.has(track.artist)) score += 2.5;
      if (likedIds.has(track.id)) score += 1.15;
      if (current?.genre === track.genre) score += 0.9;
      if (current?.artist === track.artist) score += 0.35;
      if (track.local) score += 0.55;

      const historyIndex = history.indexOf(track.id);
      if (historyIndex >= 0) score -= Math.max(0.5, 6 - historyIndex * 0.28);

      return {
        track,
        score,
        reason: recommendationReason(track, taste, likedIds, followed, lang),
      };
    })
    .sort((a, b) => b.score - a.score || a.track.id - b.track.id);

  const result: RankedTrack[] = [];
  const artistUse = new Map<string, number>();
  const genreUse = new Map<string, number>();
  const target = Math.min(limit, ranked.length);

  while (ranked.length && result.length < target) {
    let bestIndex = 0;
    let bestAdjusted = -Infinity;
    ranked.forEach((item, index) => {
      const artistPenalty = (artistUse.get(item.track.artist) ?? 0) * 2.4;
      const genrePenalty = (genreUse.get(item.track.genre) ?? 0) * 0.65;
      const adjusted = item.score - artistPenalty - genrePenalty;
      if (adjusted > bestAdjusted) {
        bestAdjusted = adjusted;
        bestIndex = index;
      }
    });
    const [picked] = ranked.splice(bestIndex, 1);
    result.push(picked);
    artistUse.set(picked.track.artist, (artistUse.get(picked.track.artist) ?? 0) + 1);
    genreUse.set(picked.track.genre, (genreUse.get(picked.track.genre) ?? 0) + 1);
  }

  return result.map(({ track, reason }) => ({ track, reason }));
}

/** Подбор следующего трека: жанры вкуса, лайки, подписки, свои файлы — минус недавно игранное */
export function smartNext(all: Track[], likedIds: Set<number>, followed: Set<string>, currentId?: number, lang: "ru" | "en" = "ru"): SmartPick {
  return smartRecommendations(all, likedIds, followed, currentId, lang, 1)[0]
    ?? { track: all[0], reason: lang === "ru" ? "продолжить прослушивание" : "continue listening" };
}

// ─── Коллективные хайлайты на волне ──────────────────────────────────────────
// Эвристика, не ML (в духе smartNext выше): если несколько человек НЕЗАВИСИМО
// оставили комментарии в одном и том же месте трека — момент зацепил не одного
// слушателя. Порог в 3 комментария сознательный: «хайлайт» из двух совпадений —
// случайность, и на треке без живого обсуждения ничего подсвечиваться не будет.

export interface HotMoment { pct: number; count: number }

export function commentHotMoments(comments: { pct: number }[], windowPct = 5, minCount = 3): HotMoment[] {
  if (comments.length < minCount) return [];
  const sorted = [...comments].map(c => c.pct).sort((a, b) => a - b);
  const moments: HotMoment[] = [];
  let cluster: number[] = [];
  const flush = () => {
    if (cluster.length >= minCount) {
      moments.push({ pct: cluster.reduce((a, b) => a + b, 0) / cluster.length, count: cluster.length });
    }
    cluster = [];
  };
  for (const pct of sorted) {
    if (!cluster.length || pct - cluster[0] <= windowPct) cluster.push(pct);
    else { flush(); cluster = [pct]; }
  }
  flush();
  return moments;
}
