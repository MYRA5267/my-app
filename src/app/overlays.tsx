import { useState, useEffect, useRef, useMemo } from "react";
import {
  Play, Heart, BadgeCheck, Gift, Check, X, ChevronRight, ChevronLeft, ArrowRight,
  Mail, Crown, MessageCircle, Trash2, Share2, RefreshCw, UserPlus, Loader2,
  GripVertical, Shuffle, Import as ImportIcon, FileUp, ClipboardPaste, ImagePlus, Send,
  Zap, LineChart, Headset, TrendingUp,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { artistByName, tracksOf, AVATARS, TRACKS as ALL_TRACKS, PLAYLISTS, LEADERBOARD_PEERS, ls, type Track, type Friend } from "./data";
import { F, GLASS, SPRING, Sheet, ConfirmSheet, Aurora, TiltCard, EQ, copyText, genInviteCode, ON_DARK, onDark, THEMES, InteractiveChart } from "./lib";
import { useLang } from "./i18n";

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

// ─── Страница артиста ─────────────────────────────────────────────────────────

export function ArtistSheet({ name, onClose, onPlay, currentTrack, playing, followed, onFollow, onOpenArtist, onOpenAlbum }: {
  name: string | null; onClose: () => void; onPlay: (t: Track) => void;
  currentTrack: Track; playing: boolean;
  followed: Set<string>; onFollow: (name: string) => void; onOpenArtist: (name: string) => void; onOpenAlbum: (album: string) => void;
}) {
  const { t } = useLang();
  const [donateOpen, setDonateOpen] = useState(false);
  const [stage, setStage] = useState<"pick" | "pay" | "sent">("pick");
  const [amount, setAmount] = useState<number | null>(100);
  const [custom, setCustom] = useState("");
  const [method, setMethod] = useState<"card" | "qr">("card");
  const [cardNum, setCardNum] = useState("");
  const [cardExp, setCardExp] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [processing, setProcessing] = useState(false);

  const artist = name ? artistByName(name) : null;
  useEffect(() => {
    setDonateOpen(false); setStage("pick"); setAmount(100); setCustom("");
    setCardNum(""); setCardExp(""); setCardCvc("");
  }, [name]);

  if (!artist) return <Sheet open={false} onClose={onClose} z={55}><div /></Sheet>;

  const { own, similar } = tracksOf(artist.name);
  const isFollowed = followed.has(artist.name);
  const finalAmount = custom ? parseInt(custom) || 0 : amount ?? 0;
  const fee = Math.round(finalAmount * 0.05);
  const net = finalAmount - fee;

  return (
    <Sheet open={!!name} onClose={onClose} z={55}>
      {/* Шапка */}
      <div className="relative" style={{ height: 210 }}>
        <img src={artist.img} alt="" className="w-full h-full object-cover" style={{ filter: "brightness(0.55)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(13,13,26,1) 0%, transparent 60%)" }} />
        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(10px)", color: ON_DARK }}>
          <X size={16} />
        </button>
        <div className="absolute bottom-3 left-6 right-6">
          <div className="flex items-center gap-2">
            <span style={{ fontFamily: F.d, fontWeight: 900, fontSize: 30, letterSpacing: "-0.03em", color: ON_DARK }}>{artist.name}</span>
            {artist.verified && <BadgeCheck size={20} style={{ color: artist.c2 }} />}
          </div>
          <div className="text-xs mt-0.5" style={{ color: onDark(55), fontFamily: F.m }}>{artist.listeners} {t("ar.listeners")}</div>
        </div>
      </div>

      <div className="px-6 pt-4 pb-8">
        {/* Действия */}
        <div className="flex gap-2.5 mb-6">
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
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => setDonateOpen(o => !o)} className="flex-1 rounded-full text-sm font-semibold flex items-center justify-center gap-2" style={{ background: `${artist.c2}22`, border: `1px solid ${artist.c2}44`, color: artist.c2, fontFamily: F.b }}>
            <Gift size={14} /> {t("ar.support")}
          </motion.button>
        </div>

        {/* Донат */}
        <AnimatePresence>
          {donateOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28 }} className="overflow-hidden mb-6">
              <div className="rounded-[20px] p-5" style={GLASS}>
                {stage === "sent" ? (
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(52,211,153,0.15)" }}>
                      <Check size={22} style={{ color: "#34d399" }} />
                    </div>
                    <div className="text-sm font-semibold" style={{ fontFamily: F.b, color: "#34d399" }}>{t("don.sent", finalAmount, artist.name)}</div>
                  </motion.div>
                ) : stage === "pay" ? (
                  <>
                    <div className="font-bold mb-3" style={{ fontFamily: F.d, fontSize: 16, letterSpacing: "-0.01em" }}>{t("don.title", artist.name)}</div>

                    <div className="rounded-2xl p-3.5 mb-4" style={{ background: "color-mix(in srgb, var(--wash) 05%, transparent)" }}>
                      <div className="flex justify-between text-xs mb-1.5" style={{ fontFamily: F.b, color: "color-mix(in srgb, var(--fg) 55%, transparent)" }}>
                        <span>{t("don.amount")}</span><span>{finalAmount}₽</span>
                      </div>
                      <div className="flex justify-between text-xs mb-1.5" style={{ fontFamily: F.b, color: "color-mix(in srgb, var(--fg) 45%, transparent)" }}>
                        <span>{t("don.fee")}</span><span>−{fee}₽</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold pt-1.5" style={{ fontFamily: F.b, borderTop: "1px solid color-mix(in srgb, var(--wash) 10%, transparent)" }}>
                        <span>{t("don.net")}</span><span style={{ color: artist.c2 }}>{net}₽</span>
                      </div>
                    </div>

                    <div className="flex gap-2 mb-4">
                      {(["card", "qr"] as const).map(m => (
                        <button key={m} onClick={() => setMethod(m)} className="flex-1 py-2.5 rounded-2xl text-xs font-semibold" style={{ background: method === m ? `${artist.c2}22` : "color-mix(in srgb, var(--wash) 6%, transparent)", border: `1px solid ${method === m ? artist.c2 + "55" : "transparent"}`, color: method === m ? artist.c2 : "color-mix(in srgb, var(--fg) 55%, transparent)", fontFamily: F.b }}>
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
                        <FakeQR seed={finalAmount * 97 + artist.name.length} />
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
                        onClick={() => {
                          if (method === "card" && (cardNum.replace(/\s/g, "").length < 16 || cardExp.length < 5 || cardCvc.length < 3)) { toast(t("don.cardIncomplete")); return; }
                          setProcessing(true);
                          setTimeout(() => {
                            setProcessing(false);
                            setStage("sent");
                            toast.success(t("don.sent", finalAmount, artist.name));
                            // Донат можно повторить: форма возвращается сама, без ручного закрытия
                            setTimeout(() => setStage("pick"), 1600);
                          }, 1300);
                        }}
                        className="flex-1 py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2"
                        style={{ background: `linear-gradient(135deg, ${artist.c2}, ${artist.c2}99)`, color: "#fff", fontFamily: F.b }}
                      >
                        {processing ? (<><Loader2 size={14} className="animate-spin" /> {t("don.paying")}</>) : t("don.send", finalAmount)}
                      </motion.button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-bold mb-1" style={{ fontFamily: F.d, fontSize: 16, letterSpacing: "-0.01em" }}>{t("don.title", artist.name)}</div>
                    <div className="text-xs mb-4" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("don.sub")}</div>
                    <div className="flex gap-2 mb-4 flex-wrap">
                      {[50, 100, 300, 500].map(a => (
                        <button key={a} onClick={() => { setAmount(a); setCustom(""); }} className="px-4 py-2 rounded-full text-sm font-semibold transition-all" style={{ background: amount === a && !custom ? artist.c2 : "color-mix(in srgb, var(--wash) 07%, transparent)", color: amount === a && !custom ? "#fff" : "color-mix(in srgb, var(--fg) 60%, transparent)", fontFamily: F.b }}>
                          {a}₽
                        </button>
                      ))}
                      <input
                        value={custom}
                        onChange={e => setCustom(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder={t("don.custom")}
                        className="w-24 px-3 py-2 rounded-full text-sm bg-transparent outline-none text-center"
                        style={{ border: `1px solid ${custom ? artist.c2 : "color-mix(in srgb, var(--wash) 12%, transparent)"}`, color: "var(--fg)", fontFamily: F.b }}
                      />
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      disabled={finalAmount <= 0}
                      onClick={() => setStage("pay")}
                      className="w-full py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2"
                      style={{ background: finalAmount > 0 ? `linear-gradient(135deg, ${artist.c2}, ${artist.c2}99)` : "color-mix(in srgb, var(--wash) 06%, transparent)", color: finalAmount > 0 ? "#fff" : "color-mix(in srgb, var(--fg) 30%, transparent)", fontFamily: F.b }}
                    >
                      {t("don.next")} <ArrowRight size={13} />
                    </motion.button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Популярное */}
        <h3 className="mb-3" style={{ fontFamily: F.d, fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em" }}>{t("ar.popular")}</h3>
        {own.map(tr => (
          <div key={tr.id} onClick={() => onPlay(tr)} className="flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer hover:bg-white/5 transition-colors mb-1">
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
              <div key={tr.id} onClick={() => onPlay(tr)} className="flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer hover:bg-white/5 transition-colors mb-1">
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
        <div className="flex gap-2.5">
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
}

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
      <div className="p-7">
        <div className="text-center mb-6">
          <img src={peer.avatar} alt="" className="w-20 h-20 rounded-full object-cover mx-auto mb-3" style={{ border: `2px solid ${c2}`, boxShadow: `0 0 40px ${c2}50` }} />
          <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 22, letterSpacing: "-0.02em" }}>{name}</div>
          <div className="text-xs mt-1" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.m }}>{t("acc.level", peer.level)}</div>
        </div>

        <div className="relative rounded-[22px] overflow-hidden p-4" style={GLASS}>
          <Aurora c2={c2} opacity={0.35} />
          <div className="relative z-10 flex gap-2">
            {[[String(peer.minutesWeek), t("acc.stMin")], [String(peer.streak), t("acc.stStreak")], [peer.topGenre, t("acc.stGenre")]].map(([v, l]) => (
              <div key={l} className="flex-1 rounded-xl px-2 py-2.5 text-center min-w-0" style={{ background: "color-mix(in srgb, var(--wash) 06%, transparent)" }}>
                <div className="text-sm font-bold truncate" style={{ fontFamily: F.d, color: c2 }}>{v}</div>
                <div className="text-[9px] mt-0.5 truncate" style={{ fontFamily: F.b, color: "color-mix(in srgb, var(--fg) 45%, transparent)" }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
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
    <Sheet open={!!album} onClose={onClose} z={55}>
      <div className="relative" style={{ height: 200 }}>
        <img src={cover.img} alt="" className="w-full h-full object-cover" style={{ filter: "brightness(0.5)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(13,13,26,1) 0%, transparent 60%)" }} />
        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(10px)", color: ON_DARK }}>
          <X size={16} />
        </button>
        <div className="absolute bottom-3 left-6 right-6">
          <div className="text-[10px] uppercase tracking-[0.16em] mb-1" style={{ color: onDark(45), fontFamily: F.m }}>{t("al.type")}</div>
          <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 26, letterSpacing: "-0.03em", color: ON_DARK }}>{album}</div>
          <button onClick={() => onOpenArtist(cover.artist)} className="text-xs mt-1 hover:text-white transition-colors" style={{ color: onDark(55), fontFamily: F.b }}>{cover.artist} · {t("al.nTracks", totalDur)}</button>
        </div>
      </div>

      <div className="px-6 pt-4 pb-8">
        <div className="flex gap-2.5 mb-6">
          <motion.button whileTap={{ scale: 0.94 }} onClick={() => tracks[0] && onPlay(tracks[0])} className="flex-1 py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2" style={{ background: `linear-gradient(135deg, ${c2}, ${c2}99)`, color: "#fff", fontFamily: F.b }}>
            <Play size={16} fill="white" stroke="none" className="ml-0.5" /> {t("al.play")}
          </motion.button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => toast(t("al.shuffled"))} className="px-5 rounded-full text-sm font-semibold" style={{ ...GLASS, fontFamily: F.b }}>
            <Shuffle size={15} />
          </motion.button>
        </div>

        {tracks.map((tr, i) => (
          <div key={tr.id} onClick={() => onPlay(tr)} className="flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer hover:bg-white/5 transition-colors mb-1">
            <div className="w-6 text-center text-xs" style={{ color: currentTrack.id === tr.id && playing ? c2 : "color-mix(in srgb, var(--fg) 30%, transparent)", fontFamily: F.m }}>
              {currentTrack.id === tr.id && playing ? <EQ color={c2} size={10} /> : i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate" style={{ fontFamily: F.b }}>{tr.title}</div>
              <div className="text-xs" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}>{tr.duration}</div>
            </div>
          </div>
        ))}
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
    <Sheet open={!!playlistId} onClose={onClose} z={56}>
      <div className="relative px-6 pt-7 pb-8">
        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center z-10" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)" }}>
          <X size={16} />
        </button>
        {customPlIds?.has(pl.id) && (
          <button onClick={() => { onDelete?.(pl.id); onClose(); }} className="absolute top-4 right-16 w-9 h-9 rounded-full flex items-center justify-center z-10" style={{ background: "rgba(248,113,113,0.12)" }}>
            <Trash2 size={15} style={{ color: "#f87171" }} />
          </button>
        )}

        <div className="flex gap-4 mb-6">
          <img src={pl.img} alt="" className="w-24 h-24 rounded-2xl object-cover flex-shrink-0" style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.4)" }} />
          <div className="pt-1">
            <div className="text-[10px] uppercase tracking-[0.16em] mb-1" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}>{t("lib.playlists")}</div>
            <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 22, letterSpacing: "-0.03em" }}>{pl.name}</div>
            <div className="text-xs mt-1" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("lib.nTracks", tracks.length)}</div>
            <div className="text-[10px] mt-2" style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)", fontFamily: F.m }}>{t("pl.dragHint")}</div>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          {tracks.map((tr, i) => (
            <motion.div
              key={tr.id}
              layout
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={e => { e.preventDefault(); setOverIdx(i); }}
              onDragEnd={() => { if (dragIdx !== null && overIdx !== null) reorder(dragIdx, overIdx); setDragIdx(null); setOverIdx(null); }}
              onClick={() => onPlay(tr)}
              className="flex items-center gap-3 p-2.5 rounded-2xl cursor-grab active:cursor-grabbing transition-colors"
              style={{
                background: overIdx === i && dragIdx !== null ? "color-mix(in srgb, var(--wash) 08%, transparent)" : "color-mix(in srgb, var(--wash) 03%, transparent)",
                border: overIdx === i && dragIdx !== null ? "1px solid color-mix(in srgb, var(--wash) 12%, transparent)" : "1px solid transparent",
                opacity: dragIdx === i ? 0.5 : 1,
              }}
            >
              <GripVertical size={14} style={{ color: "color-mix(in srgb, var(--fg) 25%, transparent)", flexShrink: 0 }} />
              <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
                <img src={tr.img} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate flex items-center gap-2" style={{ fontFamily: F.b }}>
                  {tr.title}
                  {currentTrack.id === tr.id && playing && <EQ color={tr.c2} size={9} />}
                </div>
                <div className="text-xs truncate" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.b }}>{tr.artist}</div>
              </div>
              <span className="text-[10px]" style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)", fontFamily: F.m }}>{tr.duration}</span>
            </motion.div>
          ))}
        </div>
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
      <div className="relative px-6 pt-8 pb-8 overflow-hidden">
        <Aurora c2={c2} opacity={0.5} />

        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center z-20" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)" }}>
          <X size={16} />
        </button>

        {/* Слияние аватаров */}
        <div className="relative z-10 flex justify-center items-center mb-5" style={{ height: 96 }}>
          <motion.img initial={{ x: -30, opacity: 0 }} animate={{ x: 12, opacity: 1 }} transition={{ ...SPRING, delay: 0.1 }} src={avatar} alt="" className="w-20 h-20 rounded-full object-cover relative" style={{ border: `3px solid ${c2}`, zIndex: 2 }} />
          <motion.img initial={{ x: 30, opacity: 0 }} animate={{ x: -12, opacity: 1 }} transition={{ ...SPRING, delay: 0.18 }} src={friend.img} alt="" className="w-20 h-20 rounded-full object-cover" style={{ border: "3px solid #8b5cf6", zIndex: 1 }} />
        </div>

        <div className="relative z-10 text-center mb-6">
          <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 24, letterSpacing: "-0.03em" }}>{t("bl.title", finst)}</div>
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, ...SPRING }} className="inline-flex items-baseline gap-2 mt-2 px-4 py-1.5 rounded-full" style={{ background: `${c2}1c`, border: `1px solid ${c2}38` }}>
            <span style={{ fontFamily: F.d, fontWeight: 900, fontSize: 22, color: c2 }}>{friend.match}%</span>
            <span className="text-xs" style={{ color: "color-mix(in srgb, var(--fg) 55%, transparent)", fontFamily: F.b }}>{t("bl.match")}</span>
          </motion.div>
        </div>

        {/* Общие жанры */}
        <div className="relative z-10 mb-6">
          <div className="text-[10px] uppercase tracking-[0.16em] mb-2.5" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}>{t("bl.genres")}</div>
          <div className="flex gap-2 flex-wrap">
            {["Lo-fi", "Synthwave", "Indie"].map(g => (
              <span key={g} className="px-3.5 py-1.5 rounded-full text-xs font-medium" style={{ ...GLASS, fontFamily: F.b, color: "color-mix(in srgb, var(--fg) 75%, transparent)" }}>{g}</span>
            ))}
          </div>
        </div>

        {/* Плейлист */}
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-2.5">
            <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}>{t("bl.playlist")}</div>
            <div className="text-[10px]" style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)", fontFamily: F.m }}>{t("bl.updates")}</div>
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
        <motion.div key={tr.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }} onClick={() => onPlay(tr)} className="flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer hover:bg-white/5 transition-colors">
          <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0">
            <img src={tr.img} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
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

