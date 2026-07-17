import { useEffect, useRef } from "react";
import type { Track } from "./data";

// ─── Media Session: управление из шторки уведомлений и с локскрина ─────────
// Телефон показывает "сейчас играет" с обложкой и кнопками системно — без
// этого музыка из MYRA жила только внутри открытого приложения. Обработчики
// через ref: сами колбэки пересоздаются, а системе нужны живые ссылки.
// Полностью побочный эффект — ничего не возвращает, вызывается безусловно.
export function useMediaSession(params: {
  currentTrack: Track;
  playing: boolean;
  duration: number;
  progress: number;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (pct: number) => void;
}) {
  const { currentTrack, playing, duration, progress, toggle, next, prev, seek } = params;

  const mediaCtlRef = useRef({ toggle: () => {}, next: () => {}, prev: () => {}, seek: (_pct: number) => {}, duration: 0 });
  useEffect(() => {
    mediaCtlRef.current = { toggle, next, prev, seek, duration };
  }, [toggle, next, prev, seek, duration]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return; // старые WebView — просто без системной карточки
    const ms = navigator.mediaSession;
    ms.setActionHandler("play", () => mediaCtlRef.current.toggle());
    ms.setActionHandler("pause", () => mediaCtlRef.current.toggle());
    ms.setActionHandler("nexttrack", () => mediaCtlRef.current.next());
    ms.setActionHandler("previoustrack", () => mediaCtlRef.current.prev());
    // seekto — скраббер на локскрине/шторке уведомлений; без хендлера он есть,
    // но не двигает воспроизведение. Не все системы шлют его — оборачиваем в try
    try {
      ms.setActionHandler("seekto", (details) => {
        const dur = mediaCtlRef.current.duration;
        if (details.seekTime == null || !dur) return;
        mediaCtlRef.current.seek((details.seekTime / dur) * 100);
      });
    } catch {
      // "seekto" не поддержан этой платформой — остальные экшены всё равно работают
    }
    return () => {
      ms.setActionHandler("play", null);
      ms.setActionHandler("pause", null);
      ms.setActionHandler("nexttrack", null);
      ms.setActionHandler("previoustrack", null);
      try { ms.setActionHandler("seekto", null); } catch { /* см. выше */ }
    };
  }, []);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: currentTrack.album,
      // Обложки — data-URI (svg/png), системная карточка Android их понимает
      artwork: [{ src: currentTrack.img, sizes: "500x500" }],
    });
  }, [currentTrack]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }, [playing]);

  // Позиция для системного скраббера — без неё локскрин либо не показывает
  // прогресс, либо показывает статичный. duration=0 (трек ещё грузится/sim-режим
  // без реального файла) — setPositionState с нулевой длительностью кидает исключение
  useEffect(() => {
    if (!("mediaSession" in navigator) || !navigator.mediaSession.setPositionState) return;
    if (!duration || !isFinite(duration)) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        position: Math.min((progress / 100) * duration, duration),
        playbackRate: 1,
      });
    } catch {
      // позиция и длительность могут на мгновение разойтись при смене трека — не критично
    }
  }, [duration, progress]);
}
