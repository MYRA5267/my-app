import React from "react";

export type MyraGlyphName =
  | "home" | "discover" | "between" | "library" | "studio" | "profile"
  | "search" | "heart" | "chart" | "radio" | "blend"
  | "rooms" | "spark" | "bell" | "play" | "pause" | "arrow"
  | "plus" | "settings" | "download" | "globe";

export type MyraGlyphProps = {
  name: MyraGlyphName;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
  filled?: boolean;
};

const paths: Record<MyraGlyphName, React.ReactNode> = {
  home: <>
    <path d="M4.2 12.4C6.8 7.6 9.1 5.2 12 3.6c2.9 1.6 5.2 4 7.8 8.8" />
    <path d="M6.2 10.8v7.5c2.1 1.1 9.5 1.1 11.6 0v-7.5" />
    <path d="M9.7 19v-4.8c1.4-.8 3.2-.8 4.6 0V19" />
  </>,
  discover: <>
    <path d="M3.5 12c2.6-4.1 5.5-6.2 8.5-6.2s5.9 2.1 8.5 6.2c-2.6 4.1-5.5 6.2-8.5 6.2S6.1 16.1 3.5 12Z" />
    <path d="M8.3 13.2c1.2 1.8 4.3 2.6 6.3.3 1.7-2 .8-4.3-.8-5.1" />
    <circle cx="10.2" cy="10.2" r="1.15" fill="currentColor" stroke="none" />
  </>,
  between: <>
    <path d="M4.1 8.4c2.1-3.1 5.4-3.7 7.9-1.1 2.5-2.6 5.8-2 7.9 1.1" />
    <path d="M4.1 15.6c2.1 3.1 5.4 3.7 7.9 1.1 2.5 2.6 5.8 2 7.9-1.1" />
    <path d="M7.2 12h9.6" opacity=".52" />
    <circle cx="12" cy="12" r="1.45" fill="currentColor" stroke="none" />
  </>,
  library: <>
    <path d="M5.2 5.2c1.3-.7 2.6-.7 3.8 0v13.6c-1.2-.7-2.5-.7-3.8 0V5.2Z" />
    <path d="M10.1 4.2c1.3-.7 2.6-.7 3.8 0v13.6c-1.2-.7-2.5-.7-3.8 0V4.2Z" />
    <path d="M15 6.1c1.3-.7 2.6-.7 3.8 0v13.1c-1.2-.7-2.5-.7-3.8 0V6.1Z" />
  </>,
  studio: <>
    <path d="M4 12h2.1l1.4-5.2L10 17.4l2.2-9.1 2.2 7.3 1.7-5.4 1.2 1.8H20" />
    <path d="M5.3 4.4c3.9-1.9 9.5-1.9 13.4 0M5.3 19.6c3.9 1.9 9.5 1.9 13.4 0" opacity=".55" />
  </>,
  profile: <>
    <path d="M8.1 9.2c.4-3 1.8-4.7 3.9-4.7s3.5 1.7 3.9 4.7c-.3 2.5-1.7 4-3.9 4s-3.6-1.5-3.9-4Z" />
    <path d="M4.6 19.4c1.8-3.6 4.2-5.2 7.4-5.2s5.6 1.6 7.4 5.2c-3.8 1.7-11 1.7-14.8 0Z" />
  </>,
  search: <>
    <circle cx="11" cy="10.6" r="6.2" />
    <path d="M15.6 15.4 19.4 19.2" />
  </>,
  heart: <path d="M12 20c-.42 0-.83-.15-1.15-.42C6.6 16.1 4 13.7 4 10.5 4 7.9 5.95 6 8.4 6c1.42 0 2.72.72 3.6 1.86C12.88 6.72 14.18 6 15.6 6 18.05 6 20 7.9 20 10.5c0 3.2-2.6 5.6-6.85 9.08-.32.27-.73.42-1.15.42Z" />,
  chart: <>
    <path d="M4.5 18.8V14c1.1-.8 2.3-.8 3.4 0v4.8M10.3 18.8V9.5c1.1-.8 2.3-.8 3.4 0v9.3M16.1 18.8V5c1.1-.8 2.3-.8 3.4 0v13.8" />
    <path d="M3.5 20.3c4.7.6 12.3.6 17 0" opacity=".5" />
  </>,
  radio: <>
    <path d="M7.2 15.8a5.2 5.2 0 0 1 0-7.6M4.2 18.6a9 9 0 0 1 0-13.2M16.8 8.2a5.2 5.2 0 0 1 0 7.6M19.8 5.4a9 9 0 0 1 0 13.2" />
    <path d="M12 9.3c1.7 0 2.8 1.1 2.8 2.7s-1.1 2.7-2.8 2.7S9.2 13.6 9.2 12 10.3 9.3 12 9.3Z" />
  </>,
  blend: <>
    <path d="M3.8 8.1c2.2-2.7 4.4-2.7 6.6 0l3.2 4c2.2 2.7 4.4 2.7 6.6 0" />
    <path d="M3.8 15.9c2.2 2.7 4.4 2.7 6.6 0l3.2-4c2.2-2.7 4.4-2.7 6.6 0" />
    <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
  </>,
  rooms: <>
    <path d="M4.1 8.5c1.5-2.8 4.6-3.5 6.5-1.5 1.2 1.3 1.2 3.3 0 4.7-1.9 2.1-5 1.4-6.5-1.4" />
    <path d="M19.9 15.5c-1.5 2.8-4.6 3.5-6.5 1.5-1.2-1.3-1.2-3.3 0-4.7 1.9-2.1 5-1.4 6.5 1.4" />
    <path d="M7.7 15.9c2.9-1.6 5.7-1.6 8.6 0" opacity=".55" />
  </>,
  spark: <path d="M12 2.9c.8 5.7 2.4 8.2 7.8 9.1-5.4.9-7 3.4-7.8 9.1-.8-5.7-2.4-8.2-7.8-9.1 5.4-.9 7-3.4 7.8-9.1Z" />,
  bell: <>
    <path d="M12 4.2c-2.95 0-4.9 2.25-4.9 5.35 0 2.55-.5 3.95-1.45 5.1-.55.66-.12 1.66.72 1.78 3.75.5 7.5.5 11.26 0 .84-.12 1.27-1.12.72-1.78-.95-1.15-1.45-2.55-1.45-5.1C16.9 6.45 14.95 4.2 12 4.2Z" fill="currentColor" stroke="none" />
    <path d="M10.1 18.9c.5.85 1.15 1.25 1.9 1.25s1.4-.4 1.9-1.25" />
  </>,
  play: <path d="M8 6.4c0-1.18 1.28-1.92 2.3-1.32l8.1 4.9c1 .6 1 2.05 0 2.65l-8.1 4.9c-1.02.6-2.3-.14-2.3-1.32V6.4Z" />,
  pause: <><path d="M8.5 5.3v13.4M15.5 5.3v13.4" /></>,
  arrow: <><path d="M5 12h13.5M14.4 7.5 19 12l-4.6 4.5" /></>,
  plus: <><circle cx="12" cy="12" r="8.4" opacity=".4" /><path d="M12 8v8M8 12h8" /></>,
  settings: <><path d="M4 8h8.5M16.5 8H20" /><circle cx="14.5" cy="8" r="2.15" /><path d="M4 16h3.5M11.5 16H20" /><circle cx="9.5" cy="16" r="2.15" /></>,
  download: <><path d="M12 4.4v9.4M8.2 10.2 12 14l3.8-3.8" /><path d="M5.4 18.4c4.4.7 8.8.7 13.2 0" /></>,
  globe: <><circle cx="12" cy="12" r="8.3" /><path d="M3.9 12h16.2M12 3.7c-2.2 2.2-3.1 5-3.1 8.3s.9 6.1 3.1 8.3M12 3.7c2.2 2.2 3.1 5 3.1 8.3s-.9 6.1-3.1 8.3" /></>,
};

