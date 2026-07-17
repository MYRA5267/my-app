import React, { useState, useEffect, useRef, useCallback, useMemo, useId, createContext, useContext } from "react";
import { motion, AnimatePresence } from "motion/react";
import { DoorOpen, Mic2, Repeat2, GitBranch, Flag, type LucideIcon } from "lucide-react";
import type { Track } from "./data";
import { useLang } from "./i18n";
import type { SectionKind, TrackSection } from "./structure";

// ─── Токены ───────────────────────────────────────────────────────────────────

export const F = {
  d: "'Sora', sans-serif",
  b: "'Plus Jakarta Sans', sans-serif",
  m: "'IBM Plex Mono', monospace",
  s: "'Sora', sans-serif",
};

// ─── Иконки соцвходов ─────────────────────────────────────────────────────────

/** Официальный мультицветный логотип Google */
export function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}

/** Значок VK — фирменный синий квадрат с логотипом */
export function VKIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="7" fill="#0077FF" />
      <text x="12" y="16.5" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="11.5" fill="#fff">VK</text>
    </svg>
  );
}

/** Значок Яндекса — фирменный красный круг с «Я» */
export function YandexIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="12" fill="#FC3F1D" />
      <text x="12.3" y="17" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="14" fill="#fff">Я</text>
    </svg>
  );
}

// ─── Темы (тёмная / светлая) ──────────────────────────────────────────────────

export type ThemeName = "dark" | "light" | "neon";

// Фирменный стиль «глубина + витраж + перламутр»: тёмный сине-фиолетовый фон
// с авророй, молочное стекло с яркой верхней кромкой (--glass-edge) и один
// узнаваемый градиент-«перелив» (--brand-grad: фиолет → небо → жемчужная роза)
// для логотипа и брендовых акцентов
export const THEMES: Record<ThemeName, Record<string, string>> = {
  dark: {
    "--fg": "#f2f2f8",
    "--wash": "#ffffff",
    "--bg": "#020207",
    "--bg2": "#05050d",
    "--sheet": "rgba(8,8,18,0.95)",
    "--island": "rgba(9,9,19,0.84)",
    "--panel": "rgba(12,12,24,0.82)",
    "--glass-bg": "rgba(255,255,255,0.055)",
    "--glass-border": "rgba(255,255,255,0.10)",
    "--glass-edge": "rgba(255,255,255,0.19)",
    "--glass-shadow": "0 14px 40px rgba(0,0,0,0.46)",
    "--brand-grad": "linear-gradient(105deg, #a78bfa 0%, #7dd3fc 48%, #f6b8c8 100%)",
    "--cover-filter": "blur(90px) saturate(1.6) brightness(0.22)",
    "--dim": "rgba(2,2,7,0.66)",
    "--aurora-fade": "78%",
  },
  light: {
    // Светлая тема: настоящий белый глянцевый glass + видимая тень вместо еле
    // заметного 5% чёрного тона на почти белом фоне (раньше выглядело блёкло).
    "--fg": "#181820",
    "--wash": "#0d0d18",
    "--bg": "#eceef8",
    "--bg2": "#ffffff",
    "--sheet": "rgba(255,255,255,0.92)",
    "--island": "rgba(255,255,255,0.88)",
    "--panel": "rgba(255,255,255,0.92)",
    "--glass-bg": "rgba(255,255,255,0.62)",
    "--glass-border": "rgba(30,20,60,0.12)",
    "--glass-edge": "rgba(255,255,255,0.95)",
    "--glass-shadow": "0 1px 2px rgba(30,20,60,0.05), 0 12px 28px rgba(30,20,60,0.09)",
    "--brand-grad": "linear-gradient(105deg, #7c3aed 0%, #0284c7 48%, #d3728f 100%)",
    "--cover-filter": "blur(70px) saturate(1.55) brightness(1.08) opacity(0.32)",
    "--dim": "rgba(30,20,55,0.38)",
    "--aurora-fade": "56%",
  },
  // Неоновая тема — эксклюзив MYRA Plus: глубокий сине-фиолетовый фон,
  // неоновые кромки стекла. Единственная тема, закрытая тарифом
  neon: {
    "--fg": "#eef2ff",
    "--wash": "#a5b4fc",
    "--bg": "#020112",
    "--bg2": "#070420",
    "--sheet": "rgba(10,6,34,0.94)",
    "--island": "rgba(12,8,38,0.82)",
    "--panel": "rgba(16,10,46,0.78)",
    "--glass-bg": "rgba(129,140,248,0.08)",
    "--glass-border": "rgba(129,140,248,0.22)",
    "--glass-edge": "rgba(165,180,252,0.5)",
    "--glass-shadow": "0 10px 34px rgba(76,29,149,0.35)",
    "--brand-grad": "linear-gradient(105deg, #a5b4fc 0%, #67e8f9 48%, #f0abfc 100%)",
    "--cover-filter": "blur(90px) saturate(2.1) brightness(0.24)",
    "--dim": "rgba(2,1,18,0.6)",
    "--aurora-fade": "82%",
  },
};

export const ThemeCtx = createContext<{ theme: ThemeName; toggleTheme: () => void }>({ theme: "dark", toggleTheme: () => {} });
export const useTheme = () => useContext(ThemeCtx);

/**
 * "Слабая среда" — это ДВЕ разные оси, а не одна: слабое железо (мало ядер/
 * памяти) — и отдельно Android WebView (наш APK через Capacitor), у которого
 * компоновка backdrop-filter объективно хуже, чем в обычном мобильном
 * Chrome, НЕЗАВИСИМО от мощности процессора — это ограничение слоёв
 * GPU-композитора WebView, а не вычислительная мощность. Поэтому даже на
 * недорогом-но-не-слабом телефоне (проходит проверку по ядрам/памяти) полная
 * графика внутри WebView может мигать/пропадать — то, что раньше объясняли
 * только "слабым железом", на самом деле в основном это.
 */
