import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Track } from "./data";

// ─── Токены ───────────────────────────────────────────────────────────────────

export const F = {
  d: "'Sora', sans-serif",
  b: "'Plus Jakarta Sans', sans-serif",
  m: "'IBM Plex Mono', monospace",
  s: "'Sora', sans-serif",
};

export const GLASS: React.CSSProperties = {
  background: "rgba(255,255,255,0.055)",
  backdropFilter: "blur(24px) saturate(1.6)",
  WebkitBackdropFilter: "blur(24px) saturate(1.6)",
  border: "1px solid rgba(255,255,255,0.09)",
};

export const SPRING = { type: "spring" as const, damping: 26, stiffness: 320 };

export const fmtSec = (sec: number) => {
  if (!isFinite(sec) || sec < 0) sec = 0;
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
};

// ─── Аудио-движок ─────────────────────────────────────────────────────────────

export function useAudio(onEnded: () => void) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.75);

  // Резервный режим: если файл не грузится (нет сети/стрим недоступен),
  // прогресс идёт по таймеру — волны, орб и текст всё равно живут.
  const simRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const modeRef = useRef<"real" | "sim">("real");
  const SIM_DURATION = 226;

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

  useEffect(() => {
    const a = new Audio();
    a.preload = "auto";
    a.volume = 0.75;
    audioRef.current = a;
    const onTime = () => setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0);
    const onMeta = () => setDuration(a.duration || 0);
    const onEnd = () => endedRef.current();
    const onPlay = () => { modeRef.current = "real"; stopSim(); setPlaying(true); };
    const onPause = () => { if (modeRef.current === "real") setPlaying(false); };
    const onErr = () => { if (a.src) startSim(); };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("error", onErr);
    return () => {
      a.pause();
      stopSim();
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("error", onErr);
      a.src = "";
    };
  }, [startSim, stopSim]);

  const load = useCallback((url: string) => {
    stopSim();
    modeRef.current = "real";
    const a = audioRef.current;
    if (!a) return;
    a.src = url;
    a.currentTime = 0;
    setProgress(0);
    a.play().catch(() => startSim());
  }, [startSim, stopSim]);

  const toggle = useCallback(() => {
    if (modeRef.current === "sim") {
      if (simRef.current) { stopSim(); setPlaying(false); }
      else startSim();
      return;
    }
    const a = audioRef.current;
    if (!a || !a.src) return;
    if (a.paused) a.play().catch(() => startSim());
    else a.pause();
  }, [startSim, stopSim]);

  const pause = useCallback(() => {
    if (modeRef.current === "sim") { stopSim(); setPlaying(false); return; }
    audioRef.current?.pause();
  }, [stopSim]);

  const seek = useCallback((pct: number) => {
    if (modeRef.current === "sim") { setProgress(pct); return; }
    const a = audioRef.current;
    if (!a || !a.duration) return;
    a.currentTime = (pct / 100) * a.duration;
    setProgress(pct);
  }, []);

  const setVolume = useCallback((v: number) => {
    const a = audioRef.current;
    if (a) a.volume = v;
    setVolumeState(v);
  }, []);

  return { playing, progress, duration, volume, load, toggle, pause, seek, setVolume };
}

export type AudioApi = ReturnType<typeof useAudio>;

// ─── Примитивы ────────────────────────────────────────────────────────────────

/** 3D-наклон за курсором */
export function TiltCard({ children, className, style, max = 9, onClick }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties; max?: number; onClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ rx: 0, ry: 0, active: false });

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || e.pointerType === "touch") return;
    const r = el.getBoundingClientRect();
    setT({ rx: -((e.clientY - r.top) / r.height - 0.5) * max, ry: ((e.clientX - r.left) / r.width - 0.5) * max, active: true });
  };

  return (
    <div
      ref={ref}
      className={className}
      onClick={onClick}
      onPointerMove={onMove}
      onPointerLeave={() => setT({ rx: 0, ry: 0, active: false })}
      style={{
        ...style,
        transform: `perspective(900px) rotateX(${t.rx}deg) rotateY(${t.ry}deg)${t.active ? " scale3d(1.015,1.015,1.015)" : ""}`,
        transition: t.active ? "transform 0.08s ease-out" : "transform 0.5s cubic-bezier(0.22,1,0.36,1)",
        transformStyle: "preserve-3d",
        willChange: "transform",
      }}
    >
      {children}
    </div>
  );
}

