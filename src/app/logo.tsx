import React, { useId } from "react";

// ─── Логотип MYRA ─────────────────────────────────────────────────────────────
// Геометрия из бренд-гайда «MYRA Logo System v1.0» — единый источник путей.
// Wordmark — для шапок и всего меньше 48px (наследует currentColor),
// Icon — «M» на тёмной плашке для аватаров/крупных мест,
// плоская favicon-версия живёт отдельно в public/favicon.svg и в Android-векторе.

const WORD =
  "M75 160 L75 78 L120 132 L165 78 L165 160 " +
  "M214 78 L254 124 L294 78 M254 124 L254 160 " +
  "M343 160 L343 78 M343 78 L377 78 A25 25 0 0 1 377 128 L343 128 M373 128 L409 160 " +
  "M457 160 L497 78 L537 160 M474 133 L520 133";

const MONO_M = "M60 178 L60 62 L120 132 L180 62 L180 178";

// Продуктовый colorway violet — совпадает с акцентом приложения
const V = { l1: "#B79CFF", l2: "#7C5BFF", l3: "#D9A6FF", glow: "#6D3BFF" };

/** Wordmark — «рабочая лошадка»: currentColor, работает в обеих темах без пересборки */
export function MyraWordmark({ height = 26, style }: { height?: number; style?: React.CSSProperties }) {
  return (
    <svg viewBox="48 63 516 112" height={height} fill="none" role="img" aria-label="MYRA" style={{ display: "block", ...style }}>
      <title>MYRA</title>
      <path d={WORD} stroke="currentColor" strokeWidth={30} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Icon — «M» с фиолетовым градиентом на тёмной плашке: аватары, крупные места */
export function MyraIcon({ size = 96 }: { size?: number }) {
  const u = useId();
  return (
    <svg viewBox="0 0 240 240" width={size} height={size} role="img" aria-label="MYRA">
      <title>MYRA</title>
      <defs>
        <linearGradient id={`${u}-l`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor={V.l1} />
          <stop offset="50%" stopColor={V.l2} />
          <stop offset="100%" stopColor={V.l3} />
        </linearGradient>
        <radialGradient id={`${u}-a`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor={V.glow} stopOpacity="0.7" />
          <stop offset="100%" stopColor={V.glow} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="240" height="240" rx="54" fill="#0B0A12" />
      <ellipse cx="120" cy="130" rx="86" ry="70" fill={`url(#${u}-a)`} opacity="0.55" />
      <path d={MONO_M} fill="none" stroke={`url(#${u}-l)`} strokeWidth={36} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
