// ─── MYRA: эвристическая разметка структуры трека по волне ──────────────────
// ВАЖНО: это НЕ обученная ML-модель, а клиентский DSP-эвристик — в духе того
// же честного подхода, что и «AI-подбор» следующего трека в smart.ts (там
// тоже нет никакой модели, только взвешенные правила). Здесь мы:
//  1) декодируем аудио через Web Audio API,
//  2) считаем грубую огибающую RMS-энергии окнами ~1.5 сек,
//  3) ищем границы секций по скачкам производной энергии,
//  4) грубо сравниваем форму соседних «серединных» кусков (упрощённая
//     кросс-корреляция вместо настоящей автокорреляции) — совпадающие и
//     громкие куски помечаем повторяющимся припевом.
// Никаких текстовых «инсайтов о смысле песни» тут нет и не должно быть —
// только структурные границы, найденные по реальному сигналу.

import { ls, type Track } from "./data";
import { useEffect, useState } from "react";

export type SectionKind = "intro" | "verse" | "chorus" | "bridge" | "outro";

export interface TrackSection {
  startPct: number;
  endPct: number;
  kind: SectionKind;
}

const WINDOW_SEC = 1.5;
const MIN_SECTIONS = 3;
const MAX_SECTIONS = 7;
const MIN_WINDOWS = 6; // короче ~9 сек анализировать бессмысленно — отдаём null

const average = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const stddev = (xs: number[], mean: number) => Math.sqrt(average(xs.map(x => (x - mean) ** 2)));

function cacheKey(key: string) {
  return `structure.${key}`;
}

export function loadCachedStructure(key: string): TrackSection[] | null {
  return ls.get<TrackSection[] | null>(cacheKey(key), null);
}

function saveCachedStructure(key: string, sections: TrackSection[]) {
  ls.set(cacheKey(key), sections);
}

/** RMS-энергия по неперекрывающимся окнам ~WINDOW_SEC секунд */
function computeEnergyWindows(data: Float32Array, sampleRate: number): number[] {
  const windowSize = Math.max(1, Math.round(sampleRate * WINDOW_SEC));
  const windows: number[] = [];
  for (let start = 0; start < data.length; start += windowSize) {
    const end = Math.min(data.length, start + windowSize);
    let sumSq = 0;
    for (let i = start; i < end; i++) { const v = data[i]; sumSq += v * v; }
    windows.push(Math.sqrt(sumSq / Math.max(1, end - start)));
  }
  return windows;
}

/** Индексы окон-границ по скачкам |Δэнергии| выше среднего — грубо, но достаточно */
function pickBoundaries(energy: number[]): number[] {
  const n = energy.length;
  const minGap = Math.max(2, Math.floor(n / MAX_SECTIONS));
  const diffs = energy.map((e, i) => (i === 0 ? 0 : Math.abs(e - energy[i - 1])));
  const meanDiff = average(diffs);
  const sd = stddev(diffs, meanDiff);

  const candidates = diffs
    .map((d, i) => ({ i, d }))
    .filter(c => c.i >= minGap && n - c.i >= minGap && c.d > meanDiff + 0.5 * sd)
    .sort((a, b) => b.d - a.d);

  const chosen: number[] = [];
  for (const c of candidates) {
    if (chosen.length >= MAX_SECTIONS - 1) break;
    if (chosen.some(x => Math.abs(x - c.i) < minGap)) continue;
    chosen.push(c.i);
  }
  return chosen.sort((a, b) => a - b);
}

/** Гарантирует 3-7 секций: досекает самый длинный кусок или сливает самый короткий */
function ensureSectionCount(interiorBoundaries: number[], n: number): number[] {
  const bp = [0, ...interiorBoundaries, n];
  while (bp.length - 1 < MIN_SECTIONS) {
    let idx = 0, len = 0;
    for (let i = 0; i < bp.length - 1; i++) { const l = bp[i + 1] - bp[i]; if (l > len) { len = l; idx = i; } }
    const mid = Math.floor((bp[idx] + bp[idx + 1]) / 2);
    if (mid <= bp[idx] || mid >= bp[idx + 1]) break; // дальше делить некуда
    bp.splice(idx + 1, 0, mid);
  }
  while (bp.length - 1 > MAX_SECTIONS) {
    let idx = 1, len = Infinity;
    for (let i = 1; i < bp.length - 1; i++) { const l = bp[i + 1] - bp[i - 1]; if (l < len) { len = l; idx = i; } }
    bp.splice(idx, 1);
  }
  return bp;
}

function downsample(arr: number[], size: number): number[] {
  if (!arr.length) return new Array(size).fill(0);
  const out = new Array(size);
  for (let i = 0; i < size; i++) {
    const pos = size === 1 ? 0 : (i / (size - 1)) * (arr.length - 1);
    const lo = Math.floor(pos), hi = Math.min(arr.length - 1, lo + 1);
    const frac = pos - lo;
    out[i] = arr[lo] * (1 - frac) + arr[hi] * frac;
  }
  return out;
}

/** Упрощённая кросс-корреляция формы двух отрезков — не настоящий ML-анализ */
function correlate(a: number[], b: number[]): number {
  const meanA = average(a), meanB = average(b);
  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < a.length; i++) {
    const da = a[i] - meanA, db = b[i] - meanB;
    num += da * db; denA += da * da; denB += db * db;
  }
  if (denA <= 0 || denB <= 0) return 0;
  return num / Math.sqrt(denA * denB);
}