export function AccountSheet({ open, onClose, userName, onRename, avatarIdx, onAvatar, customAvatar, onAvatarFile, onDeleted, onOpenImport, onOpenSupport }: {
  open: boolean; onClose: () => void; userName: string; onRename: (n: string) => void;
  avatarIdx: number; onAvatar: (i: number) => void; customAvatar: string | null; onAvatarFile: (dataUrl: string) => void; onDeleted: () => void; onOpenImport: () => void; onOpenSupport: () => void;
}) {
  const { t } = useLang();
  const [name, setName] = useState(userName);
  const [deleteQ, setDeleteQ] = useState(false);
  useEffect(() => { setName(userName); }, [userName, open]);

  return (
    <>
      <Sheet open={open} onClose={onClose} z={65}>
        <div className="px-6 pt-7 pb-8">
          <div className="flex items-center justify-between mb-6">
            <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 24, letterSpacing: "-0.03em" }}>{t("acc.title")}</div>
            <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)" }}>
              <X size={16} />
            </button>
          </div>

          {/* Уровень меломана */}
          <div className="relative rounded-[22px] overflow-hidden p-4 mb-5" style={GLASS}>
            <Aurora c2="#8b5cf6" opacity={0.35} />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold" style={{ fontFamily: F.d, letterSpacing: "-0.01em" }}>{t("acc.level", 3)}</span>
                <span className="text-[10px]" style={{ fontFamily: F.m, color: "color-mix(in srgb, var(--fg) 45%, transparent)" }}>1 240 / 2 000 XP</span>
              </div>
              <div className="rounded-full overflow-hidden mb-3" style={{ height: 6, background: "color-mix(in srgb, var(--wash) 10%, transparent)" }}>
                <motion.div initial={{ width: 0 }} animate={{ width: "62%" }} transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }} className="h-full rounded-full" style={{ background: "linear-gradient(90deg, #8b5cf6, #c4b5fd)" }} />
              </div>
              <div className="flex gap-2">
                {[["247", t("acc.stMin")], ["21", t("acc.stStreak")], ["Synthwave", t("acc.stGenre")]].map(([v, l]) => (
                  <div key={l} className="flex-1 rounded-xl px-2 py-2 text-center" style={{ background: "color-mix(in srgb, var(--wash) 06%, transparent)" }}>
                    <div className="text-xs font-bold truncate" style={{ fontFamily: F.d, color: "#a78bfa" }}>{v}</div>
                    <div className="text-[9px] mt-0.5 truncate" style={{ fontFamily: F.b, color: "color-mix(in srgb, var(--fg) 45%, transparent)" }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>


          {/* Аватар */}
          <div className="text-[10px] uppercase tracking-[0.16em] mb-2.5" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}>{t("acc.avatar")}</div>
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
                };
                img.src = URL.createObjectURL(f);
              }} />
            </label>
          </div>

          {/* Имя */}
          <div className="text-[10px] uppercase tracking-[0.16em] mb-2.5" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}>{t("acc.name")}</div>
          <div className="flex gap-2.5 mb-5">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="flex-1 px-4 py-3 rounded-2xl bg-transparent outline-none text-sm"
              style={{ ...GLASS, color: "var(--fg)", fontFamily: F.b }}
            />
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => { if (name.trim()) { onRename(name.trim()); toast(t("acc.saved")); } }} className="px-5 rounded-2xl text-sm font-semibold" style={{ background: "linear-gradient(135deg, #8b5cf6, #a78bfa)", fontFamily: F.b }}>
              {t("acc.save")}
            </motion.button>
          </div>

          {/* Почта, подписка, поддержка */}
          <div className="flex flex-col gap-1.5 mb-6">
            <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl" style={GLASS}>
              <Mail size={15} style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)" }} />
              <div className="flex-1 text-sm" style={{ fontFamily: F.b }}>{t("acc.email")}</div>
              <div className="text-xs" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.m }}>alex@myra.app</div>
            </div>
            <motion.div whileTap={{ scale: 0.99 }} onClick={() => toast(t("acc.planTap"))} className="flex items-center gap-3 px-4 py-3.5 rounded-2xl cursor-pointer" style={GLASS}>
              <Crown size={15} style={{ color: "#facc15" }} />
              <div className="flex-1 text-sm" style={{ fontFamily: F.b }}>{t("acc.plan")}</div>
              <div className="text-xs" style={{ color: "#facc15", fontFamily: F.m }}>{t("acc.planVal")}</div>
            </motion.div>
            <motion.div whileTap={{ scale: 0.99 }} onClick={() => { onClose(); onOpenImport(); }} className="flex items-center gap-3 px-4 py-3.5 rounded-2xl cursor-pointer" style={GLASS}>
              <ImportIcon size={15} style={{ color: "#8b5cf6" }} />
              <div className="flex-1">
                <div className="text-sm" style={{ fontFamily: F.b }}>{t("im2.row")}</div>
                <div className="text-[10px]" style={{ color: "color-mix(in srgb, var(--fg) 35%, transparent)", fontFamily: F.m }}>{t("im2.rowSub")}</div>
              </div>
              <ChevronRight size={15} style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }} />
            </motion.div>
            <motion.div whileTap={{ scale: 0.99 }} onClick={() => { onClose(); onOpenSupport(); }} className="flex items-center gap-3 px-4 py-3.5 rounded-2xl cursor-pointer" style={GLASS}>
              <MessageCircle size={15} style={{ color: "#34d399" }} />
              <div className="flex-1">
                <div className="text-sm" style={{ fontFamily: F.b }}>{t("acc.support")}</div>
                <div className="text-[10px]" style={{ color: "color-mix(in srgb, var(--fg) 35%, transparent)", fontFamily: F.m }}>{t("acc.supportSub")}</div>
              </div>
              <ChevronRight size={15} style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }} />
            </motion.div>
          </div>

          <motion.button whileTap={{ scale: 0.98 }} onClick={() => setDeleteQ(true)} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-medium" style={{ background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.18)", color: "#f87171", fontFamily: F.b }}>
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
    </>
  );
}

