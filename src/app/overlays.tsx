import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Play, Heart, BadgeCheck, Gift, Check, X, ChevronRight, ChevronLeft, ArrowRight,
  Mail, Crown, MessageCircle, Trash2, Share2, RefreshCw, UserPlus, Loader2,
  GripVertical, Shuffle, Import as ImportIcon, FileUp, ClipboardPaste, ImagePlus, Send,
  Zap, LineChart, Headset, TrendingUp, Users, HelpCircle, Star, Lock, Sparkles, ArrowDownToLine, Search, Flag,
  FileText, ShieldCheck, KeyRound,
} from "./myraIcons";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { artistByName, tracksOf, AVATARS, TRACKS as ALL_TRACKS, PLAYLISTS, LEADERBOARD_PEERS, TASTE_GENRES, REPORT_REASONS, ls, svgAvatar, trackFromRow, type Track, type Friend } from "./data";
import { F, GLASS, SPRING, Sheet, ConfirmSheet, Aurora, TiltCard, EQ, Toggle, copyText, genInviteCode, ON_DARK, onDark, THEMES, InteractiveChart } from "./lib";
import { DetailBackdrop } from "./detail";
import { useLang } from "./i18n";
import { monthDays, splitAmountByShares, minutesOf, currentMonthKey, type ArtistShare } from "./stats";
import { buildAchievements, ACHIEVEMENTS, type AchievementCounters } from "./achievements";
import { supabaseEnabled, paymentsEnabled, passkeysEnabled, canUsePasskeys, registerPasskey, listPasskeys, askSupportAI, sendSupportMessage, fetchSupportThread, fetchArtistProfile, searchProfiles, submitReport, createPayment, type SupportMessageRow, type ArtistProfileData, type PublicProfile, type ReportTargetType } from "./supabase";

// Фирменный фиолетовый градиент приложения — единый для CTA, чипов и пузырей
// чата (тот же, что был разбросан по шторкам инлайном)
const ACCENT_GRAD = "linear-gradient(135deg, #8b5cf6, #a78bfa)";

// ─── Оплата донатов (симуляция — нет бэкенда/процессинга) ────────────────────

const fmtCardNum = (v: string) => v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})(?=.)/g, "$1 ");
const fmtCardExp = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; };

/** Правдоподобный QR-паттерн (не сканируется — чисто визуальная симуляция) */
function FakeQR({ seed }: { seed: number }) {
  const n = 21;
  const grid = useMemo(() => {
    let s = Math.abs(Math.round(seed)) || 1;
    const rnd = () => { s = (s * 16807 + 11) % 2147483647; return (s % 1000) / 1000; };
    const g: boolean[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => rnd() > 0.52));
    const eye = (gx: number, gy: number) => {
      for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
        g[gy + y][gx + x] = x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4);
      }
    };
    eye(0, 0); eye(n - 7, 0); eye(0, n - 7);
    return g;
  }, [seed]);
  const cell = 152 / n;
  return (
    <svg viewBox="0 0 152 152" width={152} height={152} style={{ borderRadius: 14, background: "#fff", flexShrink: 0 }}>
      {grid.map((row, y) => row.map((on, x) => on && <rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill="#0a0a12" />))}
    </svg>
  );
}

