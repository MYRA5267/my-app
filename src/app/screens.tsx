import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Play, Pause, Heart, Search, Mic2, Upload, BarChart3, Plus, ChevronRight,
  Volume2, Globe, Settings, Bell, Check, Download, X, Users, Music2,
  Zap, Radio, Moon, Dumbbell, Car, Brain, LogOut, TrendingUp, Wallet,
  Blend as BlendIcon, Crown, Trash2, FileAudio, Sun, Sparkles,
  Trophy, Clock, Flame, Gift, UserPlus, Headphones, Wrench, Lock,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { TRACKS, CHARTS, FRIENDS, PLAYLISTS, GENRE_TILES, LEADERBOARD_PEERS, AVATARS, svgCover, trackFromRow, ls, type Track, type Friend } from "./data";
import { F, GLASS, SPRING, TiltCard, Aurora, ParticleWave, EQ, Toggle, ConfirmSheet, Page, Sheet, useTheme, useProgress, ON_DARK, onDark, InteractiveChart, copyText, genInviteCode } from "./lib";
import { useLang, type Lang } from "./i18n";
import { lastNDays, isMonthEndWindow, type ActivityItem } from "./stats";
import { MyraWordmark } from "./logo";
import type { UserRole } from "./auth";
import { supabaseEnabled, fetchRecentTracks, type CommunityTrackRow, type FriendFeedItem, type PublicProfile } from "./supabase";

// ─── Дека открытий ────────────────────────────────────────────────────────────

/** Содержимое верхней карточки — ремоунтится по track.id, поэтому цвет/текст
    следующего трека плавно проявляются вместе, а не подменяются мгновенно */
function DeckCardContent({ track }: { track: Track }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(false);
    const raf = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(raf);
  }, [track.id]);

  return (
    <div
      className="absolute inset-0"
      style={{
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0) scale(1)" : "translateY(14px) scale(0.97)",
        transition: "opacity 0.45s cubic-bezier(0.22,1,0.36,1), transform 0.45s cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      <img src={track.img} alt={track.title} className="w-full h-full object-cover" />
      <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${track.c1}f0 0%, transparent 55%)` }} />
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <div className="text-[10px] uppercase tracking-[0.18em] mb-1.5" style={{ color: track.c2, fontFamily: F.m, transition: "color 0.3s" }}>{track.genre}</div>
        <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 22, lineHeight: 1.15, letterSpacing: "-0.02em", color: ON_DARK }}>{track.title}</div>
        <div className="text-sm mt-1" style={{ color: onDark(60), fontFamily: F.b }}>{track.artist} · {track.plays}</div>
      </div>
    </div>
  );
}

function DiscoveryDeck({ onPlay, onLike }: { onPlay: (t: Track) => void; onLike: (id: number) => void }) {
  const { t } = useLang();
  const [index, setIndex] = useState(0);
  const [exiting, setExiting] = useState<"left" | "right" | null>(null);
  const startRef = useRef({ x: 0, y: 0 });

  // Свайп — прямой rAF-мутацией style, как у орба и TiltCard: setState на
  // каждый pointermove перерисовывал все три карточки на 60-120 Гц ровно в
  // момент, когда пользователь ждёт плавности жеста
  const cardRef = useRef<HTMLDivElement>(null);
  const playBadgeRef = useRef<HTMLDivElement>(null);
  const skipBadgeRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const rafRef = useRef(0);

  const applyDrag = useCallback(() => {
    rafRef.current = 0;
    const el = cardRef.current;
    if (!el) return;
    const { x, y } = dragRef.current;
    el.style.transition = draggingRef.current ? "none" : "transform 0.35s cubic-bezier(0.25,0.46,0.45,0.94)";
    el.style.transform = `perspective(1000px) translateX(${x}px) translateY(${y * 0.3}px) rotate(${x * 0.08}deg) rotateY(${x * 0.06}deg) rotateX(${-y * 0.05}deg)`;
    if (playBadgeRef.current) playBadgeRef.current.style.opacity = x > 30 ? "1" : "0";
    if (skipBadgeRef.current) skipBadgeRef.current.style.opacity = x < -30 ? "1" : "0";
  }, []);
  const scheduleDrag = useCallback(() => { if (!rafRef.current) rafRef.current = requestAnimationFrame(applyDrag); }, [applyDrag]);
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const deck = useMemo(() => TRACKS.slice(0, 6), []);
  const current = deck[index % deck.length];
  const next = deck[(index + 1) % deck.length];
  const after = deck[(index + 2) % deck.length];

  const dismiss = useCallback((dir: "left" | "right") => {
    setExiting(dir);
    setTimeout(() => {
      setIndex(i => i + 1);
      dragRef.current = { x: 0, y: 0 };
      if (cardRef.current) {
        cardRef.current.style.transition = "none";
        cardRef.current.style.transform = "perspective(1000px)";
      }
      setExiting(null);
    }, 320);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    startRef.current = { x: e.clientX, y: e.clientY };
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    dragRef.current = { x: e.clientX - startRef.current.x, y: e.clientY - startRef.current.y };
    scheduleDrag();
  };
  const onPointerUp = () => {
    draggingRef.current = false;
    const x = dragRef.current.x;
    if (x > 70) { dismiss("right"); onPlay(current); }
    else if (x < -70) dismiss("left");
    else { dragRef.current = { x: 0, y: 0 }; scheduleDrag(); }
  };

  const exitX = exiting === "right" ? 500 : exiting === "left" ? -500 : 0;
  const exitRot = exiting === "right" ? 25 : exiting === "left" ? -25 : 0;

  return (
    <div className="relative select-none" style={{ height: 344 }}>
      {[after, next].reverse().map((tr, ri) => (
        <div key={tr.id} className="absolute inset-x-0 mx-auto rounded-[26px] overflow-hidden" style={{ width: "100%", height: 300, top: 20, transform: `scale(${0.88 + ri * 0.06}) translateY(${(1 - ri) * 14}px)`, zIndex: ri, transition: "transform 0.35s ease" }}>
          <img src={tr.img} alt="" className="w-full h-full object-cover" style={{ filter: "brightness(0.5)" }} />
          {/* Тот же цветовой градиент, что и у верхней карточки — цвет следующего
              трека виден уже во время свайпа, а не только после того, как карточка сменится */}
          <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${tr.c1}f0 0%, transparent 55%)` }} />
        </div>
      ))}

      <div
        ref={cardRef}
        className="absolute inset-x-0 mx-auto rounded-[26px] overflow-hidden cursor-grab active:cursor-grabbing"
        style={{
          width: "100%", height: 300, top: 20, zIndex: 10,
          // 3D-наклон при свайпе: перспектива + rotateY/rotateX от смещения —
          // чистые композитные трансформы; во время жеста transform пишется
          // напрямую в style через rAF (см. applyDrag), реакт-стилем задаётся
          // только вылет карточки
          ...(exiting ? {
            transform: `perspective(1000px) translateX(${exitX}px) rotate(${exitRot}deg) rotateY(${exiting === "right" ? 18 : -18}deg)`,
            transition: "transform 0.35s cubic-bezier(0.25,0.46,0.45,0.94)",
          } : null),
          boxShadow: `0 30px 80px ${current.c2}38`,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <DeckCardContent key={current.id} track={current} />

        <div ref={playBadgeRef} className="absolute top-6 left-6 px-4 py-2 rounded-full text-sm font-semibold pointer-events-none" style={{ ...GLASS, color: "#34d399", border: "1px solid rgba(52,211,153,0.4)", opacity: 0, transition: "opacity 0.15s" }}>
          {t("deck.play")}
        </div>
        <div ref={skipBadgeRef} className="absolute top-6 right-6 px-4 py-2 rounded-full text-sm font-semibold pointer-events-none" style={{ ...GLASS, color: "#f87171", border: "1px solid rgba(248,113,113,0.4)", opacity: 0, transition: "opacity 0.15s" }}>
          {t("deck.skip")}
        </div>
      </div>

      <div className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-5" style={{ zIndex: 20 }}>
        <motion.button whileTap={{ scale: 0.85 }} onClick={() => dismiss("left")} className="w-12 h-12 rounded-full flex items-center justify-center" style={{ ...GLASS }}>
          <X size={18} style={{ color: "#f87171" }} />
        </motion.button>
        <motion.button whileTap={{ scale: 0.88 }} whileHover={{ scale: 1.06 }} onClick={() => { onPlay(current); dismiss("right"); }} className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${current.c2}, ${current.c2}99)`, boxShadow: `0 12px 36px ${current.c2}55` }}>
          <Play size={22} fill="white" stroke="none" className="ml-1" />
        </motion.button>
        {/* Сердечко реально лайкает трек (раньше только смахивало карточку) */}
        <motion.button whileTap={{ scale: 0.85 }} onClick={() => { onLike(current.id); dismiss("right"); }} className="w-12 h-12 rounded-full flex items-center justify-center" style={{ ...GLASS }}>
          <Heart size={18} style={{ color: "#34d399" }} />
        </motion.button>
      </div>
    </div>
  );
}

// ─── Главная ──────────────────────────────────────────────────────────────────

const ACTIVITY_ICONS: Record<string, typeof Music2> = {
  "act.levelUp": Trophy, "act.streak": Flame,
  "act.cpActivated": Crown, "act.cpCancelled": Crown, "act.cpResumed": Crown,
  "act.donateSent": Gift, "act.splitDonate": Gift, "act.splitReady": Gift, "act.withdrawDone": Wallet,
  "act.plCreated": Music2, "act.plDeleted": Music2,
  "cr.added": Upload, "dl.done": Download,
  "ach.unlocked": Trophy, "act.plusActivated": Sparkles,
};

/** Компактная запись счётчика: 2400 → "2.4K" */
export const fmtCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K` : String(n));