// ─── Creator+ (монетизация) ───────────────────────────────────────────────────

export function CreatorPlusSheet({ open, onClose, status, onActivate, onCancelSub, onResume }: {
  open: boolean; onClose: () => void; status: "none" | "active" | "grace"; onActivate: () => void; onCancelSub: () => void; onResume: () => void;
}) {
  const { t } = useLang();
  const [state, setState] = useState<"offer" | "paying" | "done">("offer");
  const [cancelQ, setCancelQ] = useState(false);
  useEffect(() => { if (open) setState(status !== "none" ? "done" : "offer"); }, [open, status]);

  const pay = () => {
    setState("paying");
    setTimeout(() => { setState("done"); onActivate(); toast.success(t("cp.done")); }, 1600);
  };

  const BENEFITS = [
    { Icon: Gift, title: t("cp.b1"), sub: t("cp.b1Sub") },
    { Icon: Zap, title: t("cp.b2"), sub: t("cp.b2Sub") },
    { Icon: LineChart, title: t("cp.b3"), sub: t("cp.b3Sub") },
    { Icon: Headset, title: t("cp.b4"), sub: t("cp.b4Sub") },
  ];

  return (
    <Sheet open={open} onClose={onClose} z={65}>
      <div className="relative px-6 pt-8 pb-8 overflow-hidden">
        <Aurora c2="#8b5cf6" opacity={0.6} />
        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center z-20" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)" }}>
          <X size={16} />
        </button>

        <div className="relative z-10">
          {state === "done" ? (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SPRING} className="text-center py-6">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...SPRING, delay: 0.15 }} className="w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center" style={{ background: "rgba(52,211,153,0.13)", border: "1.5px solid rgba(52,211,153,0.4)" }}>
                <Check size={34} style={{ color: "#34d399" }} />
              </motion.div>
              <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 24, letterSpacing: "-0.03em" }}>{t("cp.done")}</div>
              <div className="text-sm mt-2 mb-2" style={{ color: "color-mix(in srgb, var(--fg) 50%, transparent)", fontFamily: F.b }}>{t("cp.doneSub")}</div>
              <div className="text-xs mb-7" style={{ color: status === "grace" ? "#fb923c" : "color-mix(in srgb, var(--fg) 35%, transparent)", fontFamily: F.m }}>{status === "grace" ? t("cp.graceNote") : t("cp.cancel")}</div>
              <motion.button whileTap={{ scale: 0.96 }} onClick={onClose} className="px-10 py-3 rounded-full text-sm font-semibold" style={{ background: "linear-gradient(135deg, #8b5cf6, #a78bfa)", fontFamily: F.b }}>
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
            </motion.div>
          ) : (
            <>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4" style={{ background: "rgba(139,92,246,0.16)", border: "1px solid rgba(139,92,246,0.35)" }}>
                <Crown size={13} style={{ color: "#c4b5fd" }} />
                <span className="text-xs font-semibold" style={{ color: "#c4b5fd", fontFamily: F.m }}>{t("cp.title")}</span>
              </div>
              <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 27, letterSpacing: "-0.03em", lineHeight: 1.1 }} className="mb-2">{t("cr.earn")}</div>
              <div className="text-sm mb-4" style={{ color: "color-mix(in srgb, var(--fg) 50%, transparent)", fontFamily: F.b }}>{t("cp.sub")}</div>

              <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl mb-5" style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.28)" }}>
                <TrendingUp size={15} style={{ color: "#34d399", flexShrink: 0 }} />
                <span className="text-xs font-semibold" style={{ color: "#34d399", fontFamily: F.b }}>{t("cp.stat")}</span>
              </div>

              <div className="flex flex-col gap-2.5 mb-7">
                {BENEFITS.map((b, i) => (
                  <motion.div key={b.title} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 + i * 0.07 }} className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl" style={GLASS}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(139,92,246,0.2)" }}>
                      <b.Icon size={15} style={{ color: "#c4b5fd" }} />
                    </div>
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
            </>
          )}
        </div>
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

