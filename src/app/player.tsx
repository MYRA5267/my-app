import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  Play, Pause, SkipBack, SkipForward, Heart, Shuffle, Repeat,
  ChevronDown, Share2, Volume2, VolumeX, Globe, Flag,
  MessageCircle, Send, Timer, BadgeCheck, ArrowDownToLine, CheckCircle2, Music2, Flame, Blend,
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { LYRICS, artistByName, loadMyComments, addMyComment, commentsFor, type Track, type Comment } from "./data";
import { commentHotMoments } from "./smart";
import { F, GLASS, SPRING, fmtSec, FrequencyOrb, Aurora, Waveform, ParticleWave, EQ, THEMES, copyText, deriveHandle, TrackStructureBar, SectionBadge } from "./lib";
import { useLang } from "./i18n";
import { supabaseEnabled, fetchComments, postComment } from "./supabase";
import { enqueueSyncOp, isNetworkError } from "./syncQueue";
import { useTrackStructure, sectionForPct } from "./structure";
import { ReportSheet } from "./overlays";

const SLEEP_OPTIONS = [15, 30, 60];

export function FullPlayer({ track, playing, onToggle, onClose, progress, duration, onSeek, onNext, onPrev, liked, onLike, volume, onVolume, onPlayTrack, onOpenArtist, onOpenAlbum, sleepLeft, onSleep, downloaded, onDownload, handle, uid, crossfade, onToggleCrossfade, shuffle, onToggleShuffle, repeat, onToggleRepeat, queue }: {
  track: Track; playing: boolean; onToggle: () => void; onClose: () => void;
  progress: number; duration: number; onSeek: (p: number) => void; onNext: () => void; onPrev: () => void;
  liked: boolean; onLike: () => void; volume: number; onVolume: (v: number) => void;
  onPlayTrack: (t: Track) => void; onOpenArtist: (name: string) => void; onOpenAlbum: (album: string) => void;
  sleepLeft: number | null; onSleep: (minutes: number | null) => void;
  downloaded: boolean; onDownload: () => void; handle: string; uid: string | null;
  crossfade: boolean; onToggleCrossfade: () => void;
  // Перемешивание/повтор живут в App и реально управляют переходами треков
  shuffle: boolean; onToggleShuffle: () => void; repeat: boolean; onToggleRepeat: () => void;
  queue: Track[];
}) {
  const { t, lang } = useLang();
  const [tab, setTab] = useState<"player" | "lyrics" | "comments" | "queue">("player");
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
        id: row.id,
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
  // Жалоба на трек целиком (кнопка в шапке) или на конкретный комментарий
  // (кнопка у строки комментария, только для реальных — см. Comment.id).
  // target_id — та же конвенция, что и track_id у комментариев (см. data.ts):
  // настоящий uuid для опубликованных треков, "catalog:N" для демо-каталога
  const [reportTarget, setReportTarget] = useState<{ type: "track" | "comment"; id: string } | null>(null);
  const reportTrackId = remoteTrackId ?? `catalog:${track.id}`;
  const volRef = useRef<HTMLDivElement>(null);
  const volDragging = useRef(false);

  // Параллакс орба: наклон телефона (гироскоп) или указатель на десктопе.
  // Прямая мутация transform через rAF — БЕЗ setState: 60 Гц событий
  // deviceorientation через React-состояние вернули бы ту самую лавину
  // ре-рендеров, с которой боролись. В fx-simple гасится CSS-правилом
  const parallaxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // В упрощённой графике CSS всё равно занулит transform — не вешаем
    // слушатели 60 Гц-событий впустую
    if (document.querySelector(".fx-simple")) return;
    let raf = 0, tx = 0, ty = 0;
    const apply = () => {
      raf = 0;
      if (parallaxRef.current) parallaxRef.current.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`;
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(apply); };
    const clamp = (v: number, lim: number) => Math.max(-lim, Math.min(lim, v));
    const onOri = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      tx = clamp(e.gamma * 0.35, 11);
      ty = clamp((e.beta - 45) * 0.25, 11);
      schedule();
    };
    const onPointer = (e: PointerEvent) => {
      tx = clamp((e.clientX / window.innerWidth - 0.5) * 22, 11);
      ty = clamp((e.clientY / window.innerHeight - 0.5) * 22, 11);
      schedule();
    };
    window.addEventListener("deviceorientation", onOri);
    window.addEventListener("pointermove", onPointer);
    return () => {
      window.removeEventListener("deviceorientation", onOri);
      window.removeEventListener("pointermove", onPointer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Эвристическая структура трека (интро/куплет/припев/...) — см. structure.ts.
  // Не блокирует ничего: пока анализ не готов или не удался (сеть/CORS/формат),
  // просто null, и волна выглядит как раньше.
  const structure = useTrackStructure(track);

  const lines = LYRICS[track.id];
  const lyricIndex = Math.min((lines?.length ?? 1) - 1, Math.floor((progress / 100) * (lines?.length ?? 1)));
  const wordIndex = Math.floor(((progress / 100) * (lines?.length ?? 1) - lyricIndex) * (lines?.[lyricIndex]?.en.length ?? 1));
  const curSec = (progress / 100) * (duration || 0);
  const sleepMinutes = sleepLeft === null ? null : Math.ceil(sleepLeft / 60);
  // Округляем до целого % для тяжёлых визуалов (орб, волна) — они и так плавно
  // доезжают через собственный rAF-интерполятор, а лишний ре-рендер 48+72 узлов
  // на каждый дробный тик прогресса — то, что подвешивало плеер на слабых телефонах.
  const progressRounded = Math.round(progress);
  const verified = artistByName(track.artist)?.verified;

  // «Дальше» — от НАСТОЯЩЕЙ очереди (локальные файлы + каталог), той же,
  // по которой ходит handleNext; раньше вкладка показывала только каталог
  const queueIdx = queue.findIndex(q => q.id === track.id);
  const upNext = queueIdx >= 0
    ? [...queue.slice(queueIdx + 1), ...queue.slice(0, queueIdx)]
    : queue;

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
      // Пишем сразу и оптимистично добавляем в список — не ждём рефетча.
      // Сетевой сбой не теряет комментарий: он встаёт в офлайн-очередь и
      // доотправится при возвращении сети (см. syncQueue.ts)
      const enqueue = () => enqueueSyncOp("comment", { trackId: remoteTrackId, pct, text });
      postComment(uid, remoteTrackId, pct, text)
        .then(({ error }) => { if (error && isNetworkError(error)) enqueue(); })
        .catch(err => { if (isNetworkError(err)) enqueue(); else console.warn("postComment:", err); });
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
    <div className="myra-full-player absolute inset-0 flex flex-col overflow-hidden" style={{ ...(THEMES.dark as React.CSSProperties), background: "var(--bg)", color: "var(--fg)" }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img src={track.img} alt="" className="fx-heavy absolute inset-0 w-full h-full object-cover opacity-50" style={{ filter: "blur(110px) saturate(1.45) brightness(0.15)", transform: "scale(1.35)" }} />
        <Aurora c2={track.c2} opacity={0.42} />
        <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 28% 46%, ${track.c2}18 0%, transparent 34%), linear-gradient(115deg, rgba(2,2,7,0.66), rgba(2,2,7,0.94) 70%)` }} />
        <div className="myra-player-noise absolute inset-0" />
      </div>

      {/* Header */}
      <header className="myra-player-header relative z-20 flex-shrink-0">
        <motion.button aria-label={t("pl.close")} title={t("pl.close")} whileTap={{ scale: 0.88 }} onClick={onClose} className="myra-player-icon-button">
          <ChevronDown size={19} />
        </motion.button>
        <nav className="myra-player-tabs" aria-label={t("pl.playerNav")}>
          {TABS.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className="myra-player-tab" aria-current={tab === id ? "page" : undefined} style={{ fontFamily: F.b, color: tab === id ? "#fff" : "rgba(242,242,248,0.46)" }}>
              {tab === id && <motion.div layoutId="playertab" className="absolute inset-0 rounded-full" style={{ background: `linear-gradient(135deg, ${track.c2}, ${track.c2}c7)`, boxShadow: `0 8px 28px ${track.c2}38` }} transition={SPRING} />}
              <span className="relative z-10">{label}</span>
            </button>
          ))}
        </nav>
        <div className="myra-player-header-actions">
          <motion.button aria-label={t("report.title")} title={t("report.title")} whileTap={{ scale: 0.88 }} onClick={() => setReportTarget({ type: "track", id: reportTrackId })} className="myra-player-icon-button">
            <Flag size={16} />
          </motion.button>
          <motion.button aria-label={t("pl.share")} title={t("pl.share")} whileTap={{ scale: 0.88 }} onClick={shareTrack} className="myra-player-icon-button">
            <Share2 size={17} />
          </motion.button>
        </div>
      </header>

      <div className="relative z-10 flex-1 overflow-hidden flex flex-col">
        {tab === "player" && (
          <motion.main initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, ease: [0.32, 0.72, 0, 1] }} className="myra-player-shell">
            <section className="myra-player-visual" aria-label={t("pl.visualizer")}>
              <img src={track.img} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ filter: "saturate(1.12) brightness(0.48)", transform: "scale(1.02)" }} />
              <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(2,2,8,0.18), rgba(2,2,8,0.48) 55%, rgba(2,2,8,0.88))" }} />
              <div className="absolute inset-0" style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.13), inset 0 0 0 1px rgba(255,255,255,0.07)" }} />

              <div className="absolute left-5 right-5 top-5 flex items-center justify-between z-10">
                <div className="myra-player-kicker">
                  <span className="myra-live-dot" style={{ background: track.c2, boxShadow: `0 0 14px ${track.c2}` }} />
                  {t("pl.nowPlays")}
                </div>
                <SectionBadge section={sectionForPct(structure, progressRounded)} />
              </div>

              <div ref={parallaxRef} className="fx-parallax relative z-10" style={{ willChange: "transform" }}>
                <FrequencyOrb track={track} playing={playing} progress={progressRounded} />
              </div>
            </section>

            <section className="myra-player-content">
              <div className="myra-player-meta">
                <div className="min-w-0">
                  <div className="myra-player-eyebrow" style={{ fontFamily: F.m }}>{track.genre} · {track.plays}</div>
                  <h1 className="myra-player-title" style={{ fontFamily: F.d }}>{track.title}</h1>
                  <div className="flex items-center gap-2 mt-2.5 min-w-0">
                    <button onClick={() => onOpenArtist(track.artist)} className="myra-player-artist">
                      {track.artist}
                      {verified && <BadgeCheck size={15} style={{ color: track.c2 }} />}
                    </button>
                    <span className="text-white/20">·</span>
                    <button onClick={() => onOpenAlbum(track.album)} className="myra-player-album">{track.album}</button>
                  </div>
                </div>
                <motion.button aria-label={liked ? t("pl.unlike") : t("pl.like")} title={liked ? t("pl.unlike") : t("pl.like")} whileTap={{ scale: 0.84 }} onClick={onLike} className="myra-player-like" style={{ background: liked ? `${track.c2}1f` : undefined, borderColor: liked ? `${track.c2}48` : undefined }}>
                  <Heart size={21} fill={liked ? track.c2 : "none"} stroke={liked ? track.c2 : "rgba(255,255,255,0.68)"} />
                </motion.button>
              </div>

              <div className="myra-player-timeline">
                <ParticleWave progress={progressRounded} color={track.c2} onSeek={onSeek} height={64} playing={playing} />
                <TrackStructureBar sections={structure} height={22} />
                <div className="flex justify-between mt-2.5 text-[11px]" style={{ color: "rgba(242,242,248,0.42)", fontFamily: F.m }}>
                  <span>{fmtSec(curSec)}</span>
                  <span>-{duration ? fmtSec(Math.max(0, duration - curSec)) : track.duration}</span>
                </div>
              </div>

              <div className="myra-player-controls">
                <motion.button aria-label={t("pl.shuffle")} title={t("pl.shuffle")} whileTap={{ scale: 0.86 }} onClick={() => { onToggleShuffle(); toast(shuffle ? t("pl.shuffleOff") : t("pl.shuffleOn")); }} className="myra-player-control myra-player-control-small" data-active={shuffle || undefined} style={{ color: shuffle ? track.c2 : undefined }}>
                  <Shuffle size={19} />
                </motion.button>
                <motion.button aria-label={t("pl.previous")} title={t("pl.previous")} whileTap={{ scale: 0.86 }} onClick={onPrev} className="myra-player-control">
                  <SkipBack size={23} fill="currentColor" />
                </motion.button>
                <motion.button aria-label={playing ? t("pl.pause") : t("pl.play")} title={playing ? t("pl.pause") : t("pl.play")} whileTap={{ scale: 0.91 }} whileHover={{ scale: 1.035 }} onClick={onToggle} className="myra-player-play" style={{ background: `linear-gradient(145deg, ${track.c2}, ${track.c2}b8)`, boxShadow: `0 18px 55px ${track.c2}42, inset 0 1px 0 rgba(255,255,255,0.34)` }}>
                  {playing ? <Pause size={29} fill="white" stroke="none" /> : <Play size={30} fill="white" stroke="none" className="ml-1" />}
                </motion.button>
                <motion.button aria-label={t("pl.next")} title={t("pl.next")} whileTap={{ scale: 0.86 }} onClick={onNext} className="myra-player-control">
                  <SkipForward size={23} fill="currentColor" />
                </motion.button>
                <motion.button aria-label={t("pl.repeat")} title={t("pl.repeat")} whileTap={{ scale: 0.86 }} onClick={() => { onToggleRepeat(); toast(repeat ? t("pl.repeatOff") : t("pl.repeatOn")); }} className="myra-player-control myra-player-control-small" data-active={repeat || undefined} style={{ color: repeat ? track.c2 : undefined }}>
                  <Repeat size={19} />
                </motion.button>
              </div>

              <div className="myra-player-utilities">
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => { onToggleCrossfade(); toast(crossfade ? t("pl.fadeOff") : t("pl.fadeOn")); }} className="myra-player-utility" data-active={crossfade || undefined} style={{ color: crossfade ? track.c2 : undefined, borderColor: crossfade ? `${track.c2}42` : undefined }}>
                  <Blend size={16} />
                  <span>{t("pl.fade")}</span>
                </motion.button>
                <motion.button whileTap={{ scale: 0.96 }} onClick={onDownload} className="myra-player-utility" data-active={downloaded || undefined} style={{ color: downloaded ? "#5ee7ac" : undefined, borderColor: downloaded ? "rgba(94,231,172,0.3)" : undefined }}>
                  {downloaded ? <CheckCircle2 size={16} /> : <ArrowDownToLine size={16} />}
                  <span>{t("pl.offline")}</span>
                </motion.button>
                <div className="relative">
                  <motion.button whileTap={{ scale: 0.96 }} onClick={() => setSleepOpen(o => !o)} className="myra-player-utility" data-active={sleepLeft !== null || undefined} style={{ color: sleepLeft !== null ? track.c2 : undefined, borderColor: sleepLeft !== null ? `${track.c2}42` : undefined }}>
                    <Timer size={16} />
                    <span>{sleepMinutes !== null ? `${sleepMinutes}${lang === "ru" ? "м" : "m"}` : t("pl.sleep")}</span>
                  </motion.button>

                  {sleepOpen && (
                    <motion.div initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="myra-player-sleep-menu">
                      <div className="text-[10px] uppercase tracking-[0.14em] mb-2 px-1" style={{ color: "rgba(242,242,248,0.42)", fontFamily: F.m }}>{t("pl.sleep")}</div>
                      <div className="flex gap-1.5">
                        {SLEEP_OPTIONS.map(m => (
                          <button key={m} onClick={() => { onSleep(m); setSleepOpen(false); toast(t("pl.sleepSet", m)); }} className="px-3 py-2 rounded-xl text-xs font-semibold" style={{ background: "rgba(255,255,255,0.07)", fontFamily: F.b }}>
                            {m}{lang === "ru" ? "м" : "m"}
                          </button>
                        ))}
                        <button onClick={() => { onSleep(null); setSleepOpen(false); toast(t("pl.sleepUnset")); }} className="px-3 py-2 rounded-xl text-xs font-semibold" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(242,242,248,0.52)", fontFamily: F.b }}>
                          {t("pl.sleepOff")}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              <div className="myra-player-volume">
                <button aria-label={t("pl.volume")} title={t("pl.volume")} onClick={() => onVolume(volume > 0 ? 0 : 0.75)} className="myra-player-volume-icon">
                  {volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
                </button>
                <div
                  ref={volRef}
                  role="slider"
                  aria-label={t("pl.volume")}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(volume * 100)}
                  className="flex-1 relative py-3 cursor-pointer"
                  style={{ touchAction: "none" }}
                  onPointerDown={e => { volDragging.current = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setVol(e.clientX); }}
                  onPointerMove={e => { if (volDragging.current) setVol(e.clientX); }}
                  onPointerUp={() => { volDragging.current = false; }}
                  onPointerCancel={() => { volDragging.current = false; }}
                >
                  <div className="rounded-full" style={{ height: 3, background: "rgba(255,255,255,0.1)" }}>
                    <div className="h-full rounded-full relative" style={{ width: `${volume * 100}%`, background: `linear-gradient(90deg, ${track.c2}99, ${track.c2})` }}>
                      <div className="absolute right-0 top-1/2 w-2.5 h-2.5 rounded-full bg-white" style={{ transform: "translate(50%,-50%)", boxShadow: "0 2px 8px rgba(0,0,0,0.65)" }} />
                    </div>
                  </div>
                </div>
                <span className="w-8 text-right text-[10px]" style={{ color: "rgba(242,242,248,0.38)", fontFamily: F.m }}>{Math.round(volume * 100)}</span>
              </div>
            </section>
          </motion.main>
        )}

        {false && tab === "player" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }} className="flex-1 flex flex-col px-6 pt-2 overflow-y-auto w-full max-w-xl mx-auto" style={{ scrollbarWidth: "none" }}>
            <div className="flex justify-center items-center mb-6 mt-1">
              <div ref={parallaxRef} className="fx-parallax" style={{ willChange: "transform" }}>
                <FrequencyOrb track={track} playing={playing} progress={progressRounded} />
              </div>
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

            {/* Волна — поток частиц вместо баров, тот же приём, что на главной */}
            <div className="mb-5">
              <ParticleWave progress={progressRounded} color={track.c2} onSeek={onSeek} height={56} playing={playing} />
              <TrackStructureBar sections={structure} />
              <div className="flex justify-between mt-2 text-xs" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}>
                <span>{fmtSec(curSec)}</span>
                <span>{duration ? fmtSec(duration) : track.duration}</span>
              </div>
            </div>

            {/* Управление — единый вес у всех кнопок (стеклянные объёмные чипы),
                Перелив стоит парой с shuffle: обе — модификаторы воспроизведения */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-1.5">
                <motion.button whileTap={{ scale: 0.85 }} onClick={() => { onToggleCrossfade(); toast(crossfade ? t("pl.fadeOff") : t("pl.fadeOn")); }} title={t("pl.fade")} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ ...GLASS, background: crossfade ? `${track.c2}26` : GLASS.background }}>
                  <Blend size={16} style={{ color: crossfade ? track.c2 : "color-mix(in srgb, var(--wash) 40%, transparent)" }} />
                </motion.button>
                <motion.button whileTap={{ scale: 0.85 }} onClick={() => { onToggleShuffle(); toast(shuffle ? t("pl.shuffleOff") : t("pl.shuffleOn")); }} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ ...GLASS, background: shuffle ? `${track.c2}26` : GLASS.background }}>
                  <Shuffle size={17} style={{ color: shuffle ? track.c2 : "color-mix(in srgb, var(--wash) 40%, transparent)" }} />
                </motion.button>
              </div>
              <motion.button whileTap={{ scale: 0.85 }} onClick={onPrev} className="w-12 h-12 rounded-full flex items-center justify-center" style={GLASS}>
                <SkipBack size={20} fill="currentColor" />
              </motion.button>
              <motion.button whileTap={{ scale: 0.9 }} whileHover={{ scale: 1.04 }} onClick={onToggle} className="rounded-full flex items-center justify-center" style={{ width: 74, height: 74, background: `linear-gradient(135deg, ${track.c2}, ${track.c2}aa)`, boxShadow: `0 0 54px ${track.c2}5c` }}>
                {playing ? <Pause size={28} fill="white" stroke="none" /> : <Play size={28} fill="white" stroke="none" className="ml-1" />}
              </motion.button>
              <motion.button whileTap={{ scale: 0.85 }} onClick={onNext} className="w-12 h-12 rounded-full flex items-center justify-center" style={GLASS}>
                <SkipForward size={20} fill="currentColor" />
              </motion.button>
              <motion.button whileTap={{ scale: 0.85 }} onClick={onDownload} title="offline" className="w-10 h-10 rounded-full flex items-center justify-center" style={GLASS}>
                {downloaded ? <CheckCircle2 size={18} style={{ color: "#34d399" }} /> : <ArrowDownToLine size={18} style={{ color: "color-mix(in srgb, var(--wash) 40%, transparent)" }} />}
              </motion.button>
              <motion.button whileTap={{ scale: 0.85 }} onClick={() => { onToggleRepeat(); toast(repeat ? t("pl.repeatOff") : t("pl.repeatOn")); }} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ ...GLASS, background: repeat ? `${track.c2}26` : GLASS.background }}>
                <Repeat size={17} style={{ color: repeat ? track.c2 : "color-mix(in srgb, var(--wash) 40%, transparent)" }} />
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
                {sleepMinutes !== null && <span className="text-[11px] font-semibold" style={{ color: track.c2, fontFamily: F.m }}>{sleepMinutes}м</span>}
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
                    {(c.user.replace(/^@/, "")[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-semibold" style={{ color: track.c2, fontFamily: F.b }}>{c.user}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: `${track.c2}22`, color: track.c2, fontFamily: F.m }}>{fmtSec((c.pct / 100) * (duration || 372))}</span>
                      <SectionBadge section={sectionForPct(structure, c.pct)} />
                    </div>
                    <div className="text-sm" style={{ color: "color-mix(in srgb, var(--fg) 78%, transparent)", fontFamily: F.b }}>{c.text}</div>
                  </div>
                  <div className="flex items-center gap-2 text-xs flex-shrink-0" style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }}>
                    <Heart size={10} /> {c.likes}
                    {/* Пожаловаться можно только на реальный комментарий (id есть
                        только у строк из public.comments) — у затравочных и
                        локальных комментариев жаловаться физически не на что */}
                    {c.id && (
                      <button onClick={() => setReportTarget({ type: "comment", id: c.id! })} title={t("report.title")} className="opacity-60 hover:opacity-100 transition-opacity">
                        <Flag size={11} />
                      </button>
                    )}
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

      <ReportSheet
        open={!!reportTarget}
        onClose={() => setReportTarget(null)}
        uid={uid}
        targetType={reportTarget?.type ?? "track"}
        targetId={reportTarget?.id ?? null}
      />
    </div>
  );
}