export function MyraGlyph({ name, size = 20, className, style, strokeWidth = 1.7, filled = false }: MyraGlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={["myra-custom-icon", className].filter(Boolean).join(" ")}
      style={style}
    >
      {paths[name]}
    </svg>
  );
}

export const createMyraIcon = (name: MyraGlyphName) =>
  React.memo(function Icon({ size = 20, className, style }: Omit<MyraGlyphProps, "name">) {
    return <MyraGlyph name={name} size={size} className={className} style={style} />;
  });

export const MyraHomeIcon = createMyraIcon("home");
export const MyraDiscoverIcon = createMyraIcon("discover");
export const MyraBetweenIcon = createMyraIcon("between");
export const MyraLibraryIcon = createMyraIcon("library");
export const MyraStudioIcon = createMyraIcon("studio");
export const MyraProfileIcon = createMyraIcon("profile");

// ─── Объёмные 3D-иконки нижней навигации ─────────────────────────────────────
// Выпуклая заливка (градиент) + глянцевый блик сверху + мягкое свечение —
// референс: нижний бар Яндекс-музыки. Активная светится фирменным градиентом
// (персик→фиолет), неактивная — приглушённый currentColor (адаптируется под
// тему), тоже с объёмом. Свечение (SVG-фильтр) гасится на слабых устройствах
// (weak = fx-simple): на Android WebView фильтры дают лишние перерисовки.
const NAV3D_SHAPES: Record<string, { shape: React.ReactNode; overlay?: React.ReactNode }> = {
  home: {
    shape: <path d="M4.4 11.5c0-.7.33-1.36.9-1.8l5.5-4.1c.72-.54 1.72-.54 2.44 0l5.5 4.1c.57.44.9 1.1.9 1.8v6.1c0 1.16-.94 2.1-2.1 2.1H6.5c-1.16 0-2.1-.94-2.1-2.1V11.5Z" />,
    overlay: <rect x="10" y="14.4" width="4" height="4.7" rx="1.1" fill="rgba(20,12,30,.34)" />,
  },
  browse: {
    shape: <circle cx="12" cy="12" r="8.5" />,
    overlay: <><path d="M15.6 8.4 10.7 10.7 8.4 15.6 13.3 13.3 15.6 8.4Z" fill="rgba(20,12,30,.5)" /><circle cx="12" cy="12" r="1.4" fill="rgba(20,12,30,.5)" /></>,
  },
  between: { shape: <><circle cx="8.9" cy="12" r="4.9" /><circle cx="15.1" cy="12" r="4.9" /></> },
  library: {
    shape: <><rect x="4.7" y="4.8" width="4.3" height="14.4" rx="1.7" /><rect x="9.9" y="4.8" width="4.3" height="14.4" rx="1.7" /><rect x="15.4" y="6.3" width="4" height="12.9" rx="1.6" transform="rotate(9 17.4 12.7)" /></>,
  },
  profile: {
    shape: <><circle cx="12" cy="8.3" r="3.9" /><path d="M4.7 18.7c.85-3.5 3.5-5.5 7.3-5.5s6.45 2 7.3 5.5c.2.8-.2 1.3-1 1.5-4.1 1-8.5 1-12.6 0-.8-.2-1.2-.7-1-1.5Z" /></>,
  },
};