export function WrappedModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLang();
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [fillPct, setFillPct] = useState(0);
  const rafRef = useRef<number | undefined>(undefined);
  const lastTsRef = useRef(0);
  const elapsedRef = useRef(0);
  const suppressClickRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const SLIDES = [
    { c1: "#12083a", c2: "#8b5cf6", eyebrow: t("wr.minutesEyebrow"), big: t("wr.minutes"),   sub: t("wr.minutesSub"), img: "", share: false },
    { c1: "#1a0a08", c2: "#fb923c", eyebrow: t("wr.artistEyebrow"),  big: "Luna Wave",       sub: t("wr.artist"),     img: ALL_TRACKS[0].img, share: false },
    { c1: "#071a10", c2: "#34d399", eyebrow: t("wr.genreEyebrow"),   big: "Synthwave",       sub: t("wr.genre"),      img: "", share: false },
    { c1: "#181200", c2: "#facc15", eyebrow: t("wr.tracksEyebrow"),  big: t("wr.tracksVal"), sub: t("wr.tracksSub"),  img: "", share: false },
    { c1: "#0f0818", c2: "#f472b6", eyebrow: t("wr.shareEyebrow"),   big: t("wr.shareTitle"), sub: "",                img: "", share: true },
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

            <button onClick={onClose} className="absolute top-8 right-4 w-9 h-9 rounded-full flex items-center justify-center z-40" style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(10px)" }}>
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
                    onClick={e => { e.stopPropagation(); toast(t("wr.shared")); }}
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

// ─── Детальная аналитика студии ───────────────────────────────────────────────

export function StudioStatsSheet({ open, onClose, c2 }: { open: boolean; onClose: () => void; c2: string }) {
  const { t, lang } = useLang();
  const [monthOffset, setMonthOffset] = useState(0);

  const viewDate = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);
  const numDays = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const monthLabel = viewDate.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { month: "long", year: "numeric" });
  // Стабильный сид на месяц: те же цифры при возврате к уже просмотренному месяцу
  const seed = viewDate.getFullYear() * 12 + viewDate.getMonth();

  const days = useMemo(() => Array.from({ length: numDays }, (_, i) =>
    Math.max(6, Math.round(42 + Math.abs(Math.sin(i * 0.7 + seed) * 34 + Math.sin(i * 0.23 + seed * 1.7) * 21) + Math.sin(seed * 3.1 + i * 0.05) * 12))
  ), [numDays, seed]);

  const TOP = [
    { tr: ALL_TRACKS[0], plays: "1 204", delta: "+22%", up: true },
    { tr: ALL_TRACKS[2], plays: "688",   delta: "+9%",  up: true },
    { tr: ALL_TRACKS[5], plays: "342",   delta: "-3%",  up: false },
  ];
  const SOURCES: [string, number, string][] = [
    [t("st.srcWave"), 46, "#8b5cf6"], [t("st.srcSearch"), 27, "#34d399"],
    [t("st.srcProfile"), 17, "#fb923c"], [t("st.srcBlend"), 10, "#f472b6"],
  ];
  const CITIES: [string, number][] = [["Москва", 34], ["Санкт-Петербург", 21], ["Алматы", 12], ["Берлин", 8]];

  return (
    <Sheet open={open} onClose={onClose} z={62}>
      <div className="px-6 pt-7 pb-8">
        <div className="flex items-center justify-between mb-6">
          <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 22, letterSpacing: "-0.03em" }}>{t("st.title")}</div>
          <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)" }}>
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
          {TOP.map(({ tr, plays, delta, up }) => (
            <div key={tr.id} className="flex items-center gap-3 py-2">
              <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0">
                <img src={tr.img} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0 text-sm font-semibold truncate" style={{ fontFamily: F.b }}>{tr.title}</div>
              <div className="text-xs" style={{ color: "color-mix(in srgb, var(--fg) 50%, transparent)", fontFamily: F.m }}>{plays}</div>
              <div className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold" style={{ fontFamily: F.m, color: up ? "#34d399" : "#f87171", background: up ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)" }}>{delta}</div>
            </div>
          ))}
        </div>

        {/* Источники */}
        <div className="rounded-[20px] p-4 mb-4" style={GLASS}>
          <div className="text-[10px] uppercase tracking-[0.16em] mb-3" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}>{t("st.sources")}</div>
          <div className="flex h-2.5 rounded-full overflow-hidden mb-3">
            {SOURCES.map(([label, v, c]) => <div key={label} style={{ width: `${v}%`, background: c }} />)}
          </div>
          <div className="grid grid-cols-2 gap-y-1.5 gap-x-3">
            {SOURCES.map(([label, v, c]) => (
              <div key={label} className="flex items-center gap-2 text-xs" style={{ fontFamily: F.b, color: "color-mix(in srgb, var(--fg) 65%, transparent)" }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c }} />
                <span className="truncate">{label}</span>
                <span className="ml-auto" style={{ fontFamily: F.m, color: "color-mix(in srgb, var(--fg) 40%, transparent)" }}>{v}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Города + донаты */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-[20px] p-4" style={GLASS}>
            <div className="text-[10px] uppercase tracking-[0.16em] mb-3" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}>{t("st.cities")}</div>
            {CITIES.map(([city, v]) => (
              <div key={city} className="mb-2.5">
                <div className="flex justify-between text-xs mb-1" style={{ fontFamily: F.b }}>
                  <span style={{ color: "color-mix(in srgb, var(--fg) 75%, transparent)" }}>{city}</span>
                  <span style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}>{v}%</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: "color-mix(in srgb, var(--wash) 08%, transparent)" }}>
                  <div className="h-full rounded-full" style={{ width: `${v * 2.5}%`, background: `linear-gradient(90deg, ${c2}, ${c2}66)` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-[20px] p-4 flex flex-col justify-center" style={GLASS}>
            <div className="text-[10px] uppercase tracking-[0.16em] mb-2" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}>{t("st.donations")}</div>
            <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 30, letterSpacing: "-0.03em", color: c2 }}>1 240₽</div>
            <div className="flex items-center gap-1 mt-1 text-xs font-semibold" style={{ color: "#34d399", fontFamily: F.m }}>+38%</div>
          </div>
        </div>
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
          <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--wash) 7%, transparent)" }}>
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
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => parse(text)} disabled={!text.trim()} className="flex-1 py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2" style={{ background: text.trim() ? "linear-gradient(135deg, #8b5cf6, #a78bfa)" : "color-mix(in srgb, var(--wash) 6%, transparent)", color: text.trim() ? "#fff" : "color-mix(in srgb, var(--fg) 30%, transparent)", fontFamily: F.b }}>
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