// ─── Виджет доната — общий для демо-артистов каталога и настоящих артистов ───
// Вынесен из ArtistSheet, чтобы RealArtistSheet (донаты настоящим артистам)
// не дублировал ~110 строк одной и той же логики (этапы pick/pay/sent,
// карта/QR, расчёт комиссии). Родитель отвечает за то, кому именно уходит
// донат — сюда передаётся только отображаемое имя и обработчик суммы.
// key={artistLabel} на стороне родителя сбрасывает весь внутренний стейт при
// смене артиста — отдельный reset-эффект тут не нужен.
function DonateWidget({ open, artistLabel, c2, toUserId, onDonate }: {
  open: boolean; artistLabel: string; c2: string; toUserId?: string; onDonate: (amount: number) => void;
}) {
  const { t } = useLang();
  const [stage, setStage] = useState<"pick" | "pay" | "sent">("pick");
  const [amount, setAmount] = useState<number | null>(100);
  const [custom, setCustom] = useState("");
  const [method, setMethod] = useState<"card" | "qr">("card");
  const [cardNum, setCardNum] = useState("");
  const [cardExp, setCardExp] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [processing, setProcessing] = useState(false);

  // Комиссии нет: онбординг обещает «донаты без комиссии», и это правда —
  // вся сумма уходит артисту (и в ledger, и в donations.amount пишется она же,
  // так что «получено» у артиста совпадает с тем, что отправил слушатель)
  const finalAmount = custom ? parseInt(custom) || 0 : amount ?? 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28 }} className="overflow-hidden mb-6">
          <div className="rounded-[20px] p-5" style={GLASS}>
            {stage === "sent" ? (
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(52,211,153,0.15)" }}>
                  <Check size={22} style={{ color: "#34d399" }} />
                </div>
                <div className="text-sm font-semibold" style={{ fontFamily: F.b, color: "#34d399" }}>{t("don.sent", finalAmount, artistLabel)}</div>
              </motion.div>
            ) : stage === "pay" ? (
              <>
                <div className="font-bold mb-3" style={{ fontFamily: F.d, fontSize: 16, letterSpacing: "-0.01em" }}>{t("don.title", artistLabel)}</div>

                <div className="rounded-2xl p-3.5 mb-4" style={{ background: "color-mix(in srgb, var(--wash) 05%, transparent)" }}>
                  <div className="flex justify-between text-xs mb-1.5" style={{ fontFamily: F.b, color: "color-mix(in srgb, var(--fg) 55%, transparent)" }}>
                    <span>{t("don.amount")}</span><span>{finalAmount}₽</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold pt-1.5" style={{ fontFamily: F.b, borderTop: "1px solid color-mix(in srgb, var(--wash) 10%, transparent)" }}>
                    <span>{t("don.net")}</span><span style={{ color: c2 }}>{finalAmount}₽</span>
                  </div>
                </div>

                <div className="flex gap-2 mb-4">
                  {(["card", "qr"] as const).map(m => (
                    <button key={m} onClick={() => setMethod(m)} className="flex-1 py-2.5 rounded-2xl text-xs font-semibold" style={{ background: method === m ? `${c2}22` : "color-mix(in srgb, var(--wash) 6%, transparent)", border: `1px solid ${method === m ? c2 + "55" : "transparent"}`, color: method === m ? c2 : "color-mix(in srgb, var(--fg) 55%, transparent)", fontFamily: F.b }}>
                      {m === "card" ? t("don.methodCard") : t("don.methodQr")}
                    </button>
                  ))}
                </div>

                {method === "card" ? (
                  <div className="flex flex-col gap-2 mb-5">
                    <input value={cardNum} onChange={e => setCardNum(fmtCardNum(e.target.value))} placeholder="0000 0000 0000 0000" inputMode="numeric" className="px-4 py-2.5 rounded-2xl bg-transparent outline-none text-sm" style={{ ...GLASS, color: "var(--fg)", fontFamily: F.m }} />
                    <div className="flex gap-2">
                      <input value={cardExp} onChange={e => setCardExp(fmtCardExp(e.target.value))} placeholder={t("don.expPh")} inputMode="numeric" className="flex-1 px-4 py-2.5 rounded-2xl bg-transparent outline-none text-sm" style={{ ...GLASS, color: "var(--fg)", fontFamily: F.m }} />
                      <input value={cardCvc} onChange={e => setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="CVC" inputMode="numeric" type="password" className="w-24 px-4 py-2.5 rounded-2xl bg-transparent outline-none text-sm" style={{ ...GLASS, color: "var(--fg)", fontFamily: F.m }} />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2.5 mb-5 py-1">
                    <FakeQR seed={finalAmount * 97 + artistLabel.length} />
                    <div className="text-[11px]" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("don.qrHint")}</div>
                  </div>
                )}

                <div className="flex gap-2.5">
                  <motion.button whileTap={{ scale: 0.96 }} onClick={() => setStage("pick")} className="px-5 py-3 rounded-full text-sm font-semibold" style={{ ...GLASS, fontFamily: F.b }}>
                    {t("don.back")}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    disabled={processing}
                    onClick={async () => {
                      if (method === "card" && (cardNum.replace(/\s/g, "").length < 16 || cardExp.length < 5 || cardCvc.length < 3)) { toast(t("don.cardIncomplete")); return; }
                      setProcessing(true);

                      // Сначала пробуем настоящий платёж через ЮKassa — если она
                      // настроена (см. create-payment/index.ts), уводим на её
                      // hosted-страницу оплаты и НЕ вызываем onDonate здесь: реальный
                      // донат запишется позже, на сервере, вебхуком после
                      // подтверждения оплаты, а не оптимистично на клиенте
                      try {
                        const { data, error } = await createPayment("donation", finalAmount, { toArtist: artistLabel, toUserId });
                        if (data?.confirmation_url) {
                          window.location.href = data.confirmation_url;
                          return;
                        }
                        if (error) throw error;
                      } catch (err) {
                        console.warn("createPayment:", err);
                      }
                      setProcessing(false);
                      toast.error(t("pay.unavailable"));
                    }}
                    className="flex-1 py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2"
                    style={{ background: `linear-gradient(135deg, ${c2}, ${c2}99)`, color: "#fff", fontFamily: F.b }}
                  >
                    {processing ? (<><Loader2 size={14} className="animate-spin" /> {t("don.paying")}</>) : t("don.send", finalAmount)}
                  </motion.button>
                </div>
                {/* Честная подпись, как у Plus: реального процессинга до подключения провайдера нет */}
                <div className="text-[10px] text-center mt-2.5" style={{ color: "color-mix(in srgb, var(--fg) 35%, transparent)", fontFamily: F.m }}>{t("don.simNote")}</div>
              </>
            ) : (
              <>
                <div className="font-bold mb-1" style={{ fontFamily: F.d, fontSize: 16, letterSpacing: "-0.01em" }}>{t("don.title", artistLabel)}</div>
                <div className="text-xs mb-4" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("don.sub")}</div>
                <div className="flex gap-2 mb-4 flex-wrap">
                  {[50, 100, 300, 500].map(a => (
                    <button key={a} onClick={() => { setAmount(a); setCustom(""); }} className="px-4 py-2 rounded-full text-sm font-semibold transition-all" style={{ background: amount === a && !custom ? c2 : "color-mix(in srgb, var(--wash) 07%, transparent)", color: amount === a && !custom ? "#fff" : "color-mix(in srgb, var(--fg) 60%, transparent)", fontFamily: F.b }}>
                      {a}₽
                    </button>
                  ))}
                  <input
                    value={custom}
                    onChange={e => setCustom(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder={t("don.custom")}
                    className="w-24 px-3 py-2 rounded-full text-sm bg-transparent outline-none text-center"
                    style={{ border: `1px solid ${custom ? c2 : "color-mix(in srgb, var(--wash) 12%, transparent)"}`, color: "var(--fg)", fontFamily: F.b }}
                  />
                </div>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  disabled={finalAmount <= 0}
                  onClick={() => setStage("pay")}
                  className="w-full py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2"
                  style={{ background: finalAmount > 0 ? `linear-gradient(135deg, ${c2}, ${c2}99)` : "color-mix(in srgb, var(--wash) 06%, transparent)", color: finalAmount > 0 ? "#fff" : "color-mix(in srgb, var(--fg) 30%, transparent)", fontFamily: F.b }}
                >
                  {t("don.next")} <ArrowRight size={13} />
                </motion.button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Страница артиста ─────────────────────────────────────────────────────────

export const ArtistSheet = React.memo(function ArtistSheet({ name, onClose, onPlay, currentTrack, playing, followed, onFollow, onOpenArtist, onOpenAlbum, onDonate }: {
  name: string | null; onClose: () => void; onPlay: (t: Track) => void;
  currentTrack: Track; playing: boolean;
  followed: Set<string>; onFollow: (name: string) => void; onOpenArtist: (name: string) => void; onOpenAlbum: (album: string) => void;
  onDonate?: (artistName: string, amount: number) => void;
}) {
  const { t } = useLang();
  const [donateOpen, setDonateOpen] = useState(false);

  const artist = name ? artistByName(name) : null;
  useEffect(() => { setDonateOpen(false); }, [name]);

  if (!artist) return <Sheet open={false} onClose={onClose} z={55}><div /></Sheet>;

  const { own, similar } = tracksOf(artist.name);
  const isFollowed = followed.has(artist.name);

  return (
    <Sheet open={!!name} onClose={onClose} z={55} wide>
      {/* Шапка */}
      <div className="myra-artist-hero relative" style={{ "--artist-accent": artist.c2 } as React.CSSProperties}>
        <img src={artist.img} alt="" className="w-full h-full object-cover" style={{ filter: "brightness(0.55)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(13,13,26,1) 0%, transparent 60%)" }} />
        <button onClick={onClose} aria-label={t("sheet.close")} title={t("sheet.close")} className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(10px)", color: ON_DARK }}>
          <X size={16} />
        </button>
        <div className="myra-artist-identity absolute bottom-3 left-6 right-6">
          <div className="flex items-center gap-2">
            <span style={{ fontFamily: F.d, fontWeight: 900, fontSize: 30, letterSpacing: "-0.03em", color: ON_DARK }}>{artist.name}</span>
            {artist.verified && <BadgeCheck size={20} style={{ color: artist.c2 }} />}
          </div>
          <div className="text-xs mt-0.5" style={{ color: onDark(55), fontFamily: F.m }}>{artist.listeners} {t("ar.listeners")}</div>
          <div className="myra-artist-genre">{artist.genre}</div>
        </div>
      </div>

      <div className="myra-artist-body px-6 pt-4 pb-8">
        {/* Действия */}
        <div className="myra-artist-actions flex gap-2.5 mb-6">
          <motion.button whileTap={{ scale: 0.94 }} onClick={() => own[0] && onPlay(own[0])} className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg, ${artist.c2}, ${artist.c2}99)`, boxShadow: `0 8px 26px ${artist.c2}55` }}>
            <Play size={18} fill="white" stroke="none" className="ml-0.5" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => { onFollow(artist.name); toast(isFollowed ? t("ar.unfollowed") : t("ar.followed", artist.name)); }}
            className="flex-1 rounded-full text-sm font-semibold"
            style={isFollowed ? { ...GLASS, color: artist.c2, fontFamily: F.b } : { background: "color-mix(in srgb, var(--wash) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--wash) 20%, transparent)", fontFamily: F.b }}
          >
            {isFollowed ? t("ar.following") : t("ar.follow")}
          </motion.button>
          {paymentsEnabled && <motion.button whileTap={{ scale: 0.96 }} onClick={() => setDonateOpen(o => !o)} className="flex-1 rounded-full text-sm font-semibold flex items-center justify-center gap-2" style={{ background: `${artist.c2}22`, border: `1px solid ${artist.c2}44`, color: artist.c2, fontFamily: F.b }}>
            <Gift size={14} /> {t("ar.support")}
          </motion.button>}
        </div>

        {paymentsEnabled && <DonateWidget
          key={artist.name}
          open={donateOpen}
          artistLabel={artist.name}
          c2={artist.c2}
          onDonate={amt => onDonate?.(artist.name, amt)}
        />}

        {/* Популярное */}
        <h3 className="mb-3" style={{ fontFamily: F.d, fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em" }}>{t("ar.popular")}</h3>
        {own.map(tr => (
          <div key={tr.id} onClick={() => onPlay(tr)} className="myra-artist-track flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer mb-1">
            <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0">
              <img src={tr.img} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate flex items-center gap-2" style={{ fontFamily: F.b }}>
                {tr.title}
                {currentTrack.id === tr.id && playing && <EQ color={tr.c2} size={9} />}
              </div>
              <button onClick={e => { e.stopPropagation(); onOpenAlbum(tr.album); }} className="text-xs hover:text-white transition-colors" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.b }}>{tr.album} · {tr.duration}</button>
            </div>
            <Play size={14} style={{ color: "color-mix(in srgb, var(--fg) 35%, transparent)" }} />
          </div>
        ))}

        {similar.length > 0 && (
          <>
            <h3 className="mb-3 mt-5" style={{ fontFamily: F.d, fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em" }}>{t("ar.similarTr")}</h3>
            {similar.slice(0, 2).map(tr => (
              <div key={tr.id} onClick={() => onPlay(tr)} className="myra-artist-track flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer mb-1">
                <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0">
                  <img src={tr.img} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ fontFamily: F.b }}>{tr.title}</div>
                  <div className="text-xs" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.b }}>{tr.artist}</div>
                </div>
                <Play size={14} style={{ color: "color-mix(in srgb, var(--fg) 35%, transparent)" }} />
              </div>
            ))}
          </>
        )}

        {/* Похожие артисты */}
        <h3 className="mb-3 mt-5" style={{ fontFamily: F.d, fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em" }}>{t("ar.similar")}</h3>
        <div className="myra-similar-artists flex gap-2.5">
          {artist.similar.map(s => {
            const sa = artistByName(s);
            if (!sa) return null;
            return (
              <motion.button key={s} whileTap={{ scale: 0.95 }} onClick={() => onOpenArtist(s)} className="flex items-center gap-2.5 pl-1.5 pr-4 py-1.5 rounded-full" style={GLASS}>
                <img src={sa.img} alt="" className="w-8 h-8 rounded-full object-cover" />
                <span className="text-xs font-semibold" style={{ fontFamily: F.b }}>{s}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
});

// ─── Профиль настоящего артиста (реальный пользователь, не демо-каталог) ─────
// В отличие от ArtistSheet (фиксированные 8 артистов каталога), здесь артист —
// это чья-то реальная запись в profiles/tracks: данные подгружаются из
// Supabase по artistId (uuid), а не берутся из статичного ARTISTS.
const REAL_ARTIST_C2 = "#8b5cf6";

export const RealArtistSheet = React.memo(function RealArtistSheet({ artistId, onClose, onPlay, currentTrack, playing, onDonate }: {
  artistId: string | null; onClose: () => void; onPlay: (t: Track) => void;
  currentTrack: Track; playing: boolean;
  onDonate?: (toUserId: string, artistName: string, amount: number) => void;
}) {
  const { t } = useLang();
  const [donateOpen, setDonateOpen] = useState(false);
  const [profile, setProfile] = useState<ArtistProfileData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDonateOpen(false);
    setProfile(null);
    if (!artistId) return;
    setLoading(true);
    fetchArtistProfile(artistId)
      .then(({ data }) => setProfile(data))
      .finally(() => setLoading(false));
  }, [artistId]);

  if (!artistId) return <Sheet open={false} onClose={onClose} z={55}><div /></Sheet>;

  const name = profile?.username ?? "";
  const avatar = profile?.avatar_url || svgAvatar((name[0] || "?").toUpperCase(), "#12083a", REAL_ARTIST_C2);
  const tracks = (profile?.tracks ?? []).map(row => trackFromRow(row, name));

  return (
    <Sheet open={!!artistId} onClose={onClose} z={55} wide>
      <div className="myra-artist-hero myra-real-artist-hero relative" style={{ "--artist-accent": REAL_ARTIST_C2 } as React.CSSProperties}>
        <div className="w-full h-full" style={{ background: `linear-gradient(160deg, ${REAL_ARTIST_C2}33, #07070f 75%)` }} />
        <button onClick={onClose} aria-label={t("sheet.close")} title={t("sheet.close")} className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(10px)", color: ON_DARK }}>
          <X size={16} />
        </button>
        <div className="myra-artist-identity absolute bottom-4 left-6 right-6 flex items-end gap-3">
          <img src={avatar} alt="" className="w-16 h-16 rounded-full object-cover flex-shrink-0" style={{ border: "2px solid rgba(255,255,255,0.2)" }} />
          <div className="min-w-0 pb-0.5">
            <div style={{ fontFamily: F.d, fontWeight: 900, fontSize: 22, letterSpacing: "-0.03em", color: ON_DARK }} className="truncate">{name || "…"}</div>
            {profile?.handle && <div className="text-xs mt-0.5" style={{ color: onDark(55), fontFamily: F.m }}>@{profile.handle.replace(/^@/, "")}</div>}
          </div>
        </div>
      </div>

      <div className="myra-artist-body px-6 pt-4 pb-8">
        <div className="myra-artist-actions flex gap-2.5 mb-6">
          <motion.button
            whileTap={{ scale: 0.94 }}
            disabled={!tracks[0]}
            onClick={() => tracks[0] && onPlay(tracks[0])}
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${REAL_ARTIST_C2}, ${REAL_ARTIST_C2}99)`, boxShadow: `0 8px 26px ${REAL_ARTIST_C2}55`, opacity: tracks[0] ? 1 : 0.4 }}
          >
            <Play size={18} fill="white" stroke="none" className="ml-0.5" />
          </motion.button>
          {paymentsEnabled && <motion.button whileTap={{ scale: 0.96 }} onClick={() => setDonateOpen(o => !o)} className="flex-1 rounded-full text-sm font-semibold flex items-center justify-center gap-2" style={{ background: `${REAL_ARTIST_C2}22`, border: `1px solid ${REAL_ARTIST_C2}44`, color: REAL_ARTIST_C2, fontFamily: F.b }}>
            <Gift size={14} /> {t("ar.support")}
          </motion.button>}
        </div>

        {paymentsEnabled && <DonateWidget
          key={artistId}
          open={donateOpen}
          artistLabel={name}
          c2={REAL_ARTIST_C2}
          toUserId={artistId}
          onDonate={amt => onDonate?.(artistId, name, amt)}
        />}

        <h3 className="mb-3" style={{ fontFamily: F.d, fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em" }}>{t("ar.popular")}</h3>
        {loading ? (
          <div className="text-xs py-6 text-center" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.b }}>{t("ra.loading")}</div>
        ) : tracks.length === 0 ? (
          <div className="text-xs py-6 text-center" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.b }}>{t("ra.empty")}</div>
        ) : tracks.map(tr => (
          <div key={tr.id} onClick={() => onPlay(tr)} className="myra-artist-track flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer mb-1">
            <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0">
              <img src={tr.img} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate flex items-center gap-2" style={{ fontFamily: F.b }}>
                {tr.title}
                {currentTrack.id === tr.id && playing && <EQ color={tr.c2} size={9} />}
              </div>
              <div className="text-xs truncate" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.b }}>{tr.genre}</div>
            </div>
            <Play size={14} style={{ color: "color-mix(in srgb, var(--fg) 35%, transparent)" }} />
          </div>
        ))}
      </div>
    </Sheet>
  );
});

// ─── Профиль другого пользователя (из Рейтинга) ──────────────────────────────

export function PeerProfileSheet({ peer, onClose }: {
  peer: typeof LEADERBOARD_PEERS[number] | null; onClose: () => void;
}) {
  const { t, lang } = useLang();
  if (!peer) return <Sheet open={false} onClose={onClose} z={59} center><div /></Sheet>;

  const name = lang === "ru" ? peer.name : peer.en;
  const c2 = peer.c2;

  return (
    <Sheet open={!!peer} onClose={onClose} z={59} center>
      {/* Тёмное хиро вместо GLASS+Aurora — язык AccountSheet/Студии,
          акцент соседа задаёт свечение через --sheet-accent */}
      <div className="p-4">
        <div className="myra-sheet-hero p-6 text-center" style={{ "--sheet-accent": c2 } as React.CSSProperties}>
          <img src={peer.avatar} alt="" className="myra-sheet-avatar w-20 h-20 mx-auto mb-3" />
          <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 22, letterSpacing: "-0.02em", color: ON_DARK }}>{name}</div>
          <div className="text-xs mt-1 mb-5" style={{ color: onDark(48), fontFamily: F.m }}>{t("acc.level", peer.level)}</div>

          <div className="myra-sheet-stats">
            {[[String(peer.minutesWeek), t("acc.stMin")], [String(peer.streak), t("acc.stStreak")], [peer.topGenre, t("acc.stGenre")]].map(([v, l]) => (
              <div key={l}>
                <div className="text-sm font-bold truncate" style={{ fontFamily: F.d, color: c2 }}>{v}</div>
                <div className="text-[9px] mt-0.5 truncate" style={{ fontFamily: F.b, color: onDark(48) }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}

// ─── Профиль реального человека (настоящий аккаунт Supabase) ─────────────────
// В отличие от ArtistSheet (демо-каталог, ARTISTS в data.ts) и PeerProfileSheet
// (тоже демо — LEADERBOARD_PEERS), здесь показан по-настоящему существующий
// аккаунт: то, на кого можно по-настоящему подписаться. Минимально, но честно —
// аватар, имя, хендл и кнопка подписки, без выдуманной статистики.

export function RealProfileSheet({ profile, onClose, isFollowing, onToggleFollow }: {
  profile: PublicProfile | null; onClose: () => void; isFollowing: boolean; onToggleFollow: (id: string) => void;
}) {
  const { t } = useLang();
  if (!profile) return <Sheet open={false} onClose={onClose} z={69} center><div /></Sheet>;

  return (
    <Sheet open={!!profile} onClose={onClose} z={69} center>
      <div className="p-4">
        <div className="myra-sheet-hero p-6 text-center">
          <img src={profile.avatar_url || AVATARS[0]} alt="" className="myra-sheet-avatar w-20 h-20 mx-auto mb-3" />
          <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 22, letterSpacing: "-0.02em", color: ON_DARK }}>{profile.username}</div>
          <div className="text-xs mt-1" style={{ color: onDark(48), fontFamily: F.m }}>@{(profile.handle || profile.username).replace(/^@/, "")}</div>
          {profile.role === "artist" && (
            <div className="inline-flex items-center gap-1 mt-2.5 px-2.5 py-1 rounded-full text-[10px] font-semibold" style={{ background: "rgba(139,92,246,0.2)", color: "#a78bfa", fontFamily: F.m }}>
              <BadgeCheck size={11} /> {t("soc.artistBadge")}
            </div>
          )}
          {/* GLASS здесь не годится: хиро всегда тёмное, а GLASS настроен под
              текущую тему — в светлой он дал бы тёмный текст на тёмной карточке */}
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => onToggleFollow(profile.id)}
            className="w-full mt-6 py-3.5 rounded-full text-sm font-semibold"
            style={isFollowing ? { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", color: ON_DARK, fontFamily: F.b } : { background: ACCENT_GRAD, color: "#fff", fontFamily: F.b }}
          >
            {isFollowing ? t("ar.following") : t("ar.follow")}
          </motion.button>
        </div>
      </div>
    </Sheet>
  );
}

// ─── Поиск реальных людей по username ─────────────────────────────────────────
// Пока единственный способ найти реальный профиль, на который можно
// подписаться (нет ни инвайт-ссылок на конкретный аккаунт, ни QR)

export function PeopleSearchSheet({ open, onClose, followingIds, onToggleFollow, onOpenProfile }: {
  open: boolean; onClose: () => void; followingIds: Set<string>;
  onToggleFollow: (id: string) => void; onOpenProfile: (p: PublicProfile) => void;
}) {
  const { t } = useLang();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) { setQuery(""); setResults([]); }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const h = setTimeout(() => {
      searchProfiles(query).then(r => { setResults(r); setLoading(false); });
    }, 300);
    return () => clearTimeout(h);
  }, [query]);

  return (
    <Sheet open={open} onClose={onClose} z={68}>
      <div className="px-6 pt-7 pb-8">
        <div className="flex items-center justify-between mb-5">
          <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 19, letterSpacing: "-0.02em" }}>{t("soc.searchTitle")}</div>
          <button onClick={onClose} aria-label={t("sheet.close")} title={t("sheet.close")} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--wash) 7%, transparent)" }}>
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-3 px-4 py-3.5 rounded-[18px] mb-5" style={GLASS}>
          <Search size={15} style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", flexShrink: 0 }} />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t("soc.searchPh")}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "var(--fg)", fontFamily: F.b }}
          />
          {query && <button onClick={() => setQuery("")}><X size={14} style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)" }} /></button>}
        </div>

        {loading && (
          <div className="text-xs text-center py-6" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.b }}>{t("soc.searching")}</div>
        )}
        {!loading && query.trim() !== "" && results.length === 0 && (
          <div className="text-xs text-center py-6" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.b }}>{t("soc.noResults")}</div>
        )}

        {results.length > 0 && (
          <div className="myra-sheet-card">
            {results.map(p => {
              const isFollowing = followingIds.has(p.id);
              return (
                <div key={p.id} className="myra-sheet-row" data-clickable>
                  <button onClick={() => onOpenProfile(p)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <img src={p.avatar_url || AVATARS[0]} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ fontFamily: F.b }}>{p.username}</div>
                      <div className="text-xs truncate" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.b }}>@{(p.handle || p.username).replace(/^@/, "")}</div>
                    </div>
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.94 }}
                    onClick={() => onToggleFollow(p.id)}
                    className="px-4 py-2 rounded-full text-xs font-semibold flex-shrink-0"
                    style={isFollowing ? { ...GLASS, fontFamily: F.b } : { background: ACCENT_GRAD, color: "#fff", fontFamily: F.b }}
                  >
                    {isFollowing ? t("ar.following") : t("ar.follow")}
                  </motion.button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Sheet>
  );
}

// ─── Страница альбома ─────────────────────────────────────────────────────────

export function AlbumSheet({ album, onClose, onPlay, currentTrack, playing, onOpenArtist }: {
  album: string | null; onClose: () => void; onPlay: (t: Track) => void;
  currentTrack: Track; playing: boolean; onOpenArtist: (name: string) => void;
}) {
  const { t } = useLang();
  const tracks = album ? ALL_TRACKS.filter(tr => tr.album === album) : [];
  const cover = tracks[0];
  if (!album || !cover) return <Sheet open={false} onClose={onClose} z={55}><div /></Sheet>;

  const totalDur = tracks.length;
  const c2 = cover.c2;

  return (
    <Sheet open={!!album} onClose={onClose} z={55} wide>
      {/* Хиро того же языка, что .myra-artist-hero у ArtistSheet — тёмный
          оверлей поверх обложки + акцент альбома через CSS custom property */}
      <div className="myra-album-hero relative" style={{ "--album-accent": c2 } as React.CSSProperties}>
        <img src={cover.img} alt="" className="w-full h-full object-cover" />
        {/* Ненавязчивый DETAIL поверх обложки — под тёмным градиентом (::after),
            поэтому не спорит с реальным фото альбома, только добавляет свечение по краям */}
        <DetailBackdrop variant="blur" accent={c2} active={playing} />
        <button onClick={onClose} aria-label={t("sheet.close")} title={t("sheet.close")} className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(10px)", color: ON_DARK }}>
          <X size={16} />
        </button>
        <div className="myra-album-identity absolute bottom-5 left-6 right-6">
          <span className="myra-album-eyebrow">{t("al.type")}</span>
          <div className="myra-album-title">{album}</div>
          <button onClick={() => onOpenArtist(cover.artist)} className="myra-album-sub">{cover.artist} · {t("al.nTracks", totalDur)}</button>
        </div>
      </div>

      <div className="px-6 pt-5 pb-8">
        <div className="flex gap-2.5 mb-6">
          <motion.button whileTap={{ scale: 0.94 }} onClick={() => tracks[0] && onPlay(tracks[0])} className="flex-1 py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2" style={{ background: `linear-gradient(135deg, ${c2}, ${c2}99)`, color: "#fff", fontFamily: F.b }}>
            <Play size={16} fill="white" stroke="none" className="ml-0.5" /> {t("al.play")}
          </motion.button>
          {/* Шафл честный: реально запускает случайный трек альбома */}
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => { const tr = tracks[Math.floor(Math.random() * tracks.length)]; if (tr) { onPlay(tr); toast(t("al.shuffled")); } }} className="px-5 rounded-full text-sm font-semibold" style={{ ...GLASS, fontFamily: F.b }}>
            <Shuffle size={15} />
          </motion.button>
        </div>

        {/* Строки треков — переиспользуем .myra-track-row (Полка/PremiumTrackRow),
            не заводим отдельный стиль строки под альбом */}
        <div className="flex flex-col gap-1">
          {tracks.map(tr => {
            const active = currentTrack.id === tr.id && playing;
            return (
              <div key={tr.id} className={`myra-track-row${active ? " is-active" : ""}`} onClick={() => onPlay(tr)}>
                <div className="myra-track-row-cover">
                  <img src={tr.img} alt="" loading="lazy" decoding="async" />
                  <span>{active ? <EQ color="#fff" size={11} /> : <Play size={13} fill="currentColor" strokeWidth={0} />}</span>
                </div>
                <div className="myra-track-row-copy">
                  <strong>{tr.title}</strong>
                  <button onClick={e => { e.stopPropagation(); onOpenArtist(tr.artist); }}>{tr.artist}</button>
                </div>
                <span className="myra-track-row-genre">{tr.genre}</span>
                <span className="myra-track-row-duration">{tr.duration}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}

// ─── Плейлист с drag-n-drop ───────────────────────────────────────────────────

export function PlaylistSheet({ playlistId, onClose, onPlay, currentTrack, playing, order, onReorder, playlists = PLAYLISTS, customPlIds, onDelete }: {
  playlistId: string | null; onClose: () => void; onPlay: (t: Track) => void;
  currentTrack: Track; playing: boolean;
  order: number[]; onReorder: (ids: number[]) => void;
  playlists?: typeof PLAYLISTS;
  customPlIds?: Set<string>; onDelete?: (id: string) => void;
}) {
  const { t } = useLang();
  const pl = playlists.find(p => p.id === playlistId) ?? null;
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const tracks = order.map(id => ALL_TRACKS.find(tr => tr.id === id)).filter((tr): tr is Track => !!tr);
  // Плейлисты (в т.ч. созданные пользователем) не хранят свой акцентный цвет —
  // берём его у первого трека, с нейтральным фиолетовым фолбэком для пустого
  const accent = tracks[0]?.c2 ?? "#8b5cf6";

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onReorder(next);
    toast(t("pl.reordered"));
  };

  if (!pl) return <Sheet open={false} onClose={onClose} z={56}><div /></Sheet>;

  return (
    <Sheet open={!!playlistId} onClose={onClose} z={56} wide>
      {/* Тот же хиро-приём, что у AlbumSheet/ArtistSheet — акцент из первого трека */}
      <div className="myra-playlist-hero relative" style={{ "--playlist-accent": accent } as React.CSSProperties}>
        <img src={pl.img} alt="" className="w-full h-full object-cover" />
        <button onClick={onClose} aria-label={t("sheet.close")} title={t("sheet.close")} className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center z-10" style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(10px)", color: ON_DARK }}>
          <X size={16} />
        </button>
        {customPlIds?.has(pl.id) && (
          <button onClick={() => { onDelete?.(pl.id); onClose(); }} className="absolute top-4 right-16 w-9 h-9 rounded-full flex items-center justify-center z-10" style={{ background: "rgba(248,113,113,0.16)", backdropFilter: "blur(10px)" }}>
            <Trash2 size={15} style={{ color: "#f87171" }} />
          </button>
        )}
        <div className="myra-playlist-hero-identity absolute bottom-5 left-6 right-6">
          <span className="myra-playlist-hero-eyebrow">{t("lib.playlists")}</span>
          <div className="myra-playlist-hero-title">{pl.name}</div>
          <div className="myra-playlist-hero-sub">{t("lib.nTracks", tracks.length)}</div>
        </div>
      </div>

      <div className="px-6 pt-5 pb-8">
        {tracks.length > 0 && (
          <div className="flex gap-2.5 mb-5">
            <motion.button whileTap={{ scale: 0.94 }} onClick={() => onPlay(tracks[0])} className="flex-1 py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}99)`, color: "#fff", fontFamily: F.b }}>
              <Play size={16} fill="white" stroke="none" className="ml-0.5" /> {t("pl.playAll")}
            </motion.button>
            {/* Шафл честный: реально запускает случайный трек плейлиста */}
            <motion.button whileTap={{ scale: 0.96 }} onClick={() => { const tr = tracks[Math.floor(Math.random() * tracks.length)]; if (tr) { onPlay(tr); toast(t("pl.plShuffled")); } }} className="px-5 rounded-full text-sm font-semibold" style={{ ...GLASS, fontFamily: F.b }}>
              <Shuffle size={15} />
            </motion.button>
          </div>
        )}

        <div className="flex items-center gap-1.5 mb-4">
          <GripVertical size={12} style={{ color: "color-mix(in srgb, var(--fg) 28%, transparent)" }} />
          <span className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "color-mix(in srgb, var(--fg) 32%, transparent)", fontFamily: F.m }}>{t("pl.dragHint")}</span>
        </div>

        {tracks.length === 0 ? (
          <div className="myra-empty-state">
            <span>{t("pl.emptyTracks")}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {/* Драг-н-дроп полностью как был: те же dragIdx/overIdx, тот же
                reorder(from, to) — меняется только визуальное оформление строки */}
            {tracks.map((tr, i) => {
              const active = currentTrack.id === tr.id && playing;
              const rowClass = `myra-playlist-track-row${active ? " is-active" : ""}${dragIdx === i ? " is-drag-source" : ""}${overIdx === i && dragIdx !== null ? " is-drag-over" : ""}`;
              return (
                <motion.div
                  key={tr.id}
                  layout
                  draggable
                  onDragStart={() => setDragIdx(i)}
                  onDragOver={e => { e.preventDefault(); setOverIdx(i); }}
                  onDragEnd={() => { if (dragIdx !== null && overIdx !== null) reorder(dragIdx, overIdx); setDragIdx(null); setOverIdx(null); }}
                  onClick={() => onPlay(tr)}
                  className={rowClass}
                >
                  <GripVertical size={14} className="myra-playlist-track-row-grip" />
                  <div className="myra-playlist-track-row-cover">
                    <img src={tr.img} alt="" loading="lazy" decoding="async" />
                    <span>{active ? <EQ color="#fff" size={11} /> : <Play size={13} fill="currentColor" strokeWidth={0} />}</span>
                  </div>
                  <div className="myra-playlist-track-row-copy">
                    <strong>{tr.title}</strong>
                    <span>{tr.artist}</span>
                  </div>
                  <span className="myra-playlist-track-row-duration">{tr.duration}</span>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </Sheet>
  );
}

// ─── Blend-экран ──────────────────────────────────────────────────────────────

export function BlendSheet({ friend, onClose, onPlay, currentTrack, playing, avatar }: {
  friend: Friend | null; onClose: () => void; onPlay: (t: Track) => void;
  currentTrack: Track; playing: boolean; avatar: string;
}) {
  const { t, lang } = useLang();
  if (!friend) return <Sheet open={false} onClose={onClose} z={60}><div /></Sheet>;

  const fname = lang === "ru" ? friend.name : friend.en;
  const finst = lang === "ru" ? friend.inst : friend.en;
  const c2 = friend.track.c2;

  // 5 общих треков: трек друга + 4 по совпадению вкуса
  const shared = [friend.track.id, 1, 3, 6, 5];

  return (
    <Sheet open={!!friend} onClose={onClose} z={60}>
      <div className="px-6 pt-6 pb-8">
        {/* Тёмное хиро вместо Aurora на всю шторку — слияние аватаров
            и процент совпадения теперь живут в одной карточке-«обложке» */}
        <div className="myra-sheet-hero p-6 mb-6" style={{ "--sheet-accent": c2 } as React.CSSProperties}>
          <button onClick={onClose} aria-label={t("sheet.close")} title={t("sheet.close")} className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center z-20" style={{ background: "rgba(0,0,0,0.35)", color: ON_DARK }}>
            <X size={16} />
          </button>

          {/* Слияние аватаров */}
          <div className="relative z-10 flex justify-center items-center mb-4" style={{ height: 96 }}>
            <motion.img initial={{ x: -30, opacity: 0 }} animate={{ x: 12, opacity: 1 }} transition={{ ...SPRING, delay: 0.1 }} src={avatar} alt="" className="w-20 h-20 rounded-full object-cover relative" style={{ border: `3px solid ${c2}`, zIndex: 2 }} />
            <motion.img initial={{ x: 30, opacity: 0 }} animate={{ x: -12, opacity: 1 }} transition={{ ...SPRING, delay: 0.18 }} src={friend.img} alt="" className="w-20 h-20 rounded-full object-cover" style={{ border: "3px solid #8b5cf6", zIndex: 1 }} />
          </div>

          <div className="relative z-10 text-center">
            <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 24, letterSpacing: "-0.03em", color: ON_DARK }}>{t("bl.title", finst)}</div>
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, ...SPRING }} className="inline-flex items-baseline gap-2 mt-2 px-4 py-1.5 rounded-full" style={{ background: `${c2}24`, border: `1px solid ${c2}45` }}>
              <span style={{ fontFamily: F.d, fontWeight: 900, fontSize: 22, color: c2 }}>{friend.match}%</span>
              <span className="text-xs" style={{ color: onDark(58), fontFamily: F.b }}>{t("bl.match")}</span>
            </motion.div>
          </div>
        </div>

        {/* Общие жанры */}
        <div className="mb-6">
          <span className="myra-sheet-eyebrow">{t("bl.genres")}</span>
          <div className="flex gap-2 flex-wrap">
            {["Lo-fi", "Synthwave", "Indie"].map(g => (
              <span key={g} className="px-3.5 py-1.5 rounded-full text-xs font-medium" style={{ ...GLASS, fontFamily: F.b, color: "color-mix(in srgb, var(--fg) 75%, transparent)" }}>{g}</span>
            ))}
          </div>
        </div>

        {/* Плейлист */}
        <div>
          <div className="flex items-baseline justify-between">
            <span className="myra-sheet-eyebrow">{t("bl.playlist")}</span>
            <span className="text-[10px]" style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)", fontFamily: F.m }}>{t("bl.updates")}</span>
          </div>
          <BlendTracks ids={shared} onPlay={onPlay} currentTrack={currentTrack} playing={playing} c2={c2} />

          <div className="flex gap-2.5 mt-5">
            <motion.button whileTap={{ scale: 0.96 }} onClick={() => toast(t("bl.updated", finst))} className="flex-1 py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2" style={{ ...GLASS, fontFamily: F.b }}>
              <RefreshCw size={13} /> {t("bl.refresh")}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={async () => {
                const link = `https://myra.app/i/${genInviteCode()}`;
                await copyText(link);
                toast(t("bl.invited", link));
              }}
              className="flex-1 py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(135deg, ${c2}, ${c2}99)`, color: "#fff", fontFamily: F.b }}
            >
              <UserPlus size={13} /> {t("bl.invite")}
            </motion.button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function BlendTracks({ ids, onPlay, currentTrack, playing, c2 }: {
  ids: number[]; onPlay: (t: Track) => void; currentTrack: Track; playing: boolean; c2: string;
}) {
  const { t } = useLang();
  const seen = new Set<number>();
  const list = ids.map(id => ALL_TRACKS.find(tr => tr.id === id) ?? ALL_TRACKS[id % ALL_TRACKS.length]).filter(tr => {
    if (seen.has(tr.id)) return false;
    seen.add(tr.id);
    return true;
  });
  return (
    <div className="flex flex-col gap-1">
      {list.map((tr, i) => (
        <motion.div key={tr.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }} onClick={() => onPlay(tr)} className="myra-blend-row">
          <div className="myra-blend-row-cover">
            <img src={tr.img} alt="" loading="lazy" decoding="async" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate flex items-center gap-2" style={{ fontFamily: F.b }}>
              {tr.title}
              {currentTrack.id === tr.id && playing && <EQ color={c2} size={9} />}
            </div>
            <div className="text-xs truncate" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.b }}>{tr.artist}</div>
          </div>
          <Play size={13} style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }} />
        </motion.div>
      ))}
    </div>
  );
}