export function isWeakEnvironment(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const weakHardware = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  // "; wv)" — стандартный маркер Android System WebView в UA (обычный Chrome
  // для Android его не проставляет); window.Capacitor — тот же сигнал для APK
  const androidWebView = /; wv\)/.test(navigator.userAgent) || "Capacitor" in window;
  return weakHardware || reducedMotion || androidWebView;
}

// Прогресс воспроизведения (целый %) отдельным контекстом: его потребляют
// только точечные виджеты (hero-волна Прилива, волна сайдбара), а экраны
// не получают progress пропом — и не перерисовываются целиком каждый тик
export const ProgressCtx = createContext(0);
export const useProgress = () => useContext(ProgressCtx);

export const GLASS: React.CSSProperties = {
  background: "var(--glass-bg)",
  backdropFilter: "blur(24px) saturate(1.6)",
  WebkitBackdropFilter: "blur(24px) saturate(1.6)",
  border: "1px solid var(--glass-border)",
  // Яркая верхняя кромка — «витринное» стекло: свет как будто падает сверху.
  // Компоненты, переопределяющие border целиком, гасят и её — это ожидаемо
  borderTop: "1px solid var(--glass-edge)",
  boxShadow: "var(--glass-shadow)",
};

/** Фиксированный светлый текст для карточек с ВСЕГДА тёмным фоном (обложка/градиент
    трека) — они не подстраиваются под тему, поэтому не должны наследовать var(--fg),
    иначе в светлой теме текст становится нечитаемым на тёмном фоне */
export const ON_DARK = "#f4f4fa";
export const onDark = (pct: number) => `rgba(244,244,250,${pct / 100})`;

/** Копирует текст в буфер обмена с запасным вариантом для WebView без Clipboard API */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

/** Короткий уникальный код приглашения (демо, без бэкенда) */
export function genInviteCode(): string {
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).toUpperCase();
}

/** Хендл по умолчанию из имени пользователя — "Confirm Flow Test" → "@confirm_flow_test" */
export function deriveHandle(name: string): string {
  const slug = name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-zа-яё0-9_]/gi, "");
  return "@" + (slug || "myra_user");
}

export const SPRING = { type: "spring" as const, damping: 26, stiffness: 320 };

export const fmtSec = (sec: number) => {
  if (!isFinite(sec) || sec < 0) sec = 0;
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
};

// ─── Аудио-движок ─────────────────────────────────────────────────────────────

// Два аудиоэлемента: при смене трека старый плавно затухает, новый нарастает.
// getFade() читает настройку кроссфейда из профиля.
/** Пресеты обработки под каждый уровень качества: срез верхних частот + компенсация громкости.
    Честная симуляция через Web Audio API — реального перекодирования потока нет,
    но звук на выходе действительно меняется, а не только подпись в UI. */
const QUALITY_DSP = [
  { freq: 7000,  gain: 0.92 }, // AAC 256 — заметно приглушённые верха, как у лёгкого lossy-сжатия
  { freq: 20000, gain: 1 },    // FLAC — без обработки, полный диапазон
  { freq: 20000, gain: 1.1 },  // Hi-Res 24-bit — чуть больше воздуха и громкости
];