/** Реальное относительное время из timestamp'а события */
function relTimeParts(ts: number): [number, string] {
  const mins = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (mins < 60) return [mins, "time.min"];
  const hours = Math.round(mins / 60);
  if (hours < 24) return [hours, "time.h"];
  return [Math.round(hours / 24), "time.d"];
}

// Простой превью-плеер для ленты подписок — независимая пара <audio> + id
// текущего трека, отдельная от главного плеера приложения (useAudio в lib.tsx):
// эти треки чужие, не часть очереди/"Моей волны" и не должны трогать currentTrack
function useTrackPreview(onStart?: () => void) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const onStartRef = useRef(onStart);
  onStartRef.current = onStart;

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    const onEnded = () => setPlayingId(null);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.pause();
    };
  }, []);

  const toggle = useCallback((id: string, url: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    setPlayingId(prev => {
      if (prev === id) { audio.pause(); return null; }
      // Основной плеер ставится на паузу — иначе играли бы два потока сразу
      onStartRef.current?.();
      audio.src = url;
      audio.play().catch(() => {});
      return id;
    });
  }, []);

  return { playingId, toggle };
}

/** Одна карточка ленты подписок: реальный трек реального человека, на которого подписан пользователь */
function FriendFeedRow({ item, playingId, onToggle, onOpenProfile }: {
  item: FriendFeedItem; playingId: string | null; onToggle: (id: string, url: string) => void; onOpenProfile: (p: PublicProfile) => void;
}) {
  const { t } = useLang();
  const owner = item.owner;
  const isPlaying = playingId === item.id;
  const [val, unitKey] = relTimeParts(new Date(item.created_at).getTime());

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-white/5 transition-colors">
      <button
        onClick={() => owner && onOpenProfile({ id: item.owner_id, username: owner.username, handle: owner.handle, avatar_url: owner.avatar_url, role: owner.role })}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
      >
        <img src={owner?.avatar_url || item.cover_url || AVATARS[0]} alt="" loading="lazy" decoding="async" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate" style={{ fontFamily: F.b }}>{item.title}</div>
          <div className="text-xs truncate" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>
            {owner?.username ?? "?"} · {t("notif.ago", `${val} ${t(unitKey)}`)}
          </div>
        </div>
      </button>
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={() => onToggle(item.id, item.audio_url)}
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: "linear-gradient(135deg, #8b5cf6, #a78bfa)" }}
      >
        {isPlaying ? <Pause size={13} fill="white" stroke="none" /> : <Play size={13} fill="white" stroke="none" className="ml-0.5" />}
      </motion.button>
    </div>
  );
}

// Волна hero-карточки подписана на прогресс через контекст — прогресс не
// попадает в пропсы HomeScreen, и главная не перерисовывается каждый тик.
// Поток частиц вместо баров: органичнее и дешевле для WebView-композитора
function HeroWave({ playing }: { playing: boolean }) {
  const progress = useProgress();
  return <ParticleWave progress={progress} playing={playing} color="#c4b5fd" height={44} />;
}

