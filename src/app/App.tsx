import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { SkipBack, SkipForward, Play, Pause } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Toaster, toast } from "sonner";

import { TRACKS, AVATARS, PLAYLISTS, ls, svgCover, LEADERBOARD_PEERS, type Track, type Friend, type Playlist } from "./data";
import { F, GLASS, SPRING, useAudio, DynamicBg, Waveform, EQ, THEMES, ThemeCtx, ON_DARK, onDark, type ThemeName } from "./lib";
import { smartNext, pushHistory } from "./smart";
import { saveDownload, loadDownloads, deleteDownload } from "./idb";
import { LangProvider, useLang } from "./i18n";
import { OnboardingFlow } from "./auth";
import { HomeScreen, RatingScreen, LibraryScreen, CreatorScreen, ProfileScreen } from "./screens";
import { FullPlayer, BottomIsland, NAV } from "./player";
import { ArtistSheet, AlbumSheet, PlaylistSheet, BlendSheet, AccountSheet, CreatorPlusSheet, WrappedModal, StudioStatsSheet, ImportSheet, SupportSheet, PeerProfileSheet } from "./overlays";
import { LiveSessionSheet } from "./live";
import { saveLocalTrack, loadLocalTracks, deleteLocalTrack } from "./idb";

const LOCAL_PALETTE: [string, string][] = [
  ["#12083a", "#8b5cf6"], ["#071a10", "#34d399"], ["#1a0a08", "#fb923c"],
  ["#0f0818", "#f472b6"], ["#071218", "#38bdf8"], ["#181200", "#facc15"],
];

type Tab = "home" | "rating" | "library" | "creator" | "profile";