// ─── Поддержка (чат внутри приложения, история хранится локально) ────────────

interface SupportMsg { id: number; from: "me" | "support"; text: string; time: number; topicLabel?: string }

const SUPPORT_TOPICS = ["sup.tBug", "sup.tBilling", "sup.tIdea", "sup.tOther"] as const;
const REPLY_KEY: Record<typeof SUPPORT_TOPICS[number], string> = {
  "sup.tBug": "sup.replyBug", "sup.tBilling": "sup.replyBilling", "sup.tIdea": "sup.replyIdea", "sup.tOther": "sup.replyOther",
};

const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function SupportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLang();
  const [topic, setTopic] = useState<typeof SUPPORT_TOPICS[number]>("sup.tBug");
  const [msg, setMsg] = useState("");
  const [thread, setThread] = useState<SupportMsg[]>(() => ls.get<SupportMsg[]>("supportChat", []));
  const [typing, setTyping] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Приветствие при самом первом открытии — дальше история живёт в localStorage
  useEffect(() => {
    if (open && thread.length === 0) {
      const greet: SupportMsg = { id: Date.now(), from: "support", text: t("sup.greet"), time: Date.now() };
      setThread([greet]);
      ls.set("supportChat", [greet]);
    }
  }, [open]);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [thread, typing]);
  useEffect(() => () => clearTimeout(replyTimer.current), []);

  const send = () => {
    const text = msg.trim();
    if (!text) { toast(t("sup.empty")); return; }
    const mine: SupportMsg = { id: Date.now(), from: "me", text, time: Date.now(), topicLabel: t(topic) };
    setThread(prev => { const next = [...prev, mine]; ls.set("supportChat", next); return next; });
    setMsg("");
    setTyping(true);
    clearTimeout(replyTimer.current);
    replyTimer.current = setTimeout(() => {
      const reply: SupportMsg = { id: Date.now() + 1, from: "support", text: t(REPLY_KEY[topic]), time: Date.now() };
      setThread(prev => { const next = [...prev, reply]; ls.set("supportChat", next); return next; });
      setTyping(false);
      toast(t("sup.newReply"));
    }, 1400);
  };

  return (
    <Sheet open={open} onClose={onClose} z={67}>
      <div className="px-6 pt-7 pb-5 flex flex-col" style={{ height: "min(78vh, 640px)" }}>
        <div className="flex items-center justify-between mb-1 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #8b5cf6, #a78bfa)" }}>
              <MessageCircle size={16} style={{ color: "#fff" }} />
            </div>
            <div className="min-w-0">
              <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 17, letterSpacing: "-0.02em" }}>{t("sup.title")}</div>
              <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "#34d399", fontFamily: F.m }}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#34d399" }} /> {t("sup.online")}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "color-mix(in srgb, var(--wash) 7%, transparent)" }}>
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
                <div className="px-4 py-2.5 rounded-[18px] text-sm" style={m.from === "me" ? { background: "linear-gradient(135deg, #8b5cf6, #a78bfa)", color: "#fff", borderBottomRightRadius: 6, fontFamily: F.b } : { ...GLASS, borderBottomLeftRadius: 6, fontFamily: F.b }}>
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
              <button key={id} onClick={() => setTopic(id)} className="px-3 py-1.5 rounded-full text-[11px] font-semibold" style={{ background: topic === id ? "linear-gradient(135deg, #8b5cf6, #a78bfa)" : "color-mix(in srgb, var(--wash) 6%, transparent)", color: topic === id ? "#fff" : "color-mix(in srgb, var(--fg) 60%, transparent)", fontFamily: F.b }}>
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
            <motion.button whileTap={{ scale: 0.88 }} onClick={send} className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: msg.trim() ? "linear-gradient(135deg, #8b5cf6, #a78bfa)" : "color-mix(in srgb, var(--wash) 8%, transparent)" }}>
              <Send size={16} style={{ color: msg.trim() ? "#fff" : "color-mix(in srgb, var(--fg) 30%, transparent)" }} />
            </motion.button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
