import React, { useId, useRef, useState } from "react";

// ─── DETAIL — фирменный визуальный мотив MYRA ────────────────────────────────
// Светящаяся полупрозрачная волна в медно-розовых/золотистых/фиолетовых/
// холодных тонах — тот же принцип, что уже даёт Aurora (lib.tsx), но не
// круглые пятна, а органическая лента, ближе к референсу бренда.
//
// Реального кропа референса нет в комплекте — компонент пробует загрузить
// public/detail/detail.webp (см. DETAIL_SRC ниже); пока файла нет, <img>
// молча падает по onError, и остаётся видна процедурная SVG-лента той же
// палитрой, что и --brand-grad (THEMES, lib.tsx): фиолетовый → небо →
// жемчужная роза, плюс медь/золото из референса. Как только файл появится
// в репозитории — он подхватится сам, без правок в местах вызова.
//
// Как и Aurora, полностью декоративный: aria-hidden, pointer-events: none.
// Дыхание/дрейф гасятся классом .fx-simple и prefers-reduced-motion (см.
// theme.css) — так же, как остальной fx-* декор в приложении.

// Respect Vite's relative base so the web build works from a GitHub Pages subfolder too.
const DETAIL_SRC = `${import.meta.env.BASE_URL}detail/detail.webp`;

export type DetailVariant = "full" | "soft" | "blur" | "mobile";

const BASE_STOPS_A = [
  { offset: "0%", color: "#ffb37a" },  // медь
  { offset: "45%", color: "#f6b8c8" }, // жемчужная роза (из --brand-grad)
  { offset: "100%", color: "#a78bfa" }, // фиолетовый (из --brand-grad)
];

const BASE_STOPS_B = [
  { offset: "0%", color: "#ffd88a" },  // золото
  { offset: "50%", color: "#7dd3fc" }, // небо (из --brand-grad)
  { offset: "100%", color: "#a78bfa" }, // фиолетовый
];

/**
 * Атмосферный фирменный слой DETAIL. Полностью декоративный — не должен
 * перекрывать текст/контролы (используется как задний план с mask-image,
 * растворяющим края, см. .myra-detail в theme.css).
 *
 * accent — если задан (обычно track.c2), подмешивается в среднюю точку
 * первой ленты, чтобы DETAIL мягко менялся вместе с текущим треком, а не
 * жил отдельной от музыки жизнью.
 *
 * active — false на паузе: дыхание замедляется (не останавливается резко —
 * см. ТЗ "во время паузы движение должно замедляться").
 */
export const DetailBackdrop = React.memo(function DetailBackdrop({
  variant = "full",
  accent,
  active = true,
  className = "",
}: {
  variant?: DetailVariant;
  accent?: string;
  active?: boolean;
  className?: string;
}) {
  const uid = useId();
  const idA = `detail-a-${uid}`;
  const idB = `detail-b-${uid}`;
  const [photoOk, setPhotoOk] = useState(false);
  const [photoTried, setPhotoTried] = useState(false);

  const stopsA = accent
    ? [BASE_STOPS_A[0], { offset: "45%", color: accent }, BASE_STOPS_A[2]]
    : BASE_STOPS_A;

  return (
    <div
      aria-hidden="true"
      className={`myra-detail myra-detail--${variant}${active ? "" : " myra-detail--paused"} ${className}`}
    >
      {/* Реальный ассет — рендерится всегда (чтобы браузер попытался
          загрузить), но виден только после успешной загрузки; до этого
          момента и при 404 его перекрывает процедурная лента ниже */}
      {!photoTried || photoOk ? (
        <img
          src={DETAIL_SRC}
          alt=""
          loading="lazy"
          decoding="async"
          className="myra-detail-photo"
          style={{ opacity: photoOk ? undefined : 0 }}
          onLoad={() => setPhotoOk(true)}
          onError={() => setPhotoTried(true)}
        />
      ) : null}
      {!photoOk && (
        <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" focusable="false">
          <defs>
            <linearGradient id={idA} x1="0%" y1="20%" x2="100%" y2="80%">
              {stopsA.map(s => <stop key={s.offset} offset={s.offset} stopColor={s.color} />)}
            </linearGradient>
            <linearGradient id={idB} x1="100%" y1="10%" x2="0%" y2="90%">
              {BASE_STOPS_B.map(s => <stop key={s.offset} offset={s.offset} stopColor={s.color} />)}
            </linearGradient>
          </defs>
          <path
            className="myra-detail-ribbon myra-detail-ribbon-a"
            fill={`url(#${idA})`}
            d="M-40,120 C40,60 110,180 190,110 C270,40 330,140 440,90 L440,300 L-40,300 Z"
          />
          <path
            className="myra-detail-ribbon myra-detail-ribbon-b"
            fill={`url(#${idB})`}
            d="M-40,180 C50,220 120,90 210,160 C300,230 340,100 440,150 L440,300 L-40,300 Z"
          />
        </svg>
      )}
      {/* Лёгкая цветовая связь с текущим треком поверх реального фото —
          обычная альфа-подмешка, без mix-blend-mode (см. риски в плане) */}
      {accent && photoOk && (
        <div className="myra-detail-tint" style={{ background: `radial-gradient(circle at 50% 40%, ${accent}2e, transparent 70%)` }} />
      )}
    </div>
  );
});