/** Живой aurora-фон */
export function Aurora({ c2, opacity = 1 }: { c2: string; opacity?: number }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ opacity }}>
      <div className="absolute rounded-full" style={{ width: "70%", height: "70%", left: "-10%", top: "-20%", background: `radial-gradient(circle, ${c2}30 0%, transparent 65%)`, filter: "blur(40px)", animation: "drift1 14s ease-in-out infinite" }} />
      <div className="absolute rounded-full" style={{ width: "60%", height: "60%", right: "-15%", top: "10%", background: "radial-gradient(circle, rgba(139,92,246,0.22) 0%, transparent 65%)", filter: "blur(40px)", animation: "drift2 18s ease-in-out infinite" }} />
      <div className="absolute rounded-full" style={{ width: "55%", height: "55%", left: "20%", bottom: "-25%", background: `radial-gradient(circle, ${c2}22 0%, transparent 65%)`, filter: "blur(40px)", animation: "drift3 16s ease-in-out infinite" }} />
    </div>
  );
}

/** Фон приложения — обложка + aurora */
export function DynamicBg({ track }: { track: Track }) {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      <AnimatePresence>
        <motion.img
          key={track.id}
          src={track.img}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4 }}
          style={{ filter: "blur(90px) saturate(1.6) brightness(0.22)", transform: "scale(1.2)" }}
        />
      </AnimatePresence>
      <Aurora c2={track.c2} opacity={0.7} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 0%, #05050b 78%)" }} />
      <div className="absolute bottom-0 left-0 right-0 h-72" style={{ background: "linear-gradient(to top, #05050b 0%, transparent 100%)" }} />
    </div>
  );
}

/** Волновая дорожка с сиком; playing — бары у плейхеда пульсируют */
export function Waveform({ progress, color, onSeek, height = 52, seed = 7, bars = 72, dim = false, playing = false }: {
  progress: number; color: string; onSeek?: (p: number) => void; height?: number; seed?: number; bars?: number; dim?: boolean; playing?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

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
        const played = (i / bars) * 100 <= progress;
        const headIdx = Math.floor((progress / 100) * bars);
        const nearHead = playing && Math.abs(i - headIdx) <= 2;
        return (
          <div
            key={i}
            className="flex-1 rounded-full"
            style={{
              height: `${h * 100}%`,
              minWidth: 2,
              background: played ? `linear-gradient(to top, ${color}, ${color}88)` : dim ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.13)",
              transition: "background 0.2s",
              animation: nearHead ? `waveBounce ${0.45 + (i % 3) * 0.12}s ease-in-out infinite alternate` : "none",
            }}
          />
        );
      })}
    </div>
  );
}