export function useAudio(onEnded: () => void, getFade: () => boolean = () => true) {
  const players = useRef<[HTMLAudioElement, HTMLAudioElement] | null>(null);
  const activeIdx = useRef(0);
  const fadeRaf = useRef<number | null>(null);
  const volRef = useRef(0.75);
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;
  const fadeRef = useRef(getFade);
  fadeRef.current = getFade;
  const audioCtxRef = useRef<AudioContext | null>(null);
  const filtersRef = useRef<[BiquadFilterNode, BiquadFilterNode] | null>(null);
  const qualityGainsRef = useRef<[GainNode, GainNode] | null>(null);
  const qualityRef = useRef(1);

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.75);

  // Резервный режим: если файл не грузится (нет сети), прогресс идёт по таймеру —
  // волны, орб и текст всё равно живут.
  const simRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const modeRef = useRef<"real" | "sim">("real");
  const SIM_DURATION = 226;

  const active = () => players.current?.[activeIdx.current];

  const stopSim = useCallback(() => {
    if (simRef.current) { clearInterval(simRef.current); simRef.current = null; }
  }, []);

  const startSim = useCallback(() => {
    modeRef.current = "sim";
    setDuration(SIM_DURATION);
    setPlaying(true);
    stopSim();
    simRef.current = setInterval(() => {
      setProgress(p => {
        const np = p + (100 / SIM_DURATION) * 0.5;
        if (np >= 100) { endedRef.current(); return 0; }
        return np;
      });
    }, 500);
  }, [stopSim]);

  const stopFade = () => {
    if (fadeRaf.current !== null) { cancelAnimationFrame(fadeRaf.current); fadeRaf.current = null; }
  };

  useEffect(() => {
    const mk = () => { const a = new Audio(); a.preload = "auto"; a.volume = 0.75; return a; };
    const pair: [HTMLAudioElement, HTMLAudioElement] = [mk(), mk()];
    players.current = pair;

    // Реальная DSP-цепочка (не просто смена подписи): каждый плеер идёт через
    // фильтр низких частот + компенсирующий gain, которые двигает setQuality
    try {
      const AudioCtxCls = window.AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new AudioCtxCls();
      audioCtxRef.current = ctx;
      const chains = pair.map(a => {
        const src = ctx.createMediaElementSource(a);
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        const preset = QUALITY_DSP[qualityRef.current] ?? QUALITY_DSP[1];
        filter.frequency.value = preset.freq;
        const gain = ctx.createGain();
        gain.gain.value = preset.gain;
        src.connect(filter).connect(gain).connect(ctx.destination);
        return { filter, gain };
      });
      filtersRef.current = [chains[0].filter, chains[1].filter];
      qualityGainsRef.current = [chains[0].gain, chains[1].gain];
    } catch {
      // Web Audio недоступен (старый браузер и т.п.) — просто играем без DSP
    }

    const handlers = pair.map(a => {
      const isActive = () => a === active();
      const onTime = () => { if (!isActive()) return; const p = a.duration ? (a.currentTime / a.duration) * 100 : 0; setProgress(prev => Math.abs(p - prev) < 0.35 && p > prev ? prev : p); };
      const onMeta = () => { if (isActive()) setDuration(a.duration || 0); };
      const onEnd = () => { if (isActive()) endedRef.current(); };
      const onPlay = () => { if (isActive()) { modeRef.current = "real"; stopSim(); setPlaying(true); } };
      const onPause = () => { if (isActive() && modeRef.current === "real" && fadeRaf.current === null) setPlaying(false); };
      const onErr = () => { if (isActive() && a.src) startSim(); };
      a.addEventListener("timeupdate", onTime);
      a.addEventListener("loadedmetadata", onMeta);
      a.addEventListener("ended", onEnd);
      a.addEventListener("play", onPlay);
      a.addEventListener("pause", onPause);
      a.addEventListener("error", onErr);
      return () => {
        a.pause();
        a.removeEventListener("timeupdate", onTime);
        a.removeEventListener("loadedmetadata", onMeta);
        a.removeEventListener("ended", onEnd);
        a.removeEventListener("play", onPlay);
        a.removeEventListener("pause", onPause);
        a.removeEventListener("error", onErr);
        a.src = "";
      };
    });
    return () => {
      stopSim(); stopFade(); handlers.forEach(h => h());
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      filtersRef.current = null;
      qualityGainsRef.current = null;
    };
  }, [startSim, stopSim]);

  const load = useCallback((url: string) => {
    stopSim();
    modeRef.current = "real";
    // Контекст стартует в suspended-состоянии, пока не будет жеста пользователя —
    // клик по треку как раз им и является
    if (audioCtxRef.current?.state === "suspended") audioCtxRef.current.resume().catch(() => {});
    const pair = players.current;
    if (!pair) return;
    const cur = pair[activeIdx.current];
    const wantFade = fadeRef.current() && !cur.paused && cur.src;

    stopFade();
    setProgress(0);

    if (!wantFade) {
      cur.pause();
      cur.src = url;
      cur.currentTime = 0;
      cur.volume = volRef.current;
      cur.play().catch(() => startSim());
      return;
    }

    // Кроссфейд: новый трек стартует на нуле громкости и нарастает, старый затухает
    const nextIdx = 1 - activeIdx.current;
    const nxt = pair[nextIdx];
    nxt.src = url;
    nxt.currentTime = 0;
    nxt.volume = 0;
    activeIdx.current = nextIdx;
    nxt.play().catch(() => startSim());

    const durationMs = 1400;
    const startedAt = performance.now();
    const fadeFrame = (now: number) => {
      const k = Math.min(1, (now - startedAt) / durationMs);
      nxt.volume = volRef.current * k;
      cur.volume = volRef.current * (1 - k);
      if (k >= 1) {
        fadeRaf.current = null;
        cur.pause();
        cur.src = "";
        cur.volume = volRef.current;
      } else {
        fadeRaf.current = requestAnimationFrame(fadeFrame);
      }
    };
    fadeRaf.current = requestAnimationFrame(fadeFrame);
  }, [startSim, stopSim]);

  const toggle = useCallback(() => {
    if (audioCtxRef.current?.state === "suspended") audioCtxRef.current.resume().catch(() => {});
    if (modeRef.current === "sim") {
      if (simRef.current) { stopSim(); setPlaying(false); }
      else startSim();
      return;
    }
    const a = active();
    if (!a || !a.src) return;
    if (a.paused) a.play().catch(() => startSim());
    else a.pause();
  }, [startSim, stopSim]);

  const pause = useCallback(() => {
    if (modeRef.current === "sim") { stopSim(); setPlaying(false); return; }
    active()?.pause();
  }, [stopSim]);

  const seek = useCallback((pct: number) => {
    if (modeRef.current === "sim") { setProgress(pct); return; }
    const a = active();
    if (!a || !a.duration) return;
    a.currentTime = (pct / 100) * a.duration;
    setProgress(pct);
  }, []);

  const setVolume = useCallback((v: number) => {
    volRef.current = v;
    const a = active();
    if (a && fadeRaf.current === null) a.volume = v;
    setVolumeState(v);
  }, []);

  // Реально меняет звук под выбранное качество (0 = AAC 256, 1 = FLAC, 2 = Hi-Res) —
  // плавно двигает срез фильтра и компенсирующую громкость, чтобы не было щелчка
  const setQuality = useCallback((idx: number) => {
    qualityRef.current = idx;
    const preset = QUALITY_DSP[idx] ?? QUALITY_DSP[1];
    const ctx = audioCtxRef.current;
    const now = ctx?.currentTime ?? 0;
    filtersRef.current?.forEach(f => f.frequency.setTargetAtTime(preset.freq, now, 0.08));
    qualityGainsRef.current?.forEach(g => g.gain.setTargetAtTime(preset.gain, now, 0.08));
  }, []);

  // Стабильная ссылка: без useMemo новый объект на каждый рендер обесценивал
  // React.memo всех экранов (проп onPlay пересоздавался на каждый тик прогресса)
  return useMemo(
    () => ({ playing, progress, duration, volume, load, toggle, pause, seek, setVolume, setQuality }),
    [playing, progress, duration, volume, load, toggle, pause, seek, setVolume, setQuality],
  );
}

