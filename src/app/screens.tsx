import { useState, useRef, useCallback, useMemo } from "react";
import {
  Play, Pause, Heart, Search, Mic2, Upload, BarChart3, Plus, ChevronRight,
  Volume2, Globe, Settings, Bell, Check, Download, X, Users, Music2,
  Zap, Radio, Moon, Dumbbell, Car, Brain, LogOut, TrendingUp, Wallet,
  Bot, Blend as BlendIcon, Crown, Trash2, FileAudio,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { TRACKS, CHARTS, FRIENDS, PLAYLISTS, PODCASTS, GENRE_TILES, svgCover, type Track, type Friend } from "./data";
import { F, GLASS, SPRING, TiltCard, Aurora, Waveform, EQ, Toggle, ConfirmSheet, Page } from "./lib";
import { useLang, type Lang } from "./i18n";

// ─── Дека открытий ────────────────────────────────────────────────────────────

function DiscoveryDeck({ onPlay }: { onPlay: (t: Track) => void }) {
  const { t } = useLang();
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState<"left" | "right" | null>(null);
  const startRef = useRef({ x: 0, y: 0 });

  const deck = useMemo(() => TRACKS.slice(0, 6), []);
  const current = deck[index % deck.length];
  const next = deck[(index + 1) % deck.length];
  const after = deck[(index + 2) % deck.length];

  const dismiss = useCallback((dir: "left" | "right") => {
    setExiting(dir);
    setTimeout(() => {
      setIndex(i => i + 1);
      setDrag({ x: 0, y: 0 });
      setExiting(null);
    }, 320);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    startRef.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    setDrag({ x: e.clientX - startRef.current.x, y: e.clientY - startRef.current.y });
  };
  const onPointerUp = () => {
    setDragging(false);
    if (drag.x > 70) { dismiss("right"); onPlay(current); }
    else if (drag.x < -70) dismiss("left");
    else setDrag({ x: 0, y: 0 });
  };

  const rot = drag.x * 0.08;
  const exitX = exiting === "right" ? 500 : exiting === "left" ? -500 : 0;
  const exitRot = exiting === "right" ? 25 : exiting === "left" ? -25 : 0;

  return (
    <div className="relative select-none" style={{ height: 344 }}>
      {[after, next].reverse().map((tr, ri) => (
        <div key={tr.id} className="absolute inset-x-0 mx-auto rounded-[26px] overflow-hidden" style={{ width: "100%", height: 300, top: 20, transform: `scale(${0.88 + ri * 0.06}) translateY(${(1 - ri) * 14}px)`, zIndex: ri, transition: "transform 0.35s ease" }}>
          <img src={tr.img} alt="" className="w-full h-full object-cover" style={{ filter: "brightness(0.35)" }} />
        </div>
      ))}

      <div
        className="absolute inset-x-0 mx-auto rounded-[26px] overflow-hidden cursor-grab active:cursor-grabbing"
        style={{
          width: "100%", height: 300, top: 20, zIndex: 10,
          transform: exiting
            ? `translateX(${exitX}px) rotate(${exitRot}deg)`
            : `translateX(${drag.x}px) translateY(${drag.y * 0.3}px) rotate(${rot}deg)`,
          transition: dragging ? "none" : "transform 0.35s cubic-bezier(0.25,0.46,0.45,0.94)",
          boxShadow: `0 30px 80px ${current.c2}38`,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <img src={current.img} alt={current.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${current.c1}f0 0%, transparent 55%)` }} />

        {drag.x > 30 && (
          <div className="absolute top-6 left-6 px-4 py-2 rounded-full text-sm font-semibold" style={{ ...GLASS, color: "#34d399", border: "1px solid rgba(52,211,153,0.4)" }}>
            {t("deck.play")}
          </div>
        )}
        {drag.x < -30 && (
          <div className="absolute top-6 right-6 px-4 py-2 rounded-full text-sm font-semibold" style={{ ...GLASS, color: "#f87171", border: "1px solid rgba(248,113,113,0.4)" }}>
            {t("deck.skip")}
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="text-[10px] uppercase tracking-[0.18em] mb-1.5" style={{ color: current.c2, fontFamily: F.m }}>{current.genre}</div>
          <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 22, lineHeight: 1.15, letterSpacing: "-0.02em" }}>{current.title}</div>
          <div className="text-sm mt-1" style={{ color: "rgba(242,242,248,0.6)", fontFamily: F.b }}>{current.artist} · {current.plays}</div>
        </div>
      </div>

      <div className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-5" style={{ zIndex: 20 }}>
        <motion.button whileTap={{ scale: 0.85 }} onClick={() => dismiss("left")} className="w-12 h-12 rounded-full flex items-center justify-center" style={{ ...GLASS }}>
          <X size={18} style={{ color: "#f87171" }} />
        </motion.button>
        <motion.button whileTap={{ scale: 0.88 }} whileHover={{ scale: 1.06 }} onClick={() => { onPlay(current); dismiss("right"); }} className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${current.c2}, ${current.c2}99)`, boxShadow: `0 12px 36px ${current.c2}55` }}>
          <Play size={22} fill="white" stroke="none" className="ml-1" />
        </motion.button>
        <motion.button whileTap={{ scale: 0.85 }} onClick={() => dismiss("right")} className="w-12 h-12 rounded-full flex items-center justify-center" style={{ ...GLASS }}>
          <Heart size={18} style={{ color: "#34d399" }} />
        </motion.button>
      </div>
    </div>
  );
}

// ─── Главная ──────────────────────────────────────────────────────────────────

const NOTIF_KEYS = [
  { icon: Music2, key: "notif.1", time: ["12", "time.min"] },
  { icon: Users,  key: "notif.2", time: ["1", "time.h"] },
  { icon: Wallet, key: "notif.3", time: ["3", "time.h"] },
];

export function HomeScreen({ onPlay, currentTrack, playing, onNavigate, onOpenBlend, onOpenLive, avatar }: {
  onPlay: (t: Track) => void; currentTrack: Track; playing: boolean; onNavigate: (tab: string) => void;
  onOpenBlend: (f: Friend) => void; onOpenLive: (f: Friend) => void; avatar: string;
}) {
  const { t, lang } = useLang();
  const [notifOpen, setNotifOpen] = useState(false);
  const waveActive = playing && currentTrack.id === TRACKS[0].id;

  const QUICK = [
    { label: t("home.liked"),  icon: Heart,      act: () => onNavigate("library") },
    { label: t("home.charts"), icon: TrendingUp, act: () => onNavigate("browse") },
    { label: t("home.radio"),  icon: Radio,      act: () => { const tr = TRACKS[Math.floor(Math.random() * TRACKS.length)]; onPlay(tr); toast(t("home.radioToast", tr.title, tr.artist)); } },
    { label: t("home.blend"),  icon: BlendIcon,  act: () => onOpenBlend(FRIENDS[0]) },
  ];

  return (
    <Page>
      {/* Верхняя панель */}
      <div className="px-5 pt-6 pb-5 flex items-center justify-between">
        <div className="lg:hidden" style={{ fontFamily: F.d, fontWeight: 900, fontSize: 24, letterSpacing: "-0.03em" }}>MYRA</div>
        <div className="hidden lg:block" style={{ fontFamily: F.d, fontWeight: 800, fontSize: 22, letterSpacing: "-0.03em" }}>{t("nav.home")}</div>
        <div className="flex gap-2 relative items-center">
          <motion.button whileTap={{ scale: 0.85 }} onClick={() => setNotifOpen(o => !o)} className="w-10 h-10 rounded-full flex items-center justify-center relative" style={{ ...GLASS, background: notifOpen ? `${currentTrack.c2}30` : GLASS.background }}>
            <Bell size={16} />
            <span className="absolute top-2 right-2.5 w-1.5 h-1.5 rounded-full" style={{ background: currentTrack.c2 }} />
          </motion.button>
          <motion.img whileTap={{ scale: 0.9 }} src={avatar} alt="avatar" className="w-10 h-10 rounded-full object-cover cursor-pointer" style={{ border: `1.5px solid ${currentTrack.c2}66` }} onClick={() => onNavigate("profile")} />
          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                className="absolute top-12 right-0 rounded-[22px] overflow-hidden z-30"
                style={{ width: 296, background: "rgba(18,18,32,0.62)", backdropFilter: "blur(36px) saturate(1.8)", WebkitBackdropFilter: "blur(36px) saturate(1.8)", border: "1px solid rgba(255,255,255,0.13)", boxShadow: "0 24px 70px rgba(0,0,0,0.6)" }}
              >
                <div className="px-4 py-3 text-[10px] tracking-[0.16em]" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", fontFamily: F.m, color: "rgba(242,242,248,0.5)" }}>{t("home.notifs")}</div>
                {NOTIF_KEYS.map((n, i) => {
                  const Icon = n.icon;
                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => { setNotifOpen(false); toast(t(n.key)); }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${currentTrack.c2}1e` }}>
                        <Icon size={14} style={{ color: currentTrack.c2 }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs" style={{ color: "rgba(242,242,248,0.85)", fontFamily: F.b }}>{t(n.key)}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: "rgba(242,242,248,0.32)", fontFamily: F.m }}>{t("notif.ago", `${n.time[0]} ${t(n.time[1])}`)}</div>
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Hero: Моя волна */}
      <div className="px-5 mb-7">
        <TiltCard
          max={5}
          className="relative rounded-[28px] overflow-hidden cursor-pointer"
          style={{ background: "linear-gradient(140deg, rgba(18,8,58,0.9), rgba(59,7,100,0.75))", border: "1px solid rgba(255,255,255,0.1)", boxShadow: waveActive ? `0 0 70px ${TRACKS[0].c2}45` : "0 16px 50px rgba(124,58,237,0.18)" }}
          onClick={() => onPlay(TRACKS[0])}
        >
          <Aurora c2="#8b5cf6" />
          <div className="relative z-10 flex items-center justify-between p-6">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] mb-2" style={{ color: "#a78bfa", fontFamily: F.m }}>{t("home.flow")}</div>
              <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 30, letterSpacing: "-0.03em", lineHeight: 1 }}>
                {t("home.my")}<span style={{ fontFamily: F.s, fontStyle: "italic", fontWeight: 600, background: "linear-gradient(90deg, #c4b5fd, #f0abfc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{t("home.wave")}</span>
              </div>
              <div className="text-xs mt-2.5" style={{ color: "rgba(242,242,248,0.55)", fontFamily: F.b }}>Synthwave · Lo-fi · Dream Pop</div>
            </div>
            <motion.div whileTap={{ scale: 0.88 }} className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(10px)", border: `1.5px solid ${waveActive ? "#a78bfa" : "rgba(255,255,255,0.25)"}` }}>
              {waveActive ? <Pause size={22} fill="white" stroke="none" /> : <Play size={22} fill="white" stroke="none" className="ml-1" />}
            </motion.div>
          </div>
          <div className="relative z-10 px-6 pb-5">
            <Waveform progress={waveActive ? 38 : 0} color="#a78bfa" height={30} seed={11} bars={56} dim />
          </div>
        </TiltCard>
      </div>

      {/* Быстрые действия */}
      <div className="px-5 mb-8 grid grid-cols-4 gap-2.5">
        {QUICK.map((q, i) => {
          const Icon = q.icon;
          return (
            <motion.button
              key={q.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.05, ...SPRING }}
              whileTap={{ scale: 0.93 }}
              onClick={q.act}
              className="flex flex-col items-center gap-2 py-4 rounded-[20px]"
              style={GLASS}
            >
              <Icon size={18} style={{ color: currentTrack.c2 }} />
              <span className="text-[11px] font-medium" style={{ color: "rgba(242,242,248,0.7)", fontFamily: F.b }}>{q.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Дека */}
      <div className="px-5 mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 style={{ fontFamily: F.d, fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em" }}>{t("home.discover")}</h2>
          <span className="text-[10px]" style={{ color: "rgba(242,242,248,0.3)", fontFamily: F.m }}>{t("home.swipeHint")}</span>
        </div>
        <DiscoveryDeck onPlay={onPlay} />
      </div>

      {/* Друзья слушают */}
      <div className="px-5 mb-8">
        <h2 className="mb-3" style={{ fontFamily: F.d, fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em" }}>{t("home.friends")}</h2>
        <div className="flex gap-4 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {FRIENDS.map(f => (
            <motion.div key={f.name} whileTap={{ scale: 0.94 }} className="flex-shrink-0 cursor-pointer text-center" style={{ width: 76 }} onClick={() => { onOpenLive(f); toast(t("home.withFriend", lang === "ru" ? f.inst : f.en, f.track.title)); }}>
              <div className="relative mx-auto mb-2" style={{ width: 62, height: 62 }}>
                <div className="absolute inset-0 rounded-full" style={{ padding: 2, background: f.live ? `linear-gradient(135deg, ${f.track.c2}, #8b5cf6)` : "rgba(255,255,255,0.12)" }}>
                  <img src={f.img} alt={f.name} className="w-full h-full rounded-full object-cover" style={{ border: "2.5px solid #0a0a16" }} />
                </div>
                {f.live && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "#0a0a16" }}>
                    <EQ color={f.track.c2} size={8} />
                  </div>
                )}
              </div>
              <div className="text-xs font-medium truncate" style={{ fontFamily: F.b }}>{lang === "ru" ? f.name : f.en}</div>
              <div className="text-[10px] truncate" style={{ color: "rgba(242,242,248,0.38)", fontFamily: F.b }}>{f.track.title}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Продолжить */}
      <div className="px-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 style={{ fontFamily: F.d, fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em" }}>{t("home.continue")}</h2>
          <button onClick={() => onNavigate("library")} className="text-xs flex items-center gap-0.5" style={{ color: currentTrack.c2, fontFamily: F.b }}>{t("home.all")} <ChevronRight size={13} /></button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {TRACKS.slice(1, 7).map(tr => (
            <motion.div key={tr.id} whileTap={{ scale: 0.95 }} className="flex-shrink-0 cursor-pointer group" style={{ width: 108 }} onClick={() => onPlay(tr)}>
              <div className="relative w-full rounded-[18px] overflow-hidden mb-2" style={{ aspectRatio: "1", boxShadow: currentTrack.id === tr.id ? `0 10px 34px ${tr.c2}50` : "0 6px 20px rgba(0,0,0,0.35)" }}>
                <img src={tr.img} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(0,0,0,0.4)" }}>
                  <Play size={18} fill="white" stroke="none" />
                </div>
                {currentTrack.id === tr.id && playing && (
                  <div className="absolute bottom-2 right-2 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}>
                    <EQ color="#fff" size={9} />
                  </div>
                )}
              </div>
              <div className="text-xs font-semibold truncate" style={{ fontFamily: F.b }}>{tr.title}</div>
              <div className="text-[10px] truncate" style={{ color: "rgba(242,242,248,0.4)", fontFamily: F.b }}>{tr.artist}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </Page>
  );
}

// ─── Обзор ────────────────────────────────────────────────────────────────────

export function BrowseScreen({ onPlay, onOpenArtist }: { onPlay: (t: Track) => void; onOpenArtist: (name: string) => void }) {
  const { t } = useLang();
  const [query, setQuery] = useState("");
  const filtered = query ? TRACKS.filter(tr => (tr.title + tr.artist + tr.genre).toLowerCase().includes(query.toLowerCase())) : [];

  const MOODS = [
    { label: t("mood.focus"),   icon: Brain,    track: TRACKS[3] },
    { label: t("mood.workout"), icon: Dumbbell, track: TRACKS[1] },
    { label: t("mood.road"),    icon: Car,      track: TRACKS[2] },
    { label: t("mood.sleep"),   icon: Moon,     track: TRACKS[4] },
    { label: t("mood.energy"),  icon: Zap,      track: TRACKS[5] },
  ];

  return (
    <Page>
      <div className="px-5 pt-6 pb-4">
        <h1 style={{ fontFamily: F.d, fontWeight: 800, fontSize: 28, letterSpacing: "-0.03em" }}>{t("nav.browse")}</h1>
        <div className="mt-4 flex items-center gap-3 px-4 py-3.5 rounded-[18px]" style={GLASS}>
          <Search size={15} style={{ color: "rgba(242,242,248,0.4)", flexShrink: 0 }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t("browse.search")}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "#f2f2f8", fontFamily: F.b }}
          />
          {query && <button onClick={() => setQuery("")}><X size={14} style={{ color: "rgba(242,242,248,0.4)" }} /></button>}
        </div>
      </div>

      <div className="px-5 mb-7">
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {MOODS.map(m => {
            const Icon = m.icon;
            return (
              <motion.button key={m.label} whileTap={{ scale: 0.93 }} onClick={() => { onPlay(m.track); toast(t("browse.mixStarted", m.label)); }} className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-medium" style={{ ...GLASS, fontFamily: F.b, color: "rgba(242,242,248,0.8)" }}>
                <Icon size={13} style={{ color: m.track.c2 }} />
                {m.label}
              </motion.button>
            );
          })}
        </div>
      </div>

      {query ? (
        <div className="px-5">
          <div className="text-xs mb-3" style={{ color: "rgba(242,242,248,0.4)", fontFamily: F.m }}>{t("browse.found", filtered.length)}</div>
          {filtered.map((tr, i) => (
            <motion.div key={tr.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} onClick={() => onPlay(tr)} className="flex items-center gap-3 p-3 rounded-2xl mb-2 cursor-pointer hover:bg-white/5 transition-colors" style={{ background: "rgba(255,255,255,0.03)" }}>
              <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
                <img src={tr.img} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold" style={{ fontFamily: F.b }}>{tr.title}</div>
                <button onClick={e => { e.stopPropagation(); onOpenArtist(tr.artist); }} className="text-xs hover:text-white transition-colors" style={{ color: "rgba(242,242,248,0.4)", fontFamily: F.b }}>{tr.artist} · {tr.genre}</button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <>
          <div className="px-5 mb-7">
            <h2 className="mb-3" style={{ fontFamily: F.d, fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em" }}>{t("browse.chart")}</h2>
            {CHARTS.map((c, i) => (
              <motion.div
                key={c.pos}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 px-2 py-2.5 rounded-2xl cursor-pointer hover:bg-white/5 transition-colors mb-1"
                onClick={() => onPlay({ ...TRACKS[(c.pos + 1) % TRACKS.length], id: c.pos + 100, title: c.title, artist: c.artist, album: "Charts", img: c.img })}
              >
                <div className="w-7 text-center font-bold text-sm" style={{ color: c.pos <= 3 ? "#a78bfa" : "rgba(242,242,248,0.3)", fontFamily: F.m }}>{c.pos}</div>
                <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0">
                  <img src={c.img} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ fontFamily: F.b }}>{c.title}</div>
                  <div className="text-xs truncate" style={{ color: "rgba(242,242,248,0.4)", fontFamily: F.b }}>{c.artist}</div>
                </div>
                <div className="text-[11px] px-2 py-1 rounded-full font-semibold" style={{ fontFamily: F.m, color: c.delta > 0 ? "#34d399" : c.delta < 0 ? "#f87171" : "rgba(242,242,248,0.3)", background: c.delta > 0 ? "rgba(52,211,153,0.1)" : c.delta < 0 ? "rgba(248,113,113,0.1)" : "rgba(255,255,255,0.05)" }}>
                  {c.delta > 0 ? `+${c.delta}` : c.delta < 0 ? c.delta : "—"}
                </div>
              </motion.div>
            ))}
          </div>

          <div className="px-5 mb-6">
            <h2 className="mb-3" style={{ fontFamily: F.d, fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em" }}>{t("browse.genres")}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {GENRE_TILES.map(([g, c], i) => (
                <TiltCard key={g} max={11} onClick={() => setQuery(g)} className="relative rounded-[18px] overflow-hidden cursor-pointer h-[68px]" style={{ boxShadow: `0 8px 26px ${c}22` }}>
                  <img src={svgCover("#0a0a16", c, i + 51)} alt={g} className="w-full h-full object-cover" style={{ filter: "brightness(0.55)" }} />
                  <div className="absolute inset-0 flex items-center px-4" style={{ background: `linear-gradient(135deg, ${c}3e, transparent)` }}>
                    <div className="font-bold text-sm" style={{ fontFamily: F.d, letterSpacing: "-0.01em" }}>{g}</div>
                  </div>
                </TiltCard>
              ))}
            </div>
          </div>
        </>
      )}
    </Page>
  );
}

// ─── Медиатека ────────────────────────────────────────────────────────────────

export function LibraryScreen({ onPlay, likedIds, onLike, currentTrack, playing, onOpenArtist, onOpenAlbum, onOpenPlaylist, myTracks = [], onDeleteLocal }: {
  onPlay: (t: Track) => void; likedIds: Set<number>; onLike: (id: number) => void;
  currentTrack: Track; playing: boolean; onOpenArtist: (name: string) => void;
  onOpenAlbum?: (album: string) => void; onOpenPlaylist?: (id: string) => void;
  myTracks?: Track[]; onDeleteLocal?: (id: number) => void;
}) {
  const { t } = useLang();
  const [tab, setTab] = useState<"liked" | "playlists" | "podcasts">("liked");
  const liked = TRACKS.filter(tr => likedIds.has(tr.id));

  const TABS = [
    { id: "liked" as const, label: t("lib.tracks", liked.length + myTracks.length) },
    { id: "playlists" as const, label: t("lib.playlists") },
    { id: "podcasts" as const, label: t("lib.podcasts") },
  ];

  return (
    <Page>
      <div className="px-5 pt-6 pb-4 flex items-center justify-between">
        <h1 style={{ fontFamily: F.d, fontWeight: 800, fontSize: 28, letterSpacing: "-0.03em" }}>{t("nav.library")}</h1>
        <motion.button whileTap={{ scale: 0.85 }} onClick={() => toast(t("lib.newPl"))} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${currentTrack.c2}, ${currentTrack.c2}99)` }}>
          <Plus size={16} />
        </motion.button>
      </div>

      <div className="flex gap-1 mx-5 mb-6 p-1 rounded-full w-fit" style={GLASS}>
        {TABS.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)} className="relative px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap" style={{ fontFamily: F.b, color: tab === tb.id ? "#fff" : "rgba(242,242,248,0.45)" }}>
            {tab === tb.id && <motion.div layoutId="libtab" className="absolute inset-0 rounded-full" style={{ background: `${currentTrack.c2}cc` }} transition={SPRING} />}
            <span className="relative z-10">{tb.label}</span>
          </button>
        ))}
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}>
          {tab === "liked" && (
            <div className="px-5 flex flex-col gap-1">
              {myTracks.map(tr => (
                <div key={tr.id} onClick={() => onPlay(tr)} className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer hover:bg-white/5 transition-colors group">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
                    <img src={tr.img} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(0,0,0,0.5)" }}>
                      <Play size={14} fill="white" stroke="none" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate flex items-center gap-2" style={{ fontFamily: F.b }}>
                      {tr.title}
                      {currentTrack.id === tr.id && playing && <EQ color={tr.c2} size={9} />}
                    </div>
                    <div className="text-xs truncate flex items-center gap-1.5" style={{ color: "rgba(242,242,248,0.4)", fontFamily: F.b }}>
                      <FileAudio size={11} style={{ color: tr.c2 }} />
                      {t("cr.local")}
                    </div>
                  </div>
                  {onDeleteLocal && (
                    <motion.button whileTap={{ scale: 0.8 }} onClick={e => { e.stopPropagation(); onDeleteLocal(tr.id); }} className="p-1.5">
                      <Trash2 size={14} style={{ color: "rgba(248,113,113,0.6)" }} />
                    </motion.button>
                  )}
                </div>
              ))}
              {TRACKS.map(tr => (
                <div key={tr.id} onClick={() => onPlay(tr)} className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer hover:bg-white/5 transition-colors group">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
                    <img src={tr.img} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(0,0,0,0.5)" }}>
                      <Play size={14} fill="white" stroke="none" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate flex items-center gap-2" style={{ fontFamily: F.b }}>
                      {tr.title}
                      {currentTrack.id === tr.id && playing && <EQ color={tr.c2} size={9} />}
                    </div>
                    <div className="text-xs truncate" style={{ color: "rgba(242,242,248,0.4)", fontFamily: F.b }}>
                      <button onClick={e => { e.stopPropagation(); onOpenArtist(tr.artist); }} className="hover:text-white transition-colors">{tr.artist}</button>
                      {" · "}
                      <button onClick={e => { e.stopPropagation(); onOpenAlbum?.(tr.album); }} className="hover:text-white transition-colors">{tr.album}</button>
                    </div>
                  </div>
                  <motion.button whileTap={{ scale: 0.7 }} onClick={e => { e.stopPropagation(); onLike(tr.id); }} className="p-1.5">
                    <Heart size={15} fill={likedIds.has(tr.id) ? tr.c2 : "none"} stroke={likedIds.has(tr.id) ? tr.c2 : "rgba(255,255,255,0.25)"} />
                  </motion.button>
                </div>
              ))}
            </div>
          )}

          {tab === "playlists" && (
            <div className="px-5 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {PLAYLISTS.map(pl => (
                <TiltCard key={pl.id} max={9} className="cursor-pointer group" onClick={() => onOpenPlaylist ? onOpenPlaylist(pl.id) : toast(t("lib.plToast", pl.name, pl.trackIds.length))}>
                  <div className="rounded-[20px] overflow-hidden mb-2.5 aspect-square relative">
                    <img src={pl.img} alt={pl.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(0,0,0,0.4)" }}>
                      <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.16)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.3)" }}>
                        <Play size={17} fill="white" stroke="none" className="ml-0.5" />
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold" style={{ fontFamily: F.b }}>{pl.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: "rgba(242,242,248,0.4)", fontFamily: F.b }}>{t("lib.nTracks", pl.trackIds.length)}</div>
                </TiltCard>
              ))}
            </div>
          )}

          {tab === "podcasts" && (
            <div className="px-5 flex flex-col gap-4">
              {PODCASTS.map(p => (
                <div key={p.name} className="flex gap-4 cursor-pointer p-3 rounded-2xl hover:bg-white/5 transition-colors" onClick={() => toast(t("lib.podToast", p.name, p.p))}>
                  <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0">
                    <img src={p.img} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ fontFamily: F.b }}>{p.name}</div>
                    <div className="text-xs mb-2.5" style={{ color: "rgba(242,242,248,0.4)", fontFamily: F.b }}>{p.ep}</div>
                    <div className="rounded-full overflow-hidden" style={{ height: 3, background: "rgba(255,255,255,0.1)" }}>
                      <div className="h-full rounded-full" style={{ width: `${p.p}%`, background: `linear-gradient(90deg, ${currentTrack.c2}88, ${currentTrack.c2})` }} />
                    </div>
                    <div className="text-[10px] mt-1.5" style={{ color: "rgba(242,242,248,0.3)", fontFamily: F.m }}>{t("lib.listened", p.p)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </motion.div>
    </Page>
  );
}

// ─── Студия ───────────────────────────────────────────────────────────────────

export function CreatorScreen({ c2, creatorPlus, onOpenCreatorPlus, onOpenStats, myTracks = [], onAddFiles, onPlay }: {
  c2: string; creatorPlus: boolean; onOpenCreatorPlus: () => void;
  onOpenStats: () => void; myTracks?: Track[]; onAddFiles: (files: FileList | File[]) => void; onPlay: (t: Track) => void;
}) {
  const { t } = useLang();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const WEEK = [24, 38, 31, 52, 46, 71, 64];
  const max = Math.max(...WEEK);
  const points = WEEK.map((v, i) => `${(i / (WEEK.length - 1)) * 100},${40 - (v / max) * 36}`).join(" ");

  return (
    <Page>
      <div className="px-5 pt-6 pb-5 flex items-end justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] mb-1" style={{ color: "rgba(242,242,248,0.35)", fontFamily: F.m }}>{t("cr.creator")}</div>
          <h1 style={{ fontFamily: F.d, fontWeight: 800, fontSize: 28, letterSpacing: "-0.03em" }}>{t("cr.studio")}</h1>
        </div>
        {creatorPlus && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-1" style={{ background: "rgba(139,92,246,0.16)", border: "1px solid rgba(139,92,246,0.35)" }}>
            <Crown size={12} style={{ color: "#c4b5fd" }} />
            <span className="text-[11px] font-semibold" style={{ color: "#c4b5fd", fontFamily: F.m }}>Creator+</span>
          </div>
        )}
      </div>

      <div className="px-5 mb-7">
        <div className="rounded-[24px] p-5 mb-3 cursor-pointer" style={GLASS} onClick={onOpenStats}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs mb-1" style={{ color: "rgba(242,242,248,0.45)", fontFamily: F.b }}>{t("cr.plays7")}</div>
              <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 26, letterSpacing: "-0.02em" }}>2 412</div>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold" style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", fontFamily: F.m }}>
              <TrendingUp size={12} /> +18%
            </div>
          </div>
          <svg viewBox="0 0 100 42" className="w-full" style={{ height: 72 }} preserveAspectRatio="none">
            <defs>
              <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c2} stopOpacity="0.35" />
                <stop offset="100%" stopColor={c2} stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points={`0,42 ${points} 100,42`} fill="url(#area)" />
            <polyline points={points} fill="none" stroke={c2} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            {WEEK.map((v, i) => (
              <circle key={i} cx={(i / (WEEK.length - 1)) * 100} cy={40 - (v / max) * 36} r={i === WEEK.length - 2 ? 2.2 : 0} fill="#fff" />
            ))}
          </svg>
          <div className="flex justify-between mt-1 text-[9px]" style={{ color: "rgba(242,242,248,0.3)", fontFamily: F.m }}>
            {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map(d => <span key={d}>{d}</span>)}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {[["18", t("cr.fans"), Users], ["1 240₽", t("cr.donations"), Wallet], [String(3 + myTracks.length), t("cr.releases"), Music2]].map(([v, l, Icon]: any) => (
            <motion.div key={l} whileTap={{ scale: 0.95 }} onClick={onOpenStats} className="rounded-[20px] p-4 cursor-pointer" style={GLASS}>
              <Icon size={15} style={{ color: c2 }} className="mb-2" />
              <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 17, letterSpacing: "-0.02em" }}>{v}</div>
              <div className="text-[10px] mt-0.5" style={{ color: "rgba(242,242,248,0.45)", fontFamily: F.b }}>{l}</div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="px-5 mb-7">
        <h2 className="mb-3" style={{ fontFamily: F.d, fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em" }}>{t("cr.newRelease")}</h2>
        {/* Реальная загрузка: клик открывает выбор файла, drag-n-drop тоже работает */}
        <input
          ref={fileRef}
          type="file"
          accept="audio/*,.mp3,.wav,.flac,.m4a,.ogg,.aac"
          multiple
          className="hidden"
          onChange={e => { if (e.target.files?.length) { onAddFiles(e.target.files); e.target.value = ""; } }}
        />
        <div
          className="flex flex-col items-center justify-center rounded-[20px] p-7 cursor-pointer transition-all"
          style={{ ...GLASS, border: dragOver ? `1.5px dashed ${c2}` : "1.5px dashed rgba(255,255,255,0.16)", background: dragOver ? `${c2}14` : GLASS.background }}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) onAddFiles(e.dataTransfer.files); }}
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: `${c2}1e` }}>
            <Upload size={19} style={{ color: c2 }} />
          </div>
          <div className="text-sm font-semibold mb-1" style={{ fontFamily: F.b }}>{t("cr.dropFile")}</div>
          <div className="text-xs" style={{ color: "rgba(242,242,248,0.35)", fontFamily: F.m }}>MP3 · FLAC · WAV · M4A</div>
        </div>

        {/* Мои файлы */}
        {myTracks.length > 0 && (
          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-[0.16em] mb-2" style={{ color: "rgba(242,242,248,0.4)", fontFamily: F.m }}>{t("cr.myFiles")}</div>
            {myTracks.map(tr => (
              <motion.div key={tr.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onClick={() => onPlay(tr)} className="flex items-center gap-3 p-3 rounded-2xl mb-1.5 cursor-pointer hover:bg-white/5 transition-colors" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0">
                  <img src={tr.img} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ fontFamily: F.b }}>{tr.title}</div>
                  <div className="text-[10px] mt-0.5 flex items-center gap-1.5" style={{ color: "rgba(242,242,248,0.35)", fontFamily: F.m }}>
                    <FileAudio size={10} style={{ color: tr.c2 }} /> {t("cr.local")}
                  </div>
                </div>
                <Play size={14} style={{ color: "rgba(242,242,248,0.35)" }} />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="px-5 mb-7">
        <h2 className="mb-3" style={{ fontFamily: F.d, fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em" }}>{t("cr.myReleases")}</h2>
        {TRACKS.slice(0, 3).map(tr => (
          <div key={tr.id} className="flex items-center gap-3 p-3 rounded-2xl mb-2 cursor-pointer hover:bg-white/5 transition-colors" style={{ background: "rgba(255,255,255,0.03)" }}>
            <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
              <img src={tr.img} alt="" className="w-full h-full object-cover" style={{ filter: "brightness(0.75)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate" style={{ fontFamily: F.b }}>{tr.title}</div>
              <div className="text-[10px] mt-1" style={{ color: "rgba(242,242,248,0.35)", fontFamily: F.m }}>{t("cr.plays", tr.plays)}</div>
            </div>
            <BarChart3 size={16} style={{ color: tr.c2 }} />
          </div>
        ))}
      </div>

      {/* Creator+ / Начни зарабатывать */}
      <div className="px-5">
        <TiltCard max={5} className="rounded-[24px] p-6 overflow-hidden relative cursor-pointer" style={{ background: "linear-gradient(135deg, rgba(18,8,58,0.85), rgba(59,7,100,0.7))", border: "1px solid rgba(139,92,246,0.3)" }} onClick={onOpenCreatorPlus}>
          <Aurora c2="#8b5cf6" opacity={0.6} />
          <div className="relative z-10">
            <div className="text-[10px] uppercase tracking-[0.2em] mb-2" style={{ color: "#a78bfa", fontFamily: F.m }}>Creator+</div>
            <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 20, letterSpacing: "-0.02em" }} className="mb-1.5">
              {creatorPlus ? t("cr.active") : t("cr.earn")}
            </div>
            <div className="text-xs mb-4" style={{ color: "rgba(242,242,248,0.5)", fontFamily: F.b }}>{creatorPlus ? t("cp.cancel") : t("cr.earnSub")}</div>
            <motion.button whileTap={{ scale: 0.95 }} onClick={e => { e.stopPropagation(); onOpenCreatorPlus(); }} className="px-6 py-2.5 rounded-full text-sm font-semibold" style={{ background: "linear-gradient(135deg, #8b5cf6, #a78bfa)", color: "#fff", fontFamily: F.b }}>
              {creatorPlus ? t("cr.manage") : t("cr.connect")}
            </motion.button>
          </div>
        </TiltCard>
      </div>
    </Page>
  );
}

// ─── Профиль ──────────────────────────────────────────────────────────────────

export function ProfileScreen({ c2, userName, avatar, creatorPlus, onOpenBlend, onOpenAccount, onOpenWrapped, onLogout }: {
  c2: string; userName: string; avatar: string; creatorPlus: boolean;
  onOpenBlend: (f: Friend) => void; onOpenAccount: () => void; onOpenWrapped: () => void; onLogout: () => void;
}) {
  const { t, lang, setLang } = useLang();
  const [notifs, setNotifs] = useState(true);
  const [autoDl, setAutoDl] = useState(false);
  const [aiFilter, setAiFilter] = useState(true);
  const [crossfade, setCrossfade] = useState(false);
  const [qualityIdx, setQualityIdx] = useState(1);
  const [blendOpen, setBlendOpen] = useState(false);
  const [logoutQ, setLogoutQ] = useState(false);

  const QUALITIES = ["AAC 256", "FLAC", "Hi-Res 24-bit"];

  return (
    <Page>
      <div className="px-5 pt-8 pb-6 text-center">
        <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SPRING} className="relative inline-block mb-4">
          <img src={avatar} alt="avatar" className="w-24 h-24 rounded-full object-cover mx-auto" style={{ border: `2px solid ${c2}`, boxShadow: `0 0 40px ${c2}50` }} />
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${c2}, ${c2}aa)` }}>
            {creatorPlus ? <Crown size={12} /> : <Mic2Icon />}
          </div>
        </motion.div>
        <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 24, letterSpacing: "-0.03em" }}>{userName}</div>
        <div className="text-xs mt-1.5" style={{ color: "rgba(242,242,248,0.4)", fontFamily: F.m }}>@alex_vibe · Creator{creatorPlus ? "+" : ""}</div>
        <div className="flex justify-center gap-10 mt-6">
          {[["128", t("pr.follows")], ["34", t("pr.fans")], ["2.4K", t("pr.plays")]].map(([v, l]) => (
            <div key={l} className="text-center">
              <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 19, color: c2, letterSpacing: "-0.02em" }}>{v}</div>
              <div className="text-[10px] mt-0.5" style={{ color: "rgba(242,242,248,0.4)", fontFamily: F.b }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Wrapped */}
      <div className="px-5 mb-6">
        <TiltCard max={6} onClick={onOpenWrapped} className="rounded-[24px] overflow-hidden relative cursor-pointer" style={{ height: 104, background: "linear-gradient(135deg, rgba(18,8,58,0.9), rgba(124,58,237,0.55))", border: "1px solid rgba(139,92,246,0.3)" }}>
          <Aurora c2="#8b5cf6" opacity={0.7} />
          <div className="absolute inset-0 flex items-center justify-between px-6 z-10">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] mb-1.5" style={{ color: "#a78bfa", fontFamily: F.m }}>{t("pr.july")}</div>
              <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 22, letterSpacing: "-0.02em" }}>
                {t("pr.wrapped")}<span style={{ fontFamily: F.s, fontStyle: "italic", fontWeight: 500, fontSize: 18, color: "#c4b5fd" }}>{t("pr.month")}</span>
              </div>
            </div>
            <ChevronRight size={20} style={{ color: "rgba(242,242,248,0.5)" }} />
          </div>
        </TiltCard>
      </div>

      {/* Настройки */}
      <div className="px-5 flex flex-col gap-1.5">
        <SettingRow icon={<Bell size={15} />} label={t("pr.notifs")}>
          <Toggle on={notifs} onChange={() => { setNotifs(n => !n); toast(notifs ? t("pr.notifsOff") : t("pr.notifsOn")); }} color={c2} />
        </SettingRow>

        <SettingRow icon={<Download size={15} />} label={t("pr.autoDl")} sub="4.2 GB / 10 GB">
          <Toggle on={autoDl} onChange={() => { setAutoDl(a => !a); toast(autoDl ? t("pr.autoDlOff") : t("pr.autoDlOn")); }} color={c2} />
        </SettingRow>

        <SettingRow icon={<Bot size={15} />} label={t("pr.aiFilter")} sub={t("pr.aiSub")}>
          <Toggle on={aiFilter} onChange={() => { setAiFilter(a => !a); toast(aiFilter ? t("pr.aiOff") : t("pr.aiOn")); }} color={c2} />
        </SettingRow>

        <SettingRow icon={<BlendIcon size={15} />} label={t("pr.crossfade")}>
          <Toggle on={crossfade} onChange={() => { setCrossfade(cf => !cf); toast(crossfade ? t("pr.crossOff") : t("pr.crossOn")); }} color={c2} />
        </SettingRow>

        <motion.div whileTap={{ scale: 0.99 }} className="flex items-center gap-3 px-4 py-3.5 rounded-2xl cursor-pointer" style={GLASS} onClick={() => { const next = (qualityIdx + 1) % QUALITIES.length; setQualityIdx(next); toast(t("pr.qualitySet", QUALITIES[next])); }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.07)" }}><Volume2 size={15} /></div>
          <div className="flex-1">
            <div className="text-sm" style={{ fontFamily: F.b }}>{t("pr.quality")}</div>
            <div className="text-[10px] mt-0.5" style={{ color: "#34d399", fontFamily: F.m }}>{t("pr.lossless")}</div>
          </div>
          <div className="text-xs px-2.5 py-1 rounded-full" style={{ background: `${c2}1e`, color: c2, fontFamily: F.m }}>{QUALITIES[qualityIdx]}</div>
        </motion.div>

        {/* Blend */}
        <div className="rounded-2xl overflow-hidden" style={GLASS}>
          <motion.div whileTap={{ scale: 0.99 }} className="flex items-center gap-3 px-4 py-3.5 cursor-pointer" onClick={() => setBlendOpen(o => !o)}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.07)" }}><Users size={15} /></div>
            <div className="flex-1 text-sm" style={{ fontFamily: F.b }}>{t("pr.blendRow")}</div>
            <motion.div animate={{ rotate: blendOpen ? 90 : 0 }}><ChevronRight size={15} style={{ color: "rgba(242,242,248,0.3)" }} /></motion.div>
          </motion.div>
          <AnimatePresence>
            {blendOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                {FRIENDS.slice(0, 2).map(f => (
                  <div key={f.name} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <img src={f.img} alt="" className="w-8 h-8 rounded-full object-cover" />
                    <div className="flex-1">
                      <div className="text-xs font-semibold" style={{ fontFamily: F.b }}>{t("pr.blendWith", lang === "ru" ? f.inst : f.en)}</div>
                      <div className="text-[10px]" style={{ color: "rgba(242,242,248,0.35)", fontFamily: F.m }}>{t("pr.match", f.match)}</div>
                    </div>
                    <button onClick={() => onOpenBlend(f)} className="text-[10px] px-2.5 py-1.5 rounded-full" style={{ background: `${c2}1e`, color: c2, fontFamily: F.b }}>{t("pr.open")}</button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Язык — реально переключает интерфейс */}
        <motion.div whileTap={{ scale: 0.99 }} className="flex items-center gap-3 px-4 py-3.5 rounded-2xl cursor-pointer" style={GLASS} onClick={() => setLang(lang === "ru" ? "en" : "ru")}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.07)" }}><Globe size={15} /></div>
          <div className="flex-1 text-sm" style={{ fontFamily: F.b }}>{t("pr.lang")}</div>
          <div className="flex gap-1 p-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
            {(["ru", "en"] as Lang[]).map(l => (
              <span key={l} className="relative px-2.5 py-1 rounded-full text-[11px] font-bold uppercase" style={{ fontFamily: F.m, color: lang === l ? "#fff" : "rgba(242,242,248,0.4)" }}>
                {lang === l && <motion.span layoutId="langpill" className="absolute inset-0 rounded-full" style={{ background: c2 }} transition={SPRING} />}
                <span className="relative z-10">{l}</span>
              </span>
            ))}
          </div>
        </motion.div>

        <motion.div whileTap={{ scale: 0.99 }} className="flex items-center gap-3 px-4 py-3.5 rounded-2xl cursor-pointer" style={GLASS} onClick={onOpenAccount}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.07)" }}><Settings size={15} /></div>
          <div className="flex-1 text-sm" style={{ fontFamily: F.b }}>{t("pr.account")}</div>
          <ChevronRight size={15} style={{ color: "rgba(242,242,248,0.3)" }} />
        </motion.div>

        <motion.button whileTap={{ scale: 0.98 }} onClick={() => setLogoutQ(true)} className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl mt-2 text-sm font-medium" style={{ background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.18)", color: "#f87171", fontFamily: F.b }}>
          <LogOut size={14} /> {t("pr.logout")}
        </motion.button>
      </div>

      <ConfirmSheet
        open={logoutQ}
        onClose={() => setLogoutQ(false)}
        title={t("pr.logoutQ")}
        sub={t("pr.logoutSub")}
        confirmLabel={t("pr.logout")}
        cancelLabel={t("pr.cancel")}
        danger
        onConfirm={() => { setLogoutQ(false); onLogout(); }}
      />
    </Page>
  );
}

function SettingRow({ icon, label, sub, children }: { icon: React.ReactNode; label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl" style={GLASS}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.07)" }}>{icon}</div>
      <div className="flex-1">
        <div className="text-sm" style={{ fontFamily: F.b }}>{label}</div>
        {sub && <div className="text-[10px] mt-0.5" style={{ color: "rgba(242,242,248,0.35)", fontFamily: F.m }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function Mic2Icon() {
  return <Mic2 size={12} />;
}
