import React, { useState, useEffect, useRef, useCallback, useMemo, useDeferredValue } from "react";
import {
  Play, Pause, Heart, Search, Mic2, Upload, BarChart3, Plus, ChevronRight,
  Volume2, Globe, Bell, Check, Download, X, Users, Music2,
  Zap, Radio, Moon, Dumbbell, Car, Brain, LogOut, TrendingUp, Wallet,
  Blend as BlendIcon, Crown, Trash2, FileAudio, Sun, Sparkles,
  Trophy, Clock, Flame, Gift, UserPlus, Headphones, Wrench, Lock,
  SlidersHorizontal, CircleUserRound, Cast, ChevronDown, type LucideIcon,
} from "./myraIcons";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { TRACKS, CHARTS, FRIENDS, PLAYLISTS, GENRE_TILES, LEADERBOARD_PEERS, AVATARS, svgCover, trackFromRow, ls, type Track, type Friend } from "./data";
import { F, GLASS, SPRING, TiltCard, Aurora, EQ, Toggle, ConfirmSheet, Page, Sheet, useTheme, useProgress, ON_DARK, onDark, InteractiveChart, copyText, genInviteCode } from "./lib";
import { DetailBackdrop, DetailWave } from "./detail";
import { useLang, type Lang } from "./i18n";
import { lastNDays, isMonthEndWindow, type ActivityItem } from "./stats";
import { MyraBrandLockup } from "./logo";
import { MyraGlyph, type MyraGlyphName } from "./myraIcons";
import type { UserRole } from "./auth";
import { supabaseEnabled, fetchRecentTracks, type CommunityTrackRow, type FriendFeedItem, type PublicProfile } from "./supabase";
import type { SmartPick } from "./smart";

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
  "ach.unlocked": Trophy, "act.plusActivated": Sparkles,
};

/** Компактная запись счётчика: 2400 → "2.4K" */
export const fmtCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K` : String(n));

function SectionHeading({ title, sub, action, onAction }: { title: string; sub?: string; action?: string; onAction?: () => void }) {
  return (
    <div className="myra-section-heading">
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {action && onAction && (
        <button onClick={onAction}>{action}<MyraGlyph name="arrow" size={15} /></button>
      )}
    </div>
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
    <div className={`myra-track-row${active ? " is-active" : ""}`} onClick={() => onPlay(track)}>
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
function HeroWave({ playing, accent, buffered }: { playing: boolean; accent: string; buffered: number }) {
  const progress = useProgress();
  return <DetailWave progress={progress} buffered={buffered} playing={playing} accent={accent} height={74} />;
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

  const QUICK: { label: string; glyph: MyraGlyphName; act: () => void }[] = [
    { label: t("home.liked"),  glyph: "heart", act: () => onNavigate("library") },
    { label: t("home.charts"), glyph: "chart", act: () => onNavigate("rating") },
    { label: t("home.radio"),  glyph: "radio", act: onPlayRadio },
    { label: t("home.blend"),  glyph: "blend", act: () => (FRIENDS[0] ? onOpenBlend(FRIENDS[0]) : inviteBlend()) },
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
              <div className="myra-flow-kicker text-[10px] uppercase tracking-[0.2em] mb-2">{t("home.flow")}</div>
              <h1>{t("home.headline")}</h1>
              <p>{t("home.headlineSub")}</p>
              <div className="myra-home-flow-label"><MyraGlyph name="spark" size={13} />{t("home.aiSub")}</div>
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
            >
              <span className="myra-quick-glyph"><MyraGlyph name={q.glyph} size={19} /></span>
              <span className="text-[11px] font-medium" style={{ color: "color-mix(in srgb, var(--fg) 70%, transparent)", fontFamily: F.b }}>{q.label}</span>
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

      {/* Лента подписок — реальные аккаунты Supabase, полностью скрыта без бэкенда
          (см. supabaseEnabled в src/app/supabase.ts), в отличие от "Друзья слушают"
          ниже, которая всегда на месте (просто пуста без бэкенда/приглашённых) */}
      {supabaseEnabled && (
        <div className="px-5 mb-8">
          <div className="myra-section-heading" style={{ alignItems: "center" }}>
            <h2>{t("soc.feedTitle")}</h2>
            <button onClick={onOpenPeopleSearch} style={{ color: currentTrack.c2, fontFamily: F.b }}>
              <MyraGlyph name="search" size={13} /> {t("soc.findPeople")}
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
          рабочая кнопка входа в реальную синхронную комнату. Иконка Cast (не
          Radio — тот уже занят «Течением» в быстрых действиях выше, а это
          принципиально другая функция: совместное прослушивание, а не радио) */}
      <div className="px-5 mb-8">
        <button onClick={onOpenRooms} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-[18px] text-left" style={GLASS}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${currentTrack.c2}1e` }}>
            <MyraGlyph name="rooms" size={17} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold" style={{ fontFamily: F.b }}>{t("room.entry")}</div>
            <div className="text-xs mt-0.5" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("room.entrySub")}</div>
          </div>
        </button>
      </div>

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