export type AudioApi = ReturnType<typeof useAudio>;

// ─── Примитивы ────────────────────────────────────────────────────────────────

/** 3D-наклон за курсором */
export function TiltCard({ children, className, style, max = 9, onClick }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties; max?: number; onClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const pos = useRef({ rx: 0, ry: 0, active: false });

  // Наклон — прямой rAF-мутацией style, без setState на каждый pointermove
  // (ре-рендер поддерева на 60-120 Гц) и без постоянного willChange: каждый
  // «вечный» willChange — это принудительный слой GPU-композитора WebView,
  // а их память и есть причина мигающих элементов на слабых телефонах
  const apply = () => {
    raf.current = 0;
    const el = ref.current;
    if (!el) return;
    const { rx, ry, active } = pos.current;
    el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)${active ? " scale3d(1.015,1.015,1.015)" : ""}`;
    el.style.transition = active ? "transform 0.08s ease-out" : "transform 0.5s cubic-bezier(0.22,1,0.36,1)";
    el.style.willChange = active ? "transform" : "auto";
  };
  const schedule = () => { if (!raf.current) raf.current = requestAnimationFrame(apply); };

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || e.pointerType === "touch") return;
    const r = el.getBoundingClientRect();
    pos.current = { rx: -((e.clientY - r.top) / r.height - 0.5) * max, ry: ((e.clientX - r.left) / r.width - 0.5) * max, active: true };
    schedule();
  };

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  return (
    <div
      ref={ref}
      className={className}
      onClick={onClick}
      onPointerMove={onMove}
      onPointerLeave={() => { pos.current = { rx: 0, ry: 0, active: false }; schedule(); }}
      style={{ ...style, transformStyle: "preserve-3d" }}
    >
      {children}
    </div>
  );
}

/** Живой aurora-фон */
export const Aurora = React.memo(function Aurora({ c2, opacity = 1 }: { c2: string; opacity?: number }) {
  return (
    <div className="fx-aurora absolute inset-0 overflow-hidden pointer-events-none" style={{ opacity }}>
      <div className="absolute rounded-full" style={{ width: "70%", height: "70%", left: "-10%", top: "-20%", background: `radial-gradient(circle, ${c2}30 0%, transparent 65%)`, filter: "blur(40px)", animation: "drift1 14s ease-in-out infinite" }} />
      <div className="absolute rounded-full" style={{ width: "60%", height: "60%", right: "-15%", top: "10%", background: "radial-gradient(circle, rgba(139,92,246,0.22) 0%, transparent 65%)", filter: "blur(40px)", animation: "drift2 18s ease-in-out infinite" }} />
      <div className="absolute rounded-full" style={{ width: "55%", height: "55%", left: "20%", bottom: "-25%", background: `radial-gradient(circle, ${c2}22 0%, transparent 65%)`, filter: "blur(40px)", animation: "drift3 16s ease-in-out infinite" }} />
    </div>
  );
});

/** Фон приложения — обложка + aurora */
export const DynamicBg = React.memo(function DynamicBg({ track }: { track: Track }) {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      <AnimatePresence>
        <motion.img
          key={track.id}
          src={track.img}
          alt=""
          className="fx-heavy absolute inset-0 w-full h-full object-cover"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4 }}
          style={{ filter: "var(--cover-filter)", transform: "scale(1.2)" }}
        />
      </AnimatePresence>
      <Aurora c2={track.c2} opacity={0.7} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 0%, var(--bg) var(--aurora-fade))" }} />
      <div className="absolute bottom-0 left-0 right-0 h-72" style={{ background: "linear-gradient(to top, var(--bg) 0%, transparent 100%)" }} />
    </div>
  );
});

/** Волновая дорожка с сиком; playing — бары у плейхеда пульсируют */
export const Waveform = React.memo(function Waveform({ progress, color, onSeek, height = 52, seed = 7, bars = 72, dim = false, playing = false }: {
  progress: number; color: string; onSeek?: (p: number) => void; height?: number; seed?: number; bars?: number; dim?: boolean; playing?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // Плавное перетекание: показываемый прогресс догоняет реальный через rAF.
  // Цикл ОСТАНАВЛИВАЕТСЯ, когда догнал (раньше крутился вечно — каждый
  // смонтированный Waveform был пожизненным 60 Гц-пробуждателем главного
  // потока, даже на паузе); эффект перезапустится по следующему progress
  const [disp, setDisp] = useState(progress);
  const dispRef = useRef(progress);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const target = progress;
      const d = dispRef.current;
      const nd = Math.abs(target - d) < 0.08 ? target : d + (target - d) * 0.14;
      if (nd !== d) { dispRef.current = nd; setDisp(nd); }
      raf = nd === target ? 0 : requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [progress]);

  const heights = useMemo(
    () => Array.from({ length: bars }, (_, i) => {
      const v = Math.abs(Math.sin(i * seed * 0.37 + seed) * 0.6 + Math.sin(i * 0.9 + seed * 2) * 0.4);
      return 0.16 + v * 0.84;
    }),
    [bars, seed],
  );

  const pctFromEvent = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100));
  };

  return (
    <div
      ref={ref}
      className="flex items-center gap-[2px] select-none"
      style={{ height, cursor: onSeek ? "pointer" : "default", touchAction: "none" }}
      onPointerDown={onSeek && (e => { dragging.current = true; (e.target as HTMLElement).setPointerCapture(e.pointerId); onSeek(pctFromEvent(e.clientX)); })}
      onPointerMove={onSeek && (e => { if (dragging.current) onSeek(pctFromEvent(e.clientX)); })}
      onPointerUp={() => { dragging.current = false; }}
    >
      {heights.map((h, i) => {
        const played = (i / bars) * 100 <= disp;
        const headIdx = Math.floor((disp / 100) * bars);
        const nearHead = playing && Math.abs(i - headIdx) <= 2;
        return (
          <div
            key={i}
            className="flex-1 rounded-full"
            style={{
              height: `${h * 100}%`,
              minWidth: 2,
              background: played ? `linear-gradient(to top, ${color}, ${color}88)` : dim ? "color-mix(in srgb, var(--wash) 08%, transparent)" : "color-mix(in srgb, var(--wash) 13%, transparent)",
              transition: "background 0.2s",
              animation: nearHead ? `waveBounce ${0.45 + (i % 3) * 0.12}s ease-in-out infinite alternate` : "none",
            }}
          />
        );
      })}
    </div>
  );
});

/**
 * Поток частиц на canvas — вместо DOM-баров: один слой рисования дешевле для
 * WebView-композитора, чем десятки div'ов, и даёт живую органическую волну
 * без backdrop-filter/blur-элементов. onSeek опционален: без него — чисто
 * декоративный (как на главной), с ним — полноценный скраббер (как в плеере).
 */
export const ParticleWave = React.memo(function ParticleWave({ progress, playing, color, height = 40, onSeek }: {
  progress: number; playing: boolean; color: string; height?: number; onSeek?: (p: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef(false);
  const pctFromEvent = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100));
  };
  const liveRef = useRef({ progress, playing });
  liveRef.current = { progress, playing };
  const particlesRef = useRef<{ x: number; phase: number; speed: number; size: number }[]>([]);
  const dprRef = useRef(1);
  const tRef = useRef(0);

  // Настройка канваса и частиц — на смену трека/цвета (пересоздаёт узор,
  // это ожидаемо: новый трек — новый рисунок волны)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const simple = !!document.querySelector(".fx-simple");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    dprRef.current = dpr;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, r.width * dpr);
      canvas.height = Math.max(1, r.height * dpr);
    };
    resize();
    const N = simple ? 34 : 110;
    particlesRef.current = Array.from({ length: N }, (_, i) => ({
      x: i / N,
      phase: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 0.7,
      size: 0.8 + Math.random() * 1.6,
    }));
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [color]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { progress: prog, playing: isPlaying } = liveRef.current;
    const dpr = dprRef.current;
    const w = canvas.width, h = canvas.height;
    const t = tRef.current;
    ctx.clearRect(0, 0, w, h);
    ctx.shadowBlur = 5 * dpr;
    ctx.shadowColor = color;
    for (const p of particlesRef.current) {
      const wobble = Math.sin(p.x * 11 + t * p.speed) * 0.32 + Math.sin(p.x * 3.2 - t * 0.6) * 0.24;
      const y = h / 2 + wobble * (h * 0.4);
      const x = p.x * w;
      const ahead = p.x * 100 > prog;
      const shimmer = 0.55 + 0.45 * Math.sin(p.phase + t * p.speed * 2.2);
      let alpha = (ahead ? 0.28 : 1) * shimmer;
      if (!isPlaying) alpha *= 0.5;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x, y, p.size * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }, [color]);

  // Цикл анимации — работает ТОЛЬКО пока играет музыка; на паузе/в fx-simple
  // рисуем один статичный кадр и не планируем rAF вообще (раньше цикл крутился
  // вечно даже на паузе — тот самый пожизненный 60 Гц-пробуждатель, который уже
  // однажды лечили у обычного Waveform)
  useEffect(() => {
    const simple = !!document.querySelector(".fx-simple");
    if (simple || !playing) { draw(); return; }
    let raf = 0;
    const loop = () => {
      if (!document.hidden) { tRef.current += 0.016; draw(); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, draw]);

  // На паузе прогресс всё равно может меняться (перетаскивание скраббера) —
  // без rAF-цикла перерисовываем кадр вручную на каждое такое изменение
  useEffect(() => {
    if (!playing) draw();
  }, [progress, playing, draw]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full block"
      style={{ height, cursor: onSeek ? "pointer" : "default", touchAction: onSeek ? "none" : undefined }}
      onPointerDown={onSeek && (e => { dragging.current = true; (e.target as HTMLElement).setPointerCapture(e.pointerId); onSeek(pctFromEvent(e)); })}
      onPointerMove={onSeek && (e => { if (dragging.current) onSeek(pctFromEvent(e)); })}
      onPointerUp={() => { dragging.current = false; }}
    />
  );
});

// ─── Структура трека на волне (эвристика, см. structure.ts) ────────────────
// Цвета/иконки — просто устойчивый визуальный словарь секций, одинаковый для
// всех треков, чтобы пользователь быстро научился узнавать «розовое — припев»
// и т.п. К анализу ИИ это не имеет отношения — только UI-соответствие меткам.
export const SECTION_COLORS: Record<SectionKind, string> = {
  intro: "#64748b",
  verse: "#38bdf8",
  chorus: "#f472b6",
  bridge: "#a78bfa",
  outro: "#94a3b8",
};

const SECTION_ICONS: Record<SectionKind, LucideIcon> = {
  intro: DoorOpen,
  verse: Mic2,
  chorus: Repeat2,
  bridge: GitBranch,
  outro: Flag,
};

/** Полоска цветных подписанных секций структуры трека под волной; рендерит null, пока анализ не готов или не удался */
export const TrackStructureBar = React.memo(function TrackStructureBar({ sections, height = 22, compact = false }: {
  sections: TrackSection[] | null; height?: number; compact?: boolean;
}) {
  const { t } = useLang();
  if (!sections || sections.length === 0) return null;

  return (
    <div className="flex gap-[2px] select-none" style={{ height }}>
      {sections.map((s, i) => {
        const Icon = SECTION_ICONS[s.kind];
        const width = Math.max(s.endPct - s.startPct, 0.5);
        const showLabel = !compact && width >= 10;
        const showIcon = width >= 5;
        return (
          <div
            key={i}
            title={t(`wave.${s.kind}`)}
            className="flex items-center justify-center gap-1 overflow-hidden rounded-md truncate"
            style={{
              flex: `${width} 0 0%`,
              background: `${SECTION_COLORS[s.kind]}2e`,
              border: `1px solid ${SECTION_COLORS[s.kind]}55`,
              color: SECTION_COLORS[s.kind],
            }}
          >
            {showIcon && <Icon size={compact ? 10 : 11} />}
            {showLabel && <span className="text-[9px] font-semibold" style={{ fontFamily: F.m }}>{t(`wave.${s.kind}`)}</span>}
          </div>
        );
      })}
    </div>
  );
});

/** Маленький бейдж «в какой секции оставлен комментарий» — по попаданию pct в найденный диапазон */
export const SectionBadge = React.memo(function SectionBadge({ section }: { section: TrackSection | undefined }) {
  const { t } = useLang();
  if (!section) return null;
  const Icon = SECTION_ICONS[section.kind];
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md flex-shrink-0"
      style={{ background: `${SECTION_COLORS[section.kind]}22`, color: SECTION_COLORS[section.kind], fontFamily: F.m }}
    >
      <Icon size={9} />
      {t(`wave.${section.kind}`)}
    </span>
  );
});

/** Catmull-Rom → кубический Безье: гладкая кривая через все точки без внешних либ */
function smoothPath(points: [number, number][]): string {
  if (points.length < 2) return "";
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/** Интерактивный график: жми и веди пальцем/курсором, чтобы посмотреть значение
    в любой точке — с плавающей подсказкой и вертикальной направляющей.
    variant="bars" — объёмные столбики по дням вместо сглаженной кривой */
export function InteractiveChart({ data, labels, color, height = 84, markIndex, valueLabel, variant = "line" }: {
  data: number[]; labels?: string[]; color: string; height?: number; markIndex?: number; valueLabel?: (v: number, i: number) => string; variant?: "line" | "bars";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [active, setActive] = useState<number | null>(null);
  const gradId = `ic-area-${useId()}`;
  const barGradId = `ic-bar-${useId()}`;

  const W = 300, H = 100, PAD = 8;
  const { pts, path, areaPath, barW } = useMemo(() => {
    const max = Math.max(...data), min = Math.min(0, ...data);
    const range = max - min || 1;
    const pts: [number, number][] = data.map((v, i) => [
      data.length > 1 ? (i / (data.length - 1)) * W : W / 2,
      PAD + (1 - (v - min) / range) * (H - PAD * 2),
    ]);
    const path = smoothPath(pts);
    const areaPath = `${path} L${pts[pts.length - 1][0]},${H} L${pts[0][0]},${H} Z`;
    const barW = Math.max(1.5, (W / data.length) * 0.62);
    return { pts, path, areaPath, barW };
  }, [data]);

  const idxFromClientX = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return Math.round(pct * (data.length - 1));
  };

  const shownIdx = active ?? null;
  const shownPt = shownIdx !== null ? pts[shownIdx] : null;
  const tipPct = shownPt ? Math.min(94, Math.max(6, (shownPt[0] / W) * 100)) : 0;

  return (
    <div
      ref={ref}
      className="relative select-none"
      style={{ touchAction: "none", cursor: "crosshair" }}
      onClick={e => e.stopPropagation()}
      onPointerDown={e => { dragging.current = true; (e.target as HTMLElement).setPointerCapture(e.pointerId); setActive(idxFromClientX(e.clientX)); }}
      onPointerMove={e => { if (dragging.current) setActive(idxFromClientX(e.clientX)); else if (e.pointerType !== "touch") setActive(idxFromClientX(e.clientX)); }}
      onPointerUp={e => { dragging.current = false; if (e.pointerType === "touch") setActive(null); }}
      onPointerLeave={() => { if (!dragging.current) setActive(null); }}
    >
      <div className="relative" style={{ height: 26 }}>
        {shownPt && (
          <div
            className="absolute px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap pointer-events-none"
            style={{
              left: `${tipPct}%`, transform: "translateX(-50%)", top: 0,
              background: "var(--panel)", backdropFilter: "blur(20px)",
              border: "1px solid color-mix(in srgb, var(--wash) 14%, transparent)",
              color: "var(--fg)", fontFamily: F.m, boxShadow: "0 8px 20px rgba(0,0,0,0.28)",
            }}
          >
            {valueLabel ? valueLabel(data[shownIdx!], shownIdx!) : data[shownIdx!]}{labels?.[shownIdx!] ? ` · ${labels[shownIdx!]}` : ""}
          </div>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={barGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.95" />
            <stop offset="100%" stopColor={color} stopOpacity="0.4" />
          </linearGradient>
        </defs>
        {variant === "bars" ? (
          pts.map((p, i) => (
            <rect
              key={i}
              x={p[0] - barW / 2}
              y={p[1]}
              width={barW}
              height={Math.max(0, H - p[1])}
              rx={Math.min(2.2, barW / 2)}
              fill={shownIdx === i ? color : `url(#${barGradId})`}
              opacity={shownIdx === null || shownIdx === i ? 1 : 0.55}
              style={{ transition: "opacity 0.15s" }}
            />
          ))
        ) : (
          <>
            <path d={areaPath} fill={`url(#${gradId})`} />
            <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </>
        )}
        {markIndex != null && shownIdx === null && pts[markIndex] && variant === "line" && (
          <circle cx={pts[markIndex][0]} cy={pts[markIndex][1]} r="2.4" fill="#fff" stroke={color} strokeWidth="1.5" />
        )}
        {shownPt && (
          <>
            <line x1={shownPt[0]} y1={0} x2={shownPt[0]} y2={H} stroke={color} strokeWidth="1" strokeDasharray="2,3" opacity="0.35" vectorEffect="non-scaling-stroke" />
            {variant === "line" && <circle cx={shownPt[0]} cy={shownPt[1]} r="3.4" fill="#fff" stroke={color} strokeWidth="2" />}
          </>
        )}
      </svg>
    </div>
  );
}