/** Позиционная эвристика: первая секция — интро, последняя — аутро, повторяющиеся
    громкие куски в середине — припев, остальное — куплет/бридж чередованием */
function labelSections(bp: number[], energy: number[]): SectionKind[] {
  const segCount = bp.length - 1;
  const labels: SectionKind[] = new Array(segCount).fill("verse");
  if (segCount === 1) return ["intro"];

  labels[0] = "intro";
  labels[segCount - 1] = "outro";

  const middle = Array.from({ length: segCount }, (_, i) => i).filter(i => i !== 0 && i !== segCount - 1);
  const segEnergy = (i: number) => average(energy.slice(bp[i], bp[i + 1]));
  const shapeOf = (i: number) => downsample(energy.slice(bp[i], bp[i + 1]), 6);
  const overallMean = average(energy);

  const chorus = new Set<number>();
  for (let a = 0; a < middle.length; a++) {
    for (let b = a + 1; b < middle.length; b++) {
      const ia = middle[a], ib = middle[b];
      if (segEnergy(ia) < overallMean * 1.02 || segEnergy(ib) < overallMean * 1.02) continue; // припев обычно громче среднего
      if (correlate(shapeOf(ia), shapeOf(ib)) > 0.72) { chorus.add(ia); chorus.add(ib); }
    }
  }

  let toggle = 0;
  for (const i of middle) {
    if (chorus.has(i)) { labels[i] = "chorus"; continue; }
    labels[i] = toggle % 2 === 0 ? "verse" : "bridge";
    toggle++;
  }
  return labels;
}

/**
 * Разбирает аудио трека на 3-7 секций по грубой эвристике. Возвращает null при
 * любой проблеме (сеть, CORS, неподдерживаемый формат, слишком короткий трек) —
 * вызывающий код должен просто не показывать секции, никогда не бросать исключение.
 */
/** Та же эвристика слабого железа, что у автовключения упрощённой графики:
    декод целого трека в PCM — пиковые десятки мегабайт памяти, на дешёвом
    Android-телефоне это способно уронить WebView целиком */
function isWeakDevice(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4
    || (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
}

export async function analyzeTrackStructure(url: string): Promise<TrackSection[] | null> {
  try {
    if (!url) return null;
    // На слабом железе честно пропускаем анализ: трек и так стримится в
    // <audio>, а параллельное второе скачивание + полный PCM-декод — нет
    if (isWeakDevice()) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();

    const OfflineCtxCls: typeof OfflineAudioContext | undefined =
      (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    if (!OfflineCtxCls) return null;
    // Рендерить контекст не будем — используем только decodeAudioData.
    // Частота 8 кГц (минимум спецификации): decodeAudioData ресемплирует к
    // частоте контекста, и пиковая память декода падает в ~5.5 раза против
    // 44.1 кГц; для огибающей RMS-энергии такой точности более чем достаточно
    const ctx = new OfflineCtxCls(1, 1, 8000);
    const buffer = await ctx.decodeAudioData(arrayBuffer);
    const data = buffer.getChannelData(0);

    const energyRaw = computeEnergyWindows(data, buffer.sampleRate);
    if (energyRaw.length < MIN_WINDOWS) return null;
    const maxE = Math.max(...energyRaw, 1e-9);
    const energy = energyRaw.map(e => e / maxE);

    const interior = pickBoundaries(energy);
    const bp = ensureSectionCount(interior, energy.length);
    const kinds = labelSections(bp, energy);

    return bp.slice(0, -1).map((start, i) => ({
      startPct: (start / energy.length) * 100,
      endPct: (bp[i + 1] / energy.length) * 100,
      kind: kinds[i],
    }));
  } catch {
    // Сеть/CORS/формат — тихо не показываем структуру, воспроизведение не трогаем
    return null;
  }
}

/** Отдаёт закэшированную структуру сразу (если есть) и досчитывает в фоне, если нет */
export function useTrackStructure(track: Pick<Track, "id" | "url" | "remoteId">): TrackSection[] | null {
  // blob-URL уникален на каждую сессию — кэш по нему копил бы в localStorage
  // мёртвые ключи для каждого локального файла; числовой id стабилен
  const key = track.remoteId ?? (track.url.startsWith("blob:") ? `local:${track.id}` : track.url);
  const [sections, setSections] = useState<TrackSection[] | null>(() => loadCachedStructure(key));

  useEffect(() => {
    const cached = loadCachedStructure(key);
    setSections(cached);
    if (cached) return;

    let cancelled = false;
    analyzeTrackStructure(track.url).then(result => {
      if (cancelled || !result) return;
      saveCachedStructure(key, result);
      setSections(result);
    });
    return () => { cancelled = true; };
  }, [key, track.url]);

  return sections;
}

/** В какую секцию попадает комментарий по его pct — для бейджа во вкладке комментариев */
export function sectionForPct(sections: TrackSection[] | null, pct: number): TrackSection | undefined {
  if (!sections) return undefined;
  return sections.find(s => pct >= s.startPct && pct <= s.endPct);
}