/** Живая частотная сфера — вместо пластинки/объёмной обложки */
export function FrequencyOrb({ track, playing, progress }: { track: Track; playing: boolean; progress: number }) {
  const bars = 48;
  const heights = useMemo(
    () => Array.from({ length: bars }, (_, i) => {
      const base = Math.abs(Math.sin(i * 0.42 + track.id) * 0.55 + Math.sin(i * 1.1) * 0.35);
      const active = (i / bars) * 100 <= progress;
      return { h: 0.22 + base * 0.78, active };
    }),
    [bars, track.id, progress],
  );

  return (
    <div className="relative flex items-center justify-center" style={{ width: 280, height: 280 }}>
      <motion.div
        animate={{ opacity: playing ? 0.7 : 0.25, scale: playing ? 1 : 0.92 }}
        transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
        className="absolute rounded-full"
        style={{
          width: 260, height: 260,
          background: `radial-gradient(circle, ${track.c2}35 0%, transparent 68%)`,
          filter: "blur(24px)",
          animation: playing ? "orbPulse 3s ease-in-out infinite" : "none",
        }}
      />
      <motion.div
        animate={{ rotate: playing ? 360 : 0 }}
        transition={{ duration: playing ? 24 : 0, repeat: playing ? Infinity : 0, ease: "linear" }}
        className="absolute rounded-full"
        style={{ width: 220, height: 220, border: `1px dashed ${track.c2}28` }}
      />
      <div className="absolute rounded-full flex items-center justify-center" style={{ width: 200, height: 200, background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px)", border: `1px solid ${track.c2}30`, boxShadow: `0 0 60px ${track.c2}22, inset 0 0 40px ${track.c2}08` }}>
        {heights.map((b, i) => {
          const angle = (i / bars) * 360;
          return (
            <div
              key={i}
              className="absolute origin-bottom rounded-full"
              style={{
                width: 3,
                height: `${b.h * 72}px`,
                bottom: "50%",
                left: "50%",
                marginLeft: -1.5,
                transform: `rotate(${angle}deg)`,
                background: b.active
                  ? `linear-gradient(to top, ${track.c2}, ${track.c2}55)`
                  : "rgba(255,255,255,0.12)",
                opacity: playing ? (b.active ? 1 : 0.45) : 0.3,
                transition: "background 0.25s, opacity 0.4s",
                boxShadow: b.active && playing ? `0 0 8px ${track.c2}66` : "none",
              }}
            />
          );
        })}
        <motion.div
          animate={{ scale: playing ? [1, 1.03, 1] : 1 }}
          transition={{ duration: 2, repeat: playing ? Infinity : 0, ease: "easeInOut" }}
          className="relative z-10 rounded-2xl overflow-hidden"
          style={{ width: 72, height: 72, boxShadow: `0 8px 28px ${track.c2}44` }}
        >
          <img src={track.img} alt="" className="w-full h-full object-cover" />
        </motion.div>
      </div>
    </div>
  );
}

/** Индикатор «сейчас играет» */
export function EQ({ color, size = 12 }: { color: string; size?: number }) {
  return (
    <div className="flex items-end gap-[2px]" style={{ height: size }}>
      {[0, 1, 2].map(i => (
        <div key={i} className="w-[3px] rounded-full origin-bottom" style={{ height: size, background: color, animation: `eq${i + 1} ${0.5 + i * 0.13}s ease-in-out infinite alternate` }} />
      ))}
    </div>
  );
}

/** iOS-переключатель */
export function Toggle({ on, onChange, color }: { on: boolean; onChange: () => void; color: string }) {
  return (
    <button onClick={onChange} className="relative rounded-full flex-shrink-0 transition-colors duration-300" style={{ width: 46, height: 27, background: on ? color : "rgba(255,255,255,0.13)" }}>
      <motion.div animate={{ x: on ? 20 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 32 }} className="absolute top-[3px] left-[3px] w-[21px] h-[21px] rounded-full bg-white" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.35)" }} />
    </button>
  );
}

/** Шторка снизу — общий контейнер оверлеев. center — компактный диалог по центру экрана */
export function Sheet({ open, onClose, children, z = 60, center = false }: {
  open: boolean; onClose: () => void; children: React.ReactNode; z?: number; center?: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`fixed inset-0 flex justify-center ${center ? "items-center p-6" : "items-end lg:items-center"}`}
          style={{ zIndex: z, background: "rgba(5,5,12,0.55)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={center ? { scale: 0.9, opacity: 0, y: 14 } : { y: "12%", opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={center ? { scale: 0.94, opacity: 0, y: 8 } : { y: "10%", opacity: 0, scale: 0.98 }}
            transition={SPRING}
            onClick={e => e.stopPropagation()}
            className={`w-full max-h-[92vh] overflow-y-auto ${center ? "max-w-xs rounded-[28px]" : "lg:max-w-md rounded-t-[30px] lg:rounded-[30px]"}`}
            style={{ background: "rgba(13,13,26,0.92)", backdropFilter: "blur(40px) saturate(1.6)", WebkitBackdropFilter: "blur(40px) saturate(1.6)", border: "1px solid rgba(255,255,255,0.11)", boxShadow: center ? "0 30px 90px rgba(0,0,0,0.65)" : "0 -20px 80px rgba(0,0,0,0.6)", scrollbarWidth: "none" }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Адаптивная страница: скролл + центрированная колонка под телефон/планшет/ПК/ТВ */
export function Page({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-y-auto h-full pb-44 lg:pb-8 ${className}`} style={{ scrollbarWidth: "none" }}>
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
        <div className="text-sm mt-2 mb-6" style={{ color: "rgba(242,242,248,0.5)", fontFamily: F.b }}>{sub}</div>
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