// ─── Аккаунт ──────────────────────────────────────────────────────────────────

export function AccountSheet({ open, onClose, userName, onRename, email, onSetEmail, handle, onSetHandle, avatarIdx, onAvatar, customAvatar, onAvatarFile, onDeleted, onOpenImport, onOpenSupport, level, xpIntoLevel, xpForLevel, minutesWeek, streak, topGenre, planLabel, onOpenPlan }: {
  open: boolean; onClose: () => void; userName: string; onRename: (n: string) => void;
  email: string; onSetEmail: (email: string) => void;
  handle: string; onSetHandle: (handle: string) => void;
  avatarIdx: number; onAvatar: (i: number) => void; customAvatar: string | null; onAvatarFile: (dataUrl: string) => void; onDeleted: () => void; onOpenImport: () => void; onOpenSupport: () => void;
  level: number; xpIntoLevel: number; xpForLevel: number; minutesWeek: number; streak: number; topGenre: string | null;
  planLabel: string; onOpenPlan: () => void;
}) {
  const { t } = useLang();
  const [name, setName] = useState(userName);
  const [emailInput, setEmailInput] = useState(email);
  const [handleInput, setHandleInput] = useState(handle);
  const [deleteQ, setDeleteQ] = useState(false);
  const [xpInfoOpen, setXpInfoOpen] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyCount, setPasskeyCount] = useState(0);
  useEffect(() => { setName(userName); }, [userName, open]);
  useEffect(() => { setEmailInput(email); }, [email, open]);
  useEffect(() => { setHandleInput(handle); }, [handle, open]);
  useEffect(() => {
    if (!open || !passkeysEnabled) return;
    listPasskeys()
      .then(({ data }) => setPasskeyCount(data?.length ?? 0))
      .catch(() => setPasskeyCount(0));
  }, [open]);

  const enrollPasskey = async () => {
    if (passkeyBusy || !canUsePasskeys()) return;
    setPasskeyBusy(true);
    try {
      const { error } = await registerPasskey();
      if (error) { toast.error(t("acc.passkeyFailed")); return; }
      const { data } = await listPasskeys();
      setPasskeyCount(data?.length ?? Math.max(1, passkeyCount));
      toast.success(t("acc.passkeyAdded"));
    } finally {
      setPasskeyBusy(false);
    }
  };

  const saveEmail = () => {
    const v = emailInput.trim();
    if (v && !/.+@.+\..+/.test(v)) { toast(t("acc.emailInvalid")); return; }
    onSetEmail(v);
    toast(t("acc.emailSaved"));
  };

  const saveHandle = () => {
    let v = handleInput.trim();
    if (!v.startsWith("@")) v = "@" + v;
    const slug = v.slice(1);
    if (!/^[a-zа-яё0-9_]{2,24}$/i.test(slug)) { toast(t("acc.handleInvalid")); return; }
    onSetHandle(v);
    toast(t("acc.handleSaved"));
  };

  return (
    <>
      <Sheet open={open} onClose={onClose} z={65}>
        <div className="px-6 pt-7 pb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="myra-page-eyebrow">MYRA ACCOUNT</span>
              <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 24, letterSpacing: "-0.03em" }}>{t("acc.title")}</div>
            </div>
            <button onClick={onClose} aria-label={t("sheet.close")} title={t("sheet.close")} className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)" }}>
              <X size={16} />
            </button>
          </div>

          {/* Уровень меломана — тёмная hero-карточка со свечением (тот же язык,
              что у Рейтинга/Студии), а не голая GLASS-плашка. Фон карточки
              всегда тёмный независимо от темы, поэтому текст внутри — на
              ON_DARK/onDark(), а не на var(--fg) (иначе в светлой теме текст
              стал бы тёмным на тёмном) */}
          <div className="myra-account-hero mb-6">
            <Aurora c2="#8b5cf6" opacity={0.35} />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold" style={{ fontFamily: F.d, letterSpacing: "-0.01em", color: ON_DARK }}>{t("acc.level", level)}</span>
                  <button onClick={() => setXpInfoOpen(true)} className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ color: onDark(40) }}>
                    <HelpCircle size={14} />
                  </button>
                </div>
                <span className="text-[10px]" style={{ fontFamily: F.m, color: onDark(45) }}>{xpIntoLevel} / {xpForLevel} XP</span>
              </div>
              <div className="rounded-full overflow-hidden mb-3" style={{ height: 6, background: "rgba(255,255,255,0.12)" }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (xpIntoLevel / xpForLevel) * 100)}%` }} transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }} className="h-full rounded-full" style={{ background: "linear-gradient(90deg, #8b5cf6, #c4b5fd)" }} />
              </div>
              <div className="myra-account-hero-stats">
                {[[String(minutesWeek), t("acc.stMin")], [String(streak), t("acc.stStreak")], [topGenre ?? "—", t("acc.stGenre")]].map(([v, l]) => (
                  <div key={l}>
                    <div className="text-xs font-bold truncate" style={{ fontFamily: F.d, color: "#c4b5fd" }}>{v}</div>
                    <div className="text-[9px] mt-0.5 truncate" style={{ fontFamily: F.b, color: onDark(46) }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Аватар */}
          <span className="myra-account-section-label">{t("acc.avatar")}</span>
          <div className="flex gap-3 mb-6">
            {customAvatar && (
              <div className="relative rounded-full">
                <img src={customAvatar} alt="" className="w-14 h-14 rounded-full object-cover" style={{ border: "2.5px solid #8b5cf6" }} />
                <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "#8b5cf6" }}><Check size={11} /></div>
              </div>
            )}
            {AVATARS.map((a, i) => (
              <motion.button key={a} whileTap={{ scale: 0.9 }} onClick={() => onAvatar(i)} className="relative rounded-full">
                <img src={a} alt="" className="w-14 h-14 rounded-full object-cover" style={{ border: avatarIdx === i && !customAvatar ? "2.5px solid #8b5cf6" : "2.5px solid color-mix(in srgb, var(--wash) 10%, transparent)", opacity: avatarIdx === i && !customAvatar ? 1 : 0.6 }} />
                {avatarIdx === i && !customAvatar && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "#8b5cf6" }}>
                    <Check size={11} />
                  </div>
                )}
              </motion.button>
            ))}
            <label className="w-14 h-14 rounded-full flex items-center justify-center cursor-pointer flex-shrink-0" style={{ border: "2px dashed color-mix(in srgb, var(--fg) 25%, transparent)" }} title="upload">
              <ImagePlus size={18} style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)" }} />
              <input type="file" accept="image/*" className="hidden" onChange={e => {
                const f = e.target.files?.[0]; e.target.value = "";
                if (!f) return;
                const img = new Image();
                img.onload = () => {
                  const s = 160, cv = document.createElement("canvas");
                  cv.width = s; cv.height = s;
                  const cx = cv.getContext("2d")!;
                  const k = Math.max(s / img.width, s / img.height);
                  cx.drawImage(img, (s - img.width * k) / 2, (s - img.height * k) / 2, img.width * k, img.height * k);
                  onAvatarFile(cv.toDataURL("image/jpeg", 0.85));
                  toast(t("acc.photoSet"));
                  URL.revokeObjectURL(img.src);
                };
                img.src = URL.createObjectURL(f);
              }} />
            </label>
          </div>

          {/* Личные данные: имя/хендл/почта теперь одна карточка с разделителями
              вместо трёх одинаковых GLASS-плашек подряд — подпись поля живёт
              над инпутом, кнопка сохранения — компактно справа от него */}
          <span className="myra-account-section-label">{t("acc.sectionProfile")}</span>
          <div className="myra-account-card mb-6">
            <div className="myra-account-field">
              <div className="flex-1 min-w-0">
                <div className="myra-account-field-label">{t("acc.name")}</div>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-transparent outline-none text-sm"
                  style={{ color: "var(--fg)", fontFamily: F.b }}
                />
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => { if (name.trim()) { onRename(name.trim()); toast(t("acc.saved")); } }} className="px-4 py-2 rounded-xl text-xs font-semibold flex-shrink-0" style={{ background: "linear-gradient(135deg, #8b5cf6, #a78bfa)", fontFamily: F.b }}>
                {t("acc.save")}
              </motion.button>
            </div>
            <div className="myra-account-field">
              <div className="flex-1 min-w-0">
                <div className="myra-account-field-label">{t("acc.handle")}</div>
                <input
                  value={handleInput}
                  onChange={e => setHandleInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveHandle(); }}
                  className="w-full bg-transparent outline-none text-sm"
                  style={{ color: "var(--fg)", fontFamily: F.b }}
                />
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={saveHandle} className="px-4 py-2 rounded-xl text-xs font-semibold flex-shrink-0" style={{ background: "linear-gradient(135deg, #8b5cf6, #a78bfa)", fontFamily: F.b }}>
                {t("acc.save")}
              </motion.button>
            </div>
            <div className="myra-account-field">
              <Mail size={14} style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <div className="myra-account-field-label">{t("acc.email")}</div>
                <input
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveEmail(); }}
                  type="email"
                  placeholder={t("acc.emailPlaceholder")}
                  className="w-full bg-transparent outline-none text-sm"
                  style={{ color: "var(--fg)", fontFamily: F.b }}
                />
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={saveEmail} className="px-4 py-2 rounded-xl text-xs font-semibold flex-shrink-0" style={{ background: "linear-gradient(135deg, #8b5cf6, #a78bfa)", fontFamily: F.b }}>
                {t("acc.save")}
              </motion.button>
            </div>
          </div>

          {/* Подписка, импорт, поддержка — одна карточка строк с ховером вместо
              трёх отдельных GLASS-плашек */}
          {passkeysEnabled && (
            <>
              <span className="myra-account-section-label">{t("acc.sectionSecurity")}</span>
              <div className="myra-account-card mb-6">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.99 }}
                  disabled={passkeyBusy || !canUsePasskeys()}
                  onClick={enrollPasskey}
                  className="myra-account-row w-full text-left disabled:opacity-45"
                >
                  <KeyRound size={15} style={{ color: "#c4b5fd" }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm" style={{ fontFamily: F.b }}>{t("acc.passkey")}</div>
                    <div className="text-[10px]" style={{ color: "color-mix(in srgb, var(--fg) 35%, transparent)", fontFamily: F.m }}>
                      {passkeyCount > 0 ? t("acc.passkeyCount", passkeyCount) : t("acc.passkeySub")}
                    </div>
                  </div>
                  <span className="text-[10px]" style={{ color: "#c4b5fd", fontFamily: F.m }}>
                    {passkeyBusy ? t("acc.passkeyAdding") : t("acc.passkeyAdd")}
                  </span>
                </motion.button>
              </div>
            </>
          )}

          <span className="myra-account-section-label">{t("acc.sectionMore")}</span>
          <div className="myra-account-card mb-6">
            <motion.div whileTap={{ scale: 0.99 }} onClick={() => { onClose(); onOpenPlan(); }} className="myra-account-row">
              <Crown size={15} style={{ color: "#facc15" }} />
              <div className="flex-1 text-sm" style={{ fontFamily: F.b }}>{t("acc.plan")}</div>
              <div className="text-xs" style={{ color: "#facc15", fontFamily: F.m }}>{planLabel}</div>
              <ChevronRight size={15} style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }} />
            </motion.div>
            <motion.div whileTap={{ scale: 0.99 }} onClick={() => { onClose(); onOpenImport(); }} className="myra-account-row">
              <ImportIcon size={15} style={{ color: "#8b5cf6" }} />
              <div className="flex-1">
                <div className="text-sm" style={{ fontFamily: F.b }}>{t("im2.row")}</div>
                <div className="text-[10px]" style={{ color: "color-mix(in srgb, var(--fg) 35%, transparent)", fontFamily: F.m }}>{t("im2.rowSub")}</div>
              </div>
              <ChevronRight size={15} style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }} />
            </motion.div>
            <motion.div whileTap={{ scale: 0.99 }} onClick={() => { onClose(); onOpenSupport(); }} className="myra-account-row">
              <MessageCircle size={15} style={{ color: "#34d399" }} />
              <div className="flex-1">
                <div className="text-sm" style={{ fontFamily: F.b }}>{t("acc.support")}</div>
                <div className="text-[10px]" style={{ color: "color-mix(in srgb, var(--fg) 35%, transparent)", fontFamily: F.m }}>{t("acc.supportSub")}</div>
              </div>
              <ChevronRight size={15} style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }} />
            </motion.div>
          </div>

          {/* Правовые документы */}
          <span className="myra-account-section-label">{t("acc.sectionDocs")}</span>
          <div className="myra-account-card mb-6">
            <a href="./privacy.html" target="_blank" rel="noopener noreferrer" className="myra-account-row">
              <ShieldCheck size={15} style={{ color: "#60a5fa" }} />
              <div className="flex-1 text-sm" style={{ fontFamily: F.b }}>{t("acc.privacy")}</div>
              <ChevronRight size={15} style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }} />
            </a>
            <a href="./terms.html" target="_blank" rel="noopener noreferrer" className="myra-account-row">
              <FileText size={15} style={{ color: "#a3a3a3" }} />
              <div className="flex-1 text-sm" style={{ fontFamily: F.b }}>{t("acc.terms")}</div>
              <ChevronRight size={15} style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }} />
            </a>
            <a href="./support.html" target="_blank" rel="noopener noreferrer" className="myra-account-row">
              <Headset size={15} style={{ color: "#34d399" }} />
              <div className="flex-1 text-sm" style={{ fontFamily: F.b }}>{t("acc.support")}</div>
              <ChevronRight size={15} style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }} />
            </a>
            <a href="./contacts.html" target="_blank" rel="noopener noreferrer" className="myra-account-row">
              <Mail size={15} style={{ color: "#818cf8" }} />
              <div className="flex-1 text-sm" style={{ fontFamily: F.b }}>{t("acc.contacts")}</div>
              <ChevronRight size={15} style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }} />
            </a>
            <a href="./copyright.html" target="_blank" rel="noopener noreferrer" className="myra-account-row">
              <ShieldCheck size={15} style={{ color: "#fbbf24" }} />
              <div className="flex-1 text-sm" style={{ fontFamily: F.b }}>{t("acc.copyright")}</div>
              <ChevronRight size={15} style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }} />
            </a>
            <a href="./report-content.html" target="_blank" rel="noopener noreferrer" className="myra-account-row">
              <Flag size={15} style={{ color: "#f87171" }} />
              <div className="flex-1 text-sm" style={{ fontFamily: F.b }}>{t("acc.reportContent")}</div>
              <ChevronRight size={15} style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }} />
            </a>
          </div>

          <motion.button whileTap={{ scale: 0.98 }} onClick={() => setDeleteQ(true)} className="myra-account-danger">
            <Trash2 size={14} /> {t("acc.delete")}
          </motion.button>
        </div>
      </Sheet>

      <ConfirmSheet
        open={deleteQ}
        onClose={() => setDeleteQ(false)}
        title={t("acc.deleteQ")}
        sub={t("acc.deleteSub")}
        confirmLabel={t("acc.deleteYes")}
        cancelLabel={t("pr.cancel")}
        danger
        onConfirm={() => { setDeleteQ(false); onClose(); onDeleted(); }}
      />

      <Sheet open={xpInfoOpen} onClose={() => setXpInfoOpen(false)} z={68}>
        <div className="px-6 pt-7 pb-8">
          <div className="flex items-center justify-between mb-6">
            <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 20, letterSpacing: "-0.03em" }}>{t("acc.xpInfoTitle")}</div>
            <button onClick={() => setXpInfoOpen(false)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)" }}>
              <X size={16} />
            </button>
          </div>

          <div className="rounded-2xl p-4 mb-6" style={GLASS}>
            <div className="text-xs font-bold uppercase tracking-[0.1em] mb-2" style={{ color: "#a78bfa", fontFamily: F.m }}>{t("acc.xpHowTitle")}</div>
            <div className="text-sm" style={{ color: "color-mix(in srgb, var(--fg) 70%, transparent)", fontFamily: F.b, lineHeight: 1.55 }}>{t("acc.xpHowBody")}</div>
          </div>

          {/* Списка «наград за уровни» больше нет: значки, рамки и скидки из него
              не существовали в коде — обещания без реализации нарушают принцип
              честности. Вернём, когда награды станут настоящими */}
        </div>
      </Sheet>
    </>
  );
}

// ─── MYRA Pro (монетизация, бывш. Creator+) ───────────────────────────────────

export function CreatorPlusSheet({ open, onClose, status, onActivate, onCancelSub, onResume }: {
  open: boolean; onClose: () => void; status: "none" | "active" | "grace"; onActivate: () => void; onCancelSub: () => void; onResume: () => void;
}) {
  const { t } = useLang();
  const [state, setState] = useState<"offer" | "paying" | "done">("offer");
  const [cancelQ, setCancelQ] = useState(false);
  useEffect(() => { if (open) setState(status !== "none" ? "done" : "offer"); }, [open, status]);

  const pay = async () => {
    setState("paying");

    // Сначала пробуем настоящий платёж через ЮKassa (см. create-payment/index.ts).
    // Если она настроена — уводим на её hosted-страницу оплаты; активацию
    // подписки (status='active') в этом случае ставит вебхук после
    // подтверждённой оплаты, а не onActivate() здесь оптимистично
    try {
      const { data, error } = await createPayment("subscription", 499, { planId: "pro" });
      if (data?.confirmation_url) {
        window.location.href = data.confirmation_url;
        return;
      }
      if (error) throw error;
    } catch (err) {
      console.warn("createPayment:", err);
    }
    setState("offer");
    toast.error(t("pay.unavailable"));
  };

  const BENEFITS = [
    { Icon: ArrowDownToLine, title: t("cp.b1"), sub: t("cp.b1Sub") },
    { Icon: Zap, title: t("cp.b2"), sub: t("cp.b2Sub") },
    { Icon: LineChart, title: t("cp.b3"), sub: t("cp.b3Sub") },
    { Icon: Headset, title: t("cp.b4"), sub: t("cp.b4Sub") },
    { Icon: Sparkles, title: t("cp.b5"), sub: t("cp.b5Sub") },
  ];

  return (
    <Sheet open={open} onClose={onClose} z={65}>
      <div className="relative px-6 pt-8 pb-8">
        <button onClick={onClose} aria-label={t("sheet.close")} title={t("sheet.close")} className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center z-20" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)" }}>
          <X size={16} />
        </button>

        {state === "done" ? (
          // Статус подписки — та же премиальная тёмная hero-карточка со свечением,
          // что и предложение оформить: активный/grace-статус теперь тоже
          // «настоящая» карточка, а не голый текст по центру шторки
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SPRING} className="myra-plus-done" style={{ "--plus-accent": "#8b5cf6" } as React.CSSProperties}>
            <Aurora c2="#8b5cf6" opacity={0.55} />
            <div className="relative z-10">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...SPRING, delay: 0.15 }} className="w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center" style={{ background: "rgba(52,211,153,0.13)", border: "1.5px solid rgba(52,211,153,0.4)" }}>
                <Check size={34} style={{ color: "#34d399" }} />
              </motion.div>
              <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 24, letterSpacing: "-0.03em", color: "#f7f5ff" }}>{t("cp.done")}</div>
              <div className="text-sm mt-2 mb-2" style={{ color: "rgba(239,236,250,0.58)", fontFamily: F.b }}>{t("cp.doneSub")}</div>
              <div className="text-xs mb-7" style={{ color: status === "grace" ? "#fb923c" : "rgba(239,236,250,0.4)", fontFamily: F.m }}>{status === "grace" ? t("cp.graceNote") : t("cp.cancel")}</div>
              <motion.button whileTap={{ scale: 0.96 }} onClick={onClose} className="px-10 py-3 rounded-full text-sm font-semibold" style={{ background: "linear-gradient(135deg, #8b5cf6, #a78bfa)", color: "#fff", fontFamily: F.b }}>
                {t("cp.great")}
              </motion.button>
              {status === "grace" ? (
                <button onClick={() => { onResume(); toast.success(t("cp.resumed")); }} className="block mx-auto mt-4 text-xs font-semibold" style={{ color: "#34d399", fontFamily: F.b }}>
                  {t("cp.resume")}
                </button>
              ) : (
                <button onClick={() => setCancelQ(true)} className="block mx-auto mt-4 text-xs transition-colors hover:text-red-300" style={{ color: "rgba(248,113,113,0.75)", fontFamily: F.b }}>
                  {t("cp.cancelBtn")}
                </button>
              )}
            </div>
          </motion.div>
        ) : (
          <>
            {/* Hero — та же порода карточки, что у апсейла в Студии (тёмное
                свечение под цвет тарифа), но теперь это полноценная шапка
                шторки: чип, заголовок, подпись и вынесенная отдельно цена */}
            <div className="myra-plus-hero mb-6" style={{ "--plus-accent": "#8b5cf6" } as React.CSSProperties}>
              <Aurora c2="#8b5cf6" opacity={0.5} />
              <div className="relative z-10">
                <span className="myra-plus-chip"><Crown size={12} /> {t("cp.title")}</span>
                <div className="myra-plus-hero-title">{t("cr.earn")}</div>
                <div className="myra-plus-hero-sub">{t("cp.sub")}</div>
                <div className="myra-plus-hero-price">
                  <strong>499₽</strong>
                  <span>{t("cp.perMonth")}</span>
                </div>
              </div>
            </div>

            {/* Плашка «зарабатывают в 2.4 раза больше» удалена: статистика была
                выдумана — у MYRA пока нет данных, чтобы такое утверждать */}
            <div className="myra-plus-benefits mb-6">
              {BENEFITS.map((b, i) => (
                <motion.div key={b.title} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 + i * 0.07 }} className="myra-plus-benefit-row" style={{ "--plus-accent": "#8b5cf6" } as React.CSSProperties}>
                  <div className="myra-plus-benefit-icon"><b.Icon size={15} /></div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold" style={{ fontFamily: F.b }}>{b.title}</div>
                    <div className="text-xs mt-0.5" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{b.sub}</div>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              disabled={state === "paying"}
              onClick={pay}
              className="w-full py-4 rounded-full text-sm font-bold flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #8b5cf6, #a78bfa)", color: "#fff", fontFamily: F.b, boxShadow: "0 12px 40px rgba(139,92,246,0.4)" }}
            >
              {state === "paying" ? (<><Loader2 size={16} className="animate-spin" /> {t("cp.paying")}</>) : t("cp.pay")}
            </motion.button>
            {/* Та же честная подпись, что у Plus и донатов */}
            <div className="text-[10px] text-center mt-2.5" style={{ color: "color-mix(in srgb, var(--fg) 35%, transparent)", fontFamily: F.m }}>{t("don.simNote")}</div>
          </>
        )}
      </div>

      <ConfirmSheet
        open={cancelQ}
        onClose={() => setCancelQ(false)}
        title={t("cp.cancelQ")}
        sub={t("cp.cancelSub")}
        confirmLabel={t("cp.cancelBtn")}
        cancelLabel={t("pr.cancel")}
        danger
        onConfirm={() => { setCancelQ(false); onCancelSub(); toast(t("cp.cancelled")); onClose(); }}
      />
    </Sheet>
  );
}

// ─── Wrapped ──────────────────────────────────────────────────────────────────

const WRAPPED_SLIDE_MS = 4000;

export function WrappedModal({ open, onClose, minutes, topArtistName, topArtistImg, topGenreName, tracksCount, genresCount }: {
  open: boolean; onClose: () => void;
  minutes: number; topArtistName: string | null; topArtistImg?: string; topGenreName: string | null;
  tracksCount: number; genresCount: number;
}) {
  const { t } = useLang();
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [fillPct, setFillPct] = useState(0);
  const rafRef = useRef<number | undefined>(undefined);
  const lastTsRef = useRef(0);
  const elapsedRef = useRef(0);
  const suppressClickRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Честно: если пользователь ещё ничего не слушал в этом месяце, показываем один
  // слайд-заглушку вместо придуманной истории
  const hasData = tracksCount > 0;
  const SLIDES = hasData ? [
    { c1: "#12083a", c2: "#8b5cf6", eyebrow: t("wr.minutesEyebrow"), big: t("wr.minutes", minutes), sub: t("wr.minutesSub"), img: "", share: false },
    ...(topArtistName ? [{ c1: "#1a0a08", c2: "#fb923c", eyebrow: t("wr.artistEyebrow"), big: topArtistName, sub: t("wr.artist"), img: topArtistImg ?? "", share: false }] : []),
    ...(topGenreName ? [{ c1: "#071a10", c2: "#34d399", eyebrow: t("wr.genreEyebrow"), big: topGenreName, sub: t("wr.genre"), img: "", share: false }] : []),
    { c1: "#181200", c2: "#facc15", eyebrow: t("wr.tracksEyebrow"), big: String(tracksCount), sub: t("wr.tracksSub", genresCount), img: "", share: false },
    { c1: "#0f0818", c2: "#f472b6", eyebrow: t("wr.shareEyebrow"), big: t("wr.shareTitle"), sub: "", img: "", share: true },
  ] : [
    { c1: "#12083a", c2: "#8b5cf6", eyebrow: t("wr.emptyEyebrow"), big: t("wr.emptyTitle"), sub: t("wr.emptySub"), img: "", share: false },
  ];

  useEffect(() => { if (open) { setIdx(0); setPaused(false); } }, [open]);
  useEffect(() => { elapsedRef.current = 0; setFillPct(0); }, [idx]);

  // Автолистание, пауза не сбрасывает прогресс — досматриваешь с того же места
  useEffect(() => {
    if (!open || paused) { lastTsRef.current = 0; return; }
    const step = (ts: number) => {
      if (!lastTsRef.current) lastTsRef.current = ts;
      elapsedRef.current += ts - lastTsRef.current;
      lastTsRef.current = ts;
      const pct = Math.min(100, (elapsedRef.current / WRAPPED_SLIDE_MS) * 100);
      setFillPct(pct);
      if (pct >= 100) {
        if (idx < SLIDES.length - 1) setIdx(i => i + 1);
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); lastTsRef.current = 0; };
  }, [open, paused, idx, SLIDES.length]);

  // Зажатие — пауза; отпускание — снова идёт, но не переключает слайд
  const onHoldStart = () => {
    holdTimerRef.current = setTimeout(() => { setPaused(true); suppressClickRef.current = true; }, 160);
  };
  const onHoldEnd = () => {
    clearTimeout(holdTimerRef.current);
    if (paused) setPaused(false);
  };
  const zoneClick = (go: () => void) => {
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    go();
  };

  const S = SLIDES[idx];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center lg:p-8"
          style={{ background: "var(--dim)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={SPRING}
            className="relative w-full h-full lg:max-w-[420px] lg:h-[86vh] lg:rounded-[32px] overflow-hidden"
            style={{ ...(THEMES.dark as React.CSSProperties), background: `linear-gradient(165deg, ${S.c1} 0%, var(--bg) 90%)`, color: "var(--fg)", transition: "background 0.8s ease" }}
          >
            <Aurora c2={S.c2} />

            {/* Прогресс-бары сторис */}
            <div className="absolute top-4 inset-x-4 flex gap-1.5 z-30" style={{ paddingTop: "env(safe-area-inset-top)" }}>
              {SLIDES.map((_, i) => (
                <div key={i} className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: "color-mix(in srgb, var(--wash) 18%, transparent)" }}>
                  <div
                    className="h-full rounded-full bg-white"
                    style={{ width: `${i < idx ? 100 : i === idx ? fillPct : 0}%`, transition: paused ? "none" : undefined }}
                  />
                </div>
              ))}
            </div>

            <button onClick={onClose} aria-label={t("sheet.close")} title={t("sheet.close")} className="absolute top-8 right-4 w-9 h-9 rounded-full flex items-center justify-center z-40" style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(10px)" }}>
              <X size={16} />
            </button>

            {/* Тап-зоны: слева назад, справа вперёд; зажатие — пауза без перехода */}
            <button
              aria-label="prev"
              className="absolute inset-y-0 left-0 w-1/3 z-20"
              onPointerDown={onHoldStart}
              onPointerUp={onHoldEnd}
              onPointerLeave={onHoldEnd}
              onClick={() => zoneClick(() => setIdx(i => Math.max(0, i - 1)))}
            />
            <button
              aria-label="next"
              className="absolute inset-y-0 right-0 w-2/3 z-20"
              onPointerDown={onHoldStart}
              onPointerUp={onHoldEnd}
              onPointerLeave={onHoldEnd}
              onClick={() => zoneClick(() => (idx < SLIDES.length - 1 ? setIdx(idx + 1) : onClose()))}
            />

            {/* Контент слайда */}
            <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-8">
              <motion.div key={idx} initial={{ opacity: 0, y: 26, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}>
                <div className="text-[11px] uppercase tracking-[0.22em] mb-4" style={{ color: S.c2, fontFamily: F.m }}>{S.eyebrow}</div>
                {S.img && (
                  <img src={S.img} alt="" className="w-36 h-36 rounded-[28px] object-cover mx-auto mb-6" style={{ boxShadow: `0 24px 70px ${S.c2}55` }} />
                )}
                <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 44, letterSpacing: "-0.04em", lineHeight: 1.04 }}>{S.big}</div>
                {S.sub && <div className="text-base mt-3" style={{ color: "color-mix(in srgb, var(--fg) 55%, transparent)", fontFamily: F.b }}>{S.sub}</div>}
                {S.share && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={async e => {
                      e.stopPropagation();
                      // Реальное копирование сводки — раньше тост врал «скопирована», ничего не копируя
                      const ok = await copyText(`MYRA · ${t("pr.wrapped")}${t("pr.month")}: ${t("wr.minutes", minutes)} · ${topArtistName} · ${topGenreName}`);
                      toast(ok ? t("wr.shared") : t("soc.followError"));
                    }}
                    className="relative z-30 mt-7 px-8 py-3.5 rounded-full text-sm font-bold flex items-center justify-center gap-2 mx-auto"
                    style={{ background: `linear-gradient(135deg, ${S.c2}, ${S.c2}99)`, color: "#fff", fontFamily: F.b, boxShadow: `0 12px 44px ${S.c2}55` }}
                  >
                    <Share2 size={14} /> {t("wr.share")}
                  </motion.button>
                )}
              </motion.div>
              {idx === 0 && (
                <div className="absolute bottom-8 inset-x-0 text-center text-[10px]" style={{ color: "color-mix(in srgb, var(--fg) 35%, transparent)", fontFamily: F.m }}>{t("wr.tap")}</div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Прозрачный сплит ─────────────────────────────────────────────────────────
// Единственный экран в стриминге, где видно, КОМУ уходит твоя поддержка и
// почему именно в таких долях: доли — это реально накопленные секунды слушания
// текущего месяца (artistSecondsByMonth), донаты — реально отправленные суммы
// (donationLedger). «Донат по сплиту» — одна сумма расходится по артистам
// месяца пропорционально твоему времени слушания; сама оплата — та же
// симуляция, что и в DonateWidget (реального процессинга в MYRA пока нет).

const SPLIT_BAR_COLORS = ["#facc15", "#8b5cf6", "#34d399", "#38bdf8", "#f472b6", "#fb923c", "#22d3ee", "#a78bfa"];

export function SplitSheet({ open, onClose, shares, monthKey, donatedTotal, donatedByArtist, onSplitDonate, ritualOn, onToggleRitual }: {
  open: boolean; onClose: () => void;
  shares: ArtistShare[]; monthKey: string;
  donatedTotal: number; donatedByArtist: Record<string, number>;
  onSplitDonate: (parts: { artist: string; amount: number }[]) => void;
  ritualOn: boolean; onToggleRitual: () => void;
}) {
  const { t, lang } = useLang();
  // Пометка месяца нужна, только когда показан закрытый прошлый месяц
  // (в первые дни нового, пока текущий пуст) — в обычные дни она лишняя
  const isPastMonth = monthKey !== currentMonthKey();
  const monthLabel = useMemo(() => {
    const [y, m] = monthKey.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { month: "long", year: "numeric" });
  }, [monthKey, lang]);
  const [stage, setStage] = useState<"view" | "pay" | "sent">("view");
  const [amount, setAmount] = useState<number | null>(300);
  const [custom, setCustom] = useState("");
  const [method, setMethod] = useState<"card" | "qr">("card");
  const [cardNum, setCardNum] = useState("");
  const [cardExp, setCardExp] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!open) { setStage("view"); setCustom(""); setAmount(300); setProcessing(false); }
  }, [open]);

  const finalAmount = custom ? parseInt(custom) || 0 : amount ?? 0;
  const parts = useMemo(() => splitAmountByShares(finalAmount, shares), [finalAmount, shares]);
  const totalSec = shares.reduce((sum, sh) => sum + sh.seconds, 0);

  return (
    <Sheet open={open} onClose={onClose} z={66}>
      <div className="px-6 pt-7 pb-8">
        <div className="flex items-center justify-between mb-1">
          <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 20, letterSpacing: "-0.02em" }}>{t("sp.title")}</div>
          <button onClick={onClose} aria-label={t("sheet.close")} title={t("sheet.close")} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)" }}>
            <X size={16} />
          </button>
        </div>
        <div className="text-xs mb-6" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("sp.sub")}</div>

        {shares.length === 0 ? (
          <div className="rounded-[20px] p-6 text-center" style={GLASS}>
            <div className="text-sm font-semibold mb-1" style={{ fontFamily: F.b }}>{t("sp.empty")}</div>
            <div className="text-xs" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("sp.emptySub")}</div>
          </div>
        ) : stage === "sent" ? (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-[20px] p-6 flex items-center gap-4" style={GLASS}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(52,211,153,0.15)" }}>
              <Check size={22} style={{ color: "#34d399" }} />
            </div>
            <div className="text-sm font-semibold" style={{ fontFamily: F.b, color: "#34d399" }}>{t("sp.sent", finalAmount, parts.length)}</div>
          </motion.div>
        ) : stage === "pay" ? (
          <div className="rounded-[20px] p-5" style={GLASS}>
            <div className="font-bold mb-3" style={{ fontFamily: F.d, fontSize: 16, letterSpacing: "-0.01em" }}>{t("sp.payTitle", finalAmount)}</div>

            <div className="rounded-2xl p-3.5 mb-4" style={{ background: "color-mix(in srgb, var(--wash) 05%, transparent)" }}>
              {parts.map(p => (
                <div key={p.artist} className="flex justify-between text-xs mb-1.5 last:mb-0" style={{ fontFamily: F.b, color: "color-mix(in srgb, var(--fg) 60%, transparent)" }}>
                  <span className="truncate mr-3">{p.artist}</span><span style={{ color: "#facc15" }}>{p.amount}₽</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mb-4">
              {(["card", "qr"] as const).map(m => (
                <button key={m} onClick={() => setMethod(m)} className="flex-1 py-2.5 rounded-2xl text-xs font-semibold" style={{ background: method === m ? "rgba(250,204,21,0.13)" : "color-mix(in srgb, var(--wash) 6%, transparent)", border: `1px solid ${method === m ? "rgba(250,204,21,0.35)" : "transparent"}`, color: method === m ? "#facc15" : "color-mix(in srgb, var(--fg) 55%, transparent)", fontFamily: F.b }}>
                  {m === "card" ? t("don.methodCard") : t("don.methodQr")}
                </button>
              ))}
            </div>

            {method === "card" ? (
              <div className="flex flex-col gap-2 mb-5">
                <input value={cardNum} onChange={e => setCardNum(fmtCardNum(e.target.value))} placeholder="0000 0000 0000 0000" inputMode="numeric" className="px-4 py-2.5 rounded-2xl bg-transparent outline-none text-sm" style={{ ...GLASS, color: "var(--fg)", fontFamily: F.m }} />
                <div className="flex gap-2">
                  <input value={cardExp} onChange={e => setCardExp(fmtCardExp(e.target.value))} placeholder={t("don.expPh")} inputMode="numeric" className="flex-1 px-4 py-2.5 rounded-2xl bg-transparent outline-none text-sm" style={{ ...GLASS, color: "var(--fg)", fontFamily: F.m }} />
                  <input value={cardCvc} onChange={e => setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="CVC" inputMode="numeric" type="password" className="w-24 px-4 py-2.5 rounded-2xl bg-transparent outline-none text-sm" style={{ ...GLASS, color: "var(--fg)", fontFamily: F.m }} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2.5 mb-5 py-1">
                <FakeQR seed={finalAmount * 131 + parts.length} />
                <div className="text-[11px]" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("don.qrHint")}</div>
              </div>
            )}

            <div className="flex gap-2.5">
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => setStage("view")} className="px-5 py-3 rounded-full text-sm font-semibold" style={{ ...GLASS, fontFamily: F.b }}>
                {t("don.back")}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                disabled={processing}
                onClick={() => {
                  if (method === "card" && (cardNum.replace(/\s/g, "").length < 16 || cardExp.length < 5 || cardCvc.length < 3)) { toast(t("don.cardIncomplete")); return; }
                  setProcessing(true);
                  setTimeout(() => {
                    setProcessing(false);
                    setStage("sent");
                    onSplitDonate(parts);
                    toast.success(t("sp.sent", finalAmount, parts.length));
                    setTimeout(() => setStage("view"), 2000);
                  }, 1300);
                }}
                className="flex-1 py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, #facc15, #f59e0b)", color: "#1a1405", fontFamily: F.b }}
              >
                {processing ? (<><Loader2 size={14} className="animate-spin" /> {t("don.paying")}</>) : t("don.send", finalAmount)}
              </motion.button>
            </div>
            {/* Честная подпись симуляции — как в DonateWidget и Plus */}
            <div className="text-[10px] text-center mt-2.5" style={{ color: "color-mix(in srgb, var(--fg) 35%, transparent)", fontFamily: F.m }}>{t("don.simNote")}</div>
          </div>
        ) : (
          <>
            {/* Реальные доли слушания за месяц — тёмное хиро с жёлтым
                «денежным» акцентом; текст явными светлыми цветами, т.к. карточка
                тёмная в любой теме (см. .myra-sheet-hero) */}
            <div className="myra-sheet-hero p-5 mb-4" style={{ "--sheet-accent": "#facc15" } as React.CSSProperties}>
              <div className="flex justify-between items-baseline mb-4">
                <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: isPastMonth ? "#facc15" : onDark(45), fontFamily: F.m }}>
                  {isPastMonth ? t("sp.sharesOf", monthLabel) : t("sp.shares")}
                </div>
                <div className="text-[10px]" style={{ color: onDark(45), fontFamily: F.m }}>{t("sp.minutes", minutesOf(totalSec))}</div>
              </div>
              {shares.slice(0, 8).map((sh, i) => {
                const color = SPLIT_BAR_COLORS[i % SPLIT_BAR_COLORS.length];
                const donated = donatedByArtist[sh.artist];
                return (
                  <div key={sh.artist} className="mb-3 last:mb-0">
                    <div className="flex justify-between items-center text-xs mb-1" style={{ fontFamily: F.b, color: ON_DARK }}>
                      <span className="truncate mr-3 flex items-center gap-2">
                        {sh.artist}
                        {donated ? <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md flex-shrink-0" style={{ background: "rgba(250,204,21,0.14)", color: "#facc15", fontFamily: F.m }}><Gift size={9} /> {donated}₽</span> : null}
                      </span>
                      <span style={{ color, fontFamily: F.m }}>{sh.pct < 1 ? "<1" : Math.round(sh.pct)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(sh.pct, 1.5)}%` }} transition={{ duration: 0.6, delay: i * 0.05 }} className="h-full rounded-full" style={{ background: color }} />
                    </div>
                  </div>
                );
              })}
              {donatedTotal > 0 && (
                <div className="mt-4 pt-3 text-xs flex justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.1)", fontFamily: F.b, color: onDark(60) }}>
                  <span>{t("sp.donated")}</span><span style={{ color: "#facc15" }}>{donatedTotal}₽</span>
                </div>
              )}
            </div>

            {/* Денежное действие включается только после подключения реального
                провайдера; статистика распределения остаётся доступной всегда. */}
            {paymentsEnabled && <div className="rounded-[20px] p-5" style={GLASS}>
              <div className="font-bold mb-1" style={{ fontFamily: F.d, fontSize: 16, letterSpacing: "-0.01em" }}>{t("sp.donateTitle")}</div>
              <div className="text-xs mb-4" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("sp.donateSub")}</div>
              <div className="flex gap-2 mb-4 flex-wrap">
                {[100, 300, 500].map(a => (
                  <button key={a} onClick={() => { setAmount(a); setCustom(""); }} className="px-4 py-2 rounded-full text-sm font-semibold transition-all" style={{ background: amount === a && !custom ? "#facc15" : "color-mix(in srgb, var(--wash) 07%, transparent)", color: amount === a && !custom ? "#1a1405" : "color-mix(in srgb, var(--fg) 60%, transparent)", fontFamily: F.b }}>
                    {a}₽
                  </button>
                ))}
                <input
                  value={custom}
                  onChange={e => setCustom(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder={t("don.custom")}
                  className="w-24 px-3 py-2 rounded-full text-sm bg-transparent outline-none text-center"
                  style={{ border: `1px solid ${custom ? "#facc15" : "color-mix(in srgb, var(--wash) 12%, transparent)"}`, color: "var(--fg)", fontFamily: F.b }}
                />
              </div>
              {parts.length > 0 && (
                <div className="rounded-2xl p-3.5 mb-4" style={{ background: "color-mix(in srgb, var(--wash) 05%, transparent)" }}>
                  {parts.map(p => (
                    <div key={p.artist} className="flex justify-between text-xs mb-1.5 last:mb-0" style={{ fontFamily: F.b, color: "color-mix(in srgb, var(--fg) 60%, transparent)" }}>
                      <span className="truncate mr-3">{p.artist}</span><span style={{ color: "#facc15" }}>{p.amount}₽</span>
                    </div>
                  ))}
                </div>
              )}
              <motion.button
                whileTap={{ scale: 0.97 }}
                disabled={finalAmount <= 0}
                onClick={() => setStage("pay")}
                className="w-full py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2"
                style={{ background: finalAmount > 0 ? "linear-gradient(135deg, #facc15, #f59e0b)" : "color-mix(in srgb, var(--wash) 06%, transparent)", color: finalAmount > 0 ? "#1a1405" : "color-mix(in srgb, var(--fg) 30%, transparent)", fontFamily: F.b }}
              >
                {t("don.next")} <ArrowRight size={13} />
              </motion.button>
            </div>}

            {/* Месячный ритуал — строго opt-in, по умолчанию выключен */}
            <div className="flex items-center gap-3 rounded-[20px] p-4 mt-4" style={GLASS}>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold" style={{ fontFamily: F.b }}>{t("sp.ritual")}</div>
                <div className="text-[11px] mt-0.5" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("sp.ritualSub")}</div>
              </div>
              <Toggle on={ritualOn} onChange={onToggleRitual} color="#facc15" />
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}

