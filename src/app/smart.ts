// ─── MYRA AI: локальный умный подбор ─────────────────────────────────────────
// История прослушиваний + вкусовой профиль. Волна не повторяет недавние треки.

import { ls, type Track } from "./data";

const HIST_MAX = 24;

export const getHistory = () => ls.get<number[]>("history", []);

export const pushHistory = (id: number) => {
  const h = [id, ...getHistory().filter(x => x !== id)].slice(0, HIST_MAX);
  ls.set("history", h);
};

export const getTaste = () => new Set(ls.get<string[]>("taste", []));

export interface SmartPick { track: Track; reason: string }

/** Подбор следующего трека: жанры вкуса, лайки, подписки, свои файлы — минус недавно игранное */
export function smartNext(all: Track[], likedIds: Set<number>, followed: Set<string>, currentId?: number, lang: "ru" | "en" = "ru"): SmartPick {
  const hist = getHistory();
  const taste = getTaste();

  const scored = all
    .filter(t => t.id !== currentId)
    .map(t => {
      let score = Math.random() * 1.5;
      if (taste.has(t.genre)) score += 2;
      if (likedIds.has(t.id)) score += 1.4;
      if (followed.has(t.artist)) score += 1.2;
      if (t.local) score += 0.6;
      const hi = hist.indexOf(t.id);
      if (hi >= 0) score -= (HIST_MAX - hi) * 0.45; // свежее прослушанное — сильнее штраф
      return { t, score };
    })
    .sort((a, b) => b.score - a.score);

  const pick = (scored[0] ?? { t: all[0] }).t;

  const ru = taste.has(pick.genre) ? `в твоём вкусе: ${pick.genre}`
    : likedIds.has(pick.id) ? "из твоего любимого"
    : followed.has(pick.artist) ? `ты подписан на ${pick.artist}`
    : pick.local ? "из твоих файлов"
    : "что-то новое для тебя";
  const en = taste.has(pick.genre) ? `matches your taste: ${pick.genre}`
    : likedIds.has(pick.id) ? "from your likes"
    : followed.has(pick.artist) ? `you follow ${pick.artist}`
    : pick.local ? "from your files"
    : "something new for you";

  return { track: pick, reason: lang === "ru" ? ru : en };
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