// Знак «проверенный артист» — фирменная печать (гребёнка) с градиентной
// заливкой и белой галочкой. Крупнее и качественнее простого BadgeCheck.
export function MyraVerifiedBadge({ size = 18, accent = "#7dd3fc", className, style, title }: {
  size?: number; accent?: string; className?: string; style?: React.CSSProperties; title?: string;
}) {
  const uid = React.useId().replace(/:/g, "");
  const gid = `vb-${uid}`;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={["myra-verified", className].filter(Boolean).join(" ")} style={style} role="img" aria-label={title ?? "Проверенный артист"}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={accent} />
          <stop offset="1" stopColor="#c98cff" />
        </linearGradient>
      </defs>
      <path d="M12 1.8c1.1 0 2.13.62 2.64 1.6.9-.5 2.02-.42 2.86.2.83.63 1.2 1.68 1 2.68 1.05.28 1.9 1.07 2.16 2.12.26 1.05-.13 2.1-.98 2.72.55.9.55 2.04 0 2.94.85.62 1.24 1.67.98 2.72-.26 1.05-1.11 1.84-2.16 2.12.2 1-.17 2.05-1 2.68-.84.62-1.96.7-2.86.2A2.98 2.98 0 0 1 12 22.2c-1.1 0-2.13-.62-2.64-1.6-.9.5-2.02.42-2.86-.2-.83-.63-1.2-1.68-1-2.68-1.05-.28-1.9-1.07-2.16-2.12-.26-1.05.13-2.1.98-2.72a2.98 2.98 0 0 1 0-2.94c-.85-.62-1.24-1.67-.98-2.72.26-1.05 1.11-1.84 2.16-2.12-.2-1 .17-2.05 1-2.68.84-.62 1.96-.7 2.86-.2A2.98 2.98 0 0 1 12 1.8Z" fill={`url(#${gid})`} stroke="none" />
      <path d="m8.2 12.2 2.5 2.5 5.1-5.4" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MyraNavIcon3D({ name, active, size = 22, weak = false, className, style }: {
  name: string; active: boolean; size?: number; weak?: boolean; className?: string; style?: React.CSSProperties;
}) {
  const uid = React.useId().replace(/:/g, "");
  const def = NAV3D_SHAPES[name] ?? NAV3D_SHAPES.home;
  const gid = `n3g-${uid}`, hid = `n3h-${uid}`, cid = `n3c-${uid}`, fid = `n3f-${uid}`;
  const glow = active && !weak;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" className={["myra-nav3d", className].filter(Boolean).join(" ")} style={style}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          {active
            ? <><stop offset="0" stopColor="#ffe6c8" /><stop offset="0.5" stopColor="#f4a77f" /><stop offset="1" stopColor="#c98cff" /></>
            : <><stop offset="0" stopColor="currentColor" stopOpacity="0.92" /><stop offset="1" stopColor="currentColor" stopOpacity="0.5" /></>}
        </linearGradient>
        <radialGradient id={hid} cx="50%" cy="24%" r="60%">
          <stop offset="0" stopColor="#ffffff" stopOpacity={active ? 0.72 : 0.32} />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <clipPath id={cid}>{def.shape}</clipPath>
        {glow && (
          <filter id={fid} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.2" floodColor="#c98cff" floodOpacity="0.55" />
          </filter>
        )}
      </defs>
      <g filter={glow ? `url(#${fid})` : undefined} fill={`url(#${gid})`}>{def.shape}</g>
      <g clipPath={`url(#${cid})`}><rect x="0" y="0" width="24" height="16" fill={`url(#${hid})`} /></g>
      {def.overlay}
    </svg>
  );
}