export const HomeScreen = React.memo(function HomeScreen({ onPlay, currentTrack, playing, onNavigate, onOpenBlend, onOpenRooms, onPlayWave, onPlayRadio, onLikeTrack, onPauseMain, onOpenArtist, onOpenRealArtist, avatar, activity, friendsFeed, onOpenPeopleSearch, onOpenRealProfile, uid }: {
  onPlay: (t: Track) => void; currentTrack: Track; playing: boolean; onNavigate: (tab: string) => void;
  onOpenBlend: (f: Friend) => void; onOpenRooms: () => void; onPlayWave: () => void; onPlayRadio: () => void;
  onLikeTrack: (id: number) => void; onPauseMain: () => void; onOpenArtist: (name: string) => void;
  onOpenRealArtist: (id: string) => void; avatar: string;
  activity: ActivityItem[];
  friendsFeed: FriendFeedItem[]; onOpenPeopleSearch: () => void; onOpenRealProfile: (p: PublicProfile) => void;
  uid: string | null;
}) {
  const { t } = useLang();
  const [notifOpen, setNotifOpen] = useState(false);
  // Кружок на колокольчике — честный: только когда есть события новее последнего
  // открытия панели. Раньше он горел всегда, даже при пустом списке
  const [notifSeenTs, setNotifSeenTs] = useState(() => ls.get<number>("notifSeen", 0));
  const hasUnread = activity.some(a => a.time > notifSeenTs);
  const toggleNotifs = () => {
    if (!notifOpen) { const now = Date.now(); ls.set("notifSeen", now); setNotifSeenTs(now); }
    setNotifOpen(o => !o);
  };
  const [searchOpen, setSearchOpen] = useState(false);
  const waveActive = playing;
  const { playingId: previewPlayingId, toggle: togglePreview } = useTrackPreview(onPauseMain);

  // Лента «Релизы сообщества» — последние по-настоящему опубликованные треки
  // ДРУГИХ пользователей. Без Supabase этой секции просто нет (а не пустышка
  // с призывом поделиться треком, который никуда не долетит)
  const [communityTracks, setCommunityTracks] = useState<CommunityTrackRow[]>([]);
  useEffect(() => {
    if (!supabaseEnabled) return;
    fetchRecentTracks(uid ?? undefined).then(({ data }) => setCommunityTracks(data));
  }, [uid]);

  const inviteBlend = async () => {
    const link = `https://myra.app/i/${genInviteCode()}`;
    await copyText(link);
    toast(t("bl.invited", link));
  };

  const QUICK = [
    { label: t("home.liked"),  icon: Heart,      act: () => onNavigate("library") },
    { label: t("home.charts"), icon: TrendingUp, act: () => setSearchOpen(true) },
    { label: t("home.radio"),  icon: Radio,      act: onPlayRadio },
    { label: t("home.blend"),  icon: BlendIcon,  act: () => (FRIENDS[0] ? onOpenBlend(FRIENDS[0]) : inviteBlend()) },
  ];

  return (
    <Page>
      {/* Верхняя панель */}
      <div className="px-5 pt-6 pb-5 flex items-center justify-between">
        <div className="lg:hidden" style={{ color: "var(--fg)" }}><MyraWordmark height={22} /></div>
        <div className="hidden lg:block" style={{ fontFamily: F.d, fontWeight: 800, fontSize: 22, letterSpacing: "-0.03em" }}>{t("nav.home")}</div>
        <div className="flex gap-2 relative items-center">
          <motion.button whileTap={{ scale: 0.85 }} onClick={toggleNotifs} className="w-10 h-10 rounded-full flex items-center justify-center relative" style={{ ...GLASS, background: notifOpen ? `${currentTrack.c2}30` : GLASS.background }}>
            <Bell size={16} />
            {hasUnread && <span className="absolute top-2 right-2.5 w-1.5 h-1.5 rounded-full" style={{ background: currentTrack.c2 }} />}
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
                style={{ width: 296, background: "var(--panel)", backdropFilter: "blur(36px) saturate(1.8)", WebkitBackdropFilter: "blur(36px) saturate(1.8)", border: "1px solid color-mix(in srgb, var(--wash) 13%, transparent)", boxShadow: "0 24px 70px rgba(0,0,0,0.6)" }}
              >
                <div className="px-4 py-3 text-[10px] tracking-[0.16em]" style={{ borderBottom: "1px solid color-mix(in srgb, var(--wash) 07%, transparent)", fontFamily: F.m, color: "color-mix(in srgb, var(--fg) 50%, transparent)" }}>{t("home.notifs")}</div>
                {activity.length === 0 && (
                  <div className="px-4 py-6 text-center text-xs" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.b }}>{t("notif.empty")}</div>
                )}
                {activity.slice(0, 8).map(item => {
                  const Icon = ACTIVITY_ICONS[item.textKey] ?? Bell;
                  const [val, unitKey] = relTimeParts(item.time);
                  return (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setNotifOpen(false)}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${currentTrack.c2}1e` }}>
                        <Icon size={14} style={{ color: currentTrack.c2 }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs" style={{ color: "color-mix(in srgb, var(--fg) 85%, transparent)", fontFamily: F.b }}>{t(item.textKey, ...item.args)}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: "color-mix(in srgb, var(--fg) 32%, transparent)", fontFamily: F.m }}>{t("notif.ago", `${val} ${t(unitKey)}`)}</div>
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Hero: Прилив */}
      <div className="px-5 mb-7">
        <TiltCard
          max={5}
          className="relative rounded-[28px] overflow-hidden cursor-pointer"
          style={{
            background: "linear-gradient(140deg, rgba(18,8,58,0.9), rgba(59,7,100,0.75))",
            backdropFilter: "blur(28px) saturate(1.7)",
            WebkitBackdropFilter: "blur(28px) saturate(1.7)",
            border: "1px solid color-mix(in srgb, var(--wash) 10%, transparent)",
            borderTop: "1px solid var(--glass-edge)",
            boxShadow: waveActive
              ? `0 0 70px ${TRACKS[0].c2}45, 0 0 130px rgba(246,184,200,0.18)`
              : "0 16px 50px rgba(124,58,237,0.18)",
          }}
          onClick={() => (playing && waveActive ? onPlay(currentTrack) : onPlayWave())}
        >
          <Aurora c2="#8b5cf6" />
          <div className="relative z-10 flex items-center justify-between p-6">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] mb-2" style={{ color: "#a78bfa", fontFamily: F.m }}>{t("home.flow")}</div>
              <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 30, letterSpacing: "-0.02em", lineHeight: 1, color: ON_DARK }}>
                <span style={{ background: "var(--brand-grad)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{t("home.wave")}</span>
              </div>
              <div className="text-xs mt-2.5" style={{ color: onDark(55), fontFamily: F.b }}>{t("home.aiSub")}</div>
            </div>
            <motion.div whileTap={{ scale: 0.88 }} className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "color-mix(in srgb, var(--wash) 12%, transparent)", backdropFilter: "blur(10px)", border: `1.5px solid ${waveActive ? "#a78bfa" : "color-mix(in srgb, var(--wash) 25%, transparent)"}` }}>
              {waveActive ? <Pause size={22} fill="white" stroke="none" /> : <Play size={22} fill="white" stroke="none" className="ml-1" />}
            </motion.div>
          </div>
          <div className="relative z-10 px-6 pb-5">
            <HeroWave playing={playing} />
          </div>
        </TiltCard>
      </div>

      {/* Поиск */}
      <div className="px-5 mb-7">
        <button onClick={() => setSearchOpen(true)} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-[18px] text-left" style={GLASS}>
          <Search size={15} style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", flexShrink: 0 }} />
          <span className="text-sm" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("home.search")}</span>
        </button>
      </div>

      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            style={{ background: "var(--dim)", backdropFilter: "blur(30px)", WebkitBackdropFilter: "blur(30px)" }}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={SPRING}
              className="absolute inset-0 lg:inset-6 lg:rounded-[28px] overflow-hidden"
              style={{ background: "var(--bg)" }}
            >
              <button onClick={() => setSearchOpen(false)} className="absolute top-6 right-5 z-10 w-9 h-9 rounded-full flex items-center justify-center" style={GLASS}>
                <X size={16} />
              </button>
              <BrowseScreen onPlay={tr => { onPlay(tr); setSearchOpen(false); }} onOpenArtist={name => { setSearchOpen(false); onOpenArtist(name); }} autoFocus />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
              <span className="text-[11px] font-medium" style={{ color: "color-mix(in srgb, var(--fg) 70%, transparent)", fontFamily: F.b }}>{q.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Дека */}
      <div className="px-5 mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 style={{ fontFamily: F.d, fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em" }}>{t("home.discover")}</h2>
          <span className="text-[10px]" style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)", fontFamily: F.m }}>{t("home.swipeHint")}</span>
        </div>
        <DiscoveryDeck onPlay={onPlay} onLike={onLikeTrack} />
      </div>

      {/* Релизы сообщества — реальные треки реальных пользователей MYRA */}
      {supabaseEnabled && communityTracks.length > 0 && (
        <div className="px-5 mb-8">
          <h2 className="mb-3" style={{ fontFamily: F.d, fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em" }}>{t("home.community")}</h2>
          <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {communityTracks.map(row => {
              const artistName = row.profiles?.username ?? "?";
              const tr = trackFromRow(row, artistName);
              return (
                <motion.div key={row.id} whileTap={{ scale: 0.95 }} className="flex-shrink-0 cursor-pointer group" style={{ width: 108 }} onClick={() => onPlay(tr)}>
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
                  <button onClick={e => { e.stopPropagation(); onOpenRealArtist(row.owner_id); }} className="text-[10px] truncate hover:text-white transition-colors" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.b }}>{artistName}</button>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Лента подписок — реальные аккаунты Supabase, полностью скрыта без бэкенда
          (см. supabaseEnabled в src/app/supabase.ts), в отличие от "Друзья слушают"
          ниже, которая всегда на месте (просто пуста без бэкенда/приглашённых) */}
      {supabaseEnabled && (
        <div className="px-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 style={{ fontFamily: F.d, fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em" }}>{t("soc.feedTitle")}</h2>
            <button onClick={onOpenPeopleSearch} className="text-xs flex items-center gap-1" style={{ color: currentTrack.c2, fontFamily: F.b }}>
              <Search size={12} /> {t("soc.findPeople")}
            </button>
          </div>
          {friendsFeed.length === 0 ? (
            <button onClick={onOpenPeopleSearch} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-[18px] text-left" style={GLASS}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${currentTrack.c2}1e` }}>
                <UserPlus size={15} style={{ color: currentTrack.c2 }} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold" style={{ fontFamily: F.b }}>{t("soc.feedEmpty")}</div>
                <div className="text-xs mt-0.5" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("soc.feedEmptySub")}</div>
              </div>
            </button>
          ) : (
            <div className="flex flex-col gap-1">
              {friendsFeed.map(item => (
                <FriendFeedRow key={item.id} item={item} playingId={previewPlayingId} onToggle={togglePreview} onOpenProfile={onOpenRealProfile} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Совместные комнаты — настоящий MVP на Supabase Realtime (см. rooms.tsx):
          вместо демо-ленты фейковых "друзей" (FRIENDS всегда пустой массив) —
          рабочая кнопка входа в реальную синхронную комнату */}
      <div className="px-5 mb-8">
        <button onClick={onOpenRooms} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-[18px] text-left" style={GLASS}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${currentTrack.c2}1e` }}>
            <Radio size={15} style={{ color: currentTrack.c2 }} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold" style={{ fontFamily: F.b }}>{t("room.entry")}</div>
            <div className="text-xs mt-0.5" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("room.entrySub")}</div>
          </div>
        </button>
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
              <div className="text-[10px] truncate" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.b }}>{tr.artist}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </Page>
  );
});

// ─── Обзор ────────────────────────────────────────────────────────────────────

export function BrowseScreen({ onPlay, onOpenArtist, autoFocus }: { onPlay: (t: Track) => void; onOpenArtist: (name: string) => void; autoFocus?: boolean }) {
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
          <Search size={15} style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", flexShrink: 0 }} />
          <input
            autoFocus={autoFocus}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t("browse.search")}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "var(--fg)", fontFamily: F.b }}
          />
          {query && <button onClick={() => setQuery("")}><X size={14} style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)" }} /></button>}
        </div>
      </div>

      <div className="px-5 mb-7">
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {MOODS.map(m => {
            const Icon = m.icon;
            return (
              <motion.button key={m.label} whileTap={{ scale: 0.93 }} onClick={() => { onPlay(m.track); toast(t("browse.mixStarted", m.label)); }} className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-medium" style={{ ...GLASS, fontFamily: F.b, color: "color-mix(in srgb, var(--fg) 80%, transparent)" }}>
                <Icon size={13} style={{ color: m.track.c2 }} />
                {m.label}
              </motion.button>
            );
          })}
        </div>
      </div>

      {query ? (
        <div className="px-5">
          <div className="text-xs mb-3" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}>{t("browse.found", filtered.length)}</div>
          {filtered.map((tr, i) => (
            <motion.div key={tr.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} onClick={() => onPlay(tr)} className="flex items-center gap-3 p-3 rounded-2xl mb-2 cursor-pointer hover:bg-white/5 transition-colors" style={{ background: "color-mix(in srgb, var(--wash) 03%, transparent)" }}>
              <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
                <img src={tr.img} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold" style={{ fontFamily: F.b }}>{tr.title}</div>
                <button onClick={e => { e.stopPropagation(); onOpenArtist(tr.artist); }} className="text-xs hover:text-white transition-colors" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.b }}>{tr.artist} · {tr.genre}</button>
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
                <div className="w-7 text-center font-bold text-sm" style={{ color: c.pos <= 3 ? "#a78bfa" : "color-mix(in srgb, var(--fg) 30%, transparent)", fontFamily: F.m }}>{c.pos}</div>
                <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0">
                  <img src={c.img} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ fontFamily: F.b }}>{c.title}</div>
                  <div className="text-xs truncate" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.b }}>{c.artist}</div>
                </div>
                <div className="text-[11px] px-2 py-1 rounded-full font-semibold" style={{ fontFamily: F.m, color: c.delta > 0 ? "#34d399" : c.delta < 0 ? "#f87171" : "color-mix(in srgb, var(--fg) 30%, transparent)", background: c.delta > 0 ? "rgba(52,211,153,0.1)" : c.delta < 0 ? "rgba(248,113,113,0.1)" : "color-mix(in srgb, var(--wash) 05%, transparent)" }}>
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
                  <img src={svgCover("var(--bg2)", c, i + 51)} alt={g} className="w-full h-full object-cover" style={{ filter: "brightness(0.55)" }} />
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

