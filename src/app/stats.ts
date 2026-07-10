// ─── Реальная статистика аккаунта (без бэкенда, всё локально) ────────────────
// Свежий аккаунт стартует с нуля: минуты, уровень, серия дней, лента событий
// и прослушивания своих треков — всё растёт по мере реального использования
// приложения и переживает перезапуск через localStorage.

import { ls } from "./data";

export interface ProfileStats {
  /** секунды прослушано по дням, ключ — ISO-дата "YYYY-MM-DD" (любая музыка) */
  secondsByDay: Record<string, number>;
  /** секунды по жанрам за всё время — для топ-жанра */
  genreSeconds: Record<string, number>;
  /** секунды по артистам за всё время — для Wrapped */
  artistSeconds: Record<string, number>;
  /** trackId -> сколько раз запускался (любой трек, не только свой) — для Wrapped */
  playedTracks: Record<number, number>;
  streak: number;
  lastActiveDay: string;
}

const DEFAULT_STATS: ProfileStats = { secondsByDay: {}, genreSeconds: {}, artistSeconds: {}, playedTracks: {}, streak: 0, lastActiveDay: "" };

export function loadStats(): ProfileStats {
  // Слияние с дефолтом — аккаунты, созданные до появления artistSeconds/playedTracks,
  // не должны падать из-за отсутствующих полей в сохранённом объекте
  return { ...DEFAULT_STATS, ...ls.get<ProfileStats>("stats", DEFAULT_STATS) };
}
export function saveStats(s: ProfileStats) {
  ls.set("stats", s);
}

export const todayIso = () => new Date().toISOString().slice(0, 10);
const isoDaysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

/** Раз в сессию (при заходе в приложение) — считает серию дней подряд */
export function touchDailyStreak(s: ProfileStats): ProfileStats {
  const today = todayIso();
  if (s.lastActiveDay === today) return s;
  const streak = s.lastActiveDay === isoDaysAgo(1) ? s.streak + 1 : 1;
  return { ...s, streak, lastActiveDay: today };
}

/** Добавляет прожитые секунды прослушивания — общие, по жанру и по артисту */
export function addListenSeconds(s: ProfileStats, seconds: number, genre: string, artist: string): ProfileStats {
  const day = todayIso();
  return {
    ...s,
    secondsByDay: { ...s.secondsByDay, [day]: (s.secondsByDay[day] ?? 0) + seconds },
    genreSeconds: { ...s.genreSeconds, [genre]: (s.genreSeconds[genre] ?? 0) + seconds },
    artistSeconds: { ...s.artistSeconds, [artist]: (s.artistSeconds[artist] ?? 0) + seconds },
  };
}

/** Отмечает запуск трека (любого) — для счётчика «сколько треков послушал» в Wrapped */
export function markTrackPlayed(s: ProfileStats, trackId: number): ProfileStats {
  return { ...s, playedTracks: { ...s.playedTracks, [trackId]: (s.playedTracks[trackId] ?? 0) + 1 } };
}

/** Панель разработчика: выдать XP напрямую. XP = секунды/6, поэтому докидываем
    только секунды дня — жанры и артисты не трогаются, Wrapped не искажается */
export function grantXp(s: ProfileStats, xp: number): ProfileStats {
  const day = todayIso();
  return { ...s, secondsByDay: { ...s.secondsByDay, [day]: (s.secondsByDay[day] ?? 0) + xp * 6 } };
}

export const totalSeconds = (s: ProfileStats) => Object.values(s.secondsByDay).reduce((a, b) => a + b, 0);
export const weekSeconds = (s: ProfileStats) => {
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += s.secondsByDay[isoDaysAgo(i)] ?? 0;
  return sum;
};
export const minutesOf = (sec: number) => Math.floor(sec / 60);
export const xpOf = (s: ProfileStats) => Math.round(totalSeconds(s) / 6); // 10 XP за минуту

