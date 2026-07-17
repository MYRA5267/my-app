import React, { useId, useState } from "react";

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

const DETAIL_SRC = "/detail/detail.webp";

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