// ─── Рейтинг ──────────────────────────────────────────────────────────────────

export const RatingScreen = React.memo(function RatingScreen({ c2, userName, avatar, level, minutesWeek, streak, onOpenPeer }: {
  c2: string; userName: string; avatar: string; level: number; minutesWeek: number; streak: number;
  onOpenPeer: (peer: typeof LEADERBOARD_PEERS[number]) => void;
}) {
  const { t, lang } = useLang();
  const [metric, setMetric] = useState<"level" | "minutes" | "streak">("level");

  const you = { name: userName, avatar, level, minutesWeek, streak, you: true as const };
  const rows = [...LEADERBOARD_PEERS.map(p => ({ ...p, you: false as const })), you]
    .sort((a, b) => metric === "level" ? b.level - a.level : metric === "minutes" ? b.minutesWeek - a.minutesWeek : b.streak - a.streak);

  const METRICS = [
    { id: "level" as const,   label: t("rt.level"),   icon: Crown },
    { id: "minutes" as const, label: t("rt.minutes"), icon: Clock },
    { id: "streak" as const,  label: t("rt.streak"),  icon: Flame },
  ];

  const valueFor = (u: typeof rows[number]) =>
    metric === "level" ? t("rt.lvlLabel", u.level) : metric === "minutes" ? t("rt.minLabel", u.minutesWeek) : t("rt.streakLabel", u.streak);

  return (
    <Page>
      <div className="px-5 pt-6 pb-4">
        <h1 style={{ fontFamily: F.d, fontWeight: 800, fontSize: 28, letterSpacing: "-0.03em" }}>{t("nav.rating")}</h1>
      </div>

      {LEADERBOARD_PEERS.length === 0 && (
        <div className="mx-5 mb-5 px-4 py-3.5 rounded-2xl flex items-center gap-3" style={GLASS}>
          <Users size={16} style={{ color: c2, flexShrink: 0 }} />
          <div className="min-w-0">
            <div className="text-sm font-semibold" style={{ fontFamily: F.b }}>{t("rt.empty")}</div>
            <div className="text-xs mt-0.5" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("rt.emptySub")}</div>
          </div>
        </div>
      )}

      <div className="flex gap-1 mx-5 mb-6 p-1 rounded-full w-fit" style={GLASS}>
        {METRICS.map(m => {
          const Icon = m.icon;
          return (
            <button key={m.id} onClick={() => setMetric(m.id)} className="relative flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap" style={{ fontFamily: F.b, color: metric === m.id ? "#fff" : "color-mix(in srgb, var(--fg) 45%, transparent)" }}>
              {metric === m.id && <motion.div layoutId="rttab" className="absolute inset-0 rounded-full" style={{ background: `${c2}cc` }} transition={SPRING} />}
              <Icon size={12} className="relative z-10" /><span className="relative z-10">{m.label}</span>
            </button>
          );
        })}
      </div>

      <div className="px-5 flex flex-col gap-1.5">
        {rows.map((u, i) => (
          <motion.div
            key={u.you ? "you" : u.name}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i, 8) * 0.03, layout: SPRING }}
            className="flex items-center gap-3 p-3 rounded-2xl"
            style={{ ...(u.you ? { background: `${c2}18`, border: `1px solid ${c2}44` } : GLASS), cursor: u.you ? "default" : "pointer" }}
            onClick={() => { if (!u.you) onOpenPeer(u); }}
          >
            <div className="w-6 text-center font-bold text-sm flex-shrink-0" style={{ color: i < 3 ? c2 : "color-mix(in srgb, var(--fg) 35%, transparent)", fontFamily: F.m }}>{i + 1}</div>
            <img src={u.avatar} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" style={u.you ? { border: `1.5px solid ${c2}` } : undefined} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate" style={{ fontFamily: F.b }}>
                {u.you ? `${u.name} · ${t("rt.you")}` : (lang === "ru" ? u.name : (u as any).en ?? u.name)}
              </div>
              <div className="text-xs truncate" style={{ color: "color-mix(in srgb, var(--fg) 42%, transparent)", fontFamily: F.m }}>{valueFor(u)}</div>
            </div>
            {i < 3 && <Crown size={16} style={{ color: i === 0 ? "#facc15" : i === 1 ? "#cbd5e1" : "#fb923c", flexShrink: 0 }} />}
            {!u.you && <ChevronRight size={15} style={{ color: "color-mix(in srgb, var(--fg) 25%, transparent)", flexShrink: 0 }} />}
          </motion.div>
        ))}
      </div>

      {/* Достижения намеренно убраны с этого экрана: они скрытые — пользователь
          узнаёт о каждом только в момент открытия (тост + уведомление).
          Полный список остался в панели разработчика для проверки. */}
      <div className="pb-6" />
    </Page>
  );
});

// ─── Медиатека ────────────────────────────────────────────────────────────────

