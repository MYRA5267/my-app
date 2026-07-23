import React, { useState, useEffect, useRef, useCallback, useMemo, useDeferredValue } from "react";
import {
  Play, Pause, Heart, Search, Mic2, Upload, BarChart3, Plus, ChevronRight,
  Volume2, Globe, Bell, Check, Download, X, Users, Music2,
  Zap, Radio, Moon, Dumbbell, Car, Brain, LogOut, TrendingUp, Wallet,
  Blend as BlendIcon, Crown, Trash2, FileAudio, Sun, Sparkles,
  Trophy, Clock, Flame, Gift, UserPlus, Headphones, Wrench, Lock,
  SlidersHorizontal, CircleUserRound, Cast, ChevronDown, type LucideIcon,
} from "./myraIcons";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { TRACKS, ARTISTS, FRIENDS, PLAYLISTS, GENRE_TILES, LEADERBOARD_PEERS, AVATARS, svgCover, trackFromRow, ls, type Track, type Friend } from "./data";
import { F, GLASS, SPRING, TiltCard, Aurora, EQ, Toggle, ConfirmSheet, Page, Sheet, useTheme, useProgress, ON_DARK, onDark, InteractiveChart, copyText, genInviteCode } from "./lib";
import { DetailBackdrop, DetailWave } from "./detail";
import { useLang, type Lang } from "./i18n";
// Алиас: track повсеместно используется как имя лямбда-параметра (TRACKS.filter(track=>…)).
import { track as trackEvent } from "./analytics";
import { lastNDays, isMonthEndWindow, type ActivityItem } from "./stats";
import { MyraBrandLockup } from "./logo";
import { MyraGlyph, MyraVerifiedBadge, type MyraGlyphName } from "./myraIcons";
import type { UserRole } from "./auth";
import {
  supabaseEnabled, paymentsEnabled, fetchRecentTracks,
  fetchCreatorVerificationRequest, submitCreatorVerificationRequest,
  type CreatorVerificationStatus, type CommunityTrackRow, type FriendFeedItem, type PublicProfile,
} from "./supabase";
import type { SmartPick } from "./smart";
import { ProfileIdentityShowcase, companionLevel, RESONANCES, type CompanionController } from "./companion";

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

function DiscoveryDeck({ onPlay, onLike, tracks }: { onPlay: (t: Track) => void; onLike: (id: number) => void; tracks: Track[] }) {
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

  const deck = useMemo(() => (tracks.length ? tracks : TRACKS).slice(0, 6), [tracks]);
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
  "ach.unlocked": Trophy,
};

/** Компактная запись счётчика: 2400 → "2.4K" */
export const fmtCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K` : String(n));

// Счётчик: целое число плавно набегает от 0 при появлении. Строки/дробные
// значения (например «1.2K», «1 234₽», «—») выводятся как есть — не ломаем
// форматирование. Одноразовый rAF (не бесконечный луп); на слабом железе
// (fx-simple) и при prefers-reduced-motion сразу показываем итог.
function CountUp({ value, duration = 0.9 }: { value: number | string; duration?: number }) {
  const reduced = useReducedMotion();
  const weak = typeof document !== "undefined" && !!document.querySelector(".fx-simple");
  const target = typeof value === "number"
    ? value
    : (/^\d+$/.test(String(value).trim()) ? parseInt(String(value), 10) : null);
  const animatable = target !== null && !reduced && !weak;
  const [display, setDisplay] = useState<number | null>(animatable ? 0 : null);
  useEffect(() => {
    if (!animatable || target === null) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animatable, target, duration]);
  if (target === null) return <>{value}</>;
  return <>{animatable ? (display ?? target) : target}</>;
}

function SectionHeading({ title, sub, action, onAction }: { title: string; sub?: string; action?: string; onAction?: () => void }) {
  // Секция мягко въезжает, когда попадает в зону видимости (один раз). На слабом
  // железе и при prefers-reduced-motion эффект отключается.
  const reduced = useReducedMotion();
  const weak = typeof document !== "undefined" && !!document.querySelector(".fx-simple");
  const animate = !reduced && !weak;
  return (
    <motion.div
      className="myra-section-heading"
      initial={animate ? { opacity: 0, y: 16 } : false}
      whileInView={animate ? { opacity: 1, y: 0 } : undefined}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
    >
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {action && onAction && (
        <button onClick={onAction}>{action}<MyraGlyph name="arrow" size={15} /></button>
      )}
    </motion.div>
  );
}

const ReleaseCard = React.memo(function ReleaseCard({ track, reason, active, playing, onPlay, onArtist }: {
  track: Track; reason?: string; active?: boolean; playing?: boolean;
  onPlay: (track: Track) => void; onArtist?: (name: string) => void;
}) {
  return (
    <article className={`myra-release-card${active ? " is-active" : ""}`} style={{ "--release-accent": track.c2 } as React.CSSProperties}>
      <span className="myra-release-orbit" aria-hidden="true" />
      <button className="myra-release-cover" onClick={() => onPlay(track)} aria-label={`${track.title} — ${track.artist}`}>
        <img src={track.img} alt="" loading="lazy" decoding="async" />
        <span className="myra-release-shade" />
        {reason && <span className="myra-release-reason"><MyraGlyph name="spark" size={11} />{reason}</span>}
        <span className="myra-release-play">
          {active && playing ? <EQ color="#fff" size={13} /> : <MyraGlyph name="play" size={18} strokeWidth={2.15} />}
        </span>
      </button>
      <div className="myra-release-meta">
        <button className="myra-release-title" onClick={() => onPlay(track)}>{track.title}</button>
        <button className="myra-release-artist" onClick={() => onArtist?.(track.artist)}>{track.artist}</button>
        <span>{track.genre}</span>
      </div>
    </article>
  );
});

const PremiumTrackRow = React.memo(function PremiumTrackRow({ track, active, playing, onPlay, onArtist, trailing }: {
  track: Track; active?: boolean; playing?: boolean; onPlay: (track: Track) => void;
  onArtist?: (name: string) => void; trailing?: React.ReactNode;
}) {
  return (
    <div
      className={`myra-track-row${active ? " is-active" : ""}`}
      onClick={() => onPlay(track)}
      onKeyDown={event => {
        if (event.currentTarget !== event.target) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onPlay(track);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${track.title} — ${track.artist}`}
    >
      <div className="myra-track-row-cover">
        <img src={track.img} alt="" loading="lazy" decoding="async" />
        <span>{active && playing ? <EQ color="#fff" size={11} /> : <MyraGlyph name="play" size={13} strokeWidth={2.15} />}</span>
      </div>
      <div className="myra-track-row-copy">
        <strong>{track.title}</strong>
        <button onClick={event => { event.stopPropagation(); onArtist?.(track.artist); }}>{track.artist}</button>
      </div>
      <span className="myra-track-row-genre">{track.genre}</span>
      <span className="myra-track-row-duration">{track.duration}</span>
      {trailing && <div className="myra-track-row-trailing" onClick={event => event.stopPropagation()}>{trailing}</div>}
    </div>
  );
});

/** Реальное относительное время из timestamp'а события */
function relTimeParts(ts: number): [number, string] {
  const mins = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (mins < 60) return [mins, "time.min"];
  const hours = Math.round(mins / 60);
  if (hours < 24) return [hours, "time.h"];
  return [Math.round(hours / 24), "time.d"];
}

/** Одна карточка ленты подписок: реальный трек реального человека, на которого подписан пользователь */
function FriendFeedRow({ item, currentTrack, playing, onPlay, onPause, onOpenProfile }: {
  item: FriendFeedItem; currentTrack: Track; playing: boolean;
  onPlay: (track: Track) => void; onPause: () => void; onOpenProfile: (p: PublicProfile) => void;
}) {
  const { t } = useLang();
  const owner = item.owner;
  const track = useMemo(() => trackFromRow(item, owner?.username ?? "?"), [item, owner?.username]);
  const isPlaying = currentTrack.remoteId === item.id && playing;
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
        onClick={() => (isPlaying ? onPause() : onPlay(track))}
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: `linear-gradient(135deg, ${track.c2}, color-mix(in srgb, ${track.c2} 68%, white))` }}
      >
        {isPlaying ? <Pause size={13} fill="white" stroke="none" /> : <Play size={13} fill="white" stroke="none" className="ml-0.5" />}
      </motion.button>
    </div>
  );
}

// Волна hero-карточки подписана на прогресс через контекст — прогресс не
// попадает в пропсы HomeScreen, и главная не перерисовывается каждый тик.
// Поток частиц вместо баров: органичнее и дешевле для WebView-композитора
function HeroWave({ playing, accent, buffered }: { playing: boolean; accent: string; buffered: number }) {
  const progress = useProgress();
  return <DetailWave progress={progress} buffered={buffered} playing={playing} accent={accent} height={28} compact />;
}