/*
 * Compatibility layer for the whole application. These are not aliases to an
 * external icon pack: every exported component is drawn from the MYRA fluid
 * geometry below. Keeping the familiar semantic export names lets screens use
 * one icon system without sacrificing readable component code.
 */
export type MyraIconComponentProps = React.SVGProps<SVGSVGElement> & {
  size?: number | string;
  absoluteStrokeWidth?: boolean;
};
export type LucideIcon = React.FC<MyraIconComponentProps>;

const S = {
  close: <><path d="M6.2 6.8c3.6 2.7 7.2 7 11.6 10.4M17.8 6.8c-3.6 2.7-7.2 7-11.6 10.4" /></>,
  check: <path d="M4.8 12.7c2.2 1 3.8 2.5 5.2 4.3 2.7-4.5 5.4-7.6 9.2-10.2" />,
  left: <><path d="M19 12H5.5M9.6 7.5 5 12l4.6 4.5" /></>,
  down: <path d="M5.5 9.2c2.2 3 4.4 5 6.5 6.1 2.1-1.1 4.3-3.1 6.5-6.1" />,
  skipBack: <><path d="M7 5.5v13" /><path d="M18.2 6.1c-4.1 1.9-7 3.9-8.8 5.9 1.8 2 4.7 4 8.8 5.9V6.1Z" /></>,
  skipForward: <><path d="M17 5.5v13" /><path d="M5.8 6.1c4.1 1.9 7 3.9 8.8 5.9-1.8 2-4.7 4-8.8 5.9V6.1Z" /></>,
  shuffle: <><path d="M4 7.2h2.5c5.4 0 5.3 9.6 10.8 9.6H20" /><path d="M16.7 13.8 20 16.8l-3.3 3" /><path d="M4 16.8h2.4c2.1 0 3.4-1.3 4.4-3M13.2 8.9c1-1 2.2-1.7 4.1-1.7H20M16.7 4.2 20 7.2l-3.3 3" opacity=".7" /></>,
  repeat: <><path d="M5.1 8.2c1.5-2 3.8-3 6.9-3 3.5 0 5.9 1.2 7.2 3.7M18.8 5.4l.4 3.5-3.7.2" /><path d="M18.9 15.8c-1.5 2-3.8 3-6.9 3-3.5 0-5.9-1.2-7.2-3.7M5.2 18.6l-.4-3.5 3.7-.2" /></>,
  share: <><path d="M8.2 12.7c3.1-4 6.5-5.7 10.4-5.2" /><path d="m15.6 4.4 3.4 3.1-3.1 3.4" /><path d="M18.5 13.8v4.5c-3.6 1.2-9.4 1.2-13 0V9.5c1.2-.4 2.6-.7 4-.8" /></>,
  volume: <><path d="M4.3 10h3.2l4.1-3.5v11L7.5 14H4.3v-4Z" /><path d="M15.2 9c1.5 1.8 1.5 4.2 0 6M18.1 6.3c3.4 3.4 3.4 8 0 11.4" /></>,
  volumeOff: <><path d="M4.3 10h3.2l4.1-3.5v11L7.5 14H4.3v-4Z" /><path d="m15.4 9 4.4 6M19.8 9l-4.4 6" /></>,
  flag: <><path d="M6 20V5.1" /><path d="M6.4 5.5c3-1.5 5.2 1.5 8.2 0 1.2-.6 2.3-.7 3.4-.4v8c-1.1-.3-2.2-.2-3.4.4-3 1.5-5.2-1.5-8.2 0" /></>,
  chat: <><path d="M4.4 6.2c4.3-2.3 10.9-2.3 15.2 0v9c-3.7 2-9 2.3-13.1.8l-2.9 2 .8-3.6V6.2Z" /><path d="M8.1 10.8h7.8" opacity=".55" /></>,
  send: <><path d="M3.8 5.3 20.2 12 3.8 18.7l2-5.2L15 12l-9.2-1.5-2-5.2Z" /><path d="M6 10.5 15 12l-9 1.5" opacity=".55" /></>,
  timer: <><path d="M8.7 3.8h6.6M12 7v2" /><path d="M5.7 12.7c0-4 2.5-6.4 6.3-6.4s6.3 2.4 6.3 6.4-2.5 6.6-6.3 6.6-6.3-2.6-6.3-6.6Z" /><path d="m12 12.7 3-2" /></>,
  badge: <><path d="M12 3.8c1.4 1 2.8 1.3 4.5.8.3 1.7 1 2.9 2.3 3.8-1 1.4-1.2 2.8-.6 4.4-1.7.4-2.9 1.2-3.7 2.6-1.4-.9-2.8-1-4.4-.4-.5-1.6-1.4-2.8-2.8-3.5.8-1.5.8-2.9.1-4.4 1.6-.6 2.7-1.5 3.1-3.5Z" /><path d="m9 12 2.1 2.1 4-4.5" /></>,
  music: <><path d="M9.1 17.2V6.4c3.1.2 6.2-.5 8.6-2v10.4" /><path d="M9.1 16.5c-2.4-1-4.7.2-4.7 2 0 1.5 1.8 2.3 3.4 1.6 1-.4 1.3-1.4 1.3-3.6ZM17.7 14.1c-2.4-1-4.7.2-4.7 2 0 1.5 1.8 2.3 3.4 1.6 1-.4 1.3-1.4 1.3-3.6Z" /></>,
  flame: <path d="M12.3 3.2c1 3.4-1.3 4.6.2 7.3 1-1.1 1.6-2.4 1.6-3.8 3.1 2.7 4.3 5.6 3.3 8.7-.8 2.7-2.7 4.4-5.4 5.2-3.7-.9-5.6-3.2-5.6-6.7 0-2.8 1.5-5.2 4.5-7.4-.1 2.2.3 3.4 1.1 4.4.4-2.5-1.4-4.4.3-7.7Z" />,
  headset: <><path d="M4.5 13v-1.2c0-4.6 2.8-7.3 7.5-7.3s7.5 2.7 7.5 7.3V13" /><path d="M4.5 12.2h2.8v6.3H5.8c-.9 0-1.3-.6-1.3-1.4v-4.9ZM19.5 12.2h-2.8v6.3h1.5c.9 0 1.3-.6 1.3-1.4v-4.9ZM16.7 18.5c-1.2 1.2-2.7 1.7-4.7 1.7" /></>,
  upload: <><path d="M12 19V7M7.7 10.8 12 6.5l4.3 4.3" /><path d="M4.8 19.1c4.8 1 9.6 1 14.4 0" /></>,
  users: <><path d="M5.2 10c.3-2.4 1.5-3.8 3.3-3.8s3 1.4 3.3 3.8c-.3 2-1.4 3.2-3.3 3.2S5.5 12 5.2 10Z" /><path d="M2.7 18.6c1.4-3 3.3-4.3 5.8-4.3s4.4 1.3 5.8 4.3c-3.1 1.3-8.5 1.3-11.6 0ZM14.2 7.3c2.4-.5 4 1 4.3 3.3-.2 1.7-1.1 2.8-2.7 3M15.2 14.5c2.7-.1 4.6 1.2 5.9 3.9-1.3.6-2.8.9-4.5.9" opacity=".7" /></>,
  energy: <path d="m13.2 2.8-7 10.1h5.1l-.5 8.3 7-10.3h-5.1l.5-8.1Z" />,
  moon: <path d="M17.8 17.2c-5.5.9-9.1-2-9.1-6.8 0-2.3.9-4.4 2.8-6-4.3.4-7.2 3.5-7.2 7.7 0 4.6 3.2 7.6 7.9 7.6 2.2 0 4.1-.8 5.6-2.5Z" />,
  workout: <><path d="M6 9v6M3.8 10.5v3M18 9v6M20.2 10.5v3M6 12h12" /><path d="M8.8 8.2v7.6M15.2 8.2v7.6" opacity=".55" /></>,
  car: <><path d="M5 16.8h14v-5.5l-2.2-4.1H7.2L5 11.3v5.5Z" /><path d="M7 16.8v2M17 16.8v2M6 12h12M8.3 14.4h.1M15.6 14.4h.1" /></>,
  brain: <><path d="M10.2 5.4c-1.5-1.3-4.2-.3-4 1.8-2.2.1-3.1 2.8-1.4 4.1-1.7 1.6-.3 4.1 1.7 4-.2 2.3 2.4 3.4 4 1.8V6.3" /><path d="M13.8 5.4c1.5-1.3 4.2-.3 4 1.8 2.2.1 3.1 2.8 1.4 4.1 1.7 1.6.3 4.1-1.7 4 .2 2.3-2.4 3.4-4 1.8V6.3M7 9.2c1.3.1 2.3.8 3.2 2M17 9.2c-1.3.1-2.3.8-3.2 2" /></>,
  exit: <><path d="M10 5H5.5v14H10M12.5 8l4.5 4-4.5 4M8 12h9" /></>,
  wallet: <><path d="M4.2 7.2c4.4-1.4 10.9-1.4 15.6 0v10.9c-4.7 1.4-11.2 1.4-15.6 0V7.2Z" /><path d="M14.2 11h5.6v4h-5.6c-1.5 0-2.2-.7-2.2-2s.7-2 2.2-2Z" /></>,
  crown: <><path d="m4.2 7.4 4.4 4.1L12 5l3.4 6.5 4.4-4.1-1.7 10.1H5.9L4.2 7.4Z" /><path d="M6.2 19.4c3.8.6 7.8.6 11.6 0" /></>,
  trash: <><path d="M7 8.3v10.4c2.8.8 7.2.8 10 0V8.3M5 6h14M9.2 6V3.8h5.6V6M9.7 11v4.8M14.3 11v4.8" /></>,
  sun: <><circle cx="12" cy="12" r="4.1" /><path d="M12 2.8v2.1M12 19.1v2.1M2.8 12h2.1M19.1 12h2.1M5.5 5.5 7 7M17 17l1.5 1.5M18.5 5.5 17 7M7 17l-1.5 1.5" /></>,
  trophy: <><path d="M8 5h8v5.6c0 3-1.4 4.7-4 4.7s-4-1.7-4-4.7V5Z" /><path d="M8 7H4.7c0 3.6 1.2 5.4 3.8 5.4M16 7h3.3c0 3.6-1.2 5.4-3.8 5.4M12 15.3V19M8.5 20h7" /></>,
  gift: <><path d="M4.3 10h15.4v9.2H4.3V10ZM3.5 7h17v3h-17V7ZM12 7v12" /><path d="M12 7C9.5 7 7.7 6 7.7 4.6c0-1.3 1.8-1.8 3-.7.7.7 1.1 1.8 1.3 3.1ZM12 7c2.5 0 4.3-1 4.3-2.4 0-1.3-1.8-1.8-3-.7-.7.7-1.1 1.8-1.3 3.1Z" /></>,
  wrench: <path d="M14.4 5.1c1.7-1 3.8-.8 5.2.6l-3.4 2.7-.7 2.3-2.3.7-7.5 8c-1.1-.3-1.8-1-2.1-2.1l8-7.5.7-2.3 2.1-2.4Z" />,
  sliders: <><path d="M4 7h5M13 7h7M4 17h9M17 17h3" /><path d="M9 4.5v5M13 14.5v5" /></>,
  copy: <><path d="M8 8h11v11H8V8Z" /><path d="M16 8V5H5v11h3" /></>,
  key: <><path d="M4.4 12.4c0-2.8 1.8-4.5 4.5-4.5s4.5 1.7 4.5 4.5-1.8 4.5-4.5 4.5-4.5-1.7-4.5-4.5Z" /><path d="M13 12.4h7M17 12.4v2M19.5 12.4v2" /></>,
  mail: <><path d="M4.2 6.5h15.6v11H4.2v-11Z" /><path d="m4.8 7.2 7.2 5.5 7.2-5.5" /></>,
  refresh: <><path d="M18.8 9.4c-1-3-3.3-4.5-6.8-4.5-2.8 0-4.9 1-6.3 3M5.7 4.8v3.1h3.4" /><path d="M5.2 14.6c1 3 3.3 4.5 6.8 4.5 2.8 0 4.9-1 6.3-3M18.3 19.2v-3.1h-3.4" /></>,
  grip: <><circle cx="9" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1" fill="currentColor" stroke="none"/></>,
  file: <><path d="M6 3.8h8l4 4v12.4H6V3.8Z" /><path d="M14 3.8v4h4M9 12h6M9 15.5h6" /></>,
  image: <><path d="M4 5h16v14H4V5Z" /><circle cx="9" cy="9.5" r="1.4" /><path d="m5 17 4.5-4.5 3.2 3 2-2L19 17" /></>,
  help: <><path d="M4.5 12c0-4.7 2.8-7.5 7.5-7.5s7.5 2.8 7.5 7.5-2.8 7.5-7.5 7.5S4.5 16.7 4.5 12Z" /><path d="M9.8 9.4c.4-1.4 1.3-2.1 2.7-2.1 1.6 0 2.7.9 2.7 2.3 0 2-2.5 2.1-2.8 4M12.4 16.7h.1" /></>,
  star: <path d="m12 3.3 2.5 5 5.6.8-4.1 4 .9 5.6-4.9-2.6-4.9 2.6.9-5.6-4.1-4 5.6-.8 2.5-5Z" />,
  lock: <><path d="M6 10h12v10H6V10Z" /><path d="M8.5 10V7.5c0-2.3 1.3-3.6 3.5-3.6s3.5 1.3 3.5 3.6V10M12 14v2.7" /></>,
  shield: <><path d="M12 3.5c2.2 1.4 4.5 2 7 1.8v6.2c0 4-2.3 6.9-7 9-4.7-2.1-7-5-7-9V5.3c2.5.2 4.8-.4 7-1.8Z" /><path d="m8.8 12 2.1 2.1 4.4-4.7" /></>,
  eye: <><path d="M3.5 12c2.7-4.1 5.5-6.1 8.5-6.1s5.8 2 8.5 6.1c-2.7 4.1-5.5 6.1-8.5 6.1S6.2 16.1 3.5 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
  eyeOff: <><path d="M4.1 5.4 19.9 18.6M7.1 7.3C5.8 8.4 4.6 10 3.5 12c2.7 4.1 5.5 6.1 8.5 6.1 1.3 0 2.6-.4 3.8-1.1M10.2 6.1c.6-.1 1.2-.2 1.8-.2 3 0 5.8 2 8.5 6.1-.6 1-1.3 1.9-2 2.7" /></>,
  bug: <><path d="M7.2 10c0-2.8 1.7-4.5 4.8-4.5s4.8 1.7 4.8 4.5v4.8c0 3-1.7 4.8-4.8 4.8s-4.8-1.8-4.8-4.8V10Z" /><path d="M9 5.9 7 3.8M15 5.9l2-2.1M4.2 11h3M16.8 11h3M4.2 16h3M16.8 16h3M12 9v10" /></>,
  inbox: <><path d="M4.2 6h15.6v12H4.2V6Z" /><path d="M4.2 14h4l1.4 2h4.8l1.4-2h4" /></>,
  external: <><path d="M13 5h6v6M19 5l-8.2 8.2" /><path d="M17.5 13v6H5V6.5h6" /></>,
  loader: <path d="M12 3.5c4.9 0 8.5 3.6 8.5 8.5S16.9 20.5 12 20.5 3.5 16.9 3.5 12c0-2.2.8-4.1 2.2-5.6" opacity=".8" />,
  door: <><path d="M6 20V4h11v16M9.5 12h.1" /><path d="M3.5 20h17" /></>,
  branch: <><path d="M7 5v9c0 3 1.8 4.5 5 4.5s5-1.5 5-4.5V9" /><circle cx="7" cy="4" r="1.7" /><circle cx="17" cy="8" r="1.7" /><circle cx="12" cy="19" r="1.7" /></>,
  lineChart: <><path d="M4 19V5M4 19h16" /><path d="m7 15 3.4-4 3 2.2L19 7" /></>,
  clipboard: <><path d="M6 6h12v15H6V6Z" /><path d="M9 6V3.5h6V6M9 11h6M9 15h6" /></>,
};