export const LibraryScreen = React.memo(function LibraryScreen({ onPlay, likedIds, onLike, currentTrack, playing, onOpenArtist, onOpenAlbum, onOpenPlaylist, myTracks = [], onDeleteLocal, onUploadFiles, playlists = [], onCreatePlaylist, customPlIds, onDeletePlaylist }: {
  onPlay: (t: Track) => void; likedIds: Set<number>; onLike: (id: number) => void;
  currentTrack: Track; playing: boolean; onOpenArtist: (name: string) => void;
  onOpenAlbum?: (album: string) => void; onOpenPlaylist?: (id: string) => void;
  myTracks?: Track[]; onDeleteLocal?: (id: number) => void; onUploadFiles?: (files: FileList | File[]) => void;
  playlists?: typeof PLAYLISTS; onCreatePlaylist?: (name: string) => void;
  customPlIds?: Set<string>; onDeletePlaylist?: (id: string) => void;
}) {
  const { t } = useLang();
  const [tab, setTab] = useState<"liked" | "playlists" | "podcasts">("liked");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null);
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
        <motion.button whileTap={{ scale: 0.85 }} onClick={() => setCreateOpen(true)} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${currentTrack.c2}, ${currentTrack.c2}99)` }}>
          <Plus size={16} />
        </motion.button>
      </div>

      <div className="flex gap-1 mx-5 mb-6 p-1 rounded-full w-fit" style={GLASS}>
        {TABS.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)} className="relative px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap" style={{ fontFamily: F.b, color: tab === tb.id ? "#fff" : "color-mix(in srgb, var(--fg) 45%, transparent)" }}>
            {tab === tb.id && <motion.div layoutId="libtab" className="absolute inset-0 rounded-full" style={{ background: `${currentTrack.c2}cc` }} transition={SPRING} />}
            <span className="relative z-10">{tb.label}</span>
          </button>
        ))}
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}>
          {tab === "liked" && (
            <div className="px-5 flex flex-col gap-1">
              {onUploadFiles && (
                <>
                  <input
                    ref={uploadRef}
                    type="file"
                    accept="audio/*,.mp3,.wav,.flac,.m4a,.ogg,.aac"
                    multiple
                    className="hidden"
                    onChange={e => { if (e.target.files?.length) { onUploadFiles(e.target.files); e.target.value = ""; } }}
                  />
                  <motion.div whileTap={{ scale: 0.98 }} onClick={() => uploadRef.current?.click()} className="flex items-center gap-3 p-3.5 rounded-2xl cursor-pointer mb-2" style={GLASS}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${currentTrack.c2}1e` }}>
                      <Upload size={16} style={{ color: currentTrack.c2 }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold" style={{ fontFamily: F.b }}>{t("cr.uploadTrack")}</div>
                      <div className="text-xs mt-0.5" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.b }}>{t("cr.uploadTrackSub")}</div>
                    </div>
                  </motion.div>
                </>
              )}
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
                    <div className="text-xs truncate flex items-center gap-1.5" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.b }}>
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
              {liked.map(tr => (
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
                    <div className="text-xs truncate" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.b }}>
                      <button onClick={e => { e.stopPropagation(); onOpenArtist(tr.artist); }} className="hover:text-white transition-colors">{tr.artist}</button>
                      {" · "}
                      <button onClick={e => { e.stopPropagation(); onOpenAlbum?.(tr.album); }} className="hover:text-white transition-colors">{tr.album}</button>
                    </div>
                  </div>
                  <motion.button whileTap={{ scale: 0.7 }} onClick={e => { e.stopPropagation(); onLike(tr.id); }} className="p-1.5">
                    <Heart size={15} fill={likedIds.has(tr.id) ? tr.c2 : "none"} stroke={likedIds.has(tr.id) ? tr.c2 : "color-mix(in srgb, var(--wash) 25%, transparent)"} />
                  </motion.button>
                </div>
              ))}
              {liked.length === 0 && myTracks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Heart size={28} style={{ color: "color-mix(in srgb, var(--fg) 25%, transparent)" }} />
                  <div className="mt-3 text-sm" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("lib.empty")}</div>
                </div>
              )}
            </div>
          )}

          {tab === "playlists" && playlists.length === 0 && (
            <div className="px-5 flex flex-col items-center justify-center py-16 text-center">
              <Music2 size={28} style={{ color: "color-mix(in srgb, var(--fg) 25%, transparent)" }} />
              <div className="mt-3 text-sm" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("lib.plEmpty")}</div>
            </div>
          )}

          {tab === "playlists" && playlists.length > 0 && (
            <div className="px-5 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {playlists.map(pl => (
                <TiltCard key={pl.id} max={9} className="cursor-pointer group" onClick={() => onOpenPlaylist ? onOpenPlaylist(pl.id) : toast(t("lib.plToast", pl.name, pl.trackIds.length))}>
                  <div className="rounded-[20px] overflow-hidden mb-2.5 aspect-square relative">
                    <img src={pl.img} alt={pl.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(0,0,0,0.4)" }}>
                      <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--wash) 16%, transparent)", backdropFilter: "blur(10px)", border: "1px solid color-mix(in srgb, var(--wash) 30%, transparent)" }}>
                        <Play size={17} fill="white" stroke="none" className="ml-0.5" />
                      </div>
                    </div>
                    {customPlIds?.has(pl.id) && (
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={e => { e.stopPropagation(); onDeletePlaylist?.(pl.id); }}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}
                      >
                        <Trash2 size={14} style={{ color: "#f87171" }} />
                      </motion.button>
                    )}
                  </div>
                  <div className="text-sm font-semibold" style={{ fontFamily: F.b }}>{pl.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.b }}>{t("lib.nTracks", pl.trackIds.length)}</div>
                </TiltCard>
              ))}
            </div>
          )}

          {tab === "podcasts" && (
            <div className="px-5 flex flex-col gap-4">
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Radio size={28} style={{ color: "color-mix(in srgb, var(--fg) 25%, transparent)" }} />
                <div className="mt-3 text-sm" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("lib.podEmpty")}</div>
              </div>
            </div>
          )}
      </motion.div>

      <Sheet open={createOpen} onClose={() => setCreateOpen(false)} z={70} center>
        <div className="p-6">
          <div className="mb-4" style={{ fontFamily: F.d, fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" }}>{t("lib.newPlTitle")}</div>
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && newName.trim()) { onCreatePlaylist?.(newName.trim()); setNewName(""); setCreateOpen(false); toast(t("lib.plCreated")); } }} placeholder={t("lib.plName")} className="w-full px-4 py-3 rounded-2xl bg-transparent outline-none text-sm mb-4" style={{ ...GLASS, color: "var(--fg)", fontFamily: F.b }} />
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => { if (newName.trim()) { onCreatePlaylist?.(newName.trim()); setNewName(""); setCreateOpen(false); toast(t("lib.plCreated")); } }} className="w-full py-3 rounded-full text-sm font-semibold" style={{ background: `linear-gradient(135deg, ${currentTrack.c2}, ${currentTrack.c2}99)`, color: "#fff", fontFamily: F.b }}>{t("lib.plCreate")}</motion.button>
        </div>
      </Sheet>
    </Page>
  );
});

// ─── Студия ───────────────────────────────────────────────────────────────────