const DETAIL_WAVE_PATH = "M-36 60 C45 8 112 26 184 58 C260 92 312 16 398 31 C476 45 507 92 590 68 C674 44 725 5 840 41 L840 78 C731 119 665 93 585 83 C502 72 467 122 384 103 C303 85 257 122 176 94 C96 66 38 112 -36 98 Z";
const DETAIL_WAVE_BACK = "M-42 69 C47 30 113 65 188 79 C267 94 319 46 400 55 C488 65 520 102 602 83 C687 63 739 42 842 55 L842 101 C739 124 675 105 594 100 C512 95 474 128 386 113 C300 98 247 126 168 105 C92 85 34 119 -42 105 Z";
const DETAIL_WAVE_EDGE = "M-36 60 C45 8 112 26 184 58 C260 92 312 16 398 31 C476 45 507 92 590 68 C674 44 725 5 840 41";
const DETAIL_WAVE_INNER = "M-24 74 C58 39 118 55 190 71 C267 88 323 39 401 48 C484 58 523 95 596 77 C680 57 732 28 824 50";

/**
 * Фирменный индикатор прогресса MYRA: органичная стеклянная лента из DETAIL.
 * Прогресс подсвечивает уже прослушанную часть, а при наличии onSeek лента
 * работает как полноценный слайдер мышью, пальцем и с клавиатуры.
 */