// ─── Достижения (вкладка Профиль) ────────────────────────────────────────────
// Открытые показываются полностью, закрытые — честные «???» без подсказок:
// механика скрытых достижений сохраняется, но прогресс теперь видно из профиля

export function AchievementsSheet({ open, onClose, counters, c2 }: {
  open: boolean; onClose: () => void; counters: AchievementCounters; c2: string;
}) {
  const { t } = useLang();
  const items = useMemo(() => buildAchievements(counters), [counters]);
  // Открытость берём из того же ls-ключа, что и тосты открытия — единый источник
  const unlocked = useMemo(() => new Set(ls.get<string[]>("achUnlocked", [])), [open]);
  const doneCount = items.filter(a => unlocked.has(a.id)).length;

  return (
    <Sheet open={open} onClose={onClose} z={64}>
      <div className="px-6 pt-7 pb-8">
        <div className="flex items-center justify-between mb-1">
          <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 20, letterSpacing: "-0.02em" }}>{t("ach.title")}</div>
          <button onClick={onClose} aria-label={t("sheet.close")} title={t("sheet.close")} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)" }}>
            <X size={16} />
          </button>
        </div>
        <div className="text-xs mb-6" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("ach.progress", doneCount, ACHIEVEMENTS.length)}</div>

        {/* Одна сгруппированная карточка с разделителями вместо стопки
            отдельных GLASS-плашек — как списки в AccountSheet */}
        <div className="myra-sheet-card">
          {items.map(a => {
            const isOpen = unlocked.has(a.id);
            const Icon = a.icon;
            return isOpen ? (
              <div key={a.id} className="myra-sheet-row">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${c2}1c` }}>
                  <Icon size={16} style={{ color: c2 }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold" style={{ fontFamily: F.b }}>{t(a.key)}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: c2, fontFamily: F.m }}>{t("ach.unlockedTag")}</div>
                </div>
                <Check size={15} style={{ color: c2 }} />
              </div>
            ) : (
              <div key={a.id} className="myra-sheet-row" style={{ opacity: 0.55 }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)" }}>
                  <Lock size={14} style={{ color: "color-mix(in srgb, var(--fg) 35%, transparent)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold" style={{ fontFamily: F.b, color: "color-mix(in srgb, var(--fg) 55%, transparent)" }}>{t("ach.hidden")}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: "color-mix(in srgb, var(--fg) 35%, transparent)", fontFamily: F.b }}>{t("ach.hiddenSub")}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}

// ─── Детальная аналитика студии ───────────────────────────────────────────────

export function StudioStatsSheet({ open, onClose, c2, myTracks, myPlaysByTrack, myPlaysByDay, balance }: {
  open: boolean; onClose: () => void; c2: string;
  myTracks: Track[]; myPlaysByTrack: Record<number, number>; myPlaysByDay: Record<string, number>; balance: number;
}) {
  const { t, lang } = useLang();
  const [monthOffset, setMonthOffset] = useState(0);

  const viewDate = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);
  const monthLabel = viewDate.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { month: "long", year: "numeric" });
  const seed = viewDate.getFullYear() * 12 + viewDate.getMonth();

  const days = useMemo(() => monthDays(myPlaysByDay, viewDate.getFullYear(), viewDate.getMonth()), [myPlaysByDay, viewDate]);
  const topMyTracks = useMemo(
    () => [...myTracks].filter(tr => (myPlaysByTrack[tr.id] ?? 0) > 0).sort((a, b) => (myPlaysByTrack[b.id] ?? 0) - (myPlaysByTrack[a.id] ?? 0)).slice(0, 5),
    [myTracks, myPlaysByTrack],
  );

  return (
    <Sheet open={open} onClose={onClose} z={62}>
      <div className="px-6 pt-7 pb-8">
        <div className="flex items-center justify-between mb-6">
          <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 22, letterSpacing: "-0.03em" }}>{t("st.title")}</div>
          <button onClick={onClose} aria-label={t("sheet.close")} title={t("sheet.close")} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)" }}>
            <X size={16} />
          </button>
        </div>

        {/* Календарь по месяцам */}
        <div className="rounded-[20px] p-4 mb-4" style={GLASS}>
          <div className="flex items-center justify-between mb-3">
            <motion.button whileTap={{ scale: 0.85 }} onClick={() => setMonthOffset(m => Math.max(-11, m - 1))} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)" }}>
              <ChevronLeft size={14} />
            </motion.button>
            <div className="text-[11px] font-semibold capitalize" style={{ fontFamily: F.m, color: "color-mix(in srgb, var(--fg) 60%, transparent)" }}>{monthLabel}</div>
            <motion.button whileTap={{ scale: 0.85 }} disabled={monthOffset === 0} onClick={() => setMonthOffset(m => Math.min(0, m + 1))} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)", opacity: monthOffset === 0 ? 0.3 : 1 }}>
              <ChevronRight size={14} />
            </motion.button>
          </div>
          <InteractiveChart key={seed} data={days} color={c2} height={110} variant="bars" valueLabel={v => t("cr.plays", v)} />
        </div>

        {/* Топ треков */}
        <div className="rounded-[20px] p-4 mb-4" style={GLASS}>
          <div className="text-[10px] uppercase tracking-[0.16em] mb-3" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}>{t("st.topTracks")}</div>
          {topMyTracks.length === 0 ? (
            <div className="text-xs py-2" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("cr.releasesEmpty")}</div>
          ) : topMyTracks.map(tr => (
            <div key={tr.id} className="flex items-center gap-3 py-2">
              <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0">
                <img src={tr.img} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0 text-sm font-semibold truncate" style={{ fontFamily: F.b }}>{tr.title}</div>
              <div className="text-xs" style={{ color: "color-mix(in srgb, var(--fg) 50%, transparent)", fontFamily: F.m }}>{t("cr.plays", myPlaysByTrack[tr.id] ?? 0)}</div>
            </div>
          ))}
        </div>

        {/* Аудитория — источники и города появятся, когда будут реальные слушатели */}
        <div className="rounded-[20px] p-5 mb-4 text-center" style={GLASS}>
          <Users size={20} style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }} className="mx-auto mb-2" />
          <div className="text-sm font-semibold" style={{ fontFamily: F.b }}>{t("st.audienceEmpty")}</div>
          <div className="text-xs mt-1" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("st.audienceEmptySub")}</div>
        </div>

        {/* Баланс — тёмное хиро с акцентным свечением, как денежные
            карточки Студии */}
        <div className="myra-sheet-hero p-5" style={{ "--sheet-accent": c2 } as React.CSSProperties}>
          <div className="text-[10px] uppercase tracking-[0.16em] mb-2" style={{ color: onDark(45), fontFamily: F.m }}>{t("st.donations")}</div>
          <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 30, letterSpacing: "-0.03em", color: ON_DARK }}>{balance.toLocaleString("ru-RU")}₽</div>
        </div>
      </div>
    </Sheet>
  );
}

// ─── Публикация трека (форма перед релизом, а не мгновенная загрузка) ────────

export function ReleaseFormSheet({ open, file, defaultCover, onClose, onPublish }: {
  open: boolean; file: File | null; defaultCover: string; onClose: () => void;
  onPublish: (meta: { title: string; genre: string; lyrics: string; cover: string | null }) => void;
}) {
  const { t } = useLang();
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState("");
  const [cover, setCover] = useState<string | null>(null);

  useEffect(() => {
    if (open && file) {
      setTitle(file.name.replace(/\.[^.]+$/, ""));
      setGenre(null);
      setLyrics("");
      setCover(null);
    }
  }, [open, file]);

  const onCoverFile = (f: File) => {
    const img = new Image();
    img.onload = () => {
      const s = 400, cv = document.createElement("canvas");
      cv.width = s; cv.height = s;
      const cx = cv.getContext("2d")!;
      const k = Math.max(s / img.width, s / img.height);
      cx.drawImage(img, (s - img.width * k) / 2, (s - img.height * k) / 2, img.width * k, img.height * k);
      setCover(cv.toDataURL("image/jpeg", 0.85));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(f);
  };

  const canPublish = title.trim().length > 0 && !!genre;

  return (
    <Sheet open={open} onClose={onClose} z={72}>
      <div className="px-6 pt-7 pb-8">
        <div className="flex items-center justify-between mb-6">
          <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 20, letterSpacing: "-0.03em" }}>{t("cr.releaseFormTitle")}</div>
          <button onClick={onClose} aria-label={t("sheet.close")} title={t("sheet.close")} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)" }}>
            <X size={16} />
          </button>
        </div>

        {/* Обложка */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0" style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
            <img src={cover ?? defaultCover} alt="" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="text-sm font-semibold mb-1.5" style={{ fontFamily: F.b }}>{t("cr.cover")}</div>
            <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold cursor-pointer" style={GLASS}>
              <ImagePlus size={13} /> {t("cr.changeCover")}
              <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onCoverFile(f); }} />
            </label>
          </div>
        </div>

        {/* Название */}
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={t("cr.trackName")}
          className="w-full px-4 py-3.5 rounded-2xl bg-transparent outline-none text-sm mb-5"
          style={{ ...GLASS, color: "var(--fg)", fontFamily: F.b }}
        />

        {/* Жанр */}
        <span className="myra-sheet-eyebrow">{t("cr.genre")}</span>
        <div className="flex flex-wrap gap-2 mb-5">
          {TASTE_GENRES.map(([g, c]) => {
            const on = genre === g;
            return (
              <button
                key={g}
                onClick={() => setGenre(g)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-colors"
                style={{ background: on ? `${c}2b` : "color-mix(in srgb, var(--wash) 5.5%, transparent)", border: `1px solid ${on ? c : "color-mix(in srgb, var(--wash) 10%, transparent)"}`, color: on ? c : "color-mix(in srgb, var(--fg) 65%, transparent)", fontFamily: F.b }}
              >
                {on && <Check size={11} />} {g}
              </button>
            );
          })}
        </div>

        {/* Текст песни */}
        <div className="flex items-baseline gap-1.5">
          <span className="myra-sheet-eyebrow">{t("cr.lyrics")}</span>
          <span className="text-[10px]" style={{ color: "color-mix(in srgb, var(--fg) 28%, transparent)", fontFamily: F.m }}>· {t("cr.lyricsOptional")}</span>
        </div>
        <textarea
          value={lyrics}
          onChange={e => setLyrics(e.target.value)}
          placeholder={t("cr.lyricsPlaceholder")}
          rows={4}
          className="w-full px-4 py-3.5 rounded-2xl bg-transparent outline-none text-sm mb-6 resize-none"
          style={{ ...GLASS, color: "var(--fg)", fontFamily: F.b, lineHeight: 1.6 }}
        />

        <motion.button
          whileTap={{ scale: canPublish ? 0.97 : 1 }}
          onClick={() => {
            if (!canPublish) { toast(genre ? t("cr.nameFirst") : t("cr.pickGenre")); return; }
            onPublish({ title: title.trim(), genre: genre!, lyrics: lyrics.trim(), cover });
          }}
          className="w-full py-4 rounded-full text-sm font-bold transition-opacity"
          style={{ background: ACCENT_GRAD, color: "#fff", fontFamily: F.b, opacity: canPublish ? 1 : 0.5 }}
        >
          {t("cr.publish")}
        </motion.button>
      </div>
    </Sheet>
  );
}

// ─── Импорт музыки списком (работает с экспортом любой площадки) ─────────────

export function ImportSheet({ open, onClose, onImported }: {
  open: boolean; onClose: () => void; onImported: (name: string, trackIds: number[]) => void;
}) {
  const { t } = useLang();
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ matched: Track[]; missed: string[] } | null>(null);

  useEffect(() => { if (open) { setText(""); setResult(null); } }, [open]);

  // Строки вида «Артист — Название», «Артист - Название» или «Название»
  const parse = (raw: string) => {
    const lines = raw.split(/\r?\n|;/).map(s => s.replace(/^\d+[.)]\s*/, "").trim()).filter(Boolean);
    const matched: Track[] = [];
    const missed: string[] = [];
    for (const line of lines) {
      const norm = line.toLowerCase();
      const hit = ALL_TRACKS.find(tr =>
        norm.includes(tr.title.toLowerCase()) ||
        (norm.includes(tr.artist.toLowerCase()) && tr.title.toLowerCase().split(" ").some(w => w.length > 3 && norm.includes(w)))
      );
      if (hit && !matched.some(m => m.id === hit.id)) matched.push(hit);
      else if (!hit) missed.push(line);
    }
    setResult({ matched, missed });
  };

  const onFile = (f: File) => {
    const r = new FileReader();
    r.onload = () => { const s = String(r.result ?? ""); setText(s); parse(s); };
    r.readAsText(f);
  };

  return (
    <Sheet open={open} onClose={onClose} z={66}>
      <div className="px-6 pt-7 pb-8">
        <div className="flex items-center justify-between mb-1.5">
          <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 22, letterSpacing: "-0.03em" }}>{t("im2.title")}</div>
          <button onClick={onClose} aria-label={t("sheet.close")} title={t("sheet.close")} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--wash) 7%, transparent)" }}>
            <X size={16} />
          </button>
        </div>
        <div className="text-xs mb-4" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("im2.sub")}</div>

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={"Luna Wave — Midnight Echo\nKRVT — Glass City\n…"}
          rows={5}
          className="w-full px-4 py-3 rounded-2xl bg-transparent outline-none text-sm mb-3 resize-none"
          style={{ ...GLASS, color: "var(--fg)", fontFamily: F.m, fontSize: 12 }}
        />

        <div className="flex gap-2.5 mb-4">
          <label className="flex-1 py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer" style={{ ...GLASS, fontFamily: F.b }}>
            <FileUp size={14} /> {t("im2.file")}
            <input type="file" accept=".txt,.csv,.m3u,.m3u8" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
          </label>
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => parse(text)} disabled={!text.trim()} className="flex-1 py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2" style={{ background: text.trim() ? ACCENT_GRAD : "color-mix(in srgb, var(--wash) 6%, transparent)", color: text.trim() ? "#fff" : "color-mix(in srgb, var(--fg) 30%, transparent)", fontFamily: F.b }}>
            <ClipboardPaste size={14} /> {t("im2.scan")}
          </motion.button>
        </div>

        {result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="rounded-[20px] p-4 mb-3" style={GLASS}>
              <div className="text-sm font-bold mb-2" style={{ fontFamily: F.d }}>{t("im2.found", result.matched.length, result.missed.length)}</div>
              {result.matched.slice(0, 5).map(tr => (
                <div key={tr.id} className="flex items-center gap-2.5 py-1.5">
                  <img src={tr.img} alt="" className="w-8 h-8 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0 text-xs font-semibold truncate" style={{ fontFamily: F.b }}>{tr.title}</div>
                  <Check size={13} style={{ color: "#34d399" }} />
                </div>
              ))}
              {result.missed.length > 0 && (
                <div className="text-[10px] mt-2" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}>
                  {t("im2.missed")}: {result.missed.slice(0, 3).join(" · ")}{result.missed.length > 3 ? "…" : ""}
                </div>
              )}
            </div>
            <motion.button
              whileTap={{ scale: 0.96 }}
              disabled={!result.matched.length}
              onClick={() => { onImported(t("im2.plName"), result.matched.map(tr => tr.id)); toast.success(t("im2.done", result.matched.length)); onClose(); }}
              className="w-full py-3.5 rounded-full text-sm font-bold"
              style={{ background: result.matched.length ? "linear-gradient(135deg, #34d399, #6ee7b7)" : "color-mix(in srgb, var(--wash) 6%, transparent)", color: result.matched.length ? "#04120c" : "color-mix(in srgb, var(--fg) 30%, transparent)", fontFamily: F.b }}
            >
              {t("im2.create")}
            </motion.button>
          </motion.div>
        )}
      </div>
    </Sheet>
  );
}

// ─── Поддержка (чат внутри приложения) ───────────────────────────────────────
// Без Supabase история живёт только в localStorage этого устройства, как и
// раньше. С Supabase — сообщения пользователя реально сохраняются на сервере
// (support_messages), чтобы их увидели живые админы в AdminSupportSheet
// (см. dev.tsx), а не только локальный ИИ-автоответ ниже.

interface SupportMsg { id: string; from: "me" | "support"; text: string; time: number; topicLabel?: string }

const SUPPORT_TOPICS = ["sup.tBug", "sup.tBilling", "sup.tIdea", "sup.tOther"] as const;

const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const rowToSupportMsg = (r: SupportMessageRow): SupportMsg => ({
  id: r.id,
  from: r.from_role === "user" ? "me" : "support",
  text: r.text,
  time: new Date(r.created_at).getTime(),
});

export function SupportSheet({ open, onClose, uid }: { open: boolean; onClose: () => void; uid: string | null }) {
  const { t } = useLang();
  const [topic, setTopic] = useState<typeof SUPPORT_TOPICS[number]>("sup.tBug");
  const [msg, setMsg] = useState("");
  const [thread, setThread] = useState<SupportMsg[]>(() => ls.get<SupportMsg[]>("supportChat", []));
  const [typing, setTyping] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Приветствие — только если ни локально, ни на сервере ещё нет ни одного
  // сообщения (используем функциональный setThread, чтобы не тянуть thread в deps)
  const ensureGreeting = () => setThread(prev => {
    if (prev.length) return prev;
    const greet: SupportMsg = { id: String(Date.now()), from: "support", text: t("sup.greet"), time: Date.now() };
    ls.set("supportChat", [greet]);
    return [greet];
  });

  // При открытии — если Supabase подключён, подтягиваем реальную историю
  // треда (там может быть уже и ответ живого админа), иначе как раньше
  // работаем только с localStorage
  useEffect(() => {
    if (!open) return;
    if (supabaseEnabled && uid) {
      fetchSupportThread(uid).then(({ data }) => {
        if (data.length) setThread(data.map(rowToSupportMsg));
        else ensureGreeting();
      });
      return;
    }
    ensureGreeting();
  }, [open, uid]);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [thread, typing]);
  useEffect(() => () => clearTimeout(replyTimer.current), []);

  const send = async () => {
    const text = msg.trim();
    if (!text) { toast(t("sup.empty")); return; }
    const mine: SupportMsg = { id: String(Date.now()), from: "me", text, time: Date.now(), topicLabel: t(topic) };
    const nextThread = [...thread, mine];
    setThread(nextThread);
    ls.set("supportChat", nextThread);
    setMsg("");
    setTyping(true);

    if (supabaseEnabled && uid) {
      // Реально сохраняем на сервере — иначе обращению просто некуда попасть,
      // кроме локального ИИ-автоответа ниже
      sendSupportMessage(uid, "user", text).catch(err => console.warn("sendSupportMessage:", err));
    }

    if (supabaseEnabled) {
      // Реальный ИИ-ответ через Edge Function — с историей переписки для контекста
      const history: { role: "user" | "assistant"; content: string }[] = nextThread.slice(-12).map(m => ({ role: m.from === "me" ? "user" : "assistant", content: m.text }));
      const { data, error } = await askSupportAI(history);
      setTyping(false);
      if (error || !data?.reply) { toast(t("sup.aiError")); return; }
      const reply: SupportMsg = { id: String(Date.now() + 1), from: "support", text: data.reply, time: Date.now() };
      setThread(prev => { const next = [...prev, reply]; ls.set("supportChat", next); return next; });
      // Тоже пишем в тред на сервере — чтобы админ видел полную картину переписки,
      // а не только реплики пользователя без ответов
      if (uid) sendSupportMessage(uid, "ai", data.reply).catch(err => console.warn("sendSupportMessage:", err));
      return;
    }

    clearTimeout(replyTimer.current);
    replyTimer.current = setTimeout(() => {
      // Без сервера — честное системное сообщение, что обращение осталось на
      // устройстве. Раньше приходил заготовленный фейковый «ответ поддержки»
      // («передали разработчикам», «ответим в течение часа»), который никто
      // не передавал и на который никто бы не ответил
      const reply: SupportMsg = { id: String(Date.now() + 1), from: "support", text: t("sup.offlineNote"), time: Date.now() };
      setThread(prev => { const next = [...prev, reply]; ls.set("supportChat", next); return next; });
      setTyping(false);
    }, 600);
  };

  return (
    <Sheet open={open} onClose={onClose} z={67}>
      <div className="px-6 pt-7 pb-5 flex flex-col" style={{ height: "min(78vh, 640px)" }}>
        <div className="flex items-center justify-between mb-1 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: ACCENT_GRAD }}>
              <MessageCircle size={16} style={{ color: "#fff" }} />
            </div>
            <div className="min-w-0">
              <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 17, letterSpacing: "-0.02em" }}>{t("sup.title")}</div>
              <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "#34d399", fontFamily: F.m }}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#34d399" }} /> {t("sup.online")}
              </div>
            </div>
          </div>
          <button onClick={onClose} aria-label={t("sheet.close")} title={t("sheet.close")} className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "color-mix(in srgb, var(--wash) 7%, transparent)" }}>
            <X size={16} />
          </button>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto py-4 flex flex-col gap-3" style={{ scrollbarWidth: "none" }}>
          {thread.map(m => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[80%]">
                {m.topicLabel && (
                  <div className="text-[9px] mb-1 text-right px-1" style={{ color: "color-mix(in srgb, var(--fg) 35%, transparent)", fontFamily: F.m }}>{m.topicLabel}</div>
                )}
                <div className="px-4 py-2.5 rounded-[18px] text-sm" style={m.from === "me" ? { background: ACCENT_GRAD, color: "#fff", borderBottomRightRadius: 6, fontFamily: F.b } : { ...GLASS, borderBottomLeftRadius: 6, fontFamily: F.b }}>
                  {m.text}
                </div>
                <div className="text-[9px] mt-1 px-1" style={{ textAlign: m.from === "me" ? "right" : "left", color: "color-mix(in srgb, var(--fg) 30%, transparent)", fontFamily: F.m }}>{fmtTime(m.time)}</div>
              </div>
            </motion.div>
          ))}
          {typing && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="px-4 py-3.5 rounded-[18px]" style={{ ...GLASS, borderBottomLeftRadius: 6 }}>
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: "color-mix(in srgb, var(--fg) 40%, transparent)", animation: `eq${i + 1} 0.8s ease-in-out infinite alternate` }} />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>

        <div className="flex-shrink-0">
          <div className="flex gap-2 flex-wrap mb-3">
            {SUPPORT_TOPICS.map(id => (
              <button key={id} onClick={() => setTopic(id)} className="px-3 py-1.5 rounded-full text-[11px] font-semibold" style={{ background: topic === id ? ACCENT_GRAD : "color-mix(in srgb, var(--wash) 6%, transparent)", color: topic === id ? "#fff" : "color-mix(in srgb, var(--fg) 60%, transparent)", fontFamily: F.b }}>
                {t(id)}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2.5">
            <textarea
              value={msg}
              onChange={e => setMsg(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={t("sup.msg")}
              rows={1}
              className="flex-1 px-4 py-3 rounded-2xl bg-transparent outline-none text-sm resize-none"
              style={{ ...GLASS, color: "var(--fg)", fontFamily: F.b, maxHeight: 90 }}
            />
            <motion.button whileTap={{ scale: 0.88 }} onClick={send} className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: msg.trim() ? ACCENT_GRAD : "color-mix(in srgb, var(--wash) 8%, transparent)" }}>
              <Send size={16} style={{ color: msg.trim() ? "#fff" : "color-mix(in srgb, var(--fg) 30%, transparent)" }} />
            </motion.button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

// ─── Жалоба на контент (трек/комментарий) ────────────────────────────────────
// MVP-модерация (см. schema.sql, секции 12-13 и src/app/dev.tsx —
// ModerationSheet, очередь для админов). Открывается из FullPlayer
// (src/app/player.tsx) — по кнопке в шапке для трека целиком и по кнопке
// рядом с конкретным комментарием (только для реальных, синхронизированных
// с Supabase комментариев — у затравочных/локальных нет id, жаловаться там
// физически не на что, см. Comment.id в data.ts).
export function ReportSheet({ open, onClose, uid, targetType, targetId }: {
  open: boolean; onClose: () => void; uid: string | null;
  targetType: ReportTargetType; targetId: string | null;
}) {
  const { t } = useLang();
  const [reason, setReason] = useState<string>(REPORT_REASONS[0].code);
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);

  // Сброс формы при каждом новом открытии — иначе повторная жалоба на другой
  // трек унаследовала бы причину/текст от предыдущей
  useEffect(() => { if (open) { setReason(REPORT_REASONS[0].code); setDetails(""); } }, [open]);

  const submit = async () => {
    // reporter_id обязателен и в RLS (auth.uid() = reporter_id), и по смыслу —
    // анонимную жалобу некому и не на что вешать. Без входа честнее сказать
    // об этом прямо, чем притвориться, что жалоба ушла
    if (!uid) { toast(t("report.needLogin")); return; }
    if (!targetId) { onClose(); return; }
    setSending(true);
    const { error } = await submitReport(uid, targetType, targetId, reason, details);
    setSending(false);
    if (error) { toast(t("report.error")); return; }
    toast(t("report.sent"));
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} z={73}>
      <div className="px-6 pt-7 pb-8">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.4)" }}>
              <Flag size={15} style={{ color: "#f87171" }} />
            </div>
            <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" }}>{t("report.title")}</div>
          </div>
          <button onClick={onClose} aria-label={t("sheet.close")} title={t("sheet.close")} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)" }}>
            <X size={16} />
          </button>
        </div>
        <div className="text-xs mb-5" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("report.sub")}</div>

        {/* Одна сгруппированная карточка с разделителями вместо стопки плашек;
            красная семантика жалобы сохраняется — фирменный фиолетовый здесь
            неуместен */}
        <div className="myra-sheet-card mb-4">
          {REPORT_REASONS.map(r => {
            const active = reason === r.code;
            return (
              <button key={r.code} onClick={() => setReason(r.code)} className="myra-sheet-row w-full text-left" data-clickable style={active ? { background: "rgba(248,113,113,0.08)" } : undefined}>
                <span className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center" style={{ border: `2px solid ${active ? "#f87171" : "color-mix(in srgb, var(--fg) 30%, transparent)"}` }}>
                  {active && <span className="w-2 h-2 rounded-full" style={{ background: "#f87171" }} />}
                </span>
                <span className="text-sm font-medium" style={{ fontFamily: F.b }}>{t(r.labelKey)}</span>
              </button>
            );
          })}
        </div>

        <textarea
          value={details}
          onChange={e => setDetails(e.target.value)}
          placeholder={t("report.detailsPh")}
          rows={3}
          className="w-full px-4 py-3 rounded-2xl bg-transparent outline-none text-sm resize-none mb-5"
          style={{ ...GLASS, color: "var(--fg)", fontFamily: F.b }}
        />

        <motion.button whileTap={{ scale: 0.97 }} disabled={sending} onClick={submit} className="w-full py-3.5 rounded-full text-sm font-semibold flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg, #ef4444, #f87171)", color: "#fff", fontFamily: F.b, opacity: sending ? 0.7 : 1 }}>
          <Flag size={14} /> {t("report.submit")}
        </motion.button>
      </div>
    </Sheet>
  );
}