export const CreatorScreen = React.memo(function CreatorScreen({ c2, creatorPlus, onOpenCreatorPlus, onOpenStats, myTracks = [], onStartRelease, onPlay, myPlaysByTrack, myPlaysByDay, balance, onWithdraw, realDonationsTotal }: {
  c2: string; creatorPlus: boolean; onOpenCreatorPlus: () => void;
  onOpenStats: () => void; myTracks?: Track[]; onStartRelease: (files: FileList | File[]) => void; onPlay: (t: Track) => void;
  myPlaysByTrack: Record<number, number>; myPlaysByDay: Record<string, number>;
  balance: number; onWithdraw: (amt: number) => void; realDonationsTotal: number;
}) {
  const { t } = useLang();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [wdOpen, setWdOpen] = useState(false);

  // Подписи — реальные дни последней недели (график заканчивается сегодня),
  // а не фиксированные «Пн…Вс», которые почти всегда врали
  const { lang } = useLang();
  const WEEKDAYS = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "en-US", { weekday: "short" });
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return fmt.format(d).replace(/^./, c => c.toUpperCase());
    });
  }, [lang]);
  const week = useMemo(() => lastNDays(myPlaysByDay, 7), [myPlaysByDay]);
  const prevWeek = useMemo(() => lastNDays(myPlaysByDay, 14).slice(0, 7).reduce((a, b) => a + b, 0), [myPlaysByDay]);
  const weekTotal = week.reduce((a, b) => a + b, 0);
  const trendPct = prevWeek > 0 ? Math.round(((weekTotal - prevWeek) / prevWeek) * 100) : null;
  const topMyTracks = useMemo(
    () => [...myTracks].sort((a, b) => (myPlaysByTrack[b.id] ?? 0) - (myPlaysByTrack[a.id] ?? 0)),
    [myTracks, myPlaysByTrack],
  );

  // Детальная аналитика — реальная привилегия Pro (шторка Pro её обещает
  // третьим пунктом; раньше она была открыта всем, и обещание было пустым)
  const openStatsGated = () => {
    if (creatorPlus) onOpenStats();
    else { toast(t("cr.statsLocked")); onOpenCreatorPlus(); }
  };

  return (
    <Page>
      <div className="px-5 pt-6 pb-5 flex items-end justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] mb-1" style={{ color: "color-mix(in srgb, var(--fg) 35%, transparent)", fontFamily: F.m }}>{t("cr.creator")}</div>
          <h1 style={{ fontFamily: F.d, fontWeight: 800, fontSize: 28, letterSpacing: "-0.03em" }}>{t("cr.studio")}</h1>
        </div>
        {creatorPlus && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-1" style={{ background: "rgba(139,92,246,0.16)", border: "1px solid rgba(139,92,246,0.35)" }}>
            <Crown size={12} style={{ color: "#c4b5fd" }} />
            <span className="text-[11px] font-semibold" style={{ color: "#c4b5fd", fontFamily: F.m }}>MYRA Pro</span>
          </div>
        )}
      </div>

      <div className="px-5 mb-7">
        <div className="rounded-[24px] p-5 mb-3 cursor-pointer" style={GLASS} onClick={openStatsGated}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs mb-1" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("cr.plays7")}</div>
              <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 26, letterSpacing: "-0.02em" }}>{weekTotal}</div>
            </div>
            {trendPct !== null && (
              <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold" style={{ background: trendPct >= 0 ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)", color: trendPct >= 0 ? "#34d399" : "#f87171", fontFamily: F.m }}>
                <TrendingUp size={12} /> {trendPct >= 0 ? "+" : ""}{trendPct}%
              </div>
            )}
          </div>
          <InteractiveChart data={week} labels={WEEKDAYS} color={c2} height={72} markIndex={week.length - 1} valueLabel={v => t("cr.plays", v)} />
          <div className="flex justify-between mt-1 text-[9px]" style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)", fontFamily: F.m }}>
            {WEEKDAYS.map(d => <span key={d}>{d}</span>)}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {[["0", t("cr.fans"), Users, openStatsGated], [balance.toLocaleString("ru-RU") + "₽", t("cr.donations"), Wallet, () => setWdOpen(true)], [String(myTracks.length), t("cr.releases"), Music2, openStatsGated]].map(([v, l, Icon, act]: any) => (
            <motion.div key={l} whileTap={{ scale: 0.95 }} onClick={act} className="rounded-[20px] p-4 cursor-pointer" style={GLASS}>
              <Icon size={15} style={{ color: c2 }} className="mb-2" />
              <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 17, letterSpacing: "-0.02em" }}>{v}</div>
              <div className="text-[10px] mt-0.5" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{l}</div>
            </motion.div>
          ))}
        </div>

        {supabaseEnabled && realDonationsTotal > 0 && (
          <div className="mt-2.5 flex items-center gap-2.5 px-4 py-3 rounded-2xl" style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)" }}>
            <Gift size={14} style={{ color: "#34d399" }} />
            <span className="text-xs" style={{ fontFamily: F.b, color: "color-mix(in srgb, var(--fg) 75%, transparent)" }}>{t("cr.realDonations", realDonationsTotal.toLocaleString("ru-RU"))}</span>
          </div>
        )}
      </div>

      <div className="px-5 mb-7">
        <h2 className="mb-3" style={{ fontFamily: F.d, fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em" }}>{t("cr.newRelease")}</h2>
        {/* Реальная загрузка: клик открывает выбор файла, drag-n-drop тоже работает */}
        <input
          ref={fileRef}
          type="file"
          accept="audio/*,.mp3,.wav,.flac,.m4a,.ogg,.aac"
          className="hidden"
          onChange={e => { if (e.target.files?.length) { onStartRelease(e.target.files); e.target.value = ""; } }}
        />
        <div
          className="flex flex-col items-center justify-center rounded-[20px] p-7 cursor-pointer transition-all"
          style={{ ...GLASS, border: dragOver ? `1.5px dashed ${c2}` : "1.5px dashed color-mix(in srgb, var(--wash) 16%, transparent)", background: dragOver ? `${c2}14` : GLASS.background }}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) onStartRelease(e.dataTransfer.files); }}
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: `${c2}1e` }}>
            <Upload size={19} style={{ color: c2 }} />
          </div>
          <div className="text-sm font-semibold mb-1" style={{ fontFamily: F.b }}>{t("cr.dropFile")}</div>
          <div className="text-xs" style={{ color: "color-mix(in srgb, var(--fg) 35%, transparent)", fontFamily: F.m }}>MP3 · FLAC · WAV · M4A</div>
        </div>

        {/* Мои файлы */}
        {myTracks.length > 0 && (
          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-[0.16em] mb-2" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}>{t("cr.myFiles")}</div>
            {myTracks.map(tr => (
              <motion.div key={tr.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onClick={() => onPlay(tr)} className="flex items-center gap-3 p-3 rounded-2xl mb-1.5 cursor-pointer hover:bg-white/5 transition-colors" style={{ background: "color-mix(in srgb, var(--wash) 03%, transparent)" }}>
                <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0">
                  <img src={tr.img} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ fontFamily: F.b }}>{tr.title}</div>
                  <div className="text-[10px] mt-0.5 flex items-center gap-1.5" style={{ color: "color-mix(in srgb, var(--fg) 35%, transparent)", fontFamily: F.m }}>
                    <FileAudio size={10} style={{ color: tr.c2 }} /> {t("cr.local")}
                  </div>
                </div>
                <Play size={14} style={{ color: "color-mix(in srgb, var(--fg) 35%, transparent)" }} />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="px-5 mb-7">
        <h2 className="mb-3" style={{ fontFamily: F.d, fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em" }}>{t("cr.myReleases")}</h2>
        {topMyTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center rounded-2xl" style={{ background: "color-mix(in srgb, var(--wash) 03%, transparent)" }}>
            <Music2 size={24} style={{ color: "color-mix(in srgb, var(--fg) 25%, transparent)" }} />
            <div className="mt-3 text-sm" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("cr.releasesEmpty")}</div>
          </div>
        ) : topMyTracks.map(tr => (
          <div key={tr.id} onClick={() => onPlay(tr)} className="flex items-center gap-3 p-3 rounded-2xl mb-2 cursor-pointer hover:bg-white/5 transition-colors" style={{ background: "color-mix(in srgb, var(--wash) 03%, transparent)" }}>
            <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
              <img src={tr.img} alt="" className="w-full h-full object-cover" style={{ filter: "brightness(0.75)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate" style={{ fontFamily: F.b }}>{tr.title}</div>
              <div className="text-[10px] mt-1" style={{ color: "color-mix(in srgb, var(--fg) 35%, transparent)", fontFamily: F.m }}>{t("cr.plays", myPlaysByTrack[tr.id] ?? 0)}</div>
            </div>
            <BarChart3 size={16} style={{ color: tr.c2 }} />
          </div>
        ))}
      </div>

      {/* MYRA Pro / Начни зарабатывать */}
      <div className="px-5">
        <TiltCard max={5} className="rounded-[24px] p-6 overflow-hidden relative cursor-pointer" style={{ background: "linear-gradient(135deg, rgba(18,8,58,0.85), rgba(59,7,100,0.7))", border: "1px solid rgba(139,92,246,0.3)" }} onClick={onOpenCreatorPlus}>
          <Aurora c2="#8b5cf6" opacity={0.6} />
          <div className="relative z-10">
            <div className="text-[10px] uppercase tracking-[0.2em] mb-2" style={{ color: "#a78bfa", fontFamily: F.m }}>MYRA Pro</div>
            <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 20, letterSpacing: "-0.02em", color: ON_DARK }} className="mb-1.5">
              {creatorPlus ? t("cr.active") : t("cr.earn")}
            </div>
            <div className="text-xs mb-4" style={{ color: onDark(50), fontFamily: F.b }}>{creatorPlus ? t("cp.cancel") : t("cr.earnSub")}</div>
            <motion.button whileTap={{ scale: 0.95 }} onClick={e => { e.stopPropagation(); onOpenCreatorPlus(); }} className="px-6 py-2.5 rounded-full text-sm font-semibold" style={{ background: "linear-gradient(135deg, #8b5cf6, #a78bfa)", color: "#fff", fontFamily: F.b }}>
              {creatorPlus ? t("cr.manage") : t("cr.connect")}
            </motion.button>
          </div>
        </TiltCard>
      </div>

      <WithdrawSheet open={wdOpen} onClose={() => setWdOpen(false)} balance={balance} c2={c2} onDone={onWithdraw} />
    </Page>
  );
});

// ─── Профиль ──────────────────────────────────────────────────────────────────

export const ProfileScreen = React.memo(function ProfileScreen({ c2, userName, handle, avatar, creatorPlus, follows, totalPlays, onOpenBlend, onOpenAccount, onOpenWrapped, onOpenSplit, onOpenAchievements, achDone, achTotal, onLogout, simpleFx, onToggleSimpleFx, quality, onSetQuality, userRole, plusActive, donationCount, devMode, onToggleDevMode, onOpenDevPanel, onOpenPlus }: {
  c2: string; userName: string; handle: string; avatar: string; creatorPlus: boolean; follows: number; totalPlays: number;
  onOpenBlend: (f: Friend) => void; onOpenAccount: () => void; onOpenWrapped: () => void; onOpenSplit: () => void;
  onOpenAchievements: () => void; achDone: number; achTotal: number; onLogout: () => void;
  simpleFx: boolean; onToggleSimpleFx: () => void; quality: number; onSetQuality: (idx: number) => void;
  userRole: UserRole; plusActive: boolean; donationCount: number;
  devMode: boolean; onToggleDevMode: () => void; onOpenDevPanel: () => void; onOpenPlus: () => void;
}) {
  const { t, lang, setLang } = useLang();
  const { theme, toggleTheme } = useTheme();
  const [blendOpen, setBlendOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logoutQ, setLogoutQ] = useState(false);

  // Тот же апгрейд, что и на стороне App.tsx: Pro у артиста, Plus у слушателя.
  // Настоящий потолок для Free — FLAC, Hi-Res только с апгрейдом
  const hasUpgrade = userRole === "artist" ? creatorPlus : plusActive;

  // Секретная активация режима разработчика: 7 быстрых тапов по аватару —
  // стандартный паттерн (как версия сборки в настройках Android)
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onAvatarTap = () => {
    tapCount.current += 1;
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 1500);
    if (tapCount.current >= 7) { tapCount.current = 0; onToggleDevMode(); }
  };

  // Бейджи: у артиста и слушателя — свои, визуально разные; Pro/Plus и «Меценат»
  // добавляются к базовому; «Разработчик» — только у создателей в dev-режиме
  const badges = useMemo(() => [
    userRole === "artist"
      ? { icon: Mic2, label: t("bd.artist"), c: "#a78bfa" }
      : { icon: Headphones, label: t("bd.listener"), c: "#34d399" },
    ...(userRole === "artist" && creatorPlus ? [{ icon: Crown, label: "MYRA Pro", c: "#c4b5fd" }] : []),
    ...(userRole === "listener" && plusActive ? [{ icon: Sparkles, label: "MYRA Plus", c: "#22d3ee" }] : []),
    ...(donationCount > 0 ? [{ icon: Gift, label: t("bd.donor"), c: "#facc15" }] : []),
    ...(devMode ? [{ icon: Wrench, label: t("bd.dev"), c: "#f472b6" }] : []),
  ], [userRole, creatorPlus, plusActive, donationCount, devMode, t]);

  const QUALITIES = ["AAC 256", "FLAC", "Hi-Res 24-bit"];

  // Реальный текущий месяц — раньше был захардкожен "Июль 2026"
  const monthLabel = useMemo(() => {
    const label = new Date().toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { month: "long", year: "numeric" });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [lang]);

  return (
    <Page>
      <div className="px-5 pt-8 pb-6 text-center">
        <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SPRING} className="relative inline-block mb-4" onClick={onAvatarTap}>
          <img src={avatar} alt="avatar" className="w-24 h-24 rounded-full object-cover mx-auto" style={{ border: `2px solid ${c2}`, boxShadow: `0 0 40px ${c2}50` }} />
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${c2}, ${c2}aa)` }}>
            {userRole === "artist" ? <Mic2Icon /> : <Headphones size={12} />}
          </div>
        </motion.div>
        <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 24, letterSpacing: "-0.03em" }}>{userName}</div>
        <div className="text-xs mt-1.5" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}>{handle}</div>
        {/* Бейджи — эксклюзивные для роли + Pro/Plus, «Меценат» и «Разработчик» */}
        <div className="flex justify-center gap-2 mt-3.5 flex-wrap px-6">
          {badges.map(b => {
            const Icon = b.icon;
            return (
              <span key={b.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold" style={{ background: `${b.c}1c`, border: `1px solid ${b.c}44`, color: b.c, fontFamily: F.b }}>
                <Icon size={12} /> {b.label}
              </span>
            );
          })}
        </div>
        <div className="flex justify-center gap-10 mt-6">
          {[[String(follows), t("pr.follows")], ["0", t("pr.fans")], [fmtCount(totalPlays), t("pr.plays")]].map(([v, l]) => (
            <div key={l} className="text-center">
              <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 19, color: c2, letterSpacing: "-0.02em" }}>{v}</div>
              <div className="text-[10px] mt-0.5" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.b }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* MYRA Plus — бесплатный уровень, виден только слушателям (Pro — у артистов в Студии) */}
      {userRole === "listener" && (
        <div className="px-5 mb-6">
          <TiltCard max={6} onClick={onOpenPlus} className="rounded-[24px] overflow-hidden relative cursor-pointer" style={{ height: 104, background: "linear-gradient(135deg, rgba(6,38,27,0.9), rgba(6,78,59,0.55))", border: "1px solid rgba(52,211,153,0.3)" }}>
            <Aurora c2="#34d399" opacity={0.7} />
            <div className="absolute inset-0 flex items-center justify-between px-6 z-10">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] mb-1.5" style={{ color: "#6ee7b7", fontFamily: F.m }}>MYRA Plus</div>
                <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 22, letterSpacing: "-0.02em", color: ON_DARK }}>
                  {plusActive ? t("plus.activeCard") : t("plus.card")}
                </div>
              </div>
              <ChevronRight size={20} style={{ color: onDark(50) }} />
            </div>
          </TiltCard>
        </div>
      )}

      {/* Настройки: декоративные тумблеры (уведомления, автозагрузка с фейковыми
          цифрами, AI-фильтр) убраны совсем — они ничего реального не делали, а
          настоящие настройки спрятаны в аккордеон, чтобы профиль не был простынёй */}
      <div className="px-5 flex flex-col gap-1.5">
        {/* Достижения — вернулись из дев-панели в профиль */}
        <motion.div whileTap={{ scale: 0.99 }} className="flex items-center gap-3 px-4 py-3.5 rounded-2xl cursor-pointer" style={GLASS} onClick={onOpenAchievements}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${c2}1c` }}><Trophy size={15} style={{ color: c2 }} /></div>
          <div className="flex-1">
            <div className="text-sm" style={{ fontFamily: F.b }}>{t("pr.achievements")}</div>
            <div className="text-[10px] mt-0.5" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}>{t("ach.progress", achDone, achTotal)}</div>
          </div>
          <ChevronRight size={15} style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }} />
        </motion.div>

        {/* Прозрачный сплит — компактной строкой вместо полноширинного баннера,
            чтобы профиль не был двумя одинаковыми по весу плашками подряд */}
        <motion.div whileTap={{ scale: 0.99 }} className="flex items-center gap-3 px-4 py-3.5 rounded-2xl cursor-pointer" style={GLASS} onClick={onOpenSplit}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(250,204,21,0.16)" }}><Gift size={15} style={{ color: "#facc15" }} /></div>
          <div className="flex-1">
            <div className="text-sm" style={{ fontFamily: F.b }}>{t("pr.split")}{t("pr.splitAccent")}</div>
            <div className="text-[10px] mt-0.5" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}>{t("pr.splitSub")}</div>
          </div>
          <ChevronRight size={15} style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }} />
        </motion.div>

        {/* Эхо месяца — раньше висело в профиле весь месяц напоказ, хотя месяц ещё
            не закончился; теперь появляется только в последние 3 дня месяца, когда
            recap реально имеет смысл смотреть */}
        {isMonthEndWindow() && (
          <motion.div whileTap={{ scale: 0.99 }} className="flex items-center gap-3 px-4 py-3.5 rounded-2xl cursor-pointer" style={GLASS} onClick={onOpenWrapped}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(139,92,246,0.16)" }}><Sparkles size={15} style={{ color: "#a78bfa" }} /></div>
            <div className="flex-1">
              <div className="text-sm" style={{ fontFamily: F.b }}>{t("pr.wrapped")}{t("pr.month")}</div>
              <div className="text-[10px] mt-0.5" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}>{monthLabel}</div>
            </div>
            <ChevronRight size={15} style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }} />
          </motion.div>
        )}

        {/* Аккордеон реальных настроек */}
        <div className="rounded-2xl overflow-hidden" style={GLASS}>
          <motion.div whileTap={{ scale: 0.99 }} className="flex items-center gap-3 px-4 py-3.5 cursor-pointer" onClick={() => setSettingsOpen(o => !o)}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)" }}><Settings size={15} /></div>
            <div className="flex-1 text-sm" style={{ fontFamily: F.b }}>{t("pr.settingsGroup")}</div>
            <motion.div animate={{ rotate: settingsOpen ? 90 : 0 }}><ChevronRight size={15} style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }} /></motion.div>
          </motion.div>
          <AnimatePresence>
            {settingsOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                <div className="flex flex-col gap-1.5 px-2 pb-2" style={{ borderTop: "1px solid color-mix(in srgb, var(--wash) 06%, transparent)", paddingTop: 8 }}>
                  <SettingRow icon={<Zap size={15} />} label={t("pr.simpleFx")} sub={t("pr.simpleFxSub")}>
                    <Toggle on={simpleFx} onChange={() => { onToggleSimpleFx(); toast(simpleFx ? t("pr.simpleFxOff") : t("pr.simpleFxOn")); }} color={c2} />
                  </SettingRow>
                  {/* Перелив (кроссфейд) переехал в плеер — к остальным настройкам воспроизведения.
                      Тема — цикл из трёх: неон открывается только с Plus/Pro, поэтому чип вместо тумблера */}
                  <SettingRow icon={theme === "dark" ? <Moon size={15} /> : theme === "light" ? <Sun size={15} /> : <Sparkles size={15} style={{ color: "#a5b4fc" }} />} label={t("pr.theme")}>
                    <div className="text-xs px-2.5 py-1 rounded-full cursor-pointer" onClick={toggleTheme} style={{ background: `${c2}1e`, color: c2, fontFamily: F.m }}>
                      {theme === "dark" ? t("pr.themeDark") : theme === "light" ? t("pr.themeLight") : t("pr.themeNeon")}
                    </div>
                  </SettingRow>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.div
          whileTap={{ scale: 0.99 }}
          className="flex items-center gap-3 px-4 py-3.5 rounded-2xl cursor-pointer"
          style={GLASS}
          onClick={() => {
            // Free: цикл AAC ↔ FLAC (Hi-Res — привилегия апгрейда). Ранний
            // return здесь раньше вообще блокировал клик с дефолтного FLAC —
            // Free-пользователь не мог даже вернуться на экономный AAC
            const maxTier = hasUpgrade ? QUALITIES.length : 2;
            const next = (quality + 1) % maxTier;
            onSetQuality(next);
            toast(!hasUpgrade && quality === 1 ? t("pr.qualityLocked") : t("pr.qualitySet", QUALITIES[next]));
          }}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)" }}><Volume2 size={15} /></div>
          <div className="flex-1">
            <div className="text-sm" style={{ fontFamily: F.b }}>{t("pr.quality")}</div>
            <div className="text-[10px] mt-0.5" style={{ color: quality === 0 ? "color-mix(in srgb, var(--fg) 40%, transparent)" : "#34d399", fontFamily: F.m }}>{quality === 0 ? t("pr.compressed") : t("pr.lossless")}</div>
          </div>
          {!hasUpgrade && <Lock size={12} style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }} />}
          <div className="text-xs px-2.5 py-1 rounded-full" style={{ background: `${c2}1e`, color: c2, fontFamily: F.m }}>{QUALITIES[quality]}</div>
        </motion.div>

        {/* Blend */}
        <div className="rounded-2xl overflow-hidden" style={GLASS}>
          <motion.div whileTap={{ scale: 0.99 }} className="flex items-center gap-3 px-4 py-3.5 cursor-pointer" onClick={() => setBlendOpen(o => !o)}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)" }}><Users size={15} /></div>
            <div className="flex-1 text-sm" style={{ fontFamily: F.b }}>{t("pr.blendRow")}</div>
            <motion.div animate={{ rotate: blendOpen ? 90 : 0 }}><ChevronRight size={15} style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }} /></motion.div>
          </motion.div>
          <AnimatePresence>
            {blendOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                {FRIENDS.length === 0 ? (
                  <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderTop: "1px solid color-mix(in srgb, var(--wash) 06%, transparent)" }}>
                    <div className="flex-1">
                      <div className="text-xs font-semibold" style={{ fontFamily: F.b }}>{t("pr.blendEmpty")}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.b }}>{t("home.friendsEmptySub")}</div>
                    </div>
                    <button
                      onClick={async () => { const link = `https://myra.app/i/${genInviteCode()}`; await copyText(link); toast(t("bl.invited", link)); }}
                      className="text-[10px] px-2.5 py-1.5 rounded-full flex-shrink-0"
                      style={{ background: `${c2}1e`, color: c2, fontFamily: F.b }}
                    >
                      {t("bl.invite")}
                    </button>
                  </div>
                ) : FRIENDS.slice(0, 2).map(f => (
                  <div key={f.name} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: "1px solid color-mix(in srgb, var(--wash) 06%, transparent)" }}>
                    <img src={f.img} alt="" className="w-8 h-8 rounded-full object-cover" />
                    <div className="flex-1">
                      <div className="text-xs font-semibold" style={{ fontFamily: F.b }}>{t("pr.blendWith", lang === "ru" ? f.inst : f.en)}</div>
                      <div className="text-[10px]" style={{ color: "color-mix(in srgb, var(--fg) 35%, transparent)", fontFamily: F.m }}>{t("pr.match", f.match)}</div>
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
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)" }}><Globe size={15} /></div>
          <div className="flex-1 text-sm" style={{ fontFamily: F.b }}>{t("pr.lang")}</div>
          <div className="flex gap-1 p-1 rounded-full" style={{ background: "color-mix(in srgb, var(--wash) 06%, transparent)" }}>
            {(["ru", "en"] as Lang[]).map(l => (
              <span key={l} className="relative px-2.5 py-1 rounded-full text-[11px] font-bold uppercase" style={{ fontFamily: F.m, color: lang === l ? "#fff" : "color-mix(in srgb, var(--fg) 40%, transparent)" }}>
                {lang === l && <motion.span layoutId="langpill" className="absolute inset-0 rounded-full" style={{ background: c2 }} transition={SPRING} />}
                <span className="relative z-10">{l}</span>
              </span>
            ))}
          </div>
        </motion.div>

        <motion.div whileTap={{ scale: 0.99 }} className="flex items-center gap-3 px-4 py-3.5 rounded-2xl cursor-pointer" style={GLASS} onClick={onOpenAccount}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)" }}><Settings size={15} /></div>
          <div className="flex-1 text-sm" style={{ fontFamily: F.b }}>{t("pr.account")}</div>
          <ChevronRight size={15} style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }} />
        </motion.div>

        {/* Панель разработчика — появляется после 7 тапов по аватару */}
        {devMode && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.99 }} className="flex items-center gap-3 px-4 py-3.5 rounded-2xl cursor-pointer" style={{ ...GLASS, border: "1px solid rgba(244,114,182,0.35)" }} onClick={onOpenDevPanel}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(244,114,182,0.12)" }}><Wrench size={15} style={{ color: "#f472b6" }} /></div>
            <div className="flex-1 text-sm" style={{ fontFamily: F.b }}>{t("dev.row")}</div>
            <ChevronRight size={15} style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }} />
          </motion.div>
        )}

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
});