const semanticIcon = (node: React.ReactNode): LucideIcon => {
  const Icon: LucideIcon = ({ size = 20, color, fill = "none", stroke = "currentColor", strokeWidth = 1.7, className, style, absoluteStrokeWidth: _absolute, ...rest }) => {
    const painted = typeof fill === "string" && fill !== "none" && fill !== "currentColor" ? fill : color;
    return (
      <svg {...rest} viewBox="0 0 24 24" width={size} height={size} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={["myra-custom-icon", className].filter(Boolean).join(" ")} style={{ color: painted, ...style }}>
        {node}
      </svg>
    );
  };
  return Icon;
};

export const Play = semanticIcon(<path d="M8 6.4c0-1.18 1.28-1.92 2.3-1.32l8.1 4.9c1 .6 1 2.05 0 2.65l-8.1 4.9c-1.02.6-2.3-.14-2.3-1.32V6.4Z" />);
export const Pause = semanticIcon(<><path d="M7.4 5.2h3.2v13.6H7.4Z" fill="currentColor" stroke="none" /><path d="M13.4 5.2h3.2v13.6h-3.2Z" fill="currentColor" stroke="none" /></>);
export const Heart = semanticIcon(paths.heart);
export const Search = semanticIcon(paths.search);
export const Mic2 = semanticIcon(paths.studio);
export const BarChart3 = semanticIcon(paths.chart);
export const LineChart = semanticIcon(S.lineChart);
export const TrendingUp = semanticIcon(S.lineChart);
export const Plus = semanticIcon(paths.plus);
export const ChevronRight = semanticIcon(paths.arrow);
export const ArrowRight = semanticIcon(paths.arrow);
export const ChevronLeft = semanticIcon(S.left);
export const ChevronDown = semanticIcon(S.down);
export const Volume2 = semanticIcon(S.volume);
export const VolumeX = semanticIcon(S.volumeOff);
export const Globe = semanticIcon(paths.globe);
export const Bell = semanticIcon(paths.bell);
export const Check = semanticIcon(S.check);
export const CheckCircle2 = semanticIcon(S.check);
export const CheckCheck = semanticIcon(<><path d="M2.8 12.8 6.5 16l5.6-7" /><path d="m9.8 14 2.6 2 8.8-9" /></>);
export const BadgeCheck = semanticIcon(S.badge);
export const Download = semanticIcon(paths.download);
export const ArrowDownToLine = semanticIcon(paths.download);
export const Upload = semanticIcon(S.upload);
export const FileUp = semanticIcon(S.upload);
export const Import = semanticIcon(S.upload);
export const X = semanticIcon(S.close);
export const XCircle = semanticIcon(<><circle cx="12" cy="12" r="8.5" />{S.close}</>);
export const Users = semanticIcon(S.users);
export const User = semanticIcon(paths.profile);
export const CircleUserRound = semanticIcon(paths.profile);
export const UserPlus = semanticIcon(<>{S.users}<path d="M18.5 4.5v5M16 7h5" /></>);
export const Music2 = semanticIcon(S.music);
export const FileAudio = semanticIcon(S.music);
export const Zap = semanticIcon(S.energy);
export const Radio = semanticIcon(paths.radio);
export const Cast = semanticIcon(paths.rooms);
export const Moon = semanticIcon(S.moon);
export const Dumbbell = semanticIcon(S.workout);
export const Car = semanticIcon(S.car);
export const Brain = semanticIcon(S.brain);
export const LogOut = semanticIcon(S.exit);
export const Wallet = semanticIcon(S.wallet);
export const Blend = semanticIcon(paths.blend);
export const Crown = semanticIcon(S.crown);
export const Trash2 = semanticIcon(S.trash);
export const Sun = semanticIcon(S.sun);
export const Sparkles = semanticIcon(paths.spark);
export const Trophy = semanticIcon(S.trophy);
export const Clock = semanticIcon(S.timer);
export const Timer = semanticIcon(S.timer);
export const Flame = semanticIcon(S.flame);
export const Gift = semanticIcon(S.gift);
export const Headphones = semanticIcon(S.headset);
export const Headset = semanticIcon(S.headset);
export const Wrench = semanticIcon(S.wrench);
export const Lock = semanticIcon(S.lock);
export const SlidersHorizontal = semanticIcon(S.sliders);
export const SkipBack = semanticIcon(S.skipBack);
export const SkipForward = semanticIcon(S.skipForward);
export const Shuffle = semanticIcon(S.shuffle);
export const Repeat = semanticIcon(S.repeat);
export const Repeat2 = semanticIcon(S.repeat);
export const Share2 = semanticIcon(S.share);
export const Flag = semanticIcon(S.flag);
export const MessageCircle = semanticIcon(S.chat);
export const Send = semanticIcon(S.send);
export const Copy = semanticIcon(S.copy);
export const KeyRound = semanticIcon(S.key);
export const Mail = semanticIcon(S.mail);
export const RefreshCw = semanticIcon(S.refresh);
export const RotateCcw = semanticIcon(S.refresh);
export const GripVertical = semanticIcon(S.grip);
export const ClipboardPaste = semanticIcon(S.clipboard);
export const ImagePlus = semanticIcon(<>{S.image}<path d="M18 3v5M15.5 5.5h5" /></>);
export const FileText = semanticIcon(S.file);
export const HelpCircle = semanticIcon(S.help);
export const Star = semanticIcon(S.star);
export const ShieldCheck = semanticIcon(S.shield);
export const ShieldAlert = semanticIcon(<>{S.shield}<path d="M12 8v5M12 16.5h.1" /></>);
export const Eye = semanticIcon(S.eye);
export const EyeOff = semanticIcon(S.eyeOff);
export const Bug = semanticIcon(S.bug);
export const Inbox = semanticIcon(S.inbox);
export const ExternalLink = semanticIcon(S.external);
export const Loader2 = semanticIcon(S.loader);
export const DoorOpen = semanticIcon(S.door);
export const GitBranch = semanticIcon(S.branch);