// ─── Обзор ────────────────────────────────────────────────────────────────────

export const BrowseScreen = React.memo(function BrowseScreen({ onPlay, onOpenArtist, autoFocus }: { onPlay: (t: Track) => void; onOpenArtist: (name: string) => void; autoFocus?: boolean }) {
  const { t } = useLang();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLocaleLowerCase();
  const filtered = useMemo(() => normalizedQuery
    ? TRACKS.filter(track => `${track.title} ${track.artist} ${track.album} ${track.genre}`.toLocaleLowerCase().includes(normalizedQuery))
    : [], [normalizedQuery]);

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
            <SectionHeading title={t("browse.trending")} sub={t("browse.chart")} />
            <div className="myra-chart-list">
            {CHARTS.map((c, i) => (
              <button
                key={c.pos}
                className="myra-chart-row flex items-center gap-3 w-full text-left"
                aria-label={`${c.title} — ${c.artist}`}
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
              </button>
            ))}
            </div>
          </div>

          <div className="myra-content-section px-5 mb-6">
            <SectionHeading title={t("browse.genres")} />
            <div className="myra-genre-grid grid grid-cols-2 md:grid-cols-4 gap-3">
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
                  <div className="myra-rating-row-rank">{i + 1}</div>
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
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const uploadRef = useRef<HTMLInputElement>(null);
  const liked = useMemo(() => TRACKS.filter(track => likedIds.has(track.id)), [likedIds]);
  const matchesLibrary = useCallback((track: Track) => !deferredQuery || `${track.title} ${track.artist} ${track.album} ${track.genre}`.toLocaleLowerCase().includes(deferredQuery), [deferredQuery]);
  const visibleLocal = useMemo(() => myTracks.filter(matchesLibrary), [myTracks, matchesLibrary]);
  const visibleLiked = useMemo(() => liked.filter(matchesLibrary), [liked, matchesLibrary]);

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

      <section className="myra-library-overview mx-5 mb-5" style={{ "--library-accent": currentTrack.c2 } as React.CSSProperties}>
        <div><MyraGlyph name="heart" size={19} /><strong>{liked.length}</strong><span>{t("lib.saved")}</span></div>
        <div><MyraGlyph name="download" size={19} /><strong>{myTracks.length}</strong><span>{t("lib.local")}</span></div>
        <div><MyraGlyph name="library" size={19} /><strong>{playlists.length}</strong><span>{t("lib.playlists")}</span></div>
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
        <div className="myra-creator-overview" style={{ "--creator-accent": c2 } as React.CSSProperties}>
          <button onClick={openStatsGated}><MyraGlyph name="profile" size={19} /><strong>0</strong><span>{t("cr.fans")}</span></button>
          <button onClick={() => setWdOpen(true)}><MyraGlyph name="spark" size={19} /><strong>{balance.toLocaleString("ru-RU")}₽</strong><span>{t("cr.donations")}</span></button>
          <button onClick={openStatsGated}><MyraGlyph name="library" size={19} /><strong>{myTracks.length}</strong><span>{t("cr.releases")}</span></button>
        </div>

        {supabaseEnabled && realDonationsTotal > 0 && (
          <div className="myra-creator-real-donations">
            <Gift size={14} style={{ color: "#34d399", flexShrink: 0 }} />
            <span className="text-xs" style={{ fontFamily: F.b, color: "color-mix(in srgb, var(--fg) 75%, transparent)" }}>{t("cr.realDonations", realDonationsTotal.toLocaleString("ru-RU"))}</span>
          </div>
        )}
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
      <section className="myra-content-section px-5">
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
      </section>

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
        roleIcon={userRole === "artist" ? Mic2 : Headphones}
        badges={badges}
        onAvatarTap={onAvatarTap}
        onManage={onOpenAccount}
        manageLabel={t("pr.manageAccount")}
      />

      {/* MYRA Plus — бесплатный уровень, виден только слушателям (Pro — у артистов в Студии) */}
      {userRole === "listener" && (
        <div className="px-5 mb-6">
          <TiltCard max={6} onClick={onOpenPlus} className="myra-profile-plus-card rounded-[24px] overflow-hidden relative cursor-pointer" style={{ height: 104, background: "linear-gradient(135deg, rgba(6,38,27,0.9), rgba(6,78,59,0.55))", border: "1px solid rgba(52,211,153,0.3)" }}>
            <Aurora c2="#d98968" opacity={0.58} />
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

      {/* Статистика — тот же паттерн стат-плиток, что в Медиатеке (myra-library-overview) */}
      <section className="myra-profile-stats myra-content-section mx-5 mb-6" style={{ "--profile-accent": c2 } as React.CSSProperties}>
        <div><MyraGlyph name="profile" size={19} /><strong>{follows}</strong><span>{t("pr.follows")}</span></div>
        <div><MyraGlyph name="heart" size={19} /><strong>0</strong><span>{t("pr.fans")}</span></div>
        <div><MyraGlyph name="chart" size={19} /><strong>{fmtCount(totalPlays)}</strong><span>{t("pr.plays")}</span></div>
      </section>

      <div className="px-5 flex flex-col gap-1.5">
        <SectionLabel>{t("pr.sectionProfile")}</SectionLabel>

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

        <StatusCard
          icon={Volume2}
          accent={ACCENT_QUALITY}
          label={t("pr.quality")}
          statusText={quality === 0 ? t("pr.compressed") : t("pr.lossless")}
          statusColor={quality === 0 ? "color-mix(in srgb, var(--fg) 40%, transparent)" : "#34d399"}
          valueChip={QUALITIES[quality]}
          locked={!hasUpgrade}
          onClick={() => {
            // Free: цикл AAC ↔ FLAC (Hi-Res — привилегия апгрейда). Ранний
            // return здесь раньше вообще блокировал клик с дефолтного FLAC —
            // Free-пользователь не мог даже вернуться на экономный AAC
            const maxTier = hasUpgrade ? QUALITIES.length : 2;
            const next = (quality + 1) % maxTier;
            onSetQuality(next);
            toast(!hasUpgrade && quality === 1 ? t("pr.qualityLocked") : t("pr.qualitySet", QUALITIES[next]));
          }}
        />

        {/* Язык — реально переключает интерфейс */}
        <SegmentedSetting
          icon={Globe}
          accent={ACCENT_LANG}
          label={t("pr.lang")}
          options={[{ value: "ru", label: "ru" }, { value: "en", label: "en" }]}
          value={lang}
          onChange={v => setLang(v as Lang)}
        />

        {/* Аккордеон реальных настроек */}
        <div className="myra-card-quiet rounded-2xl overflow-hidden">
          <AccordionTrigger icon={SlidersHorizontal} accent={ACCENT_SETTINGS} label={t("pr.settingsGroup")} open={settingsOpen} onClick={() => setSettingsOpen(o => !o)} panelId="pr-settings-panel" />
          <AnimatePresence>
            {settingsOpen && (
              <motion.div id="pr-settings-panel" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                <div className="flex flex-col gap-1.5 px-2 pb-2" style={{ borderTop: "1px solid color-mix(in srgb, var(--wash) 06%, transparent)", paddingTop: 8 }}>
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

        {/* Панель разработчика — появляется после 7 тапов по аватару */}
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
function AccountSummaryCard({ c2, avatar, userName, handle, roleIcon: RoleIcon, badges, onAvatarTap, onManage, manageLabel }: {
  c2: string; avatar: string; userName: string; handle: string; roleIcon: LucideIcon;
  badges: { icon: LucideIcon; label: string; c: string }[];
  onAvatarTap: () => void; onManage: () => void; manageLabel: string;
}) {
  return (
    <div className="myra-content-section myra-profile-hero mx-5 mt-6 mb-6 px-5 pt-8 pb-7 text-center" style={{ "--profile-accent": c2 } as React.CSSProperties}>
      <DetailBackdrop variant="soft" accent={c2} />
      <span className="myra-page-eyebrow">MYRA PROFILE</span>
      <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SPRING} className="relative inline-block mt-1" onClick={onAvatarTap}>
        <img src={avatar} alt="avatar" className="w-24 h-24 rounded-full object-cover mx-auto" style={{ border: `2px solid ${c2}`, boxShadow: `0 0 40px ${c2}50` }} />
        <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${c2}, ${c2}aa)` }}>
          <RoleIcon size={12} style={{ color: "#fff" }} />
        </div>
      </motion.div>
      <div className="myra-profile-name break-words">{userName}</div>
      <div className="text-xs mt-1.5 break-words" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}>{handle}</div>
      {/* Бейджи — эксклюзивные для роли + Pro/Plus, «Меценат» и «Разработчик»;
          это и есть честный «статус подписки/аккаунта» — без выдуманных полей */}
      <div className="myra-profile-badges">
        {badges.map(b => {
          const Icon = b.icon;
          return (
            <span key={b.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold" style={{ background: `${b.c}1c`, border: `1px solid ${b.c}44`, color: b.c, fontFamily: F.b }}>
              <Icon size={12} /> {b.label}
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
