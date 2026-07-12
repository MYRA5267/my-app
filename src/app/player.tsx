import { useState, useRef, useMemo, useEffect } from "react";
import {
  Play, Pause, SkipBack, SkipForward, Heart, Shuffle, Repeat,
  ChevronDown, Share2, Volume2, VolumeX, Globe,
  MessageCircle, Send, Timer, BadgeCheck, ArrowDownToLine, CheckCircle2, Music2, Flame,
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { TRACKS, LYRICS, artistByName, loadMyComments, addMyComment, commentsFor, type Track, type Comment } from "./data";
import { commentHotMoments } from "./smart";
import { F, GLASS, SPRING, fmtSec, FrequencyOrb, Aurora, Waveform, EQ, THEMES, copyText, deriveHandle, TrackStructureBar, SectionBadge } from "./lib";
import { useLang } from "./i18n";
import { supabaseEnabled, fetchComments, postComment } from "./supabase";
import { useTrackStructure, sectionForPct } from "./structure";

const SLEEP_OPTIONS = [15, 30, 60];

export function FullPlayer({ track, playing, onToggle, onClose, progress, duration, onSeek, onNext, onPrev, liked, onLike, volume, onVolume, onPlayTrack, onOpenArtist, onOpenAlbum, sleepLeft, onSleep, downloaded, onDownload, handle, uid }: {
  track: Track; playing: boolean; onToggle: () => void; onClose: () => void;
  progress: number; duration: number; onSeek: (p: number) => void; onNext: () => void; onPrev: () => void;
  liked: boolean; onLike: () => void; volume: number; onVolume: (v: number) => void;
  onPlayTrack: (t: Track) => void; onOpenArtist: (name: string) => void; onOpenAlbum: (album: string) => void;
  sleepLeft: number | null; onSleep: (minutes: number | null) => void;
  downloaded: boolean; onDownload: () => void; handle: string; uid: string | null;
}) {
  const { t, lang } = useLang();
  const [tab, setTab] = useState<"player" | "lyrics" | "comments" | "queue">("player");
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  // Реальные комментарии — свои для каждого трека, плюс то, что написал сам пользователь
  const [myComments, setMyComments] = useState(() => loadMyComments());
  // Трек «настоящий» (опубликован через Студию и синхронизирован с Supabase) —
  // тогда комментарии живут в public.comments, а не в localStorage этого устройства
  const remoteTrackId = supabaseEnabled ? track.remoteId : undefined;
  const [remoteComments, setRemoteComments] = useState<Comment[]>([]);
  useEffect(() => {
    if (!remoteTrackId) { setRemoteComments([]); return; }
    let cancelled = false;
    fetchComments(remoteTrackId).then(({ data }) => {
      if (cancelled) return;
      setRemoteComments(data.map(row => ({
        pct: Number(row.pct),
        user: row.profiles?.handle || deriveHandle(row.profiles?.username ?? "user"),
        text: row.text,
        likes: 0,
        avatar: track.c2,
      })));
    });
    return () => { cancelled = true; };
  }, [remoteTrackId, track.c2]);
  const comments = useMemo(
    () => (remoteTrackId ? remoteComments : commentsFor(track.id, myComments)),
    [remoteTrackId, remoteComments, track.id, myComments],
  );
  // Коллективные хайлайты: места, где комментарии нескольких людей легли рядом
  const hotMoments = useMemo(() => commentHotMoments(comments), [comments]);
  const [commentText, setCommentText] = useState("");
  const volRef = useRef<HTMLDivElement>(null);
  const volDragging = useRef(false);

  // Эвристическая структура трека (интро/куплет/припев/...) — см. structure.ts.
  // Не блокирует ничего: пока анализ не готов или не удался (сеть/CORS/формат),
  // просто null, и волна выглядит как раньше.
  const structure = useTrackStructure(track);

  const lines = LYRICS[track.id];
  const lyricIndex = Math.min((lines?.length ?? 1) - 1, Math.floor((progress / 100) * (lines?.length ?? 1)));
  const wordIndex = Math.floor(((progress / 100) * (lines?.length ?? 1) - lyricIndex) * (lines?.[lyricIndex]?.en.length ?? 1));
  const curSec = (progress / 100) * (duration || 0);
  // Округляем до целого % для тяжёлых визуалов (орб, волна) — они и так плавно
  // доезжают через собственный rAF-интерполятор, а лишний ре-рендер 48+72 узлов
  // на каждый дробный тик прогресса — то, что подвешивало плеер на слабых телефонах.
  const progressRounded = Math.round(progress);
  const verified = artistByName(track.artist)?.verified;

  const queueIdx = TRACKS.findIndex(q => q.id === track.id);
  const upNext = queueIdx >= 0
    ? [...TRACKS.slice(queueIdx + 1), ...TRACKS.slice(0, queueIdx)]
    : TRACKS;

  const shareTrack = async () => {
    const link = `https://myra.app/track/${track.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: track.title, text: `${track.title} — ${track.artist}`, url: link }); } catch { /* пользователь закрыл системный шаринг — это нормально */ }
      return;
    }
    if (await copyText(link)) toast(t("pl.shareCopied"));
  };

  const addComment = () => {
    const text = commentText.trim();
    if (!text) return;
    const pct = Math.round(progress);
    if (remoteTrackId && uid) {
      // Пишем сразу и оптимистично добавляем в список — не ждём рефетча,
      // а неудачная синхронизация (см. остальные recordDonation-подобные
      // хелперы) не должна ломать локальный опыт пользователя
      postComment(uid, remoteTrackId, pct, text).catch(err => console.warn("postComment:", err));
      setRemoteComments(prev => [...prev, { pct, user: handle, text, likes: 0, avatar: track.c2 }].sort((a, b) => a.pct - b.pct));
    } else {
      setMyComments(addMyComment(track.id, { pct, user: handle, text, likes: 0, avatar: track.c2 }));
    }
    setCommentText("");
    toast(t("pl.commented", fmtSec(curSec)));
  };

  const setVol = (clientX: number) => {
    const r = volRef.current!.getBoundingClientRect();
    onVolume(Math.min(1, Math.max(0, (clientX - r.left) / r.width)));
  };

  const TABS = [
    ["player", t("pl.track")], ["lyrics", t("pl.lyrics")], ["comments", t("pl.chat")], ["queue", t("pl.queue")],
  ] as const;

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden" style={{ ...(THEMES.dark as React.CSSProperties), background: "var(--bg)", color: "var(--fg)" }}>
      <div className="absolute inset-0 overflow-hidden">
        <img src={track.img} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ filter: "blur(80px) saturate(1.7) brightness(0.25)", transform: "scale(1.25)" }} />
        <Aurora c2={track.c2} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center 30%, transparent 0%, var(--bg) 85%)" }} />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-10 pb-2 flex-shrink-0">
        <motion.button whileTap={{ scale: 0.85 }} onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={GLASS}>
          <ChevronDown size={20} />
        </motion.button>
        <div className="flex gap-0.5 p-1 rounded-full" style={GLASS}>
          {TABS.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className="relative px-3 py-1.5 rounded-full text-xs font-medium" style={{ fontFamily: F.b, color: tab === id ? "#fff" : "color-mix(in srgb, var(--fg) 45%, transparent)" }}>
              {tab === id && <motion.div layoutId="playertab" className="absolute inset-0 rounded-full" style={{ background: track.c2 }} transition={SPRING} />}
              <span className="relative z-10">{label}</span>
            </button>
          ))}
        </div>
        <motion.button whileTap={{ scale: 0.85 }} onClick={shareTrack} className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={GLASS}>
          <Share2 size={16} />
        </motion.button>
      </div>

      <div className="relative z-10 flex-1 overflow-hidden flex flex-col">
        {tab === "player" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }} className="flex-1 flex flex-col px-6 pt-2 overflow-y-auto w-full max-w-xl mx-auto" style={{ scrollbarWidth: "none" }}>
            <div className="flex justify-center items-center mb-6 mt-1">
              <FrequencyOrb track={track} playing={playing} progress={progressRounded} />
            </div>

            <div className="flex items-start justify-between mb-5">
              <div className="min-w-0">
                <div style={{ fontFamily: F.d, fontWeight: 700, fontSize: 22, lineHeight: 1.15, letterSpacing: "-0.03em" }}>{track.title}</div>
                <button onClick={() => onOpenArtist(track.artist)} className="flex items-center gap-1.5 text-sm mt-1.5 truncate transition-colors hover:text-white" style={{ color: "color-mix(in srgb, var(--fg) 55%, transparent)", fontFamily: F.b }}>
                  {track.artist}
                  {verified && <BadgeCheck size={13} style={{ color: track.c2 }} />}
                </button>
                <button onClick={() => onOpenAlbum(track.album)} className="text-xs mt-0.5 truncate transition-colors hover:text-white block" style={{ color: "color-mix(in srgb, var(--fg) 35%, transparent)", fontFamily: F.m }}>
                  {track.album}
                </button>
              </div>
              <motion.button whileTap={{ scale: 0.7 }} onClick={onLike} className="mt-1 ml-3 flex-shrink-0">
                <Heart size={24} fill={liked ? track.c2 : "none"} stroke={liked ? track.c2 : "color-mix(in srgb, var(--wash) 35%, transparent)"} />
              </motion.button>
            </div>

            {/* Волна */}
            <div className="mb-5">
              <Waveform progress={progressRounded} color={track.c2} onSeek={onSeek} height={56} seed={track.id + 3} playing={playing} />
              <TrackStructureBar sections={structure} />
              <div className="flex justify-between mt-2 text-xs" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}>
                <span>{fmtSec(curSec)}</span>
                <span>{duration ? fmtSec(duration) : track.duration}</span>
              </div>
            </div>

            {/* Управление */}
            <div className="flex items-center justify-between mb-6">
              <motion.button whileTap={{ scale: 0.8 }} onClick={() => { setShuffle(s => !s); toast(shuffle ? t("pl.shuffleOff") : t("pl.shuffleOn")); }}>
                <Shuffle size={20} style={{ color: shuffle ? track.c2 : "color-mix(in srgb, var(--wash) 35%, transparent)" }} />
              </motion.button>
              <motion.button whileTap={{ scale: 0.85 }} onClick={onPrev} className="w-12 h-12 rounded-full flex items-center justify-center" style={GLASS}>
                <SkipBack size={20} fill="currentColor" />
              </motion.button>
              <motion.button whileTap={{ scale: 0.9 }} whileHover={{ scale: 1.04 }} onClick={onToggle} className="rounded-full flex items-center justify-center" style={{ width: 74, height: 74, background: `linear-gradient(135deg, ${track.c2}, ${track.c2}aa)`, boxShadow: `0 0 54px ${track.c2}5c` }}>
                {playing ? <Pause size={28} fill="white" stroke="none" /> : <Play size={28} fill="white" stroke="none" className="ml-1" />}
              </motion.button>
              <motion.button whileTap={{ scale: 0.85 }} onClick={onNext} className="w-12 h-12 rounded-full flex items-center justify-center" style={GLASS}>
                <SkipForward size={20} fill="currentColor" />
              </motion.button>
              <motion.button whileTap={{ scale: 0.8 }} onClick={onDownload} title="offline">
                {downloaded ? <CheckCircle2 size={20} style={{ color: "#34d399" }} /> : <ArrowDownToLine size={20} style={{ color: "color-mix(in srgb, var(--wash) 35%, transparent)" }} />}
              </motion.button>
              <motion.button whileTap={{ scale: 0.8 }} onClick={() => { setRepeat(r => !r); toast(repeat ? t("pl.repeatOff") : t("pl.repeatOn")); }}>
                <Repeat size={20} style={{ color: repeat ? track.c2 : "color-mix(in srgb, var(--wash) 35%, transparent)" }} />
              </motion.button>
            </div>

            {/* Громкость + таймер сна */}
            <div className="flex items-center gap-3 pb-8 relative">
              <button onClick={() => onVolume(volume > 0 ? 0 : 0.75)}>
                {volume === 0 ? <VolumeX size={15} style={{ color: "color-mix(in srgb, var(--wash) 35%, transparent)" }} /> : <Volume2 size={15} style={{ color: "color-mix(in srgb, var(--wash) 35%, transparent)" }} />}
              </button>
              <div
                ref={volRef}
                className="flex-1 relative py-2 cursor-pointer"
                style={{ touchAction: "none" }}
                onPointerDown={e => { volDragging.current = true; (e.target as HTMLElement).setPointerCapture(e.pointerId); setVol(e.clientX); }}
                onPointerMove={e => { if (volDragging.current) setVol(e.clientX); }}
                onPointerUp={() => { volDragging.current = false; }}
              >
                <div className="rounded-full" style={{ height: 4, background: "color-mix(in srgb, var(--wash) 10%, transparent)" }}>
                  <div className="h-full rounded-full relative" style={{ width: `${volume * 100}%`, background: `linear-gradient(90deg, ${track.c2}77, ${track.c2})` }}>
                    <div className="absolute right-0 top-1/2 w-3 h-3 rounded-full bg-white" style={{ transform: "translate(50%,-50%)", boxShadow: "0 1px 6px rgba(0,0,0,0.5)" }} />
                  </div>
                </div>
              </div>

              <motion.button whileTap={{ scale: 0.85 }} onClick={() => setSleepOpen(o => !o)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full" style={{ ...GLASS, background: sleepLeft !== null ? `${track.c2}26` : GLASS.background }}>
                <Timer size={14} style={{ color: sleepLeft !== null ? track.c2 : "color-mix(in srgb, var(--wash) 40%, transparent)" }} />
                {sleepLeft !== null && <span className="text-[11px] font-semibold" style={{ color: track.c2, fontFamily: F.m }}>{Math.ceil(sleepLeft / 60)}м</span>}
              </motion.button>

              {sleepOpen && (
                <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="absolute bottom-14 right-0 rounded-2xl p-3 z-20" style={{ background: "var(--panel)", backdropFilter: "blur(30px)", border: "1px solid color-mix(in srgb, var(--wash) 12%, transparent)", boxShadow: "0 16px 50px rgba(0,0,0,0.6)" }}>
                  <div className="text-[10px] uppercase tracking-[0.14em] mb-2 px-1" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}>{t("pl.sleep")}</div>
                  <div className="flex gap-1.5">
                    {SLEEP_OPTIONS.map(m => (
                      <button key={m} onClick={() => { onSleep(m); setSleepOpen(false); toast(t("pl.sleepSet", m)); }} className="px-3 py-2 rounded-xl text-xs font-semibold" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)", fontFamily: F.b }}>
                        {m}{lang === "ru" ? "м" : "m"}
                      </button>
                    ))}
                    <button onClick={() => { onSleep(null); setSleepOpen(false); toast(t("pl.sleepUnset")); }} className="px-3 py-2 rounded-xl text-xs font-semibold" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)", color: "color-mix(in srgb, var(--fg) 50%, transparent)", fontFamily: F.b }}>
                      {t("pl.sleepOff")}
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {tab === "lyrics" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }} className="flex-1 overflow-y-auto px-8 py-5 w-full max-w-xl mx-auto" style={{ scrollbarWidth: "none" }}>
            <div className="flex gap-2 mb-6 text-xs items-center" style={{ fontFamily: F.m }}>
              <Globe size={12} style={{ color: track.c2 }} />
              <span style={{ color: track.c2 }}>{t("pl.translate")}</span>
            </div>
            {!lines && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Music2 size={28} style={{ color: "color-mix(in srgb, var(--fg) 25%, transparent)" }} />
                <div className="mt-3 text-sm" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("pl.noLyrics")}</div>
              </div>
            )}
            {(lines ?? []).map((line, li) => {
              const isActive = li === lyricIndex;
              return (
                <div key={li} className="mb-6 transition-all duration-500" style={{ opacity: li < lyricIndex ? 0.28 : isActive ? 1 : 0.45 }}>
                  <div className="flex flex-wrap gap-x-2 gap-y-1 mb-1.5">
                    {line.en.map((word, wi) => (
                      <span
                        key={wi}
                        className="transition-all duration-300"
                        style={{
                          fontFamily: F.d,
                          fontWeight: isActive ? 700 : 500,
                          fontSize: isActive ? 21 : 17,
                          letterSpacing: "-0.02em",
                          color: isActive && wi <= wordIndex ? "#fff" : isActive ? "color-mix(in srgb, var(--fg) 55%, transparent)" : "color-mix(in srgb, var(--fg) 70%, transparent)",
                          textShadow: isActive && wi <= wordIndex ? `0 0 22px ${track.c2}88` : "none",
                        }}
                      >
                        {word}
                      </span>
                    ))}
                  </div>
                  {isActive && lang === "ru" && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-sm" style={{ color: `${track.c2}cc`, fontFamily: F.b, fontWeight: 500 }}>
                      {line.ru}
                    </motion.div>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}

        {tab === "comments" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }} className="flex-1 flex flex-col px-6 py-4 overflow-hidden w-full max-w-xl mx-auto">
            <div className="mb-5 relative flex-shrink-0">
              <Waveform progress={progressRounded} color={track.c2} onSeek={onSeek} height={48} seed={track.id + 3} dim />
              {comments.map((c, i) => (
                <div key={i} className="absolute bottom-full mb-1 -translate-x-1/2" style={{ left: `${c.pct}%` }}>
                  <div className="w-2 h-2 rounded-full" style={{ background: c.avatar, boxShadow: `0 0 8px ${c.avatar}` }} />
                </div>
              ))}
              {hotMoments.map(m => (
                <div key={`hot-${m.pct}`} className="absolute bottom-full mb-3.5 -translate-x-1/2 pointer-events-none" style={{ left: `${m.pct}%` }}>
                  <Flame size={13} fill={track.c2} style={{ color: track.c2, filter: `drop-shadow(0 0 7px ${track.c2})` }} />
                </div>
              ))}
              <TrackStructureBar sections={structure} height={16} compact />
            </div>

            {/* Горячие моменты: несколько человек отметили одно и то же место — тап перематывает туда */}
            {hotMoments.length > 0 && (
              <div className="flex gap-2 mb-4 flex-wrap flex-shrink-0">
                {hotMoments.map(m => (
                  <motion.button
                    key={`chip-${m.pct}`}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => onSeek(m.pct)}
                    title={t("pl.hotHint", m.count)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold"
                    style={{ background: `${track.c2}1c`, border: `1px solid ${track.c2}44`, color: track.c2, fontFamily: F.m }}
                  >
                    <Flame size={11} /> {fmtSec((m.pct / 100) * (duration || 372))} · {t("pl.hotCount", m.count)}
                  </motion.button>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-3 overflow-y-auto flex-1" style={{ scrollbarWidth: "none" }}>
              {comments.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-center flex-shrink-0">
                  <MessageCircle size={22} style={{ color: "color-mix(in srgb, var(--fg) 25%, transparent)" }} />
                  <div className="mt-2.5 text-sm" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("pl.noComments")}</div>
                </div>
              )}
              {comments.map((c, i) => (
                <motion.div key={`${c.user}-${c.pct}-${i}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="flex gap-3 p-3.5 rounded-2xl" style={GLASS}>
                  <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white" style={{ background: c.avatar }}>
                    {c.user[1].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-semibold" style={{ color: track.c2, fontFamily: F.b }}>{c.user}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: `${track.c2}22`, color: track.c2, fontFamily: F.m }}>{fmtSec((c.pct / 100) * (duration || 372))}</span>
                      <SectionBadge section={sectionForPct(structure, c.pct)} />
                    </div>
                    <div className="text-sm" style={{ color: "color-mix(in srgb, var(--fg) 78%, transparent)", fontFamily: F.b }}>{c.text}</div>
                  </div>
                  <div className="flex items-center gap-1 text-xs flex-shrink-0" style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }}>
                    <Heart size={10} /> {c.likes}
                  </div>
                </motion.div>
              ))}

              <div className="flex items-center gap-3 p-3 rounded-2xl mt-1 mb-6 flex-shrink-0" style={{ ...GLASS, border: `1px dashed ${track.c2}44` }}>
                <MessageCircle size={14} style={{ color: track.c2, flexShrink: 0 }} />
                <input
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") addComment(); }}
                  placeholder={t("pl.comment", fmtSec(curSec))}
                  className="flex-1 bg-transparent outline-none text-sm min-w-0"
                  style={{ color: "var(--fg)", fontFamily: F.b }}
                />
                <motion.button whileTap={{ scale: 0.8 }} onClick={addComment} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: commentText.trim() ? track.c2 : "color-mix(in srgb, var(--wash) 08%, transparent)" }}>
                  <Send size={13} style={{ color: commentText.trim() ? "#fff" : "color-mix(in srgb, var(--fg) 30%, transparent)" }} />
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {tab === "queue" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }} className="flex-1 overflow-y-auto px-6 py-4 w-full max-w-xl mx-auto" style={{ scrollbarWidth: "none" }}>
            <div className="text-[10px] uppercase tracking-[0.16em] mb-3" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}>{t("pl.nowPlays")}</div>
            <div className="flex items-center gap-3 p-3 rounded-2xl mb-5" style={{ ...GLASS, border: `1px solid ${track.c2}44` }}>
              <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
                <img src={track.img} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate" style={{ fontFamily: F.b }}>{track.title}</div>
                <div className="text-xs truncate" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.b }}>{track.artist}</div>
              </div>
              {playing && <EQ color={track.c2} size={12} />}
            </div>

            <div className="text-[10px] uppercase tracking-[0.16em] mb-3" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}>{t("pl.upNext")}</div>
            {upNext.map((q, i) => (
              <motion.div key={q.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} onClick={() => onPlayTrack(q)} className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer hover:bg-white/5 transition-colors">
                <div className="w-5 text-center text-xs" style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)", fontFamily: F.m }}>{i + 1}</div>
                <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0">
                  <img src={q.img} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ fontFamily: F.b }}>{q.title}</div>
                  <div className="text-xs truncate" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.b }}>{q.artist} · {q.duration}</div>
                </div>
                <Play size={13} style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }} />
              </motion.div>
            ))}
            <div className="h-6" />
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ─── Плавающий остров (mobile) ────────────────────────────────────────────────