/** Живая частотная сфера — объёмная: параллакс, стеклянная сфера с эквалайзером,
    тень-подиум. Кольца-декорации и орбитальные частицы убраны — читались как
    случайный шум поверх основной сферы, а не как часть неё.
    React.memo + округление progress до целого % на вызывающей стороне: без этого
    компонент (48 баров под backdrop-filter) переотрисовывался бы на каждый тик
    прогресса и ощутимо подвешивал слабые устройства. */
export const FrequencyOrb = React.memo(function FrequencyOrb({ track, playing, progress }: { track: Track; playing: boolean; progress: number }) {
  const bars = 48;
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });

  // Высота бара — статична для трека, от progress не зависит, поэтому пересчитывать
  // все 48 значений на каждый тик не нужно (раньше recomputed каждый раз через progress
  // в зависимостях — самая частая причина лишних ре-рендеров всех 48 узлов).
  const heights = useMemo(
    () => Array.from({ length: bars }, (_, i) => Math.abs(Math.sin(i * 0.42 + track.id) * 0.55 + Math.sin(i * 1.1) * 0.35) * 0.78 + 0.22),
    [bars, track.id],
  );
  const headIdx = (progress / 100) * bars;

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || e.pointerType === "touch") return;
    const r = el.getBoundingClientRect();
    setTilt({ rx: -((e.clientY - r.top) / r.height - 0.5) * 16, ry: ((e.clientX - r.left) / r.width - 0.5) * 16 });
  };

  return (
    <div
      ref={ref}
      className="relative flex items-center justify-center"
      style={{ width: 280, height: 300, perspective: 700 }}
      onPointerMove={onMove}
      onPointerLeave={() => setTilt({ rx: 0, ry: 0 })}
    >
      {/* Сцена с лёгким 3D-наклоном за курсором */}
      <div
        className="relative flex items-center justify-center"
        style={{
          width: 280, height: 280,
          transform: `rotateX(${8 + tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transformStyle: "preserve-3d",
          transition: "transform 0.35s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        {/* Дальний ореол — единственная декорация вокруг сферы, носит fx-orb:
            в режиме упрощённой графики гасится CSS-ом */}
        <motion.div
          animate={{ opacity: playing ? 0.8 : 0.3, scale: playing ? 1 : 0.9 }}
          transition={{ duration: 0.6 }}
          className="fx-orb absolute rounded-full"
          style={{ width: 272, height: 272, background: `radial-gradient(circle, ${track.c2}40 0%, transparent 66%)`, filter: "blur(28px)", animation: playing ? "orbPulse 3s ease-in-out infinite" : "none" }}
        />
        {/* Стеклянная сфера с эквалайзером */}
        <div className="absolute rounded-full flex items-center justify-center" style={{ width: 200, height: 200, background: "var(--glass-bg)", backdropFilter: "blur(20px)", border: `1px solid ${track.c2}30`, boxShadow: `0 0 70px ${track.c2}2e, inset 0 -18px 40px ${track.c2}14, inset 0 14px 30px color-mix(in srgb, var(--wash) 06%, transparent)` }}>
          {heights.map((h, i) => {
            const angle = (i / bars) * 360;
            const active = i <= headIdx;
            return (
              <div
                key={i}
                className="absolute origin-bottom rounded-full"
                style={{
                  width: 3,
                  height: `${h * 72}px`,
                  bottom: "50%",
                  left: "50%",
                  marginLeft: -1.5,
                  transform: `rotate(${angle}deg)`,
                  transformOrigin: "bottom center",
                  background: active ? `linear-gradient(to top, ${track.c2}, ${track.c2}55)` : "var(--glass-border)",
                  opacity: playing ? (active ? 1 : 0.45) : 0.3,
                  transition: "background 0.25s, opacity 0.4s",
                  boxShadow: active && playing ? `0 0 8px ${track.c2}66` : "none",
                  animation: playing && active ? `waveBounce ${0.5 + (i % 5) * 0.11}s ease-in-out infinite alternate` : "none",
                }}
              />
            );
          })}
          {/* Блик сверху — стеклянный объём */}
          <div className="fx-orb absolute rounded-full pointer-events-none" style={{ width: 150, height: 70, top: 14, background: "linear-gradient(to bottom, color-mix(in srgb, var(--wash) 10%, transparent), transparent)", filter: "blur(6px)", borderRadius: "50%" }} />
          <motion.div
            animate={{ scale: playing ? [1, 1.04, 1] : 1 }}
            transition={{ duration: 2, repeat: playing ? Infinity : 0, ease: "easeInOut" }}
            className="relative z-10 rounded-full overflow-hidden"
            style={{ width: 84, height: 84, border: `2px solid ${track.c2}55`, boxShadow: `0 10px 32px ${track.c2}55, 0 2px 8px rgba(0,0,0,0.4)` }}
          >
            <img src={track.img} alt="" className="w-full h-full object-cover" />
          </motion.div>
        </div>
      </div>
      {/* Тень-подиум под сферой */}
      <motion.div
        animate={{ opacity: playing ? 0.55 : 0.3, scaleX: playing ? 1 : 0.8 }}
        className="fx-orb absolute rounded-full"
        style={{ width: 170, height: 26, bottom: -6, background: `radial-gradient(ellipse, ${track.c2}55 0%, transparent 70%)`, filter: "blur(10px)" }}
      />
    </div>
  );
});

/** Индикатор «сейчас играет» */
export const EQ = React.memo(function EQ({ color, size = 12 }: { color: string; size?: number }) {
  return (
    <div className="flex items-end gap-[2px]" style={{ height: size }}>
      {[0, 1, 2].map(i => (
        <div key={i} className="w-[3px] rounded-full origin-bottom" style={{ height: size, background: color, animation: `eq${i + 1} ${0.5 + i * 0.13}s ease-in-out infinite alternate` }} />
      ))}
    </div>
  );
});

/** iOS-переключатель */
export function Toggle({ on, onChange, color }: { on: boolean; onChange: () => void; color: string }) {
  // Видимая дорожка остаётся 46×27 (как раньше), но кликабельная область
  // кнопки — полные 44px высотой: раньше тап-зона была ровно 27px, ниже
  // рекомендуемого минимума 44×44
  return (
    <button onClick={onChange} aria-pressed={on} className="relative flex-shrink-0" style={{ width: 46, height: 44 }}>
      <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full transition-colors duration-300" style={{ height: 27, background: on ? color : "color-mix(in srgb, var(--wash) 13%, transparent)" }} />
      <motion.div animate={{ x: on ? 20 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 32 }} className="absolute top-1/2 left-[3px] w-[21px] h-[21px] rounded-full bg-white" style={{ marginTop: -10.5, boxShadow: "0 2px 8px rgba(0,0,0,0.35)" }} />
    </button>
  );
}

/** Шторка снизу — общий контейнер оверлеев. center — компактный диалог по центру экрана */
export function Sheet({ open, onClose, children, z = 60, center = false, wide = false }: {
  open: boolean; onClose: () => void; children: React.ReactNode; z?: number; center?: boolean; wide?: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`fixed inset-0 flex justify-center ${center ? "items-center p-6" : "items-end lg:items-center"}`}
          style={{ zIndex: z, background: "var(--dim)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={center ? { scale: 0.9, opacity: 0, y: 14, rotateX: 5, transformPerspective: 900 } : { y: "12%", opacity: 0, scale: 0.98, rotateX: 4, transformPerspective: 1100 }}
            animate={{ y: 0, opacity: 1, scale: 1, rotateX: 0 }}
            exit={center ? { scale: 0.94, opacity: 0, y: 8 } : { y: "10%", opacity: 0, scale: 0.98 }}
            transition={SPRING}
            onClick={e => e.stopPropagation()}
            className={`w-full max-h-[92vh] overflow-y-auto ${center ? "max-w-xs rounded-[28px]" : wide ? "lg:max-w-4xl rounded-t-[30px] lg:rounded-[34px]" : "lg:max-w-md rounded-t-[30px] lg:rounded-[30px]"}`}
            style={{ background: "var(--sheet)", backdropFilter: "blur(40px) saturate(1.6)", WebkitBackdropFilter: "blur(40px) saturate(1.6)", border: "1px solid color-mix(in srgb, var(--wash) 11%, transparent)", boxShadow: center ? "0 30px 90px rgba(0,0,0,0.65)" : "0 -20px 80px rgba(0,0,0,0.6)", scrollbarWidth: "none" }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Адаптивная страница: скролл + центрированная колонка под телефон/планшет/ПК/ТВ.
    Нижний отступ учитывает safe-area-inset-bottom (см. .myra-page-scroll в
    theme.css) — раньше был фиксированный pb-44, и на устройствах с высоким
    home-indicator (iPhone) последний пункт экрана мог упираться в Mini Player */
export function Page({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`myra-page-scroll overflow-y-auto h-full ${className}`} style={{ scrollbarWidth: "none" }}>
      <div className="mx-auto w-full max-w-[640px] md:max-w-[720px] lg:max-w-[860px] 2xl:max-w-[1040px]">
        {children}
      </div>
    </div>
  );
}

/** Диалог подтверждения (выход, удаление) */
export function ConfirmSheet({ open, onClose, title, sub, confirmLabel, cancelLabel, danger, onConfirm }: {
  open: boolean; onClose: () => void; title: string; sub: string; confirmLabel: string; cancelLabel: string; danger?: boolean; onConfirm: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} z={80} center>
      <div className="p-7 text-center">
        <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 20, letterSpacing: "-0.02em" }}>{title}</div>
        <div className="text-sm mt-2 mb-6" style={{ color: "color-mix(in srgb, var(--fg) 50%, transparent)", fontFamily: F.b }}>{sub}</div>
        <div className="flex gap-3">
          <motion.button whileTap={{ scale: 0.96 }} onClick={onClose} className="flex-1 py-3.5 rounded-full text-sm font-semibold" style={{ ...GLASS, fontFamily: F.b }}>
            {cancelLabel}
          </motion.button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={onConfirm} className="flex-1 py-3.5 rounded-full text-sm font-semibold" style={{ background: danger ? "linear-gradient(135deg, #ef4444, #f87171)" : "linear-gradient(135deg, #8b5cf6, #a78bfa)", color: "#fff", fontFamily: F.b }}>
            {confirmLabel}
          </motion.button>
        </div>
      </div>
    </Sheet>
  );
}