// ─── Плавающий остров (mobile) ────────────────────────────────────────────────

import { Home, Search, Library, User, Mic2 } from "lucide-react";

export const NAV = [
  { id: "home",    icon: Home,    label: "nav.home" },
  { id: "browse",  icon: Search,  label: "nav.browse" },
  { id: "library", icon: Library, label: "nav.library" },
  { id: "creator", icon: Mic2,    label: "nav.creator" },
  { id: "profile", icon: User,    label: "nav.profile" },
];

/** Студия видна только артистам (или тем, кто оформил MYRA Pro) */
export const navItems = (showStudio: boolean) => showStudio ? NAV : NAV.filter(n => n.id !== "creator");

// memo обязателен: остров — единственный вечно видимый крупный компонент на
// мобильных, и без memo он перерисовывался (~50 узлов поверх blur-стекла)
// на каждый тик прогресса и любой чих AppInner
export const BottomIsland = React.memo(function BottomIsland({ track, playing, onToggle, onOpen, progress, onSeek, activeTab, onTab, liked, onLike, showStudio = true }: {
  track: Track; playing: boolean; onToggle: () => void; onOpen: () => void;
  progress: number; onSeek: (p: number) => void; activeTab: string; onTab: (t: string) => void;
  liked: boolean; onLike: () => void; showStudio?: boolean;
}) {
  const { t } = useLang();
  const seekRef = useRef<HTMLDivElement>(null);

  return (
    <div className="myra-mobile-dock absolute bottom-0 inset-x-0 z-40 px-3 pb-3 flex flex-col gap-2 pointer-events-none" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={SPRING}
        className="myra-mini-player pointer-events-auto rounded-[20px] overflow-hidden cursor-pointer"
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
          <div className="overflow-hidden" style={{ height: 3, background: "color-mix(in srgb, var(--wash) 07%, transparent)" }}>
            {/* scaleX вместо width: анимация width — это layout+paint внутри
                стеклянного острова, инвалидирующие blur-слой композитора на
                каждый тик; transform обходится одним композитом */}
            <div className="h-full w-full rounded-r-full" style={{ transform: `scaleX(${progress / 100})`, transformOrigin: "left", background: track.c2, transition: "transform 0.3s linear" }} />
          </div>
        </div>
      </motion.div>

      <nav className="myra-mobile-nav pointer-events-auto mx-auto flex items-center gap-1 p-1.5 rounded-full" aria-label={t("pl.playerNav")}>
        {navItems(showStudio).map(n => {
          const active = activeTab === n.id;
          const Icon = n.icon;
          return (
            <motion.button key={n.id} layout onClick={() => onTab(n.id)} aria-label={t(n.label)} className="myra-mobile-nav-item relative flex items-center gap-1.5 rounded-full px-3.5 py-2.5" transition={SPRING}>
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
      </nav>
    </div>
  );
});