function SettingRow({ icon, label, sub, children }: { icon: React.ReactNode; label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl" style={GLASS}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)" }}>{icon}</div>
      <div className="flex-1">
        <div className="text-sm" style={{ fontFamily: F.b }}>{label}</div>
        {sub && <div className="text-[10px] mt-0.5" style={{ color: "color-mix(in srgb, var(--fg) 35%, transparent)", fontFamily: F.m }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function Mic2Icon() {
  return <Mic2 size={12} />;
}

// ─── Вывод средств артиста ────────────────────────────────────────────────────

export function WithdrawSheet({ open, onClose, balance, c2, onDone }: {
  open: boolean; onClose: () => void; balance: number; c2: string; onDone: (amt: number) => void;
}) {
  const { t } = useLang();
  const [amt, setAmt] = useState("");
  const [method, setMethod] = useState<"card" | "sbp">("card");
  const [state, setState] = useState<"form" | "processing" | "done">("form");
  const val = Math.min(balance, parseInt(amt) || 0);

  const reset = () => { setState("form"); setAmt(""); };
  const submit = () => {
    if (val < 100) { toast(t("wd.min")); return; }
    setState("processing");
    setTimeout(() => { onDone(val); setState("done"); }, 1300);
  };

  return (
    <Sheet open={open} onClose={() => { onClose(); setTimeout(reset, 300); }} z={64} center>
      <div className="p-6">
        {state === "done" ? (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SPRING} className="text-center py-4">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(52,211,153,0.13)", border: "1.5px solid rgba(52,211,153,0.4)" }}>
              <Check size={26} style={{ color: "#34d399" }} />
            </div>
            <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 19 }}>{t("wd.done", val.toLocaleString("ru-RU"))}</div>
            <div className="text-xs mt-2 mb-5" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("wd.doneSub")}</div>
            <motion.button whileTap={{ scale: 0.96 }} onClick={() => { onClose(); reset(); }} className="px-8 py-3 rounded-full text-sm font-semibold" style={{ background: `linear-gradient(135deg, ${c2}, ${c2}99)`, color: "#fff", fontFamily: F.b }}>{t("cp.great")}</motion.button>
          </motion.div>
        ) : (
          <>
            <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 20, letterSpacing: "-0.02em" }}>{t("wd.title")}</div>
            <div className="text-xs mt-1 mb-4" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("wd.balance", balance.toLocaleString("ru-RU"))}</div>
            <div className="flex gap-2 mb-3">
              {(["card", "sbp"] as const).map(m => (
                <button key={m} onClick={() => setMethod(m)} className="flex-1 py-2.5 rounded-2xl text-xs font-semibold" style={{ background: method === m ? `${c2}22` : "color-mix(in srgb, var(--wash) 6%, transparent)", border: `1px solid ${method === m ? c2 + "55" : "transparent"}`, color: method === m ? c2 : "color-mix(in srgb, var(--fg) 55%, transparent)", fontFamily: F.b }}>
                  {m === "card" ? t("wd.card") : t("wd.sbp")}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mb-4">
              <input value={amt} onChange={e => setAmt(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder={t("wd.amount")} inputMode="numeric" className="flex-1 px-4 py-3 rounded-2xl bg-transparent outline-none text-sm min-w-0" style={{ ...GLASS, color: "var(--fg)", fontFamily: F.b }} />
              <button onClick={() => setAmt(String(balance))} className="px-4 rounded-2xl text-xs font-semibold flex-shrink-0" style={{ ...GLASS, color: c2, fontFamily: F.b }}>{t("wd.all")}</button>
            </div>
            <motion.button whileTap={{ scale: 0.97 }} disabled={state === "processing"} onClick={submit} className="w-full py-3.5 rounded-full text-sm font-bold" style={{ background: val >= 100 ? `linear-gradient(135deg, ${c2}, ${c2}99)` : "color-mix(in srgb, var(--wash) 6%, transparent)", color: val >= 100 ? "#fff" : "color-mix(in srgb, var(--fg) 30%, transparent)", fontFamily: F.b }}>
              {state === "processing" ? t("wd.processing") : t("wd.send", val ? val.toLocaleString("ru-RU") : "0")}
            </motion.button>
            <div className="text-[10px] text-center mt-3" style={{ color: "color-mix(in srgb, var(--fg) 35%, transparent)", fontFamily: F.m }}>{t("wd.fee")}</div>
            {/* Честная подпись: реальных выплат до подключения платёжного провайдера нет */}
            <div className="text-[10px] text-center mt-1.5" style={{ color: "color-mix(in srgb, var(--fg) 35%, transparent)", fontFamily: F.m }}>{t("wd.simNote")}</div>
          </>
        )}
      </div>
    </Sheet>
  );
}