function AppInner() {
  const { t, lang } = useLang();

  const [theme, setTheme] = useState<ThemeName>(() => ls.get<ThemeName>("theme", "dark"));
  const toggleTheme = useCallback(() => {
    setTheme(th => {
      const next = th === "dark" ? "light" : "dark";
      ls.set("theme", next);
      return next;
    });
  }, []);

  const [crossfade, setCrossfade] = useState(() => ls.get("crossfade", true));
  const fadeRef = useRef(crossfade);
  fadeRef.current = crossfade;
  const toggleCrossfade = useCallback(() => {
    setCrossfade(c => { ls.set("crossfade", !c); return !c; });
  }, []);

  const [onboarded, setOnboarded] = useState(() => ls.get("onboarded", false));
  const [userName, setUserName] = useState(() => ls.get("userName", "Алекс"));
  const [avatarIdx, setAvatarIdx] = useState(() => ls.get("avatarIdx", 0));
  // Подписка: none → active → grace (отменена, но действует до конца периода)
  const [cpStatus, setCpStatus] = useState<"none" | "active" | "grace">(() => {
    const raw = ls.get<"none" | "active" | "grace" | boolean>("cpStatus", ls.get("creatorPlus", false) ? "active" : "none");
    return raw === true ? "active" : raw === false ? "none" : raw;
  });
  const setCp = useCallback((s: "none" | "active" | "grace") => { setCpStatus(s); ls.set("cpStatus", s); }, []);
  const creatorPlus = cpStatus !== "none";
  const [customAvatar, setCustomAvatar] = useState<string | null>(() => ls.get<string | null>("customAvatar", null));
  const [followed, setFollowed] = useState<Set<string>>(() => new Set(ls.get<string[]>("followed", [])));

  const [tab, setTabState] = useState<Tab>(() => ls.get<Tab>("tab", "home"));
  const setTab = useCallback((id: Tab) => {
    setTabState(id);
    ls.set("tab", id);
  }, []);
  const [currentTrack, setCurrentTrack] = useState<Track>(TRACKS[0]);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<number>>(() => new Set(ls.get<number[]>("liked", TRACKS.filter(tr => tr.liked).map(tr => tr.id))));

  const [artistName, setArtistName] = useState<string | null>(null);
  const [albumName, setAlbumName] = useState<string | null>(null);
  const [peerProfile, setPeerProfile] = useState<typeof LEADERBOARD_PEERS[number] | null>(null);
  const [playlistId, setPlaylistId] = useState<string | null>(null);
  const [plOrders, setPlOrders] = useState<Record<string, number[]>>(() => ls.get("plOrders", {}));
  const [blendFriend, setBlendFriend] = useState<Friend | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [creatorPlusOpen, setCreatorPlusOpen] = useState(false);
  const [wrappedOpen, setWrappedOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const openAccount = useCallback(() => setAccountOpen(true), []);
  const openCreatorPlus = useCallback(() => setCreatorPlusOpen(true), []);
  const openWrapped = useCallback(() => setWrappedOpen(true), []);
  const openStats = useCallback(() => setStatsOpen(true), []);
  const [liveFriend, setLiveFriend] = useState<Friend | null>(null);
  const [sleepLeft, setSleepLeft] = useState<number | null>(null);
  const [myTracks, setMyTracks] = useState<Track[]>([]);

  const [downloads, setDownloads] = useState<Map<number, string>>(new Map());
  const [customPls, setCustomPls] = useState<Playlist[]>(() => ls.get<Playlist[]>("customPls", []));
  const [importOpen, setImportOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const allPlaylists = useMemo(() => [...customPls, ...PLAYLISTS], [customPls]);
  const customPlIds = useMemo(() => new Set(customPls.map(p => p.id)), [customPls]);

  const loadedRef = useRef(false);
  const nextRef = useRef<() => void>(() => {});
  const audio = useAudio(() => nextRef.current(), () => fadeRef.current);

  // Скачанные для офлайна треки каталога
  useEffect(() => {
    loadDownloads().then(recs => {
      if (recs.length) setDownloads(new Map(recs.map(r => [r.id, URL.createObjectURL(r.blob)])));
    });
  }, []);

  const avatar = customAvatar ?? AVATARS[avatarIdx] ?? AVATARS[0];

  // dev-хук для интеграционных проверок
  if ((import.meta as any).env?.DEV) {
    (window as any).__myra = { tab, playerOpen, artistName, blendFriend: blendFriend?.name ?? null, liveFriend: liveFriend?.name ?? null, accountOpen, creatorPlusOpen, wrappedOpen, statsOpen, playlistId, onboarded, myTracks: myTracks.length };
  }

  // Локальные файлы пользователя из IndexedDB
  useEffect(() => {
    loadLocalTracks().then(recs => {
      if (!recs.length) return;
      setMyTracks(recs.map(r => ({
        id: r.id, title: r.title, artist: r.artist, album: "Local", duration: r.duration,
        genre: "Local", plays: "0", liked: false, c1: r.c1, c2: r.c2,
        img: svgCover(r.c1, r.c2, r.id), url: URL.createObjectURL(r.blob), local: true,
      })));
    });
  }, []);

  // Скачанный офлайн-файл важнее стрима
  const downloadsRef = useRef(downloads);
  downloadsRef.current = downloads;
  const resolveUrl = useCallback((tr: Track) => downloadsRef.current.get(tr.id) ?? tr.url, []);

  const playTrack = useCallback((tr: Track) => {
    setCurrentTrack(prev => {
      if (prev.id === tr.id && loadedRef.current) {
        audio.toggle();
        return prev;
      }
      loadedRef.current = true;
      audio.load(resolveUrl(tr));
      pushHistory(tr.id);
      return tr;
    });
  }, [audio, resolveUrl]);

  const togglePlay = useCallback(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      audio.load(resolveUrl(currentTrack));
      pushHistory(currentTrack.id);
    } else {
      audio.toggle();
    }
  }, [audio, currentTrack, resolveUrl]);

  // Очередь = локальные файлы + каталог
  const queueRef = useRef<Track[]>(TRACKS);
  queueRef.current = myTracks.length ? [...myTracks, ...TRACKS] : TRACKS;

  const step = useCallback((dir: 1 | -1) => {
    setCurrentTrack(prev => {
      const q = queueRef.current;
      const idx = q.findIndex(tr => tr.id === prev.id);
      const next = q[(idx + dir + q.length) % q.length] ?? q[0];
      loadedRef.current = true;
      audio.load(resolveUrl(next));
      pushHistory(next.id);
      return next;
    });
  }, [audio, resolveUrl]);

  const handleNext = useCallback(() => step(1), [step]);
  const handlePrev = useCallback(() => step(-1), [step]);

  // «Моя волна»: умный подбор без повторов + причина выбора
  const likedRef = useRef(likedIds); likedRef.current = likedIds;
  const followedRef = useRef(followed); followedRef.current = followed;
  const langRef = useRef(lang); langRef.current = lang;
  const playWave = useCallback((silent = false) => {
    setCurrentTrack(prev => {
      const { track, reason } = smartNext(queueRef.current, likedRef.current, followedRef.current, prev.id, langRef.current);
      loadedRef.current = true;
      audio.load(resolveUrl(track));
      pushHistory(track.id);
      if (!silent) toast(`MYRA AI · ${track.title} — ${reason}`);
      return track;
    });
  }, [audio, resolveUrl]);

  // Загрузка трека для офлайна
  const downloadTrack = useCallback(async (tr: Track) => {
    if (downloadsRef.current.has(tr.id)) {
      const url = downloadsRef.current.get(tr.id)!;
      URL.revokeObjectURL(url);
      setDownloads(prev => { const m = new Map(prev); m.delete(tr.id); return m; });
      deleteDownload(tr.id).catch(() => {});
      toast(t("dl.removed"));
      return;
    }
    toast(t("dl.loading", tr.title));
    try {
      const res = await fetch(tr.url);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      await saveDownload(tr.id, blob).catch(() => {});
      setDownloads(prev => new Map(prev).set(tr.id, URL.createObjectURL(blob)));
      toast.success(t("dl.done", tr.title));
    } catch {
      toast(t("dl.fail"));
    }
  }, [t]);

  // Свои плейлисты (создание + импорт)
  const createPlaylist = useCallback((name: string, trackIds: number[]) => {
    const pl: Playlist = { id: "u" + Date.now(), name, img: svgCover("#12083a", "#8b5cf6", Date.now() % 97), trackIds };
    setCustomPls(prev => { const next = [pl, ...prev]; ls.set("customPls", next); return next; });
    return pl;
  }, []);

  const deletePlaylist = useCallback((id: string) => {
    setCustomPls(prev => { const next = prev.filter(p => p.id !== id); ls.set("customPls", next); return next; });
    setPlaylistId(cur => (cur === id ? null : cur));
    toast(t("lib.plDeleted"));
  }, [t]);

  const handleCreatePlaylist = useCallback((name: string) => { createPlaylist(name, []); }, [createPlaylist]);

  // Добавление своих аудиофайлов (клик или drag-n-drop)
  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = [...files].filter(f => f.type.startsWith("audio/") || /\.(mp3|wav|flac|m4a|ogg|aac)$/i.test(f.name));
    if (!list.length) return;
    const added: Track[] = [];
    for (const f of list) {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const [c1, c2] = LOCAL_PALETTE[id % LOCAL_PALETTE.length];
      const title = f.name.replace(/\.[^.]+$/, "");
      try { await saveLocalTrack({ id, title, artist: userName, duration: "", c1, c2, blob: f }); } catch { /* без сохранения */ }
      added.push({
        id, title, artist: userName, album: "Local", duration: "", genre: "Local", plays: "0",
        liked: false, c1, c2, img: svgCover(c1, c2, id), url: URL.createObjectURL(f), local: true,
      });
    }
    setMyTracks(prev => [...added, ...prev]);
    toast(t("cr.added", added.length));
  }, [userName, t]);

  const removeLocal = useCallback((id: number) => {
    setMyTracks(prev => prev.filter(tr => tr.id !== id));
    deleteLocalTrack(id).catch(() => {});
    toast(t("cr.deleted"));
  }, [t]);

  const openLive = useCallback((f: Friend) => {
    setLiveFriend(f);
    if (!(currentTrack.id === f.track.id && audio.playing)) playTrack(f.track);
  }, [currentTrack.id, audio.playing, playTrack]);

  // Автопереход = умная волна (без повторов), ручной next — по очереди
  useEffect(() => { nextRef.current = () => playWave(true); }, [playWave]);

  // Управление с локскрина/шторки (Android/десктоп)
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: currentTrack.album,
      artwork: [{ src: currentTrack.img, sizes: "500x500", type: "image/svg+xml" }],
    });
    navigator.mediaSession.setActionHandler("play", () => togglePlay());
    navigator.mediaSession.setActionHandler("pause", () => togglePlay());
    navigator.mediaSession.setActionHandler("nexttrack", () => handleNext());
    navigator.mediaSession.setActionHandler("previoustrack", () => handlePrev());
  }, [currentTrack, togglePlay, handleNext, handlePrev]);

  // Пауза фоновых анимаций, когда приложение свёрнуто — экономия батареи
  useEffect(() => {
    const onVis = () => document.documentElement.classList.toggle("app-hidden", document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (sleepLeft === null) return;
    const iv = setInterval(() => {
      setSleepLeft(s => {
        if (s === null || s <= 1) {
          audio.pause();
          toast(t("pl.sleepDone"));
          return null;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [sleepLeft, audio, t]);

  const toggleLike = useCallback((id: number) => {
    setLikedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); toast(t("like.rm")); }
      else { next.add(id); toast(t("like.add")); }
      ls.set("liked", [...next]);
      return next;
    });
  }, [t]);

  const toggleFollow = useCallback((name: string) => {
    setFollowed(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      ls.set("followed", [...next]);
      return next;
    });
  }, []);

  const openArtist = useCallback((name: string) => {
    setAlbumName(null);
    setArtistName(name);
  }, []);

  const openAlbum = useCallback((album: string) => {
    setArtistName(null);
    setAlbumName(album);
  }, []);

  const plOrder = playlistId
    ? (plOrders[playlistId] ?? allPlaylists.find(p => p.id === playlistId)?.trackIds ?? [])
    : [];
  const reorderPlaylist = useCallback((ids: number[]) => {
    if (!playlistId) return;
    setPlOrders(prev => {
      const next = { ...prev, [playlistId]: ids };
      ls.set("plOrders", next);
      return next;
    });
  }, [playlistId]);

  const finishOnboarding = useCallback((name: string) => {
    setUserName(name);
    ls.set("userName", name);
    ls.set("onboarded", true);
    setOnboarded(true);
    toast(t("au.created"));
  }, [t]);

  const handleLogout = useCallback(() => {
    audio.pause();
    ls.clear();
    setOnboarded(false);
    setTab("home");
    setPlayerOpen(false);
    setAccountOpen(false);
    toast(t("pr.loggedOut"));
  }, [audio, t]);

  const handleDeleteAccount = useCallback(() => {
    handleLogout();
    toast(t("acc.deleted"));
  }, [handleLogout, t]);

  const handleSleep = useCallback((minutes: number | null) => {
    setSleepLeft(minutes === null ? null : minutes * 60);
  }, []);

  // Тема оборачивает и онбординг, и приложение; Toaster общий
  const themedRoot = (children: React.ReactNode) => (
    <ThemeCtx.Provider value={{ theme, toggleTheme }}>
      <div className="h-screen w-full" style={{ ...(THEMES[theme] as React.CSSProperties), background: "var(--bg)", color: "var(--fg)", fontFamily: F.b, transition: "background 0.4s ease, color 0.4s ease" }}>
        <style>{`
          @keyframes drift1 { 0%,100%{transform:translate(-8%,-6%) scale(1)} 50%{transform:translate(8%,10%) scale(1.2)} }
          @keyframes drift2 { 0%,100%{transform:translate(10%,6%) scale(1.1)} 50%{transform:translate(-10%,-10%) scale(0.9)} }
          @keyframes drift3 { 0%,100%{transform:translate(0,12%) scale(1)} 50%{transform:translate(6%,-8%) scale(1.25)} }
          @keyframes eq1 { from{transform:scaleY(0.3)} to{transform:scaleY(1)} }
          @keyframes eq2 { from{transform:scaleY(1)} to{transform:scaleY(0.4)} }
          @keyframes eq3 { from{transform:scaleY(0.5)} to{transform:scaleY(0.9)} }
          @keyframes orbPulse { 0%,100%{transform:scale(1);opacity:0.85} 50%{transform:scale(1.04);opacity:1} }
          @keyframes orbSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
          @keyframes waveBounce { from{transform:scaleY(0.7)} to{transform:scaleY(1.18)} }
          @keyframes storyFill { from{width:0%} to{width:100%} }
          .app-hidden *{animation-play-state:paused!important}
          ::-webkit-scrollbar{display:none}
          *{-webkit-tap-highlight-color:transparent}
          input::placeholder{color:color-mix(in srgb, var(--fg) 28%, transparent)}
          button{font-family:inherit}
          /* ТВ и большие экраны: крупнее база, видимый фокус для пульта/клавиатуры */
          @media (min-width: 1920px) { html { font-size: 19px; } }
          :focus-visible { outline: 2px solid rgba(167,139,250,0.8); outline-offset: 2px; border-radius: 12px; }
        `}</style>
        {children}
        <Toaster
          position="top-center"
          gap={10}
          toastOptions={{
            duration: 2800,
            style: {
              borderRadius: 20,
              width: "fit-content",
              maxWidth: "90vw",
              margin: "0 auto",
              padding: "12px 22px",
              background: theme === "dark" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.75)",
              backdropFilter: "blur(40px) saturate(1.9)",
              WebkitBackdropFilter: "blur(40px) saturate(1.9)",
              border: "1px solid var(--glass-border)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
              color: "var(--fg)",
              fontFamily: F.b,
              fontSize: 13,
              fontWeight: 500,
            },
          }}
        />
      </div>
    </ThemeCtx.Provider>
  );

  if (!onboarded) {
    return themedRoot(<OnboardingFlow onDone={finishOnboarding} />);
  }

  const screens: Record<Tab, React.ReactNode> = {
    home: (
      <HomeScreen
        onPlay={playTrack}
        currentTrack={currentTrack}
        playing={audio.playing}
        progress={audio.progress}
        onNavigate={id => setTab(id as Tab)}
        onOpenBlend={setBlendFriend}
        onOpenLive={openLive}
        onPlayWave={() => playWave()}
        onOpenArtist={openArtist}
        avatar={avatar}
      />
    ),
    rating: <RatingScreen c2={currentTrack.c2} userName={userName} avatar={avatar} onOpenPeer={setPeerProfile} />,
    library: (
      <LibraryScreen
        onPlay={playTrack}
        likedIds={likedIds}
        onLike={toggleLike}
        currentTrack={currentTrack}
        playing={audio.playing}
        onOpenArtist={openArtist}
        onOpenAlbum={openAlbum}
        onOpenPlaylist={setPlaylistId}
        myTracks={myTracks}
        onDeleteLocal={removeLocal}
        playlists={allPlaylists}
        onCreatePlaylist={handleCreatePlaylist}
        customPlIds={customPlIds}
        onDeletePlaylist={deletePlaylist}
      />
    ),
    creator: (
      <CreatorScreen
        c2={currentTrack.c2}
        creatorPlus={creatorPlus}
        onOpenCreatorPlus={openCreatorPlus}
        onOpenStats={openStats}
        myTracks={myTracks}
        onAddFiles={addFiles}
        onPlay={playTrack}
      />
    ),
    profile: (
      <ProfileScreen
        c2={currentTrack.c2}
        userName={userName}
        avatar={avatar}
        creatorPlus={creatorPlus}
        onOpenBlend={setBlendFriend}
        onOpenAccount={openAccount}
        onOpenWrapped={openWrapped}
        onLogout={handleLogout}
        crossfade={crossfade}
        onToggleCrossfade={toggleCrossfade}
      />
    ),
  };

  return themedRoot(
    <div className="flex h-full w-full overflow-hidden relative">
      <DynamicBg track={currentTrack} />

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col py-8 gap-1 flex-shrink-0 relative z-10" style={{ width: 224, borderRight: "1px solid color-mix(in srgb, var(--wash) 05%, transparent)", background: "var(--island)", backdropFilter: "blur(32px)" }}>
        <div className="px-6 mb-9 flex items-baseline gap-2">
          <span style={{ fontFamily: F.d, fontWeight: 800, fontSize: 24, letterSpacing: "-0.05em" }}>MYRA</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-md" style={{ fontFamily: F.m, color: currentTrack.c2, background: `${currentTrack.c2}18` }}>beta</span>
        </div>
        {NAV.map(n => {
          const Icon = n.icon;
          const active = tab === n.id;
          return (
            <button key={n.id} onClick={() => setTab(n.id as Tab)} className="relative flex items-center gap-3 mx-3 px-4 py-3 rounded-2xl text-sm font-medium text-left" style={{ fontFamily: F.b, color: active ? "var(--fg)" : "color-mix(in srgb, var(--fg) 50%, transparent)" }}>
              {active && <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25 }} className="absolute inset-0 rounded-2xl" style={{ background: `${currentTrack.c2}1a`, border: `1px solid ${currentTrack.c2}30` }} />}
              <Icon size={17} className="relative z-10" style={{ color: active ? currentTrack.c2 : undefined }} />
              <span className="relative z-10">{t(n.label)}</span>
            </button>
          );
        })}
        <div className="flex-1" />
        <div className="mx-3">
          <div className="rounded-[20px] overflow-hidden cursor-pointer" style={{ ...GLASS }} onClick={() => setPlayerOpen(true)}>
            <div className="relative" style={{ height: 118 }}>
              <img src={currentTrack.img} alt="" className="w-full h-full object-cover" style={{ filter: "brightness(0.45)" }} />
              <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${currentTrack.c1}ee, transparent)` }} />
              <div className="absolute bottom-2.5 left-3.5 right-3.5">
                <div className="text-xs font-bold truncate" style={{ fontFamily: F.b, color: ON_DARK }}>{currentTrack.title}</div>
                <div className="text-[10px] truncate" style={{ color: onDark(55), fontFamily: F.b }}>{currentTrack.artist}</div>
              </div>
              {audio.playing && <div className="absolute top-2.5 right-2.5"><EQ color={currentTrack.c2} size={10} /></div>}
            </div>
            <div className="p-3">
              <Waveform progress={audio.progress} color={currentTrack.c2} onSeek={audio.seek} height={22} seed={currentTrack.id + 3} bars={40} dim playing={audio.playing} />
              <div className="flex items-center justify-between mt-2.5">
                <motion.button whileTap={{ scale: 0.8 }} onClick={e => { e.stopPropagation(); handlePrev(); }}><SkipBack size={14} style={{ color: "color-mix(in srgb, var(--fg) 50%, transparent)" }} /></motion.button>
                <motion.button whileTap={{ scale: 0.85 }} onClick={e => { e.stopPropagation(); togglePlay(); }} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${currentTrack.c2}, ${currentTrack.c2}aa)` }}>
                  {audio.playing ? <Pause size={13} fill="white" stroke="none" /> : <Play size={13} fill="white" stroke="none" className="ml-0.5" />}
                </motion.button>
                <motion.button whileTap={{ scale: 0.8 }} onClick={e => { e.stopPropagation(); handleNext(); }}><SkipForward size={14} style={{ color: "color-mix(in srgb, var(--fg) 50%, transparent)" }} /></motion.button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <div className="flex-1 overflow-hidden relative">
          {/* Кроссфейд без mode="wait" и без filter: экраны перетекают без провала,
              а fixed-диалоги внутри вкладок позиционируются от вьюпорта */}
          <AnimatePresence initial={false}>
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 16, scale: 0.995 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.18 } }}
              transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
              className="absolute inset-0"
            >
              {screens[tab]}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="lg:hidden">
          <BottomIsland
            track={currentTrack}
            playing={audio.playing}
            progress={audio.progress}
            onToggle={togglePlay}
            onOpen={() => setPlayerOpen(true)}
            activeTab={tab}
            onTab={id => setTab(id as Tab)}
            liked={likedIds.has(currentTrack.id)}
            onLike={() => toggleLike(currentTrack.id)}
            onSeek={audio.seek}
          />
        </div>
      </div>

      <AnimatePresence>
        {playerOpen && (
          <motion.div
            className="fixed inset-0 z-50"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 340 }}
          >
            <FullPlayer
              track={currentTrack}
              playing={audio.playing}
              progress={audio.progress}
              duration={audio.duration}
              volume={audio.volume}
              onVolume={audio.setVolume}
              onToggle={togglePlay}
              onClose={() => setPlayerOpen(false)}
              onSeek={audio.seek}
              onNext={handleNext}
              onPrev={handlePrev}
              liked={likedIds.has(currentTrack.id)}
              onLike={() => toggleLike(currentTrack.id)}
              onPlayTrack={playTrack}
              onOpenArtist={openArtist}
              onOpenAlbum={openAlbum}
              sleepLeft={sleepLeft}
              onSleep={handleSleep}
              downloaded={downloads.has(currentTrack.id)}
              onDownload={() => downloadTrack(currentTrack)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <ArtistSheet
        name={artistName}
        onClose={() => setArtistName(null)}
        onPlay={playTrack}
        currentTrack={currentTrack}
        playing={audio.playing}
        followed={followed}
        onFollow={toggleFollow}
        onOpenArtist={openArtist}
        onOpenAlbum={openAlbum}
      />

      <AlbumSheet
        album={albumName}
        onClose={() => setAlbumName(null)}
        onPlay={playTrack}
        currentTrack={currentTrack}
        playing={audio.playing}
        onOpenArtist={openArtist}
      />

      <PlaylistSheet
        playlistId={playlistId}
        onClose={() => setPlaylistId(null)}
        onPlay={playTrack}
        currentTrack={currentTrack}
        playing={audio.playing}
        order={plOrder}
        onReorder={reorderPlaylist}
        playlists={allPlaylists}
        customPlIds={customPlIds}
        onDelete={deletePlaylist}
      />

      <BlendSheet
        friend={blendFriend}
        onClose={() => setBlendFriend(null)}
        onPlay={playTrack}
        currentTrack={currentTrack}
        playing={audio.playing}
        avatar={avatar}
      />

      <AccountSheet
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        userName={userName}
        onRename={n => { setUserName(n); ls.set("userName", n); }}
        avatarIdx={avatarIdx}
        onAvatar={i => { setAvatarIdx(i); ls.set("avatarIdx", i); setCustomAvatar(null); ls.set("customAvatar", null); }}
        customAvatar={customAvatar}
        onAvatarFile={dataUrl => { setCustomAvatar(dataUrl); ls.set("customAvatar", dataUrl); }}
        onDeleted={handleDeleteAccount}
        onOpenImport={() => setImportOpen(true)}
        onOpenSupport={() => setSupportOpen(true)}
      />

      <ImportSheet
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(name, ids) => { createPlaylist(name, ids); }}
      />

      <SupportSheet open={supportOpen} onClose={() => setSupportOpen(false)} />

      <CreatorPlusSheet
        open={creatorPlusOpen}
        onClose={() => setCreatorPlusOpen(false)}
        status={cpStatus}
        onActivate={() => setCp("active")}
        onCancelSub={() => setCp("grace")}
        onResume={() => setCp("active")}
      />

      <StudioStatsSheet open={statsOpen} onClose={() => setStatsOpen(false)} c2={currentTrack.c2} />

      <LiveSessionSheet
        friend={liveFriend}
        onClose={() => setLiveFriend(null)}
        currentTrack={currentTrack}
        playing={audio.playing}
        progress={audio.progress}
        onToggle={togglePlay}
        onPlay={playTrack}
        avatar={avatar}
      />

      <WrappedModal open={wrappedOpen} onClose={() => setWrappedOpen(false)} />

      <PeerProfileSheet peer={peerProfile} onClose={() => setPeerProfile(null)} />

    </div>,
  );
}

export default function App() {
  return (
    <LangProvider>
      <AppInner />
    </LangProvider>
  );
}