/** Прогрессия уровней: порог растёт с каждым уровнем (300, 500, 700, 900 XP...) */
export function levelInfo(xp: number) {
  let level = 1, need = 300, floor = 0;
  while (xp >= floor + need) { floor += need; level++; need += 200; }
  return { level, xpFloor: floor, xpCeil: floor + need, xpIntoLevel: xp - floor, xpForLevel: need };
}

export function topGenre(s: ProfileStats): string | null {
  const entries = Object.entries(s.genreSeconds).filter(([, v]) => v > 0);
  if (!entries.length) return null;
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

export function topArtist(s: ProfileStats): string | null {
  const entries = Object.entries(s.artistSeconds).filter(([, v]) => v > 0);
  if (!entries.length) return null;
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

export const distinctTracksPlayed = (s: ProfileStats) => Object.keys(s.playedTracks).length;
export const distinctGenresPlayed = (s: ProfileStats) => Object.entries(s.genreSeconds).filter(([, v]) => v > 0).length;

/** Секунды прослушивания за текущий календарный месяц — для Wrapped */
export function currentMonthSeconds(s: ProfileStats): number {
  const now = new Date();
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-`;
  return Object.entries(s.secondsByDay).filter(([day]) => day.startsWith(prefix)).reduce((sum, [, v]) => sum + v, 0);
}

// ─── Лента реальных событий (уведомления) ────────────────────────────────────

export interface ActivityItem { id: number; textKey: string; args: (string | number)[]; time: number }

export function loadActivity(): ActivityItem[] {
  return ls.get<ActivityItem[]>("activity", []);
}

export function pushActivity(textKey: string, ...args: (string | number)[]): ActivityItem[] {
  const item: ActivityItem = { id: Date.now() + Math.random(), textKey, args, time: Date.now() };
  const next = [item, ...loadActivity()].slice(0, 30);
  ls.set("activity", next);
  return next;
}

// ─── Прослушивания своих треков (для Студии) ─────────────────────────────────

export interface MyPlays {
  /** trackId -> число прослушиваний */
  byTrack: Record<number, number>;
  /** ISO-дата -> число прослушиваний своих треков в этот день */
  byDay: Record<string, number>;
}

const DEFAULT_MY_PLAYS: MyPlays = { byTrack: {}, byDay: {} };

export function loadMyPlays(): MyPlays {
  return ls.get<MyPlays>("myPlays", DEFAULT_MY_PLAYS);
}

export function logMyTrackPlay(trackId: number): MyPlays {
  const p = loadMyPlays();
  const day = todayIso();
  const next: MyPlays = {
    byTrack: { ...p.byTrack, [trackId]: (p.byTrack[trackId] ?? 0) + 1 },
    byDay: { ...p.byDay, [day]: (p.byDay[day] ?? 0) + 1 },
  };
  ls.set("myPlays", next);
  return next;
}

/** Последние n дней (от старых к новым) для графиков */
export function lastNDays(byDay: Record<string, number>, n: number): number[] {
  const out: number[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(byDay[isoDaysAgo(i)] ?? 0);
  return out;
}

/** Значения по дням конкретного месяца (year, monthIdx с 0) — для календаря студии */
export function monthDays(byDay: Record<string, number>, year: number, monthIdx: number): number[] {
  const numDays = new Date(year, monthIdx + 1, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return Array.from({ length: numDays }, (_, i) => byDay[`${year}-${pad(monthIdx + 1)}-${pad(i + 1)}`] ?? 0);
}

// ─── Прочие лёгкие счётчики реального использования ─────────────────────────

/** Сколько всего раз пользователь запускал воспроизведение (любых треков) — для профиля */
export function loadTotalPlays(): number {
  return ls.get<number>("totalPlays", 0);
}
export function bumpTotalPlays(): number {
  const next = loadTotalPlays() + 1;
  ls.set("totalPlays", next);
  return next;
}
