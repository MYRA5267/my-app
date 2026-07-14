import React, { useId } from "react";

// ─── Логотип MYRA ─────────────────────────────────────────────────────────────
// Геометрия из бренд-гайда «MYRA Logo System v1.0» — единый источник путей.
// Colorway v2 «перелив»: жемчужный градиент фиолет → небо → роза (совпадает
// с --brand-grad в THEMES) + глянцевый блик по верху букв — «надутое стекло».
// Wordmark — для шапок и всего меньше 48px, Icon — «M» на тёмной плашке для
// аватаров/крупных мест; плоская favicon-версия живёт отдельно в
// public/favicon.svg и в Android-векторе.

const WORD =
  "M75 160 L75 78 L120 132 L165 78 L165 160 " +
  "M214 78 L254 124 L294 78 M254 124 L254 160 " +
  "M343 160 L343 78 M343 78 L377 78 A25 25 0 0 1 377 128 L343 128 M373 128 L409 160 " +
  "M457 160 L497 78 L537 160 M474 133 L520 133";

// Перелив: те же три ноты, что в --brand-grad и авроре приложения
const V = { violet: "#a78bfa", sky: "#7dd3fc", rose: "#f6b8c8", glow: "#7c5cff" };

/** Wordmark — «рабочая лошадка»: жемчужный градиент читается на обеих темах */
export function MyraWordmark({ height = 26, style }: { height?: number; style?: React.CSSProperties }) {
  const u = useId();
  return (
    <svg viewBox="48 63 516 112" height={height} fill="none" role="img" aria-label="MYRA" style={{ display: "block", ...style }}>
      <title>MYRA</title>
      <defs>
        <linearGradient id={`${u}-w`} x1="0" y1="0" x2="1" y2="0.35">
          <stop offset="0%" stopColor={V.violet} />
          <stop offset="48%" stopColor={V.sky} />
          <stop offset="100%" stopColor={V.rose} />
        </linearGradient>
      </defs>
      <path d={WORD} stroke={`url(#${u}-w)`} strokeWidth={30} strokeLinecap="round" strokeLinejoin="round" />
      {/* Глянцевый блик по верху обводки — тонкая линия внутри толстой (30/2=15 > 7+5),
          за счёт неё буквы выглядят надутыми, как пузырь, без единого фильтра */}
      <path d={WORD} stroke="#ffffff" strokeOpacity={0.38} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" transform="translate(0,-7)" />
    </svg>
  );
}

/** Icon — «Орб»: светящаяся сфера-аврора с волной звука и орбитой, как в плеере.
    Выбор создателей (июль 2026) — совпадает с favicon.svg и иконкой Android */
export function MyraIcon({ size = 96 }: { size?: number }) {
  const u = useId();
  return (
    <svg viewBox="0 0 240 240" width={size} height={size} role="img" aria-label="MYRA">
      <title>MYRA</title>
      <defs>
        <radialGradient id={`${u}-s`} cx="0.32" cy="0.28" r="0.95">
          <stop offset="0%" stopColor="#c4b5fd" /><stop offset="30%" stopColor="#7c5cff" />
          <stop offset="65%" stopColor="#2b1470" /><stop offset="100%" stopColor="#0c0630" />
        </radialGradient>
        <linearGradient id={`${u}-p`} x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0%" stopColor={V.violet} /><stop offset="48%" stopColor={V.sky} /><stop offset="100%" stopColor={V.rose} />
        </linearGradient>
        <radialGradient id={`${u}-g`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor={V.glow} stopOpacity="0.55" /><stop offset="100%" stopColor={V.glow} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${u}-h`} cx="0.35" cy="0.25" r="0.5">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" /><stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="240" height="240" rx="54" fill="#050510" />
      <circle cx="120" cy="118" r="98" fill={`url(#${u}-g)`} />
      <circle cx="120" cy="118" r="60" fill={`url(#${u}-s)`} />
      <ellipse cx="103" cy="96" rx="34" ry="24" fill={`url(#${u}-h)`} />
      <path d="M78 118 q10 -22 21 0 t21 0 t21 0 t21 0" fill="none" stroke={`url(#${u}-p)`} strokeWidth={7} strokeLinecap="round" />
      <circle cx="120" cy="118" r="76" fill="none" stroke={`url(#${u}-p)`} strokeWidth={3.5} strokeOpacity={0.85} strokeDasharray="358 120" strokeDashoffset={30} strokeLinecap="round" />
      <circle cx="188" cy="82" r="7" fill={V.rose} />
    </svg>
  );
}