export const HomeScreen = React.memo(function HomeScreen({ onPlay, currentTrack, playing, buffered, onNavigate, onOpenBlend, onOpenRooms, onPlayWave, onPlayRadio, onLikeTrack, onPauseMain, onOpenArtist, onOpenRealArtist, avatar, activity, friendsFeed, onOpenPeopleSearch, onOpenRealProfile, uid, recommendations }: {
  onPlay: (t: Track) => void; currentTrack: Track; playing: boolean; buffered: number; onNavigate: (tab: string) => void;
  onOpenBlend: (f: Friend) => void; onOpenRooms: () => void; onPlayWave: () => void; onPlayRadio: () => void;
  onLikeTrack: (id: number) => void; onPauseMain: () => void; onOpenArtist: (name: string) => void;
  onOpenRealArtist: (id: string) => void; avatar: string;
  activity: ActivityItem[];
  friendsFeed: FriendFeedItem[]; onOpenPeopleSearch: () => void; onOpenRealProfile: (p: PublicProfile) => void;
  uid: string | null;
  recommendations: SmartPick[];
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
  const waveActive = playing;
  const pulsePeople = useMemo(() => {
    const unique = new Map<string, FriendFeedItem>();
    friendsFeed.forEach(item => {
      if (item.owner && !unique.has(item.owner_id)) unique.set(item.owner_id, item);
    });
    return Array.from(unique.values()).slice(0, 6);
  }, [friendsFeed]);

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

  const QUICK: { label: string; glyph: MyraGlyphName; act: () => void; a: string; b: string }[] = [
    { label: t("home.liked"),  glyph: "heart", act: () => onNavigate("library"), a: "#ff6fa5", b: "#c98cff" },
    { label: t("home.charts"), glyph: "chart", act: () => onNavigate("rating"), a: "#f4a77f", b: "#ffd28a" },
    { label: t("home.radio"),  glyph: "radio", act: onPlayRadio, a: "#5ee7ac", b: "#67d7ff" },
    { label: t("home.blend"),  glyph: "blend", act: () => (FRIENDS[0] ? onOpenBlend(FRIENDS[0]) : inviteBlend()), a: "#9a8cff", b: "#67d7ff" },
  ];

  return (
    <Page className="myra-experience-page myra-home-page">
      {/* Верхняя панель */}
      <div className="myra-page-header px-5 pt-6 pb-5 flex items-center justify-between">
        <div className="lg:hidden"><MyraBrandLockup /></div>
        <div className="hidden lg:block myra-desktop-page-title"><span>MYRA / 01</span>{t("nav.home")}</div>
        <div className="flex gap-2 relative items-center">
          <motion.button whileTap={{ scale: 0.85 }} onClick={toggleNotifs} className="myra-header-action w-10 h-10 rounded-full flex items-center justify-center relative">
            <MyraGlyph name="bell" size={17} />
            {hasUnread && <span className="absolute top-2 right-2.5 w-1.5 h-1.5 rounded-full" style={{ background: currentTrack.c2 }} />}
          </motion.button>
          <motion.button whileTap={{ scale: 0.9 }} aria-label={t("nav.profile")} className="w-10 h-10 rounded-full flex-shrink-0" onClick={() => onNavigate("profile")}>
            <img src={avatar} alt="" className="w-10 h-10 rounded-full object-cover" style={{ border: `1.5px solid ${currentTrack.c2}66` }} />
          </motion.button>
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
                    <button type="button" key={item.id} className="flex items-center gap-3 px-4 py-3 w-full text-left cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setNotifOpen(false)}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${currentTrack.c2}1e` }}>
                        <Icon size={14} style={{ color: currentTrack.c2 }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs" style={{ color: "color-mix(in srgb, var(--fg) 85%, transparent)", fontFamily: F.b }}>{t(item.textKey, ...item.args)}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: "color-mix(in srgb, var(--fg) 32%, transparent)", fontFamily: F.m }}>{t("notif.ago", `${val} ${t(unitKey)}`)}</div>
                      </div>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Hero: Прилив */}
      <div className="myra-home-hero px-5 mb-7">
        <TiltCard
          max={5}
          className="myra-home-flow relative rounded-[28px] overflow-hidden cursor-pointer"
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
          {/* DETAIL вместо фиксированной Aurora — hero-блок теперь несёт фирменный
              мотив, но заметно тише Full Player (variant="soft"), чтобы не спорить
              с текстом/карточками (см. план, раздел 5) */}
          <DetailBackdrop variant="soft" accent="#8b5cf6" active={waveActive} />
          <div className="myra-home-flow-main relative z-10 flex items-center justify-between p-6">
            <div className="myra-home-flow-copy">
              <h1 className="myra-hero-word" style={{ fontFamily: F.d, fontWeight: 900, fontSize: 46, letterSpacing: "-0.045em", lineHeight: 0.95 }}>{t("home.wave")}</h1>
              <p style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.35, maxWidth: 190, color: "color-mix(in srgb, var(--fg) 58%, transparent)", fontFamily: F.b }}>
                {waveActive ? `${currentTrack.title} · ${currentTrack.artist}` : t("home.flowSub")}
              </p>
            </div>
            <div className="myra-home-flow-art" style={{ "--flow-color": currentTrack.c2 } as React.CSSProperties}>
              <img src={currentTrack.img} alt="" />
              <motion.span whileTap={{ scale: 0.88 }}>
                {waveActive ? <Pause size={22} fill="white" stroke="none" /> : <Play size={22} fill="white" stroke="none" className="ml-1" />}
              </motion.span>
            </div>
          </div>
          <div className="relative z-10 px-6 pb-5">
            <HeroWave playing={playing} accent={currentTrack.c2} buffered={buffered} />
          </div>
        </TiltCard>
      </div>

      {/* Поиск */}
      <div className="px-5 mb-7">
        <button onClick={() => onNavigate("browse")} className="myra-home-search w-full flex items-center gap-3 px-4 py-3.5 rounded-[18px] text-left">
          <MyraGlyph name="search" size={17} />
          <span className="text-sm" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("home.search")}</span>
        </button>
      </div>

      {/* Быстрые действия */}
      <div className="myra-quick-grid px-5 mb-8 grid grid-cols-4 gap-2.5">
        {QUICK.map((q, i) => {
          return (
            <motion.button
              key={q.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.05, ...SPRING }}
              whileTap={{ scale: 0.93 }}
              onClick={q.act}
              className="myra-quick-action flex flex-col items-center gap-2 py-4 rounded-[20px]"
              style={{ background: `linear-gradient(160deg, ${q.a}22, ${q.b}0a)`, border: `1px solid ${q.a}3a` }}
            >
              <span className="flex items-center justify-center" style={{ width: 38, height: 38, borderRadius: 13, background: `radial-gradient(circle at 50% 28%, ${q.a}, ${q.b})`, color: "#160f26", boxShadow: `0 8px 20px ${q.a}55` }}><MyraGlyph name={q.glyph} size={19} /></span>
              <span className="text-[11px] font-semibold" style={{ color: "color-mix(in srgb, var(--fg) 82%, transparent)", fontFamily: F.b }}>{q.label}</span>
            </motion.button>
          );
        })}
      </div>

      <section className="myra-content-section px-5 mb-9">
        <SectionHeading title={t("home.forYou")} sub={t("home.forYouSub")} action={t("home.all")} onAction={() => onNavigate("browse")} />
        <div className="myra-release-grid">
          {recommendations.slice(0, 6).map(item => (
            <ReleaseCard
              key={item.track.id}
              track={item.track}
              reason={item.reason}
              active={currentTrack.id === item.track.id}
              playing={playing}
              onPlay={onPlay}
              onArtist={onOpenArtist}
            />
          ))}
        </div>
      </section>

      {/* Дека */}
      <div className="myra-content-section myra-discovery-section px-5 mb-8">
        <div className="myra-section-heading" style={{ alignItems: "center" }}>
          <h2>{t("home.discover")}</h2>
          <span className="text-[10px]" style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)", fontFamily: F.m }}>{t("home.swipeHint")}</span>
        </div>
        <DiscoveryDeck onPlay={onPlay} onLike={onLikeTrack} tracks={recommendations.map(item => item.track)} />
      </div>

      {/* Релизы сообщества — реальные треки реальных пользователей MYRA.
          Список PremiumTrackRow, а не та же сетка ReleaseCard, что и «Для тебя»
          чуть выше: секции подряд не должны выглядеть одинаковой каруселью */}
      {supabaseEnabled && communityTracks.length > 0 && (
        <div className="myra-content-section px-5 mb-8">
          <SectionHeading title={t("home.community")} />
          <div className="flex flex-col gap-1">
            {communityTracks.map(row => {
              const artistName = row.profiles?.username ?? "?";
              const tr = trackFromRow(row, artistName);
              return (
                <PremiumTrackRow
                  key={row.id}
                  track={tr}
                  active={currentTrack.id === tr.id}
                  playing={playing}
                  onPlay={onPlay}
                  onArtist={() => onOpenRealArtist(row.owner_id)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* «Между» объединяет людей, их свежие релизы и совместные комнаты в одну
          социальную поверхность. Здесь нет демонстрационных аккаунтов: только
          реальные профили и треки из Supabase. */}
      <section className="myra-pulse-shell mx-5 mb-8" style={{ "--pulse-accent": currentTrack.c2 } as React.CSSProperties}>
        <header className="myra-pulse-header">
          <div>
            <span>МУЗЫКА МЕЖДУ НАМИ</span>
            <h2>{t("soc.feedTitle")}</h2>
            <p>{t("soc.pulseSub")}</p>
          </div>
          <button onClick={onOpenPeopleSearch} aria-label={t("soc.findPeople")}>
            <MyraGlyph name="search" size={16} />
          </button>
        </header>

        {pulsePeople.length > 0 && (
          <div className="myra-pulse-people" aria-label={t("soc.liveNow")}>
            {pulsePeople.map(item => (
              <button
                key={item.owner_id}
                onClick={() => item.owner && onOpenRealProfile({ id: item.owner_id, username: item.owner.username, handle: item.owner.handle, avatar_url: item.owner.avatar_url, role: item.owner.role })}
                aria-label={item.owner?.username ?? ""}
              >
                <span><img src={item.owner?.avatar_url || item.cover_url || AVATARS[0]} alt="" /></span>
                <small>{item.owner?.username ?? "?"}</small>
              </button>
            ))}
          </div>
        )}

        <div className="myra-pulse-feed">
          {friendsFeed.length === 0 ? (
            <button onClick={onOpenPeopleSearch} className="myra-pulse-empty">
              <span><UserPlus size={17} /></span>
              <div><strong>{t("soc.feedEmpty")}</strong><small>{t("soc.feedEmptySub")}</small></div>
              <MyraGlyph name="arrow" size={16} />
            </button>
          ) : (
            friendsFeed.slice(0, 8).map(item => (
              <FriendFeedRow key={item.id} item={item} currentTrack={currentTrack} playing={playing} onPlay={onPlay} onPause={onPauseMain} onOpenProfile={onOpenRealProfile} />
            ))
          )}
        </div>
        <button onClick={onOpenRooms} className="myra-pulse-room">
          <span><MyraGlyph name="rooms" size={17} /></span>
          <div><strong>{t("room.entry")}</strong><small>{t("room.entrySub")}</small></div>
          <MyraGlyph name="arrow" size={16} />
        </button>
      </section>

      {/* Продолжить — срез (6, 10), а не (2, 8): раньше он пересекался с «Для
          тебя» (0, 6), и один и тот же трек мог оказаться в обеих секциях сразу.
          На маленьком демо-каталоге секция честно короче без загруженных треков */}
      <div className="myra-content-section px-5 mb-6">
        <SectionHeading title={t("home.continue")} action={t("home.all")} onAction={() => onNavigate("library")} />
        <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {recommendations.slice(6, 10).map(({ track: tr }) => (
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

// ─── Между ────────────────────────────────────────────────────────────────────

export const BetweenScreen = React.memo(function BetweenScreen({ currentTrack, playing, friendsFeed, uid, onPlay, onPause, onOpenPeopleSearch, onOpenRealProfile, onOpenRealArtist, onOpenRooms }: {
  currentTrack: Track; playing: boolean; friendsFeed: FriendFeedItem[]; uid: string | null;
  onPlay: (track: Track) => void; onPause: () => void; onOpenPeopleSearch: () => void;
  onOpenRealProfile: (profile: PublicProfile) => void; onOpenRealArtist: (id: string) => void; onOpenRooms: () => void;
}) {
  const { t } = useLang();
  const [feed, setFeed] = useState<"near" | "open">("near");
  const [communityTracks, setCommunityTracks] = useState<CommunityTrackRow[]>([]);
  const nearbyPeople = useMemo(() => {
    const unique = new Map<string, FriendFeedItem>();
    friendsFeed.forEach(item => {
      if (item.owner && !unique.has(item.owner_id)) unique.set(item.owner_id, item);
    });
    return Array.from(unique.values()).slice(0, 10);
  }, [friendsFeed]);

  useEffect(() => {
    if (!supabaseEnabled) { setCommunityTracks([]); return; }
    fetchRecentTracks(uid ?? undefined).then(({ data }) => setCommunityTracks(data));
  }, [uid]);

  return (
    <Page className="myra-experience-page myra-between-page">
      <header className="myra-page-header px-5 pt-6 pb-5">
        <div className="lg:hidden"><MyraBrandLockup /></div>
        <div className="hidden lg:block myra-desktop-page-title"><span>MYRA / 03</span>{t("nav.between")}</div>
      </header>

      <section className="myra-between-hero mx-5 mb-6" style={{ "--between-accent": currentTrack.c2 } as React.CSSProperties}>
        <DetailBackdrop variant="soft" accent={currentTrack.c2} active={playing} />
        <div className="relative z-10">
          <span>{t("between.eyebrow")}</span>
          <h1>{t("between.title")}</h1>
          <p>{t("between.sub")}</p>
          <div className="myra-between-hero-actions">
            <button onClick={onOpenPeopleSearch}><MyraGlyph name="search" size={16} />{t("soc.findPeople")}</button>
            <button onClick={onOpenRooms}><MyraGlyph name="rooms" size={16} />{t("room.entry")}</button>
          </div>
        </div>
      </section>

      {nearbyPeople.length > 0 && (
        <section className="mx-5 mb-5">
          <div className="myra-section-heading"><h2>{t("between.people")}</h2></div>
          <div className="myra-pulse-people myra-between-people" aria-label={t("between.people")}>
            {nearbyPeople.map(item => (
              <button key={item.owner_id} onClick={() => item.owner && onOpenRealProfile({ id: item.owner_id, username: item.owner.username, handle: item.owner.handle, avatar_url: item.owner.avatar_url, role: item.owner.role })}>
                <span><img src={item.owner?.avatar_url || item.cover_url || AVATARS[0]} alt="" loading="lazy" decoding="async" /></span>
                <small>{item.owner?.username ?? "?"}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="myra-pulse-shell myra-between-feed mx-5 mb-8" style={{ "--pulse-accent": currentTrack.c2 } as React.CSSProperties}>
        <div className="myra-between-tabs" role="tablist" aria-label={t("nav.between")}>
          <button role="tab" aria-selected={feed === "near"} data-active={feed === "near" || undefined} onClick={() => setFeed("near")}>{t("between.near")}</button>
          <button role="tab" aria-selected={feed === "open"} data-active={feed === "open" || undefined} onClick={() => setFeed("open")}>{t("between.open")}</button>
        </div>

        {feed === "near" ? (
          <div className="myra-pulse-feed">
            {friendsFeed.length === 0 ? (
              <button onClick={onOpenPeopleSearch} className="myra-pulse-empty">
                <span><UserPlus size={17} /></span>
                <div><strong>{t("soc.feedEmpty")}</strong><small>{t("soc.feedEmptySub")}</small></div>
                <MyraGlyph name="arrow" size={16} />
              </button>
            ) : friendsFeed.map(item => (
              <FriendFeedRow key={item.id} item={item} currentTrack={currentTrack} playing={playing} onPlay={onPlay} onPause={onPause} onOpenProfile={onOpenRealProfile} />
            ))}
          </div>
        ) : (
          <div className="myra-pulse-feed">
            {communityTracks.length === 0 ? (
              <div className="myra-between-empty">
                <MyraGlyph name="between" size={21} />
                <strong>{t("between.openEmpty")}</strong>
                <small>{t("between.openEmptySub")}</small>
              </div>
            ) : communityTracks.map(row => {
              const track = trackFromRow(row, row.profiles?.username ?? "?");
              return (
                <PremiumTrackRow key={row.id} track={track} active={currentTrack.remoteId === row.id} playing={playing} onPlay={onPlay} onArtist={() => onOpenRealArtist(row.owner_id)} />
              );
            })}
          </div>
        )}

        <button onClick={onOpenRooms} className="myra-pulse-room">
          <span><MyraGlyph name="rooms" size={17} /></span>
          <div><strong>{t("room.entry")}</strong><small>{t("room.entrySub")}</small></div>
          <MyraGlyph name="arrow" size={16} />
        </button>
      </section>
    </Page>
  );
});

// ─── Обзор ────────────────────────────────────────────────────────────────────

export const BrowseScreen = React.memo(function BrowseScreen({ onPlay, onOpenArtist, autoFocus }: { onPlay: (t: Track) => void; onOpenArtist: (name: string) => void; autoFocus?: boolean }) {
  const { t } = useLang();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLocaleLowerCase();
  const filtered = useMemo(() => normalizedQuery
    ? TRACKS.filter(track => `${track.title} ${track.artist} ${track.album} ${track.genre}`.toLocaleLowerCase().includes(normalizedQuery))
    : [], [normalizedQuery]);

  // search — один раз на старт сессии поиска (переход пусто→непусто), с числом
  // результатов; сам запрос НЕ отправляется (это пользовательский текст). Сброс
  // на очистке поля позволяет засчитать следующий поиск.
  const searchedRef = useRef(false);
  useEffect(() => {
    if (normalizedQuery && !searchedRef.current) {
      searchedRef.current = true;
      trackEvent({ name: "search", resultCount: filtered.length });
    } else if (!normalizedQuery) {
      searchedRef.current = false;
    }
  }, [normalizedQuery, filtered.length]);

  const MOODS = [
    { label: t("mood.focus"),   icon: Brain,    track: TRACKS[3] },
    { label: t("mood.workout"), icon: Dumbbell, track: TRACKS[1] },
    { label: t("mood.road"),    icon: Car,      track: TRACKS[2] },
    { label: t("mood.sleep"),   icon: Moon,     track: TRACKS[4] },
    { label: t("mood.energy"),  icon: Zap,      track: TRACKS[5] },
  ];

  return (
    <Page className="myra-experience-page myra-search-page">
      <header className="myra-search-hero px-5 pt-7 pb-5">
        <span className="myra-page-eyebrow">MYRA DISCOVERY</span>
        <h1>{t("browse.eyebrow")}</h1>
        <p>{t("browse.subtitle")}</p>
        <div className="myra-search-field mt-5 flex items-center gap-3 px-4 py-3.5 rounded-[18px]">
          <MyraGlyph name="search" size={20} />
          <input
            autoFocus={autoFocus}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t("browse.search")}
            className="flex-1 bg-transparent outline-none"
            style={{ color: "var(--fg)", fontFamily: F.b }}
          />
          {query && <button onClick={() => setQuery("")} aria-label={t("a11y.clear")}><X size={16} /></button>}
        </div>
      </header>

      <div className="myra-mood-strip px-5 mb-8">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {MOODS.map(m => {
            const Icon = m.icon;
            return (
              <motion.button key={m.label} whileTap={{ scale: 0.96 }} onClick={() => { onPlay(m.track); toast(t("browse.mixStarted", m.label)); }} className="myra-mood-chip flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-medium" style={{ "--mood-color": m.track.c2 } as React.CSSProperties}>
                <Icon size={13} style={{ color: m.track.c2 }} />
                {m.label}
              </motion.button>
            );
          })}
        </div>
      </div>

      {query ? (
        <div className="myra-content-section px-5">
          <SectionHeading title={t("browse.found", filtered.length)} />
          {filtered.length > 0 ? (
            <div className="myra-release-grid myra-search-results">
              {filtered.map(track => (
                <ReleaseCard key={track.id} track={track} onPlay={onPlay} onArtist={onOpenArtist} />
              ))}
            </div>
          ) : (
            <div className="myra-empty-state"><Search size={24} /><span>{t("browse.noResults")}</span></div>
          )}
        </div>
      ) : (
        <>
          <div className="myra-content-section px-5 mb-8">
            <SectionHeading title={t("browse.talents")} sub={t("browse.talentsSub")} />
            <div className="myra-talent-strip">
              {ARTISTS.slice(0, 6).map((artist, index) => (
                <motion.button
                  key={artist.name}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onOpenArtist(artist.name)}
                  className="myra-talent-card"
                  style={{ "--talent-accent": artist.c2 } as React.CSSProperties}
                >
                  <span className="myra-talent-index">0{index + 1}</span>
                  <img src={artist.img} alt="" loading="lazy" decoding="async" />
                  <span className="myra-talent-copy">
                    <strong style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      {artist.name}
                      {artist.verified && <MyraVerifiedBadge size={15} accent={artist.c2} />}
                    </strong>
                    <small>{artist.genre} · {t("ar.listenersShort", artist.listeners)}</small>
                  </span>
                  <MyraGlyph name="arrow" size={15} />
                </motion.button>
              ))}
            </div>
          </div>

          <div className="myra-content-section px-5 mb-6">
            <SectionHeading title={t("browse.genres")} />
            <div className="myra-genre-river">
              {GENRE_TILES.map(([g, c], i) => (
                <motion.button
                  key={g}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setQuery(g)}
                  className="myra-genre-tile"
                  style={{ "--genre-accent": c, "--genre-shift": `${i * -0.7}s` } as React.CSSProperties}
                >
                  <span className="myra-genre-membrane" aria-hidden="true" />
                  <strong>{g}</strong>
                  <MyraGlyph name="arrow" size={14} />
                </motion.button>
              ))}
            </div>
          </div>
        </>
      )}
    </Page>
  );
});

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
  const youRank = rows.findIndex(u => u.you) + 1;

  const METRICS = [
    { id: "level" as const,   label: t("rt.level"),   icon: Crown },
    { id: "minutes" as const, label: t("rt.minutes"), icon: Clock },
    { id: "streak" as const,  label: t("rt.streak"),  icon: Flame },
  ];

  const valueFor = (u: typeof rows[number]) =>
    metric === "level" ? t("rt.lvlLabel", u.level) : metric === "minutes" ? t("rt.minLabel", u.minutesWeek) : t("rt.streakLabel", u.streak);

  // Медали пьедестала — золото/серебро/бронза для топ-3 (ярче, чем плоский номер)
  const MEDALS = [["#ffd76a", "#f4a77f"], ["#e8edf5", "#9aa7bd"], ["#ffb27a", "#d98a5a"]];

  return (
    <Page className="myra-experience-page myra-rating-page">
      <div style={{ "--rating-accent": c2 } as React.CSSProperties}>
        <header className="myra-rating-header px-5 pt-7 pb-5">
          <span className="myra-page-eyebrow">MYRA RANKINGS</span>
          <h1>{t("nav.rating")}</h1>
          <p>{t("rt.subtitle")}</p>
        </header>

        {/* Личная витрина: место в общем зачёте + три метрики, которые сами
            переключают сортировку списка ниже — не дублируем отдельный таб-бар */}
        <section className="myra-rating-hero mx-5 mb-6">
          <div className="myra-rating-hero-top">
            <div className="myra-rating-hero-avatar">
              <img src={avatar} alt="" />
              <span className="myra-rating-hero-rank">#{youRank}</span>
            </div>
            <div className="min-w-0">
              <div className="myra-rating-hero-name truncate">{userName}</div>
              <div className="myra-rating-hero-tag">
                <Crown size={12} />
                {t("rt.heroRank", youRank)}
              </div>
            </div>
          </div>
          <div className="myra-rating-hero-stats">
            {METRICS.map(m => {
              const Icon = m.icon;
              const value = m.id === "level" ? level : m.id === "minutes" ? minutesWeek : streak;
              return (
                <button
                  key={m.id}
                  onClick={() => setMetric(m.id)}
                  aria-pressed={metric === m.id}
                  className={`myra-rating-hero-stat${metric === m.id ? " is-active" : ""}`}
                >
                  <Icon size={15} />
                  <strong>{value}</strong>
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {LEADERBOARD_PEERS.length === 0 && (
          <div className="myra-rating-note mx-5 mb-6">
            <Users size={18} />
            <div className="min-w-0">
              <strong>{t("rt.empty")}</strong>
              <span>{t("rt.emptySub")}</span>
            </div>
          </div>
        )}

        <div className="myra-content-section px-5 pb-6">
          <SectionHeading title={t("rt.leaderboardTitle")} />
          <div className="myra-rating-list flex flex-col gap-1.5">
            {rows.map((u, i) => {
              // "Ты" — не кликабельная строка (некуда переходить), поэтому div;
              // остальные строки реально открывают профиль соперника — button,
              // а не div с onClick, чтобы работали клавиатура и screen reader
              const rowContent = (
                <>
                  <div className="myra-rating-row-rank" style={i < 3 ? { background: `linear-gradient(140deg, ${MEDALS[i][0]}, ${MEDALS[i][1]})`, color: "#160f26", fontWeight: 900, boxShadow: `0 5px 16px ${MEDALS[i][0]}66`, border: "none" } : undefined}>{i + 1}</div>
                  <img src={u.avatar} alt="" className="myra-rating-row-avatar" />
                  <div className="myra-rating-row-copy">
                    <strong>{u.you ? `${u.name} · ${t("rt.you")}` : (lang === "ru" ? u.name : (u as any).en ?? u.name)}</strong>
                    <span>{valueFor(u)}</span>
                  </div>
                  {i < 3 && <Crown size={16} style={{ color: i === 0 ? "#facc15" : i === 1 ? "#cbd5e1" : "#fb923c", flexShrink: 0 }} />}
                  {!u.you && <ChevronRight size={15} style={{ color: "color-mix(in srgb, var(--fg) 25%, transparent)", flexShrink: 0 }} />}
                </>
              );
              return u.you ? (
                <motion.div
                  key="you"
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 8) * 0.03, layout: SPRING }}
                  className="myra-rating-row is-you"
                >
                  {rowContent}
                </motion.div>
              ) : (
                <motion.button
                  key={u.name}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ delay: Math.min(i, 8) * 0.03, layout: SPRING }}
                  className="myra-rating-row w-full text-left"
                  onClick={() => onOpenPeer(u)}
                >
                  {rowContent}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Достижения намеренно убраны с этого экрана: они скрытые — пользователь
            узнаёт о каждом только в момент открытия (тост + уведомление).
            Полный список остался в панели разработчика для проверки. */}
      </div>
    </Page>
  );
});

// ─── Медиатека ────────────────────────────────────────────────────────────────

export const LibraryScreen = React.memo(function LibraryScreen({ onPlay, onPlayTracks, likedIds, onLike, currentTrack, playing, onOpenArtist, onOpenAlbum, onOpenPlaylist, myTracks = [], onDeleteLocal, onUploadFiles, playlists = [], onCreatePlaylist, customPlIds, onDeletePlaylist, companionController }: {
  onPlay: (t: Track) => void; likedIds: Set<number>; onLike: (id: number) => void;
  onPlayTracks?: (tracks: Track[], startIndex?: number) => void;
  currentTrack: Track; playing: boolean; onOpenArtist: (name: string) => void;
  onOpenAlbum?: (album: string) => void; onOpenPlaylist?: (id: string) => void;
  myTracks?: Track[]; onDeleteLocal?: (id: number) => void; onUploadFiles?: (files: FileList | File[]) => void;
  playlists?: typeof PLAYLISTS; onCreatePlaylist?: (name: string) => void;
  customPlIds?: Set<string>; onDeletePlaylist?: (id: string) => void;
  companionController?: CompanionController;
}) {
  const { t } = useLang();
  const [tab, setTab] = useState<"liked" | "playlists" | "podcasts">("liked");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const uploadRef = useRef<HTMLInputElement>(null);
  const liked = useMemo(() => TRACKS.filter(track => likedIds.has(track.id)), [likedIds]);
  const matchesLibrary = useCallback((track: Track) => !deferredQuery || `${track.title} ${track.artist} ${track.album} ${track.genre}`.toLocaleLowerCase().includes(deferredQuery), [deferredQuery]);
  const visibleLocal = useMemo(() => myTracks.filter(matchesLibrary), [myTracks, matchesLibrary]);
  const visibleLiked = useMemo(() => liked.filter(matchesLibrary), [liked, matchesLibrary]);

  // Награда: эксклюзивный плейлист за веху спутника (2 уровень). Треки — реальные,
  // в открытых спутником жанрах (иначе премиальный срез каталога). Настоящая
  // плюшка: играет настоящую музыку, открывается за реальный прогресс.
  const compLevel = companionController ? companionLevel(companionController.state.xp).level : 1;
  const rewardUnlocked = compLevel >= 2;
  const rewardTracks = useMemo(() => {
    const genres = new Set((companionController?.state.discoveredGenres ?? []).map(g => g.toLocaleLowerCase()));
    const byGenre = TRACKS.filter(tr => genres.has(tr.genre.toLocaleLowerCase()));
    return (byGenre.length >= 4 ? byGenre : TRACKS).slice(0, 6);
  }, [companionController?.state.discoveredGenres]);

  const TABS = [
    { id: "liked" as const, label: t("lib.tracks", liked.length + myTracks.length) },
    { id: "playlists" as const, label: t("lib.playlists") },
    { id: "podcasts" as const, label: t("lib.podcasts") },
  ];

  return (
    <Page className="myra-experience-page myra-library-page">
      <header className="myra-library-header relative px-5 pt-7 pb-5 flex items-start justify-between" style={{ overflow: "hidden" }}>
        {/* Очень слабый фирменный свет только в заголовке — списки ниже без
            тяжёлых фоновых эффектов (см. план, раздел 6) */}
        <DetailBackdrop variant="soft" accent={currentTrack.c2} active={playing} />
        <div className="relative z-10">
          <span className="myra-page-eyebrow">MYRA COLLECTION</span>
          <h1>{t("nav.library")}</h1>
          <p>{t("lib.subtitle")}</p>
        </div>
        <motion.button whileTap={{ scale: 0.85 }} onClick={() => setCreateOpen(true)} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${currentTrack.c2}, ${currentTrack.c2}99)` }}>
          <MyraGlyph name="plus" size={17} />
        </motion.button>
      </header>

      <section className="grid grid-cols-3 gap-2.5 mx-5 mb-5">
        {[
          { glyph: "heart" as const, value: liked.length, label: t("lib.saved"), a: "#ff6fa5", b: "#c98cff" },
          { glyph: "download" as const, value: myTracks.length, label: t("lib.local"), a: "#5ee7ac", b: "#67d7ff" },
          { glyph: "library" as const, value: playlists.length, label: t("lib.playlists"), a: "#f4a77f", b: "#c98cff" },
        ].map((o, i) => (
          <motion.div key={o.glyph} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07, ...SPRING }} className="flex flex-col items-center text-center" style={{ borderRadius: 22, padding: "16px 8px 14px", background: `linear-gradient(158deg, ${o.a}22, ${o.b}0d)`, border: `1px solid ${o.a}38`, boxShadow: `0 12px 32px ${o.a}1c, inset 0 1px 0 rgba(255,255,255,0.06)` }}>
            <span className="flex items-center justify-center mb-2" style={{ width: 34, height: 34, borderRadius: "50%", background: `radial-gradient(circle at 50% 30%, ${o.a}, ${o.b})`, color: "#160f26", boxShadow: `0 6px 18px ${o.a}66` }}>
              <MyraGlyph name={o.glyph} size={17} />
            </span>
            <strong style={{ fontFamily: F.d, fontWeight: 900, fontSize: 30, lineHeight: 1, letterSpacing: "-0.04em", background: `linear-gradient(120deg, ${o.a}, ${o.b})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}><CountUp value={o.value} /></strong>
            <span className="mt-1.5" style={{ fontSize: 11, color: "color-mix(in srgb, var(--fg) 52%, transparent)", fontFamily: F.m }}>{o.label}</span>
          </motion.div>
        ))}
      </section>

      <div className="myra-library-search mx-5 mb-5">
        <MyraGlyph name="search" size={17} />
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder={t("lib.search")} />
        {query && <button onClick={() => setQuery("")} aria-label={t("a11y.clear")}><X size={15} /></button>}
      </div>

      <div role="tablist" aria-label={t("nav.library")} className="myra-library-tabs flex gap-1 mx-5 mb-6 p-1 rounded-full w-fit">
        {TABS.map(tb => (
          <button key={tb.id} role="tab" aria-selected={tab === tb.id} onClick={() => setTab(tb.id)} className="relative px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap" style={{ fontFamily: F.b, color: tab === tb.id ? "#fff" : "color-mix(in srgb, var(--fg) 45%, transparent)" }}>
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
                  <motion.button whileTap={{ scale: 0.98 }} onClick={() => uploadRef.current?.click()} className="w-full flex items-center gap-3 p-3.5 rounded-2xl text-left mb-2" style={GLASS}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${currentTrack.c2}1e` }}>
                      <MyraGlyph name="download" size={17} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold" style={{ fontFamily: F.b }}>{t("cr.uploadTrack")}</div>
                      <div className="text-xs mt-0.5" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.b }}>{t("cr.uploadTrackSub")}</div>
                    </div>
                  </motion.button>
                </>
              )}
              {visibleLocal.map(tr => (
                <PremiumTrackRow
                  key={tr.id}
                  track={tr}
                  active={currentTrack.id === tr.id}
                  playing={playing}
                  onPlay={onPlay}
                  trailing={onDeleteLocal && (
                    <motion.button whileTap={{ scale: 0.8 }} onClick={() => onDeleteLocal(tr.id)} className="myra-row-icon-button" aria-label={t("a11y.delete")}>
                      <Trash2 size={15} />
                    </motion.button>
                  )}
                />
              ))}
              {visibleLiked.map(tr => (
                <PremiumTrackRow
                  key={tr.id}
                  track={tr}
                  active={currentTrack.id === tr.id}
                  playing={playing}
                  onPlay={onPlay}
                  onArtist={onOpenArtist}
                  trailing={(
                    <motion.button whileTap={{ scale: 0.75 }} onClick={() => onLike(tr.id)} className="myra-row-icon-button" aria-label={t("a11y.unlike")}>
                      <Heart size={16} fill={tr.c2} stroke={tr.c2} />
                    </motion.button>
                  )}
                />
              ))}
              {visibleLiked.length === 0 && visibleLocal.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Heart size={28} style={{ color: "color-mix(in srgb, var(--fg) 25%, transparent)" }} />
                  <div className="mt-3 text-sm" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("lib.empty")}</div>
                </div>
              )}
            </div>
          )}

          {tab === "playlists" && rewardTracks.length > 0 && (
            <div className="px-5 mb-5">
              <div className="relative rounded-[24px] overflow-hidden" style={{ border: `1px solid ${currentTrack.c2}44`, boxShadow: `0 18px 46px ${currentTrack.c2}22` }}>
                <div className="absolute inset-0 flex" aria-hidden="true">
                  {rewardTracks.slice(0, 3).map(tr => <img key={tr.id} src={tr.img} alt="" className="flex-1 object-cover h-full" style={{ filter: rewardUnlocked ? "brightness(0.55)" : "brightness(0.3) grayscale(0.5)" }} />)}
                </div>
                <div className="absolute inset-0" style={{ background: `linear-gradient(118deg, rgba(10,8,20,0.9), rgba(10,8,20,0.45)), linear-gradient(160deg, ${currentTrack.c2}3a, transparent 60%)` }} />
                <div className="relative z-10 p-5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Sparkles size={13} style={{ color: currentTrack.c2 }} />
                    <span style={{ fontFamily: F.m, fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: currentTrack.c2 }}>{t("reward.eyebrow")}</span>
                  </div>
                  <h3 className="myra-hero-word" style={{ fontFamily: F.d, fontWeight: 900, fontSize: 25, letterSpacing: "-0.03em", lineHeight: 1.05 }}>{t("reward.title")}</h3>
                  <p className="text-xs mt-1" style={{ color: onDark(60), fontFamily: F.b }}>{t("reward.sub", rewardTracks.length)}</p>
                  {rewardUnlocked ? (
                    <motion.button whileTap={{ scale: 0.96 }} onClick={() => { (onPlayTracks ?? ((tracks: Track[]) => onPlay(tracks[0])))(rewardTracks); toast.success(t("reward.playing")); }} className="myra-pulse mt-4 inline-flex items-center gap-2 pl-5 pr-6 py-3 rounded-full font-bold" style={{ background: `linear-gradient(108deg, ${currentTrack.c2}, #c98cff)`, color: "#160f26", fontFamily: F.b, boxShadow: `0 12px 30px ${currentTrack.c2}55` }}>
                      <Play size={16} fill="#160f26" stroke="none" />{t("reward.listen")}
                    </motion.button>
                  ) : (
                    <div className="mt-4 flex items-center gap-2.5">
                      <span className="flex items-center justify-center shrink-0" style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.1)", color: ON_DARK }}><Lock size={15} /></span>
                      <div className="min-w-0">
                        <div className="text-sm font-bold" style={{ color: ON_DARK, fontFamily: F.b }}>{t("reward.locked")}</div>
                        <div className="text-xs" style={{ color: onDark(52), fontFamily: F.b }}>{t("reward.lockedSub", compLevel)}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
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
                <TiltCard key={pl.id} max={7} className="myra-playlist-card cursor-pointer group" onClick={() => onOpenPlaylist ? onOpenPlaylist(pl.id) : toast(t("lib.plToast", pl.name, pl.trackIds.length))}>
                  <div className="myra-playlist-cover rounded-[20px] overflow-hidden mb-2.5 aspect-square relative">
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
                        aria-label={t("a11y.deletePlaylist")}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity"
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

export const CreatorScreen = React.memo(function CreatorScreen({ c2, creatorPlus, onOpenCreatorPlus, onOpenStats, myTracks = [], onStartRelease, onPlay, myPlaysByTrack, myPlaysByDay, balance, onWithdraw, realDonationsTotal, uid }: {
  c2: string; creatorPlus: boolean; onOpenCreatorPlus: () => void;
  onOpenStats: () => void; myTracks?: Track[]; onStartRelease: (files: FileList | File[]) => void; onPlay: (t: Track) => void;
  myPlaysByTrack: Record<number, number>; myPlaysByDay: Record<string, number>;
  balance: number; onWithdraw: (amt: number) => void; realDonationsTotal: number; uid: string | null;
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

  // Верификация: реальные, проверяемые условия (по фактическим данным студии).
  // Галочку в MYRA нельзя купить или включить — её подтверждает команда после
  // выполнения условий (принцип честности: не выдаём автоматически).
  const totalPlays = useMemo(() => Object.values(myPlaysByTrack).reduce((a, b) => a + b, 0), [myPlaysByTrack]);
  const verifyCriteria = [
    { label: t("verify.c1"), have: myTracks.length, need: 3 },
    { label: t("verify.c2"), have: totalPlays, need: 500 },
    { label: t("verify.c3"), have: realDonationsTotal > 0 ? 1 : 0, need: 1 },
  ];
  const verifyMet = verifyCriteria.every(c => c.have >= c.need);
  const [verifyStatus, setVerifyStatus] = useState<CreatorVerificationStatus | null>(null);
  const [verifyNote, setVerifyNote] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifySubmitting, setVerifySubmitting] = useState(false);

  useEffect(() => {
    if (!supabaseEnabled || !uid) {
      setVerifyStatus(null);
      setVerifyNote(null);
      return;
    }
    let active = true;
    setVerifyLoading(true);
    fetchCreatorVerificationRequest(uid)
      .then(({ data }) => {
        if (!active) return;
        setVerifyStatus(data?.status ?? null);
        setVerifyNote(data?.reviewer_note ?? null);
      })
      .finally(() => { if (active) setVerifyLoading(false); });
    return () => { active = false; };
  }, [uid]);

  const requestVerify = async () => {
    if (!verifyMet || verifyStatus === "pending" || verifyStatus === "approved" || verifySubmitting) return;
    if (!uid) { toast.error(t("verify.signIn")); return; }
    if (!supabaseEnabled) { toast.error(t("verify.unavailable")); return; }
    setVerifySubmitting(true);
    const { data, error } = await submitCreatorVerificationRequest(uid, {
      releasesCount: myTracks.length,
      playCount: totalPlays,
      hasListenerSupport: realDonationsTotal > 0,
    });
    setVerifySubmitting(false);
    if (error || !data) { toast.error(t("verify.error")); return; }
    setVerifyStatus(data.status);
    setVerifyNote(null);
    toast.success(t("verify.requested"));
  };
  const verifyRequested = verifyStatus === "pending" || verifyStatus === "approved";
  const canRequestVerify = verifyMet && !verifyRequested && !verifyLoading && !verifySubmitting;
  const verifyButtonLabel = verifyLoading || verifySubmitting
    ? t("verify.loading")
    : verifyStatus === "approved"
      ? t("verify.approved")
      : verifyStatus === "rejected"
        ? t("verify.retry")
        : verifyStatus === "pending"
          ? t("verify.pending")
          : verifyMet
            ? t("verify.cta")
            : t("verify.ctaLocked");

  // Детальная аналитика — реальная привилегия Pro (шторка Pro её обещает
  // третьим пунктом; раньше она была открыта всем, и обещание было пустым)
  const openStatsGated = () => {
    if (!paymentsEnabled || creatorPlus) onOpenStats();
    else { toast(t("cr.statsLocked")); onOpenCreatorPlus(); }
  };

  return (
    <Page className="myra-experience-page myra-creator-page">
      <header className="myra-creator-header px-5 pt-7 pb-5 flex items-start justify-between gap-4">
        <div>
          <span className="myra-page-eyebrow">MYRA STUDIO</span>
          <h1>{t("cr.studio")}</h1>
          <p>{t("cr.studioSub")}</p>
        </div>
        {creatorPlus && (
          <div className="myra-creator-pro-chip">
            <Crown size={12} />
            <span>MYRA Pro</span>
          </div>
        )}
      </header>

      <section className="myra-content-section px-5 mb-7">
        {/* Хиро-карточка прослушиваний — та же тёмная стеклянная поверхность
            со свечением, что у Home/Release-карточек, вместо плоской GLASS-плашки.
            button, а не div: карточка кликабельна (открывает статистику) */}
        <button className="myra-creator-hero w-full text-left" style={{ "--creator-accent": c2 } as React.CSSProperties} onClick={openStatsGated}>
          <div className="myra-creator-hero-top">
            <div>
              <span className="myra-creator-hero-label">{t("cr.plays7")}</span>
              <div className="myra-creator-hero-value">{weekTotal}</div>
            </div>
            {trendPct !== null && (
              <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold flex-shrink-0" style={{ background: trendPct >= 0 ? "rgba(52,211,153,0.16)" : "rgba(248,113,113,0.16)", color: trendPct >= 0 ? "#34d399" : "#f87171", fontFamily: F.m }}>
                <TrendingUp size={12} /> {trendPct >= 0 ? "+" : ""}{trendPct}%
              </div>
            )}
          </div>
          <InteractiveChart data={week} labels={WEEKDAYS} color={c2} height={72} markIndex={week.length - 1} valueLabel={v => t("cr.plays", v)} />
          <div className="myra-creator-hero-days">
            {WEEKDAYS.map(d => <span key={d}>{d}</span>)}
          </div>
        </button>

        {/* Строка статистики — тот же паттерн, что и .myra-library-overview в Полке:
            общая стеклянная плашка с разделителями между колонками вместо трёх
            отдельных карточек */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { glyph: "profile" as const, value: "0", label: t("cr.fans"), a: "#9a8cff", b: "#67d7ff", onClick: openStatsGated, dim: false },
            { glyph: "spark" as const, value: paymentsEnabled ? `${balance.toLocaleString("ru-RU")}₽` : "—", label: t("cr.donations"), a: "#ffd28a", b: "#f4a77f", onClick: () => paymentsEnabled && setWdOpen(true), dim: !paymentsEnabled },
            { glyph: "library" as const, value: `${myTracks.length}`, label: t("cr.releases"), a: "#ff6fa5", b: "#c98cff", onClick: openStatsGated, dim: false },
          ].map((s, i) => (
            <motion.button key={s.label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07, ...SPRING }} onClick={s.onClick} aria-disabled={s.dim || undefined} className="flex flex-col items-center text-center" style={{ borderRadius: 22, padding: "16px 6px 14px", background: `linear-gradient(158deg, ${s.a}22, ${s.b}0d)`, border: `1px solid ${s.a}38`, boxShadow: `0 12px 32px ${s.a}1c, inset 0 1px 0 rgba(255,255,255,0.06)`, opacity: s.dim ? 0.6 : 1 }}>
              <span className="flex items-center justify-center mb-2" style={{ width: 34, height: 34, borderRadius: "50%", background: `radial-gradient(circle at 50% 30%, ${s.a}, ${s.b})`, color: "#160f26", boxShadow: `0 6px 18px ${s.a}66` }}><MyraGlyph name={s.glyph} size={16} /></span>
              <strong style={{ fontFamily: F.d, fontWeight: 900, fontSize: 22, lineHeight: 1.05, letterSpacing: "-0.03em", background: `linear-gradient(120deg, ${s.a}, ${s.b})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><CountUp value={s.value} /></strong>
              <span className="mt-1" style={{ fontSize: 10.5, color: "color-mix(in srgb, var(--fg) 52%, transparent)", fontFamily: F.m }}>{s.label}</span>
            </motion.button>
          ))}
        </div>

        {supabaseEnabled && realDonationsTotal > 0 && (
          <div className="myra-creator-real-donations">
            <Gift size={14} style={{ color: "#34d399", flexShrink: 0 }} />
            <span className="text-xs" style={{ fontFamily: F.b, color: "color-mix(in srgb, var(--fg) 75%, transparent)" }}>{t("cr.realDonations", realDonationsTotal.toLocaleString("ru-RU"))}</span>
          </div>
        )}

        {/* Верификация — реальные условия галочки (см. requestVerify выше) */}
        <div className="mt-3.5 rounded-[22px] p-4" style={{ ...GLASS }}>
          <div className="flex items-center gap-2.5 mb-3">
            <MyraVerifiedBadge size={26} accent={c2} />
            <div className="min-w-0">
              <div className="text-sm font-bold" style={{ fontFamily: F.b }}>{t("verify.title")}</div>
              <div className="text-xs" style={{ color: "color-mix(in srgb, var(--fg) 48%, transparent)", fontFamily: F.m }}>{t("verify.sub")}</div>
            </div>
          </div>
          <div className="flex flex-col gap-2 mb-3.5">
            {verifyCriteria.map(cr => {
              const done = cr.have >= cr.need;
              return (
                <div key={cr.label} className="flex items-center gap-2.5">
                  <span className="flex items-center justify-center shrink-0" style={{ width: 22, height: 22, borderRadius: "50%", background: done ? `${c2}2e` : "color-mix(in srgb, var(--fg) 8%, transparent)", color: done ? c2 : "color-mix(in srgb, var(--fg) 38%, transparent)" }}>
                    {done ? <Check size={13} /> : <Lock size={12} />}
                  </span>
                  <span className="flex-1 text-xs" style={{ fontFamily: F.b, color: done ? "var(--fg)" : "color-mix(in srgb, var(--fg) 62%, transparent)" }}>{cr.label}</span>
                  <span className="text-xs font-semibold shrink-0" style={{ fontFamily: F.m, color: done ? c2 : "color-mix(in srgb, var(--fg) 40%, transparent)" }}>{Math.min(cr.have, cr.need)}/{cr.need}</span>
                </div>
              );
            })}
          </div>
          <button
            onClick={requestVerify}
            disabled={!canRequestVerify}
            className="w-full py-3 rounded-2xl text-sm font-bold transition-opacity disabled:opacity-45"
            style={{ background: canRequestVerify ? `linear-gradient(108deg, ${c2}, #c98cff)` : "color-mix(in srgb, var(--fg) 9%, transparent)", color: canRequestVerify ? "#160f26" : "color-mix(in srgb, var(--fg) 55%, transparent)", fontFamily: F.b }}
          >
            {verifyButtonLabel}
          </button>
          {verifyNote && (
            <div className="text-[11px] mt-2.5 text-center" style={{ color: "color-mix(in srgb, var(--fg) 58%, transparent)", fontFamily: F.b, lineHeight: 1.4 }}>{verifyNote}</div>
          )}
          <div className="text-[11px] mt-2.5 text-center" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m, lineHeight: 1.4 }}>{t("verify.note")}</div>
        </div>
      </section>

      <section className="myra-content-section px-5 mb-7">
        <SectionHeading title={t("cr.newRelease")} sub={t("cr.newReleaseSub")} />
        {/* Реальная загрузка: клик открывает выбор файла, drag-n-drop тоже работает */}
        <input
          ref={fileRef}
          type="file"
          accept="audio/*,.mp3,.wav,.flac,.m4a,.ogg,.aac"
          className="hidden"
          onChange={e => { if (e.target.files?.length) { onStartRelease(e.target.files); e.target.value = ""; } }}
        />
        {/* Остаётся div (не button) — должен принимать onDrop/onDragOver;
            role="button"+tabIndex+onKeyDown добавляют доступность с клавиатуры
            для клика-по-выбору-файла, который раньше работал только мышью/тачем */}
        <div
          className="myra-creator-dropzone"
          role="button"
          tabIndex={0}
          aria-label={t("cr.dropFile")}
          style={{ ...GLASS, border: dragOver ? `1.5px dashed ${c2}` : "1.5px dashed color-mix(in srgb, var(--wash) 16%, transparent)", background: dragOver ? `${c2}14` : GLASS.background }}
          onClick={() => fileRef.current?.click()}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileRef.current?.click(); } }}
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

        {/* Мои файлы — та же строка трека, что и в Полке (.myra-track-row) */}
        {myTracks.length > 0 && (
          <div className="mt-5">
            <div className="text-[10px] uppercase tracking-[0.16em] mb-2" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}>{t("cr.myFiles")}</div>
            <div className="flex flex-col gap-1">
              {myTracks.map(tr => (
                <PremiumTrackRow key={tr.id} track={tr} active={false} playing={false} onPlay={onPlay} />
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="myra-content-section px-5 mb-7">
        <SectionHeading title={t("cr.myReleases")} sub={t("cr.myReleasesSub")} />
        {topMyTracks.length === 0 ? (
          <div className="myra-empty-state">
            <Music2 size={24} />
            <span>{t("cr.releasesEmpty")}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {topMyTracks.map(tr => (
              <PremiumTrackRow
                key={tr.id}
                track={tr}
                active={false}
                playing={false}
                onPlay={onPlay}
                trailing={
                  <div className="flex items-center gap-1.5" style={{ color: tr.c2, fontFamily: F.m, fontSize: 11 }}>
                    <BarChart3 size={13} />{myPlaysByTrack[tr.id] ?? 0}
                  </div>
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* MYRA Pro / Начни зарабатывать — премиальная карточка со свечением,
          той же породы, что и хиро-карточка выше, а не плоская плашка-приписка */}
      {paymentsEnabled && <section className="myra-content-section px-5">
        <TiltCard max={5} className="myra-creator-pro-card" onClick={onOpenCreatorPlus}>
          <Aurora c2="#8b5cf6" opacity={0.6} />
          <div className="relative z-10">
            <div className="text-[10px] uppercase tracking-[0.2em] mb-2" style={{ color: "#a78bfa", fontFamily: F.m }}>MYRA Pro</div>
            <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 21, letterSpacing: "-0.025em", color: ON_DARK }} className="mb-1.5">
              {creatorPlus ? t("cr.active") : t("cr.earn")}
            </div>
            <div className="text-xs mb-4" style={{ color: onDark(52), fontFamily: F.b }}>{creatorPlus ? t("cp.cancel") : t("cr.earnSub")}</div>
            <motion.button whileTap={{ scale: 0.95 }} onClick={e => { e.stopPropagation(); onOpenCreatorPlus(); }} className="px-6 py-2.5 rounded-full text-sm font-semibold" style={{ background: "linear-gradient(135deg, #8b5cf6, #a78bfa)", color: "#fff", fontFamily: F.b }}>
              {creatorPlus ? t("cr.manage") : t("cr.connect")}
            </motion.button>
          </div>
        </TiltCard>
      </section>}

      {paymentsEnabled && <WithdrawSheet open={wdOpen} onClose={() => setWdOpen(false)} balance={balance} c2={c2} onDone={onWithdraw} />}
    </Page>
  );
});

// ─── Профиль ──────────────────────────────────────────────────────────────────

export const ProfileScreen = React.memo(function ProfileScreen({ c2, userName, handle, avatar, creatorPlus, follows, totalPlays, onOpenBlend, onOpenAccount, onOpenWrapped, onOpenSplit, onOpenAchievements, achDone, achTotal, onLogout, simpleFx, onToggleSimpleFx, quality, onSetQuality, userRole, donationCount, devMode, onOpenDevPanel, onOpenStudio, companionController, onOpenIdentity }: {
  c2: string; userName: string; handle: string; avatar: string; creatorPlus: boolean; follows: number; totalPlays: number;
  onOpenBlend: (f: Friend) => void; onOpenAccount: () => void; onOpenWrapped: () => void; onOpenSplit: () => void;
  onOpenAchievements: () => void; achDone: number; achTotal: number; onLogout: () => void;
  simpleFx: boolean; onToggleSimpleFx: () => void; quality: number; onSetQuality: (idx: number) => void;
  userRole: UserRole; donationCount: number;
  devMode: boolean; onOpenDevPanel: () => void; onOpenStudio: () => void;
  companionController: CompanionController; onOpenIdentity: () => void;
}) {
  const { t, lang, setLang } = useLang();
  const { theme, toggleTheme } = useTheme();
  const [blendOpen, setBlendOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logoutQ, setLogoutQ] = useState(false);

  // Бейджи профиля отражают публичную идентичность. Служебный статус
  // администратора намеренно не показываем.
  // Бейджи-награды за реальный прогресс со спутником: «Знаток» (3 уровень) и
  // «Хранитель артефактов» (собраны все артефакты). Появляются только когда
  // реально заработаны — принцип честности.
  const compLvlP = companionLevel(companionController.state.xp).level;
  const allArtifacts = companionController.state.unlockedGiftIds.length >= RESONANCES.length;
  const badges = useMemo(() => [
    userRole === "artist"
      ? { icon: Mic2, label: t("bd.artist"), c: "#a78bfa" }
      : { icon: Headphones, label: t("bd.listener"), c: "#34d399" },
    ...(userRole === "artist" && creatorPlus ? [{ icon: Crown, label: "MYRA Pro", c: "#c4b5fd" }] : []),
    ...(donationCount > 0 ? [{ icon: Gift, label: t("bd.donor"), c: "#facc15" }] : []),
    ...(compLvlP >= 3 ? [{ icon: Sparkles, label: t("badge.connoisseur"), c: "#67d7ff" }] : []),
    ...(allArtifacts ? [{ icon: Trophy, label: t("badge.collector"), c: "#ffd76a" }] : []),
  ], [userRole, creatorPlus, donationCount, compLvlP, allArtifacts, t]);

  const QUALITIES = ["AAC 256", "FLAC", "Hi-Res 24-bit"];

  // Реальный текущий месяц — раньше был захардкожен "Июль 2026"
  const monthLabel = useMemo(() => {
    const label = new Date().toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { month: "long", year: "numeric" });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [lang]);

  // Акцентные цвета для IconBadge — по одному на функцию, чтобы разные
  // пункты не сливались в одинаковую фиолетовую подсветку (см. бейджи выше:
  // роль/Pro/Plus уже цветные, тут — остальные функциональные карточки)
  const ACCENT_ACHIEVEMENTS = "#a78bfa";
  const ACCENT_SPLIT = "#facc15";
  const ACCENT_SETTINGS = "#a5b4fc";
  const ACCENT_QUALITY = "#c4b5fd";
  const ACCENT_FRIENDS = "#f0abfc";
  const ACCENT_LANG = "#7dd3fc";

  return (
    <Page className="myra-experience-page myra-profile-page">
      <AccountSummaryCard
        c2={c2}
        avatar={avatar}
        userName={userName}
        handle={handle}
        badges={badges}
        onAvatarTap={onOpenAccount}
        onManage={onOpenAccount}
        manageLabel={t("pr.manageAccount")}
      />

      <div className="px-5 mb-6">
        <ProfileIdentityShowcase controller={companionController} onOpen={onOpenIdentity} />
      </div>

      {/* Статистика — тот же паттерн стат-плиток, что в Медиатеке (myra-library-overview) */}
      <section className="myra-content-section grid grid-cols-3 gap-2.5 mx-5 mb-6">
        {[
          { glyph: "profile" as const, value: `${follows}`, label: t("pr.follows"), a: "#9a8cff", b: "#67d7ff" },
          { glyph: "heart" as const, value: "0", label: t("pr.fans"), a: "#ff6fa5", b: "#c98cff" },
          { glyph: "chart" as const, value: fmtCount(totalPlays), label: t("pr.plays"), a: "#f4a77f", b: "#ffd28a" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07, ...SPRING }} className="flex flex-col items-center text-center" style={{ borderRadius: 22, padding: "16px 6px 14px", background: `linear-gradient(158deg, ${s.a}22, ${s.b}0d)`, border: `1px solid ${s.a}38`, boxShadow: `0 12px 32px ${s.a}1c, inset 0 1px 0 rgba(255,255,255,0.06)` }}>
            <span className="flex items-center justify-center mb-2" style={{ width: 34, height: 34, borderRadius: "50%", background: `radial-gradient(circle at 50% 30%, ${s.a}, ${s.b})`, color: "#160f26", boxShadow: `0 6px 18px ${s.a}66` }}><MyraGlyph name={s.glyph} size={16} /></span>
            <strong style={{ fontFamily: F.d, fontWeight: 900, fontSize: 24, lineHeight: 1.05, letterSpacing: "-0.03em", background: `linear-gradient(120deg, ${s.a}, ${s.b})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><CountUp value={s.value} /></strong>
            <span className="mt-1" style={{ fontSize: 10.5, color: "color-mix(in srgb, var(--fg) 52%, transparent)", fontFamily: F.m }}>{s.label}</span>
          </motion.div>
        ))}
      </section>

      <div className="px-5 flex flex-col gap-1.5">
        <SectionLabel>{t("pr.sectionProfile")}</SectionLabel>

        {userRole === "artist" && (
          <NavigationCard icon={Mic2} accent="#c98cff" label={t("nav.creator")} sub={t("pr.studioSub")} onClick={onOpenStudio} accentBorder />
        )}

        <ProgressCard
          icon={Trophy}
          accent={ACCENT_ACHIEVEMENTS}
          label={t("pr.achievements")}
          done={achDone}
          total={achTotal}
          progressText={t("ach.progress", achDone, achTotal)}
          onClick={onOpenAchievements}
        />

        <NavigationCard
          icon={Gift}
          accent={ACCENT_SPLIT}
          label={`${t("pr.split")}${t("pr.splitAccent")}`}
          sub={t("pr.splitSub")}
          onClick={onOpenSplit}
        />

        {/* Эхо месяца — раньше висело в профиле весь месяц напоказ, хотя месяц ещё
            не закончился; теперь появляется только в последние 3 дня месяца, когда
            recap реально имеет смысл смотреть */}
        {isMonthEndWindow() && (
          <NavigationCard
            icon={Sparkles}
            accent="#a78bfa"
            label={`${t("pr.wrapped")}${t("pr.month")}`}
            sub={monthLabel}
            onClick={onOpenWrapped}
          />
        )}

        {/* Друзья и Созвук */}
        <div className="myra-card-quiet rounded-2xl overflow-hidden">
          <AccordionTrigger icon={Users} accent={ACCENT_FRIENDS} label={t("pr.blendRow")} open={blendOpen} onClick={() => setBlendOpen(o => !o)} panelId="pr-blend-panel" />
          <AnimatePresence>
            {blendOpen && (
              <motion.div id="pr-blend-panel" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
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

        <SectionLabel>{t("pr.sectionApp")}</SectionLabel>

        {/* Все параметры приложения собраны в одном месте: профиль больше не
            превращается в длинный список отдельных технических карточек. */}
        <div className="myra-card-quiet rounded-2xl overflow-hidden">
          <AccordionTrigger icon={SlidersHorizontal} accent={ACCENT_SETTINGS} label={t("pr.settingsGroup")} open={settingsOpen} onClick={() => setSettingsOpen(o => !o)} panelId="pr-settings-panel" />
          <AnimatePresence>
            {settingsOpen && (
              <motion.div id="pr-settings-panel" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                <div className="flex flex-col gap-1.5 px-2 pb-2" style={{ borderTop: "1px solid color-mix(in srgb, var(--wash) 06%, transparent)", paddingTop: 8 }}>
                  <SettingRow icon={<Volume2 size={15} style={{ color: ACCENT_QUALITY }} />} label={t("pr.quality")} sub={quality === 0 ? t("pr.compressed") : t("pr.lossless")}>
                    <button
                      type="button"
                      onClick={() => {
                        const next = (quality + 1) % QUALITIES.length;
                        onSetQuality(next);
                        toast(t("pr.qualitySet", QUALITIES[next]));
                      }}
                      className="myra-setting-value"
                      style={{ color: ACCENT_QUALITY }}
                    >
                      {QUALITIES[quality]}
                    </button>
                  </SettingRow>
                  <SettingRow icon={<Globe size={15} style={{ color: ACCENT_LANG }} />} label={t("pr.lang")}>
                    <div className="myra-inline-segment" role="radiogroup" aria-label={t("pr.lang")}>
                      {(["ru", "en"] as Lang[]).map(option => (
                        <button key={option} type="button" role="radio" aria-checked={lang === option} data-active={lang === option || undefined} onClick={() => setLang(option)}>{option}</button>
                      ))}
                    </div>
                  </SettingRow>
                  <SettingRow icon={<Zap size={15} />} label={t("pr.simpleFx")} sub={t("pr.simpleFxSub")}>
                    <Toggle on={simpleFx} onChange={() => { onToggleSimpleFx(); toast(simpleFx ? t("pr.simpleFxOff") : t("pr.simpleFxOn")); }} color={c2} />
                  </SettingRow>
                  {/* Перелив (кроссфейд) переехал в плеер — к остальным настройкам воспроизведения.
                      Тема — цикл из трёх: неон открывается только с Plus/Pro, поэтому чип вместо тумблера */}
                  <SettingRow icon={theme === "dark" ? <Moon size={15} /> : theme === "light" ? <Sun size={15} /> : <Sparkles size={15} style={{ color: "#a5b4fc" }} />} label={t("pr.theme")}>
                    <button
                      type="button"
                      onClick={toggleTheme}
                      aria-label={`${t("pr.theme")}: ${theme === "dark" ? t("pr.themeDark") : theme === "light" ? t("pr.themeLight") : t("pr.themeNeon")}`}
                      className="text-xs px-2.5 py-1 rounded-full"
                      style={{ background: `${c2}1e`, color: c2, fontFamily: F.m }}
                    >
                      {theme === "dark" ? t("pr.themeDark") : theme === "light" ? t("pr.themeLight") : t("pr.themeNeon")}
                    </button>
                  </SettingRow>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <SectionLabel>{t("pr.sectionSecurity")}</SectionLabel>

        {/* Серверно защищённые инструменты команды видят только строки из admins. */}
        {devMode && (
          <NavigationCard icon={Wrench} accent="#f472b6" label={t("dev.row")} onClick={onOpenDevPanel} accentBorder />
        )}

        <DestructiveButton label={t("pr.logoutRow")} onClick={() => setLogoutQ(true)} />
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
        {/* Обычный (не монопространственный) шрифт — полное предложение в
            моноширинном IBM Plex Mono читалось как искусственно разрежённое */}
        {sub && <div className="text-xs mt-0.5" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

// ─── Профиль: карточки-примитивы ──────────────────────────────────────────────
// Раньше каждый пункт профиля был одинаковой GLASS-строкой с одной и той же
// иконкой-контейнером и стрелкой — иерархии не было. Ниже — набор карточек с
// разным характером (навигация / статус / сегмент / прогресс / сводка
// аккаунта / опасное действие), собранных на общем IconBadge и Surface-тоне

/** Единый значок иконки: 44px, мягкий квадрат, тонкая граница, лёгкий
    внутренний glow под акцентный цвет — гасится в fx-simple через CSS */
function IconBadge({ icon: Icon, accent, size = 15 }: { icon: LucideIcon; accent: string; size?: number }) {
  return (
    <div className="myra-icon-badge flex-shrink-0" style={{ "--icon-accent": accent } as React.CSSProperties}>
      <Icon size={size} />
    </div>
  );
}

/** Небольшой вторичный заголовок группы пунктов (Мой профиль/Приложение/Безопасность) */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <span className="myra-section-label">{children}</span>;
}

/** Строка-навигация к вложенному экрану/шторке — иконка, название, описание, стрелка.
    Настоящая кнопка (не div), чтобы работала клавиатура и screen reader */
function NavigationCard({ icon, accent, label, sub, onClick, trailing, ariaLabel, accentBorder }: {
  icon: LucideIcon; accent: string; label: string; sub?: string; onClick: () => void;
  trailing?: React.ReactNode; ariaLabel?: string; accentBorder?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      className="myra-card-quiet w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left"
      style={accentBorder ? { borderColor: `${accent}59` } : undefined}
    >
      <IconBadge icon={icon} accent={accent} />
      <div className="flex-1 min-w-0">
        <div className="text-sm" style={{ fontFamily: F.b }}>{label}</div>
        {sub && <div className="text-xs mt-0.5 truncate" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{sub}</div>}
      </div>
      {trailing ?? <ChevronRight size={15} style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }} className="flex-shrink-0" />}
    </motion.button>
  );
}

/** Триггер аккордеона (Настройки/Друзья) — та же оболочка, что у NavigationCard,
    но со стрелкой-индикатором раскрытия вместо перехода на другой экран */
function AccordionTrigger({ icon, accent, label, open, onClick, panelId }: {
  icon: LucideIcon; accent: string; label: string; open: boolean; onClick: () => void; panelId: string;
}) {
  return (
    <button onClick={onClick} aria-expanded={open} aria-controls={panelId} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
      <IconBadge icon={icon} accent={accent} />
      <div className="flex-1 text-sm" style={{ fontFamily: F.b }}>{label}</div>
      {/* ChevronDown, а не ChevronRight: раскрывается на этой же странице, а
          не переходит на другой экран — стрелка не должна повторять
          NavigationCard, иначе аккордеон в закрытом виде от него не отличить */}
      <motion.div animate={{ rotate: open ? 180 : 0 }}><ChevronDown size={15} style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }} /></motion.div>
    </button>
  );
}

/** Карточка-статус (Качество звука) — текущее состояние + бейдж значения вместо
    обычной стрелки-перехода */
function StatusCard({ icon, accent, label, statusText, statusColor, valueChip, locked, onClick }: {
  icon: LucideIcon; accent: string; label: string; statusText: string; statusColor: string;
  valueChip: string; locked?: boolean; onClick: () => void;
}) {
  return (
    <motion.button whileTap={{ scale: 0.99 }} onClick={onClick} aria-label={`${label}: ${valueChip}`} className="myra-card-quiet w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left">
      <IconBadge icon={icon} accent={accent} />
      <div className="flex-1 min-w-0">
        <div className="text-sm" style={{ fontFamily: F.b }}>{label}</div>
        <div className="text-xs mt-0.5" style={{ color: statusColor, fontFamily: F.b }}>{statusText}</div>
      </div>
      {locked && <Lock size={12} style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }} className="flex-shrink-0" />}
      <span className="text-xs px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: `${accent}1e`, color: accent, fontFamily: F.m }}>{valueChip}</span>
    </motion.button>
  );
}

/** Сегментированный переключатель (Язык) — role="radiogroup"/"radio" вместо
    голых div/span, туч-таргеты растянуты до 44px без раздувания видимой пилюли */
function SegmentedSetting({ icon, accent, label, options, value, onChange }: {
  icon: LucideIcon; accent: string; label: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="myra-card-quiet flex items-center gap-3 px-4 py-3.5 rounded-2xl">
      <IconBadge icon={icon} accent={accent} />
      <div className="flex-1 text-sm" style={{ fontFamily: F.b }}>{label}</div>
      <div role="radiogroup" aria-label={label} className="flex gap-1 p-1 rounded-full flex-shrink-0" style={{ background: "color-mix(in srgb, var(--wash) 06%, transparent)" }}>
        {options.map(o => (
          <button
            key={o.value}
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className="relative rounded-full text-[11px] font-bold uppercase flex items-center justify-center flex-shrink-0"
            style={{ fontFamily: F.m, color: value === o.value ? "#fff" : "color-mix(in srgb, var(--fg) 40%, transparent)", minWidth: 44, minHeight: 44, padding: "0 10px" }}
          >
            {value === o.value && <motion.span layoutId="langpill" className="absolute inset-0 rounded-full" style={{ background: accent }} transition={SPRING} />}
            <span className="relative z-10">{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Карточка прогресса (Достижения) — вместо голого текста «Открыто X из Y»
    настоящая полоса прогресса, посчитанная из тех же done/total */
function ProgressCard({ icon, accent, label, done, total, progressText, onClick }: {
  icon: LucideIcon; accent: string; label: string; done: number; total: number; progressText: string; onClick: () => void;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <motion.button whileTap={{ scale: 0.99 }} onClick={onClick} aria-label={`${label}: ${progressText}`} className="myra-card-quiet w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left">
      <IconBadge icon={icon} accent={accent} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm" style={{ fontFamily: F.b }}>{label}</div>
          <div className="text-xs flex-shrink-0" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.m }}>{done}/{total}</div>
        </div>
        {/* Отдельный aria-label на треке: скринридер должен получить понятное
            описание прогресса ("Открыто 7 из 20"), а не голое aria-valuenow */}
        <div className="myra-progress-track mt-2" style={{ "--icon-accent": accent } as React.CSSProperties} role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total} aria-valuetext={progressText} aria-label={progressText}>
          <div className="myra-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <ChevronRight size={15} style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }} className="flex-shrink-0" />
    </motion.button>
  );
}

/** Сводная карточка аккаунта — заменяет собой и старую hero-плашку, и
    отдельную строку «Аккаунт»: аватар/имя/хендл/бейджи (роль, Pro/Plus,
    меценат, разработчик) + единственное действие «Управление аккаунтом» */
function AccountSummaryCard({ c2, avatar, userName, handle, badges, onAvatarTap, onManage, manageLabel }: {
  c2: string; avatar: string; userName: string; handle: string;
  badges: { icon: LucideIcon; label: string; c: string }[];
  onAvatarTap: () => void; onManage: () => void; manageLabel: string;
}) {
  return (
    <div className="myra-content-section myra-profile-hero mx-5 mt-6 mb-6 px-5 pt-8 pb-7 text-center" style={{ "--profile-accent": c2 } as React.CSSProperties}>
      <DetailBackdrop variant="soft" accent={c2} />
      <span className="myra-page-eyebrow">MYRA PROFILE</span>
      <motion.button initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SPRING} className="myra-profile-avatar-stage" onClick={onAvatarTap} aria-label={userName}>
        <div className="myra-profile-badges" aria-label={badges.map(b => b.label).join(", ")}>
          {badges.map((b, index) => {
            const Icon = b.icon;
            return (
              <span key={b.label} className="myra-profile-badge-token" data-slot={index} title={b.label} style={{ "--badge-accent": b.c, "--badge-delay": `${index * -0.8}s` } as React.CSSProperties}>
                <i><Icon size={15} /></i>
              </span>
            );
          })}
        </div>
        <img src={avatar} alt="" className="myra-profile-avatar" style={{ borderColor: c2, boxShadow: `0 0 44px ${c2}45` }} />
      </motion.button>
      <div className="myra-profile-name myra-hero-word break-words">{userName}</div>
      <div className="text-xs mt-1.5 break-words" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}>{handle}</div>
      <div className="myra-profile-badge-labels">
        {badges.map(b => {
          const Icon = b.icon;
          return (
            <span key={b.label} style={{ "--badge-accent": b.c } as React.CSSProperties}>
              <Icon size={11} /><b>{b.label}</b>
            </span>
          );
        })}
      </div>
      <motion.button whileTap={{ scale: 0.97 }} onClick={onManage} className="flex items-center gap-2 mt-5 mx-auto px-5 py-3 rounded-full text-xs font-semibold" style={{ minHeight: 44, background: "color-mix(in srgb, var(--wash) 08%, transparent)", border: "1px solid color-mix(in srgb, var(--wash) 14%, transparent)", color: "var(--fg)", fontFamily: F.b }}>
        <CircleUserRound size={14} style={{ color: c2 }} />
        {manageLabel}
        <ChevronRight size={13} style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)" }} />
      </motion.button>
    </div>
  );
}

/** Кнопка опасного действия (Выйти) — ниже контентных карточек, с
    подтверждением (см. ConfirmSheet в ProfileScreen), не перегружена свечением */
function DestructiveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <motion.button whileTap={{ scale: 0.98 }} onClick={onClick} aria-label={label} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl mt-2 text-sm font-medium" style={{ minHeight: 44, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.22)", color: "#f87171", fontFamily: F.b }}>
      <LogOut size={14} /> {label}
    </motion.button>
  );
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