export const DetailWave = React.memo(function DetailWave({
  progress,
  buffered,
  playing = false,
  height = 64,
  onSeek,
  compact = false,
  className = "",
  accent = "#d98968",
}: {
  progress: number;
  buffered?: number;
  playing?: boolean;
  height?: number;
  onSeek?: (progress: number) => void;
  compact?: boolean;
  className?: string;
  accent?: string;
}) {
  const rawId = useId().replace(/:/g, "");
  const ribbonId = `myra-detail-wave-ribbon-${rawId}`;
  const bufferId = `myra-detail-wave-buffer-${rawId}`;
  const progressId = `myra-detail-wave-progress-${rawId}`;
  const gradientId = `myra-detail-wave-gradient-${rawId}`;
  const bufferGradientId = `myra-detail-wave-buffer-gradient-${rawId}`;
  const depthGradientId = `myra-detail-wave-depth-gradient-${rawId}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const value = Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0));
  const loadedValue = Math.max(value, Math.min(100, Number.isFinite(buffered) ? Number(buffered) : value));

  const seekAt = (clientX: number) => {
    if (!onSeek || !rootRef.current) return;
    const bounds = rootRef.current.getBoundingClientRect();
    if (!bounds.width) return;
    onSeek(Math.max(0, Math.min(100, ((clientX - bounds.left) / bounds.width) * 100)));
  };

  return (
    <div
      ref={rootRef}
      className={`myra-detail-wave${playing ? " is-playing" : ""}${loadedValue < 99 ? " is-loading" : " is-loaded"}${compact ? " is-compact" : ""}${onSeek ? " is-interactive" : ""} ${className}`}
      style={{
        height,
        "--myra-wave-accent": accent,
        "--myra-wave-progress": `${value}%`,
        "--myra-wave-buffered": `${loadedValue}%`,
      } as React.CSSProperties}
      role={onSeek ? "slider" : "img"}
      aria-label="Прогресс воспроизведения"
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? 100 : undefined}
      aria-valuenow={onSeek ? Math.round(value) : undefined}
      aria-valuetext={onSeek ? `${Math.round(value)}% прослушано, ${Math.round(loadedValue)}% загружено` : undefined}
      tabIndex={onSeek ? 0 : undefined}
      onPointerDown={onSeek ? e => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        seekAt(e.clientX);
      } : undefined}
      onPointerMove={onSeek ? e => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) seekAt(e.clientX);
      } : undefined}
      onKeyDown={onSeek ? e => {
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); onSeek(Math.max(0, value - 2)); }
        if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); onSeek(Math.min(100, value + 2)); }
        if (e.key === "Home") { e.preventDefault(); onSeek(0); }
        if (e.key === "End") { e.preventDefault(); onSeek(100); }
      } : undefined}
    >
      <svg viewBox="0 0 800 120" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id={ribbonId}>
            <path d={DETAIL_WAVE_PATH} />
          </clipPath>
          <clipPath id={bufferId}>
            <rect className="myra-detail-wave-buffer-mask" x="0" y="0" width="800" height="120" style={{ transform: `scaleX(${loadedValue / 100})` }} />
          </clipPath>
          <clipPath id={progressId}>
            <rect className="myra-detail-wave-progress-mask" x="0" y="0" width="800" height="120" style={{ transform: `scaleX(${value / 100})` }} />
          </clipPath>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff2e8" stopOpacity="0.98" />
            <stop offset="0.28" stopColor="#ffc29f" stopOpacity="0.9" />
            <stop offset="0.62" stopColor={accent} stopOpacity="0.82" />
            <stop offset="1" stopColor="#d9c8ff" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id={bufferGradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#b998a4" stopOpacity="0.24" />
            <stop offset="0.65" stopColor="#e7b6c9" stopOpacity="0.4" />
            <stop offset="1" stopColor="#f3d9d0" stopOpacity="0.62" />
          </linearGradient>
          <linearGradient id={depthGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff9f5" stopOpacity="0.72" />
            <stop offset="0.36" stopColor={accent} stopOpacity="0.18" />
            <stop offset="0.72" stopColor="#2b0d22" stopOpacity="0.42" />
            <stop offset="1" stopColor="#050307" stopOpacity="0.72" />
          </linearGradient>
        </defs>

        <g className="myra-detail-wave-body">
          <path className="myra-detail-wave-back" d={DETAIL_WAVE_BACK} />
          <path className="myra-detail-wave-ghost" d={DETAIL_WAVE_PATH} />
          <g className="myra-detail-wave-media myra-detail-wave-media-base" clipPath={`url(#${ribbonId})`}>
            <image href={DETAIL_SRC} x="-20" y="-150" width="840" height="420" preserveAspectRatio="xMidYMid slice" />
            <path d={DETAIL_WAVE_PATH} fill={`url(#${depthGradientId})`} />
          </g>
          <path className="myra-detail-wave-top-rim" d={DETAIL_WAVE_EDGE} />
          <path className="myra-detail-wave-bottom-rim" d={DETAIL_WAVE_INNER} />
        </g>

        <g className="myra-detail-wave-buffer-layer" clipPath={`url(#${bufferId})`}>
          <g clipPath={`url(#${ribbonId})`}>
            <image href={DETAIL_SRC} x="-20" y="-150" width="840" height="420" preserveAspectRatio="xMidYMid slice" opacity="0.48" />
            <path d={DETAIL_WAVE_PATH} fill={`url(#${bufferGradientId})`} />
          </g>
          <path className="myra-detail-wave-buffer-line" d={DETAIL_WAVE_INNER} />
        </g>

        <g clipPath={`url(#${progressId})`}>
          <g className="myra-detail-wave-media myra-detail-wave-media-progress" clipPath={`url(#${ribbonId})`}>
            <image href={DETAIL_SRC} x="-20" y="-150" width="840" height="420" preserveAspectRatio="xMidYMid slice" />
            <path d={DETAIL_WAVE_PATH} fill={`url(#${gradientId})`} />
            <path d={DETAIL_WAVE_PATH} fill={`url(#${depthGradientId})`} />
          </g>
          <path className="myra-detail-wave-highlight" d={DETAIL_WAVE_EDGE} />
          <path className="myra-detail-wave-inner-light" d={DETAIL_WAVE_INNER} />
        </g>
      </svg>
      <span className="myra-detail-wave-energy" aria-hidden="true"><i /><i /><i /></span>
      {loadedValue > value + 0.8 && loadedValue < 99.8 && <span className="myra-detail-wave-buffer-head" aria-hidden="true" />}
      {value > 0 && <span className="myra-detail-wave-playhead" aria-hidden="true"><i /></span>}
    </div>
  );
});
