import React, { useId } from "react";

const WORD =
  "M75 160 L75 78 L120 132 L165 78 L165 160 " +
  "M214 78 L254 124 L294 78 M254 124 L254 160 " +
  "M343 160 L343 78 M343 78 L377 78 A25 25 0 0 1 377 128 L343 128 M373 128 L409 160 " +
  "M457 160 L497 78 L537 160 M474 133 L520 133";

const C = { pearl: "#fff1e9", champagne: "#f8c7a6", copper: "#d98968", rose: "#bb668b", lilac: "#a876bc", ice: "#d9efff" };

/** Fluid glass wordmark derived from the MYRA brand board. */
export function MyraWordmark({ height = 26, style }: { height?: number; style?: React.CSSProperties }) {
  const u = useId();
  return (
    <svg viewBox="48 55 516 128" height={height} fill="none" role="img" aria-label="MYRA" style={{ display: "block", overflow: "visible", ...style }}>
      <title>MYRA</title>
      <defs>
        <linearGradient id={`${u}-metal`} x1="0" y1="0" x2="1" y2=".6">
          <stop offset="0" stopColor={C.ice} /><stop offset=".2" stopColor={C.pearl} /><stop offset=".54" stopColor={C.champagne} /><stop offset=".82" stopColor={C.copper} /><stop offset="1" stopColor={C.lilac} />
        </linearGradient>
        <filter id={`${u}-glow`} x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="8" result="b" /><feColorMatrix in="b" values="1 0 0 0 .76  0 1 0 0 .36  0 0 1 0 .23  0 0 0 .55 0" />
        </filter>
      </defs>
      <path d={WORD} stroke={C.copper} strokeOpacity=".34" strokeWidth="42" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${u}-glow)`} />
      <path d={WORD} stroke={`url(#${u}-metal)`} strokeWidth="31" strokeLinecap="round" strokeLinejoin="round" />
      <path d={WORD} stroke="#2a1118" strokeOpacity=".32" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" transform="translate(0,8)" />
      <path d={WORD} stroke="#fffaf6" strokeOpacity=".72" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" transform="translate(0,-7)" />
    </svg>
  );
}

/** App mark: an organic M suspended inside a warm translucent sound membrane. */
export function MyraIcon({ size = 96, className }: { size?: number; className?: string }) {
  const u = useId();
  return (
    <svg viewBox="0 0 240 240" width={size} height={size} role="img" aria-label="MYRA" className={className}>
      <title>MYRA</title>
      <defs>
        <radialGradient id={`${u}-bg`} cx=".28" cy=".18" r="1"><stop offset="0" stopColor="#241821" /><stop offset=".56" stopColor="#0d090f" /><stop offset="1" stopColor="#030305" /></radialGradient>
        <linearGradient id={`${u}-ribbon`} x1=".04" y1=".1" x2=".92" y2=".82"><stop offset="0" stopColor={C.ice} /><stop offset=".18" stopColor={C.pearl} /><stop offset=".48" stopColor={C.champagne} /><stop offset=".72" stopColor={C.rose} /><stop offset="1" stopColor={C.lilac} /></linearGradient>
        <radialGradient id={`${u}-mist`} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor={C.copper} stopOpacity=".5" /><stop offset="1" stopColor={C.copper} stopOpacity="0" /></radialGradient>
        <filter id={`${u}-soft`} x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="10" /></filter>
      </defs>
      <rect x="4" y="4" width="232" height="232" rx="58" fill={`url(#${u}-bg)`} stroke="#f2b794" strokeOpacity=".22" strokeWidth="2" />
      <ellipse cx="120" cy="124" rx="104" ry="72" fill={`url(#${u}-mist)`} filter={`url(#${u}-soft)`} />
      <path d="M20 103C54 60 82 76 112 94s54 18 108-18M16 153c36-31 64-29 92-6s62 26 118-10" fill="none" stroke={`url(#${u}-ribbon)`} strokeOpacity=".25" strokeWidth="12" strokeLinecap="round" />
      <path d="M55 164V89c0-14 18-18 25-6l40 67 40-67c7-12 25-8 25 6v75" fill="none" stroke="#2c1219" strokeOpacity=".55" strokeWidth="39" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M55 156V83c0-14 18-18 25-6l40 67 40-67c7-12 25-8 25 6v73" fill="none" stroke={`url(#${u}-ribbon)`} strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M58 143V86c0-7 7-8 11-2l43 70" fill="none" stroke="#fffaf6" strokeOpacity=".62" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}

export function MyraBrandLockup({ compact = false }: { compact?: boolean }) {
  if (compact) return <MyraIcon size={42} className="myra-brand-lockup-icon" />;
  return (
    <div className="myra-brand-lockup" aria-label="MYRA Music">
      <MyraIcon size={46} className="myra-brand-lockup-icon" />
      <div className="myra-brand-lockup-copy"><MyraWordmark height={25} /><span>MUSIC · DEEPLY YOURS</span></div>
    </div>
  );
}