import { Home, Trophy, Library, User, Mic2 } from "lucide-react";

export const NAV = [
  { id: "home",    icon: Home,    label: "nav.home" },
  { id: "rating",  icon: Trophy,  label: "nav.rating" },
  { id: "library", icon: Library, label: "nav.library" },
  { id: "creator", icon: Mic2,    label: "nav.creator" },
  { id: "profile", icon: User,    label: "nav.profile" },
];

/** Студия видна только артистам (или тем, кто оформил MYRA Pro) */
export const navItems = (showStudio: boolean) => showStudio ? NAV : NAV.filter(n => n.id !== "creator");

export function BottomIsland({ track, playing, onToggle, onOpen, progress, onSeek, activeTab, onTab, liked, onLike, showStudio = true }: {
  track: Track; playing: boolean; onToggle: () => void; onOpen: () => void;
  progress: number; onSeek: (p: number) => void; activeTab: string; onTab: (t: string) => void;
  liked: boolean; onLike: () => void; showStudio?: boolean;
}) {
  const { t } = useLang();
  const seekRef = useRef<HTMLDivElement>(null);

  return (
    <div className="absolute bottom-0 inset-x-0 z-40 px-3 pb-3 flex flex-col gap-2 pointer-events-none" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={SPRING}
        className="pointer-events-auto rounded-[20px] overflow-hidden cursor-pointer"
        style={{ ...GLASS, background: "var(--island)", boxShadow: "0 18px 50px rgba(0,0,0,0.55)" }}
        onClick={onOpen}
      >
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0" style={{ boxShadow: `0 4px 18px ${track.c2}44` }}>
            <img src={track.img} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate" style={{ fontFamily: F.b }}>{track.title}</div>
            <div className="text-xs truncate flex items-center gap-2" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>
              {playing && <EQ color={track.c2} size={9} />}
              {track.artist}
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.75 }} onClick={e => { e.stopPropagation(); onLike(); }} className="p-1">
            <Heart size={17} fill={liked ? track.c2 : "none"} stroke={liked ? track.c2 : "color-mix(in srgb, var(--wash) 30%, transparent)"} />
          </motion.button>
          <motion.button whileTap={{ scale: 0.85 }} onClick={e => { e.stopPropagation(); onToggle(); }} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${track.c2}, ${track.c2}aa)` }}>
            {playing ? <Pause size={15} fill="white" stroke="none" /> : <Play size={15} fill="white" stroke="none" className="ml-0.5" />}
          </motion.button>
        </div>
        {/* Перемотка прямо с мини-плеера — без открытия обложки */}
        <div
          ref={seekRef}
          className="py-1.5 -mt-1.5 cursor-pointer"
          style={{ touchAction: "none" }}
          onClick={e => e.stopPropagation()}
          onPointerDown={e => {
            e.stopPropagation();
            const r = seekRef.current!.getBoundingClientRect();
            onSeek(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
          }}
        >
          <div style={{ height: 3, background: "color-mix(in srgb, var(--wash) 07%, transparent)" }}>
            <div className="h-full rounded-r-full" style={{ width: `${progress}%`, background: track.c2, transition: "width 0.3s linear" }} />
          </div>
        </div>
      </motion.div>

      <div className="pointer-events-auto mx-auto flex items-center gap-1 p-1.5 rounded-full" style={{ ...GLASS, background: "var(--island)", boxShadow: "0 18px 50px rgba(0,0,0,0.55)" }}>
        {navItems(showStudio).map(n => {
          const active = activeTab === n.id;
          const Icon = n.icon;
          return (
            <motion.button key={n.id} layout onClick={() => onTab(n.id)} className="relative flex items-center gap-1.5 rounded-full px-3.5 py-2.5" transition={SPRING}>
              {active && <motion.div layoutId="mobnav" className="absolute inset-0 rounded-full" style={{ background: `${track.c2}2e`, border: `1px solid ${track.c2}44` }} transition={SPRING} />}
              <Icon size={17} className="relative z-10" style={{ color: active ? track.c2 : "color-mix(in srgb, var(--fg) 40%, transparent)" }} />
              {active && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative z-10 text-xs font-semibold whitespace-nowrap" style={{ color: track.c2, fontFamily: F.b }}>
                  {t(n.label)}
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
