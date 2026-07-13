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

const MONO_M = "M60 178 L60 62 L120 132 L180 62 L180 178";

// Перелив: те же три ноты, что в --brand-grad и авроре приложения
const V = { violet: "#a78bfa", sky: "#7dd3fc", rose: "#f6b8c8", glow: "#6D3BFF", pearl: "#f9dce4" };

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

/** Icon — «M» с переливом на тёмной плашке: аватары, крупные места */
export function MyraIcon({ size = 96 }: { size?: number }) {
  const u = useId();
  return (
    <svg viewBox="0 0 240 240" width={size} height={size} role="img" aria-label="MYRA">
      <title>MYRA</title>
      <defs>
        <linearGradient id={`${u}-l`} x1="0.05" y1="0.1" x2="0.95" y2="0.9">
          <stop offset="0%" stopColor={V.violet} />
          <stop offset="50%" stopColor={V.sky} />
          <stop offset="100%" stopColor={V.rose} />
        </linearGradient>
        <radialGradient id={`${u}-a`} cx="0.35" cy="0.35" r="0.65">
          <stop offset="0%" stopColor={V.glow} stopOpacity="0.7" />
          <stop offset="100%" stopColor={V.glow} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${u}-p`} cx="0.8" cy="0.85" r="0.5">
          <stop offset="0%" stopColor={V.rose} stopOpacity="0.4" />
          <stop offset="100%" stopColor={V.rose} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="240" height="240" rx="54" fill="#050510" />
      <ellipse cx="100" cy="105" rx="90" ry="76" fill={`url(#${u}-a)`} opacity="0.6" />
      <ellipse cx="175" cy="185" rx="80" ry="66" fill={`url(#${u}-p)`} />
      <path d={MONO_M} fill="none" stroke={`url(#${u}-l)`} strokeWidth={36} strokeLinecap="round" strokeLinejoin="round" />
      <path d={MONO_M} fill="none" stroke={V.pearl} strokeOpacity={0.35} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" transform="translate(0,-8)" />
    </svg>
  );
}
