import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from "react";
import { SkipBack, SkipForward, Play, Pause } from "./myraIcons";
import { motion, AnimatePresence } from "motion/react";
import { Toaster, toast } from "sonner";

import { TRACKS, AVATARS, PLAYLISTS, ls, LEADERBOARD_PEERS, type Track, type Friend, type Playlist } from "./data";
import { F, GLASS, SPRING, DynamicBg, EQ, THEMES, ThemeCtx, ProgressCtx, ON_DARK, onDark } from "./lib";
import { DetailWave } from "./detail";
import { useThemeCycle, useSimpleFx, useIsDesktop } from "./useAppEnvironment";
import { useSleepTimer } from "./useSleepTimer";
import { useMediaSession } from "./useMediaSession";
import { isNativeAndroid } from "./nativeMedia";
import { useDownloads } from "./useDownloads";
import { usePlaylists } from "./usePlaylists";
import { useLocalTracks } from "./useLocalTracks";
import { useSocialLayer } from "./useSocialLayer";
import { useSubscription } from "./useSubscription";
import { useIdentity } from "./useIdentity";
import { usePlayerQueue } from "./usePlayerQueue";
import { track } from "./analytics";
import { smartRecommendations } from "./smart";
import { IdentityCollectionSheet, useCompanion } from "./companion";
import {
  loadStats, saveStats, touchDailyStreak, addListenSeconds, markTrackPlayed, totalSeconds, weekSeconds, minutesOf, xpOf, levelInfo, topGenre,
  topArtist, distinctTracksPlayed, distinctGenresPlayed, currentMonthSeconds, grantXp,
  loadActivity, pushActivity, loadMyPlays, logMyTrackPlay, loadTotalPlays, bumpTotalPlays,
  latestSharesMonth, loadDonationLedger, logDonationSent, donationsOfMonth, currentMonthKey,
  type ProfileStats, type ActivityItem, type MyPlays, type DonationLedger,
} from "./stats";
import { ACHIEVEMENTS, type AchievementCounters } from "./achievements";
import { MyraBrandLockup } from "./logo";
// Ленивые чанки: дев-панель с админ-инбоксом нужна двум создателям, live-сессии
// недостижимы без реальных друзей, онбординг после входа — мёртвый груз.
// Маунт «после первого открытия» (см. useEverOpened) гарантирует, что чанк не
// скачивается, пока фича ни разу не понадобилась, но exit-анимации сохраняются
const DevPanelSheet = lazy(() => import("./dev").then(m => ({ default: m.DevPanelSheet })));
const AdminSupportSheet = lazy(() => import("./dev").then(m => ({ default: m.AdminSupportSheet })));
const ModerationSheet = lazy(() => import("./dev").then(m => ({ default: m.ModerationSheet })));
import { LangProvider, useLang } from "./i18n";
import { enqueueSyncOp, flushSyncQueue, isNetworkError } from "./syncQueue";
const OnboardingFlow = lazy(() => import("./auth").then(m => ({ default: m.OnboardingFlow })));
import {
  supabaseEnabled, signOutRemote, recordDonation, fetchReceivedDonationsTotal, deleteAccountRemote,
  isAdmin, onAuthEvent,
} from "./supabase";
import { HomeScreen, BetweenScreen, BrowseScreen, RatingScreen, LibraryScreen, CreatorScreen, ProfileScreen } from "./screens";
import { FullPlayer, BottomIsland, navItems } from "./player";
import { ArtistSheet, RealArtistSheet, AlbumSheet, PlaylistSheet, BlendSheet, AccountSheet, CreatorPlusSheet, WrappedModal, SplitSheet, AchievementsSheet, StudioStatsSheet, ImportSheet, SupportSheet, PeerProfileSheet, ReleaseFormSheet, RealProfileSheet, PeopleSearchSheet } from "./overlays";
const RoomSheet = lazy(() => import("./roomSheet").then(m => ({ default: m.RoomSheet })));

// Вынесено на уровень модуля — статичная строка, незачем пересобирать на каждый рендер
const GLOBAL_STYLE = `
  @keyframes drift1 { 0%,100%{transform:translate(-8%,-6%) scale(1)} 50%{transform:translate(8%,10%) scale(1.2)} }
  @keyframes drift2 { 0%,100%{transform:translate(10%,6%) scale(1.1)} 50%{transform:translate(-10%,-10%) scale(0.9)} }
  @keyframes drift3 { 0%,100%{transform:translate(0,12%) scale(1)} 50%{transform:translate(6%,-8%) scale(1.25)} }
  @keyframes eq1 { from{transform:scaleY(0.3)} to{transform:scaleY(1)} }
  @keyframes eq2 { from{transform:scaleY(1)} to{transform:scaleY(0.4)} }
  @keyframes eq3 { from{transform:scaleY(0.5)} to{transform:scaleY(0.9)} }
  .myra-eq-bar{contain:paint;will-change:transform}
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
  /* Упрощённая графика для слабых устройств: главный убийца композитора на
     Android WebView — десятки backdrop-filter одновременно + полноэкранные
     размытые обложки. Отключаем их одним классом на корне; полупрозрачные
     фоны стеклянных панелей остаются читабельными и без блюра */
  .fx-simple *{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
  .fx-simple .fx-heavy{display:none!important}
  .fx-simple .fx-aurora div{animation:none!important;filter:none!important;opacity:0.55}
  .fx-simple .fx-parallax{transform:none!important}
  /* Декор орба (blur-ореол, кольца, частицы, подиум) — раньше был единственной
     тяжестью, которую упрощённая графика не гасила */
  .fx-simple .fx-orb{display:none!important}
`;

type Tab = "home" | "browse" | "between" | "rating" | "library" | "creator" | "profile";
const TAB_ORDER: Tab[] = ["home", "browse", "between", "rating", "library", "creator", "profile"];

// Ленивый маунт шторки: чанк не грузится, пока шторку ни разу не открыли,
// а после первого открытия остаётся смонтированной — размонтирование по
// закрытию лишило бы AnimatePresence exit-анимации
function useEverOpened(open: boolean) {
  const [ever, setEver] = useState(open);
  useEffect(() => { if (open) setEver(true); }, [open]);
  return ever;
}

function AppInner() {
  const { t, lang } = useLang();
  const companionController = useCompanion();
  const [identityCollectionOpen, setIdentityCollectionOpen] = useState(false);
  const openIdentityCollection = useCallback(() => setIdentityCollectionOpen(true), []);

  // Неон — эксклюзив апгрейда (Plus у слушателя, Pro у артиста): цикл тем
  // включает его только при активной подписке, иначе честный тост вместо темы
  const { theme, toggleTheme } = useThemeCycle();
  const { simpleFx, toggleSimpleFx } = useSimpleFx();
  const isDesktop = useIsDesktop();

  const [crossfade, setCrossfade] = useState(() => ls.get("crossfade", true));
  const fadeRef = useRef(crossfade);
  fadeRef.current = crossfade;
  const toggleCrossfade = useCallback(() => {
    setCrossfade(c => { ls.set("crossfade", !c); return !c; });
  }, []);

  const {
    onboarded, userName, setUserName, email, setEmail, handle, setHandle,
    avatarIdx, setAvatarIdx, customAvatar, setCustomAvatar,
    userRole, setRole, uid, finishOnboarding, clearIdentity,
  } = useIdentity();
  const [passwordRecovery, setPasswordRecovery] = useState(
    () => new URL(window.location.href).searchParams.get("password-recovery") === "1",
  );
  useEffect(() => {
    const { data } = onAuthEvent(event => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  // uidRef — только для sendDonation ниже (ref, чтобы не пересоздавать колбэк
  // при каждой смене uid); хуки useSocialLayer/useLocalTracks/useSubscription
  // держат собственные внутренние копии этого же паттерна
  const uidRef = useRef<string | null>(null);
  uidRef.current = uid;

  const {
    followingSet, friendsFeed, realProfile, setRealProfile,
    peopleSearchOpen, setPeopleSearchOpen, openPeopleSearch,
    toggleRealFollow, clearSocial,
  } = useSocialLayer(uid);

  // Студия — только артистам: MYRA Pro больше не открывает её слушателям
  const showStudio = userRole === "artist";
  // В релизе доступ к инструментам команды определяет только серверная таблица
  // admins. Локальный флаг разрешён лишь в явной dev-сборке.
  const [adminAccess, setAdminAccess] = useState(false);
  const localDevAccess = import.meta.env.DEV && import.meta.env.VITE_DEV_TOOLS === "true";
  const devMode = adminAccess || localDevAccess;
  const [devPanelOpen, setDevPanelOpen] = useState(false);
  const [adminSupportOpen, setAdminSupportOpen] = useState(false);
  const [moderationOpen, setModerationOpen] = useState(false);
  const [followed, setFollowed] = useState<Set<string>>(() => new Set(ls.get<string[]>("followed", [])));

  useEffect(() => {
    let active = true;
    if (!uid) {
      setAdminAccess(false);
      return () => { active = false; };
    }
    isAdmin(uid)
      .then(allowed => { if (active) setAdminAccess(allowed); })
      .catch(() => { if (active) setAdminAccess(false); });
    return () => { active = false; };
  }, [uid]);

  useEffect(() => {
    if (devMode) return;
    setDevPanelOpen(false);
    setAdminSupportOpen(false);
    setModerationOpen(false);
  }, [devMode]);

  const [tab, setTabState] = useState<Tab>(() => ls.get<Tab>("tab", "home"));
  const previousTabRef = useRef(tab);
  const tabDirection = TAB_ORDER.indexOf(tab) >= TAB_ORDER.indexOf(previousTabRef.current) ? 1 : -1;
  useEffect(() => { previousTabRef.current = tab; }, [tab]);
  const setTab = useCallback((id: Tab) => {
    setTabState(id);
    ls.set("tab", id);
  }, []);
  const [currentTrack, setCurrentTrack] = useState<Track>(TRACKS[0]);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<number>>(() => new Set(ls.get<number[]>("liked", [])));

  const [artistName, setArtistName] = useState<string | null>(null);
  const [realArtistId, setRealArtistId] = useState<string | null>(null);
  const [albumName, setAlbumName] = useState<string | null>(null);
  const [peerProfile, setPeerProfile] = useState<typeof LEADERBOARD_PEERS[number] | null>(null);
  const [blendFriend, setBlendFriend] = useState<Friend | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [creatorPlusOpen, setCreatorPlusOpen] = useState(false);
  const [wrappedOpen, setWrappedOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const openAccount = useCallback(() => setAccountOpen(true), []);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!onboarded || url.searchParams.get("delete-account") !== "1") return;
    setTab("profile");
    setAccountOpen(true);
    url.searchParams.delete("delete-account");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [onboarded, setTab]);
  const openCreatorPlus = useCallback(() => setCreatorPlusOpen(true), []);
  const openWrapped = useCallback(() => setWrappedOpen(true), []);
  const openStats = useCallback(() => setStatsOpen(true), []);
  const [roomOpen, setRoomOpen] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  // Реальная статистика аккаунта — стартует с нуля и растёт по мере использования
  const [stats, setStats] = useState<ProfileStats>(() => loadStats());
  const [activity, setActivity] = useState<ActivityItem[]>(() => loadActivity());
  const [myPlays, setMyPlays] = useState<MyPlays>(() => loadMyPlays());
  const [totalPlays, setTotalPlays] = useState(() => loadTotalPlays());
  // Сколько раз реально задонатил другим артистам — для достижений в Рейтинге;
  // донат по сплиту — тоже донат, поэтому учитывается наравне с одиночным
  const donationCount = useMemo(() => activity.filter(a => a.textKey === "act.donateSent" || a.textKey === "act.splitDonate").length, [activity]);
  const [balance, setBalance] = useState(() => ls.get("balance", 0));

  const logActivity = useCallback((key: string, ...args: (string | number)[]) => {
    setActivity(pushActivity(key, ...args));
  }, []);

  const {
    cpStatus, creatorPlus,
    activateCreatorPlus, cancelCreatorPlusSub, resumeCreatorPlus, clearSubscription,
    setCp,
  } = useSubscription({ userRole, uid, onboarded, logActivity });

  // На этапе бесплатного запуска все пользовательские функции доступны.
  const { downloads, resolveUrl, downloadTrack, clearDownloads } = useDownloads({ hasUpgrade: true, logActivity });
  const {
    customPls, playlistId, setPlaylistId, allPlaylists, customPlIds, plOrder,
    createPlaylist, deletePlaylist, handleCreatePlaylist, reorderPlaylist, clearPlaylists,
  } = usePlaylists(logActivity);

  // Публикация релиза (см. useLocalTracks.ts) синхронизирует трек в Supabase в
  // фоне; если к моменту ответа сервера пользователь уже открыл именно этот
  // трек в плеере, дописываем remoteId в currentTrack тем же снимком
  const handlePublishedRemote = useCallback((localId: number, remoteId: string) => {
    setCurrentTrack(prev => (prev.id === localId ? { ...prev, remoteId } : prev));
  }, []);
  const {
    myTracks, addFiles, startRelease, publishRelease, removeLocal,
    pendingRelease, setPendingRelease, clearLocalTracks,
  } = useLocalTracks({ userName, uid, logActivity, onPublishedRemote: handlePublishedRemote });

  // Прозрачный сплит: локальная бухгалтерия отправленных донатов + шторка
  const [donationLedger, setDonationLedger] = useState<DonationLedger>(() => loadDonationLedger());
  const [splitOpen, setSplitOpen] = useState(false);
  const [achOpen, setAchOpen] = useState(false);
  const openAchievements = useCallback(() => setAchOpen(true), []);
  const openSplit = useCallback(() => setSplitOpen(true), []);

  // Единый путь любого доната: лента событий, локальная бухгалтерия месяца
  // и (когда есть бэкенд) запись в Supabase — чтобы ArtistSheet, RealArtistSheet
  // и донат по сплиту не расходились в учёте. Сетевой сбой больше не теряет
  // операцию навсегда — она встаёт в офлайн-очередь (см. syncQueue.ts)
  const sendDonation = useCallback((name: string, amt: number, toUserId?: string) => {
    setDonationLedger(logDonationSent(name, amt));
    if (supabaseEnabled && uidRef.current) {
      recordDonation(uidRef.current, name, amt, toUserId)
        .then(({ error }) => { if (error && isNetworkError(error)) enqueueSyncOp("donation", { artist: name, amount: amt, toUserId }); })
        .catch(err => {
          if (isNetworkError(err)) enqueueSyncOp("donation", { artist: name, amount: amt, toUserId });
          else console.warn("recordDonation:", err);
        });
    }
  }, []);

  // Доотправка очереди: при появлении uid (старт/логин) и при возвращении сети
  useEffect(() => {
    if (!supabaseEnabled || !uid) return;
    const flush = () => {
      flushSyncQueue(uid).then(sent => { if (sent > 0) toast(t("sync.flushed", sent)); });
    };
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [uid, t]);

  const handleSplitDonate = useCallback((parts: { artist: string; amount: number }[]) => {
    const total = parts.reduce((sum, p) => sum + p.amount, 0);
    for (const p of parts) sendDonation(p.artist, p.amount);
    // Одна сводная запись в ленте вместо N одинаковых — иначе донат по сплиту
    // на 8 артистов вытеснил бы из капованной ленты всё остальное
    setActivity(pushActivity("act.splitDonate", total, parts.length));
  }, [sendDonation]);

  // Показываем последний месяц с данными: в первые дни нового месяца сплит
  // текущего пуст, и честнее показать закрытый прошлый месяц с пометкой
  // Открытые достижения: activity пополняется в момент открытия нового —
  // правильный триггер для пересчёта из ls
  const achDone = useMemo(() => {
    const u = new Set(ls.get<string[]>("achUnlocked", []));
    return ACHIEVEMENTS.filter(a => u.has(a.id)).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity]);

  const { monthKey: splitMonthKey, shares: monthShares } = useMemo(() => latestSharesMonth(stats), [stats]);
  const monthDonations = useMemo(() => donationsOfMonth(donationLedger, splitMonthKey), [donationLedger, splitMonthKey]);

  // Месячный сплит-ритуал: строго opt-in. При первом открытии приложения в
  // новом месяце (и только если прошлый месяц реально слушался) — одно
  // напоминание тостом и записью в ленте, не чаще раза в месяц
  const [splitRitual, setSplitRitualState] = useState(() => ls.get("splitRitual", false));
  const toggleSplitRitual = useCallback(() => {
    setSplitRitualState(prev => {
      const next = !prev;
      ls.set("splitRitual", next);
      // При включении помечаем текущий месяц просмотренным — иначе тумблер
      // сработал бы немедленно, а не при реальной смене месяца
      if (next) ls.set("splitRitualSeen", currentMonthKey());
      return next;
    });
  }, []);
  useEffect(() => {
    if (!onboarded || !ls.get("splitRitual", false)) return;
    const mk = currentMonthKey();
    const seen = ls.get("splitRitualSeen", "");
    if (seen === mk) return;
    ls.set("splitRitualSeen", mk);
    const prev = Object.keys(stats.artistSecondsByMonth).filter(k => k < mk).sort().pop();
    if (!prev || !Object.values(stats.artistSecondsByMonth[prev] ?? {}).some(v => v > 0)) return;
    // Тост — с задержкой и без cleanup: эффект срабатывает в момент маунта,
    // когда Toaster ещё не готов, а очистка таймера при любом повторном
    // прогоне эффекта молча убивала бы уведомление. Гвард по splitRitualSeen
    // выше гарантирует не больше одного срабатывания в месяц и так
    setTimeout(() => toast(t("sp.ritualToast")), 1200);
    setActivity(pushActivity("act.splitReady"));
    // stats в зависимостях не нужен: проверка осмысленна ровно один раз за
    // запуск — момент «наступил новый месяц» не повторяется внутри сессии
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboarded, t]);

  // Серия дней подряд — считаем один раз при заходе в приложение
  useEffect(() => {
    setStats(prev => {
      const touched = touchDailyStreak(prev);
      if (touched.streak !== prev.streak && touched.streak > 1) logActivity("act.streak", touched.streak);
      return touched;
    });
  }, [logActivity]);

  useEffect(() => { saveStats(stats); }, [stats]);

  // Уведомление о новом уровне — реагируем на реальный прирост XP от прослушивания
  const prevLevelRef = useRef<number | null>(null);
  useEffect(() => {
    const lvl = levelInfo(xpOf(stats)).level;
    if (prevLevelRef.current !== null && lvl > prevLevelRef.current) {
      logActivity("act.levelUp", lvl);
      toast.success(t("act.levelUp", lvl));
    }
    prevLevelRef.current = lvl;
  }, [stats, logActivity, t]);

  // Если Студия скрылась (например, сменили роль на слушателя) — уводим со вкладки
  useEffect(() => {
    if (tab === "creator" && !showStudio) setTab("home");
  }, [tab, showStudio, setTab]);

  // Скрытые достижения: списка в интерфейсе нет — пользователь узнаёт о каждом
  // только в момент открытия (тост + запись в уведомлениях). Прогресс — в ls.
  useEffect(() => {
    const unlocked = new Set(ls.get<string[]>("achUnlocked", []));
    const counters: AchievementCounters = {
      totalPlays, streak: stats.streak, likedCount: likedIds.size,
      playlistCount: customPls.length, releaseCount: myTracks.length,
      donationCount, level: levelInfo(xpOf(stats)).level,
    };
    const fresh = ACHIEVEMENTS.filter(a => !unlocked.has(a.id) && a.of(counters) >= a.need);
    if (!fresh.length) return;
    fresh.forEach(a => unlocked.add(a.id));
    ls.set("achUnlocked", [...unlocked]);
    fresh.forEach(a => logActivity("ach.unlocked", t(a.key)));
    toast.success(t("ach.unlocked", t(fresh[0].key)));
  }, [totalPlays, stats, likedIds, customPls, myTracks, donationCount, logActivity, t]);

  const openDevPanel = useCallback(() => {
    if (!devMode) { toast.error(t("dev.denied")); return; }
    setDevPanelOpen(true);
  }, [devMode, t]);
  const openAdminSupport = useCallback(() => {
    if (!devMode) { toast.error(t("dev.denied")); return; }
    setAdminSupportOpen(true);
  }, [devMode, t]);
  const openModeration = useCallback(() => {
    if (!devMode) { toast.error(t("dev.denied")); return; }
    setModerationOpen(true);
  }, [devMode, t]);
  const handleGrantXp = useCallback((xp: number) => { setStats(prev => grantXp(prev, xp)); }, []);
  const addBalance = useCallback((amt: number) => {
    setBalance(b => { const nb = b + amt; ls.set("balance", nb); return nb; });
  }, []);

  const withdraw = useCallback((amt: number) => {
    setBalance(b => { const nb = b - amt; ls.set("balance", nb); return nb; });
    logActivity("act.withdrawDone", amt);
  }, [logActivity]);

  // Реальный счётчик "начал слушать трек" — для профиля и (если это свой трек) студии
  const registerPlay = useCallback((tr: Track) => {
    setTotalPlays(bumpTotalPlays());
    setStats(prev => markTrackPlayed(prev, tr.id));
    if (tr.local) setMyPlays(logMyTrackPlay(tr.id));
    companionController.recordPlay(tr);
  }, [companionController.recordPlay]);

  const {
    audio, queue, shuffle, setShuffle, repeat, setRepeat,
    playTrack, togglePlay, handleNext, handlePrev, playRadio, startWave,
  } = usePlayerQueue({ currentTrack, setCurrentTrack, myTracks, resolveUrl, registerPlay, likedIds, followed, fadeRef });
  const { sleepLeft, handleSleep } = useSleepTimer(audio.pause);
  const lastAudioErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (!audio.error || audio.error === lastAudioErrorRef.current) return;
    lastAudioErrorRef.current = audio.error;
    track({ name: "playback_error" });
    toast.error(audio.error);
  }, [audio.error]);

  // Открытие приложения — один раз за сессию рантайма.
  useEffect(() => { track({ name: "app_open" }); }, []);

  // Выбранное качество хранится в профиле. Переключение реального потока
  // заработает, когда каталог начнёт отдавать отдельные AAC/FLAC/Hi-Res URL.
  const [qualityIdx, setQualityIdxState] = useState(() => ls.get("qualityIdx", 1));
  const setQualityIdx = useCallback((idx: number) => { setQualityIdxState(idx); ls.set("qualityIdx", idx); }, []);
  useEffect(() => { audio.setQuality(qualityIdx); }, [qualityIdx, audio]);
  // На этапе бесплатного запуска AAC, FLAC и Hi-Res доступны всем.

  // Реальное время прослушивания — копится, пока реально играет музыка.
  // artist обязан быть в зависимостях наравне с genre: иначе при переходе на
  // трек того же жанра интервал не пересоздаётся и секунды продолжают
  // засчитываться прежнему артисту (ломая Wrapped и топ-артиста)
  useEffect(() => {
    if (!audio.playing) return;
    const TICK = 5;
    const iv = setInterval(() => {
      setStats(prev => addListenSeconds(prev, TICK, currentTrack.genre, currentTrack.artist));
    }, TICK * 1000);
    return () => clearInterval(iv);
  }, [audio.playing, currentTrack.genre, currentTrack.artist]);

  // Реально полученные донаты (from RealArtistSheet, to_user_id = uid) — не
  // тот же счётчик, что локальный симулированный balance/withdraw ниже:
  // подтягиваем при каждом заходе в Студию, чтобы сумма была свежей
  const [realDonationsTotal, setRealDonationsTotal] = useState(0);
  useEffect(() => {
    if (!supabaseEnabled || !uid || tab !== "creator") return;
    fetchReceivedDonationsTotal(uid).then(setRealDonationsTotal);
  }, [uid, tab]);


  const avatar = customAvatar ?? AVATARS[avatarIdx] ?? AVATARS[0];

  const toggleLike = useCallback((id: number) => {
    setLikedIds(prev => {
      const next = new Set(prev);
      // track() внутри апдейтера — сознательно: так колбэк не зависит от likedIds
      // и не пересоздаётся на каждый лайк (иначе рвётся React.memo экранов).
      // Событие — чистый no-op по умолчанию, повтор в dev StrictMode безвреден.
      if (next.has(id)) { next.delete(id); track({ name: "unlike", trackId: id }); toast(t("like.rm")); }
      else { next.add(id); companionController.recordLike(); track({ name: "like", trackId: id }); toast(t("like.add")); }
      ls.set("liked", [...next]);
      return next;
    });
  }, [t, companionController.recordLike]);
  const currentIdRef = useRef(currentTrack.id); currentIdRef.current = currentTrack.id;
  const likeCurrent = useCallback(() => toggleLike(currentIdRef.current), [toggleLike]);

  // dev-хук для интеграционных проверок
  if ((import.meta as any).env?.DEV || location.hostname === "127.0.0.1" || location.hostname === "localhost") {
    (window as any).__myra = { tab, playerOpen, artistName, blendFriend: blendFriend?.name ?? null, roomOpen, accountOpen, creatorPlusOpen, wrappedOpen, statsOpen, playlistId, onboarded, myTracks: myTracks.length, audio, qualityIdx };
  }

  // Media Session — управление из шторки уведомлений и с локскрина (см. useMediaSession.ts)
  useMediaSession({
    currentTrack,
    playing: audio.playing,
    duration: audio.duration,
    progress: audio.progress,
    liked: likedIds.has(currentTrack.id),
    toggle: togglePlay,
    next: handleNext,
    prev: handlePrev,
    seek: audio.seek,
    like: likeCurrent,
    flow: startWave,
  });

  const openRooms = useCallback(() => setRoomOpen(true), []);

  // Пауза фоновых анимаций, когда приложение свёрнуто — экономия батареи
  useEffect(() => {
    const onVis = () => document.documentElement.classList.toggle("app-hidden", document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const toggleFollow = useCallback((name: string) => {
    setFollowed(prev => {
      const next = new Set(prev);
      // Имя артиста НЕ уходит в аналитику — только сам факт follow/unfollow.
      if (next.has(name)) { next.delete(name); track({ name: "unfollow_artist" }); }
      else { next.add(name); track({ name: "follow_artist" }); }
      ls.set("followed", [...next]);
      return next;
    });
  }, []);

  const navigateTab = useCallback((id: string) => setTab(id as Tab), [setTab]);
  // Стабильные колбэки для BottomIsland: инлайновые пересоздавались каждый
  // рендер и полностью обесценивали его React.memo
  const openPlayer = useCallback(() => setPlayerOpen(true), []);
  const openArtist = useCallback((name: string) => {
    setAlbumName(null);
    setArtistName(name);
  }, []);

  const openRealArtist = useCallback((id: string) => {
    setAlbumName(null);
    setRealArtistId(id);
  }, []);

  const openAlbum = useCallback((album: string) => {
    setArtistName(null);
    setAlbumName(album);
  }, []);

  const handleLogout = useCallback(() => {
    track({ name: "logout" });
    audio.pause();
    // Гасим и серверную сессию Supabase — иначе getSession() на следующем запуске
    // решит, что пользователь всё ещё залогинен, и попытается восстановить профиль
    if (supabaseEnabled) signOutRemote().catch(() => {});
    // Чистим и офлайн-хранилище (IndexedDB), не только localStorage —
    // иначе после входа в новый аккаунт старые файлы всё ещё будут тут
    clearLocalTracks();
    clearDownloads();
    ls.clear();
    clearIdentity();
    setTab("home");
    setPlayerOpen(false);
    setAccountOpen(false);
    // Полный сброс в памяти — новый аккаунт должен быть по-настоящему пустым,
    // а не просто выглядеть так до следующей перезагрузки страницы
    setLikedIds(new Set());
    setFollowed(new Set());
    clearPlaylists();
    clearSubscription();
    setAdminAccess(false);
    setDevPanelOpen(false);
    setAdminSupportOpen(false);
    setModerationOpen(false);
    setCreatorPlusOpen(false);
    setStats(touchDailyStreak(loadStats()));
    setActivity([]);
    setMyPlays({ byTrack: {}, byDay: {} });
    setTotalPlays(0);
    setBalance(0);
    prevLevelRef.current = null;
    // Соцслой — тоже полностью сброшен, иначе подписки предыдущего аккаунта
    // этого устройства всплыли бы у следующего, вошедшего на нём же
    clearSocial();
    // Прозрачный сплит: ls.clear() выше стёр ключ на диске, но состояние в
    // памяти пережило бы логаут — донаты прошлого аккаунта не должны
    // показываться следующему
    setDonationLedger({});
    setSplitOpen(false);
    toast(t("pr.loggedOut"));
  }, [audio, t, clearLocalTracks, clearDownloads, clearPlaylists, clearSocial, clearSubscription, clearIdentity]);

  // В отличие от остальных фоновых синхронизаций (донаты, подписки), здесь
  // нельзя молча проглотить ошибку и продолжить как ни в чём не бывало:
  // текст в UI прямым текстом обещает "сотрутся навсегда", и если реальное
  // удаление на сервере не прошло, пользователь должен об этом узнать, а не
  // считать аккаунт удалённым, пока он на самом деле жив в базе
  const handleDeleteAccount = useCallback(async () => {
    track({ name: "delete_account_start" });
    if (supabaseEnabled && uid) {
      const { error } = await deleteAccountRemote();
      if (error) { toast.error(t("acc.deleteFailed")); return; }
    }
    track({ name: "delete_account_complete" });
    handleLogout();
    toast(t("acc.deleted"));
  }, [handleLogout, t, uid]);

  // Тема оборачивает и онбординг, и приложение; Toaster общий
  const themedRoot = (children: React.ReactNode) => (
    <ThemeCtx.Provider value={{ theme, toggleTheme }}>
      <div data-theme={theme} className={`h-screen w-full${simpleFx ? " fx-simple" : ""}${isNativeAndroid ? " android-runtime" : ""}`} style={{ ...(THEMES[theme] as React.CSSProperties), background: "var(--bg)", color: "var(--fg)", fontFamily: F.b, transition: "background 0.4s ease, color 0.4s ease" }}>
        <style>{GLOBAL_STYLE}</style>
        <ProgressCtx.Provider value={audio.progress}>{children}</ProgressCtx.Provider>
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
              // По светлой ветке — только светлая тема: неон тоже тёмный, и белый
              // фон делал его тосты нечитаемыми (белое по белому)
              background: theme === "light" ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.12)",
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

  // Хуки ленивого маунта — строго до раннего return (правила хуков)
  const devEver = useEverOpened(devPanelOpen);
  const adminEver = useEverOpened(adminSupportOpen);
  const moderationEver = useEverOpened(moderationOpen);
  const roomEver = useEverOpened(roomOpen);

  // Данные «Эха месяца» считаются только при изменении статистики, а не на
  // каждый рендер AppInner (topArtist звался дважды + два прохода по queue)
  const wrappedData = useMemo(() => {
    const artist = topArtist(stats);
    return {
      minutes: minutesOf(currentMonthSeconds(stats)),
      artist,
      artistImg: queue.find(tr => tr.artist === artist)?.img,
      genre: topGenre(stats),
      tracks: distinctTracksPlayed(stats),
      genres: distinctGenresPlayed(stats),
    };
  }, [stats, queue]);

  // Тоже строго до раннего return ниже — иначе на первом рендере (onboarded
  // ещё false) этот хук не вызывается, а на следующем начинает вызываться,
  // и React падает с "Rendered more hooks than during the previous render"
  // Лимит 10 (не 8): «Для тебя» (0-6) и «Продолжить» (6-10) на Главной берут
  // непересекающиеся срезы одного списка — раньше их срезы (0-6 и 2-8)
  // частично совпадали, и один трек мог показываться в обеих секциях сразу.
  // Демо-каталог маленький (8 треков), поэтому «Продолжить» честно короче
  // без загруженных треков — это ограничение размера каталога, не баг
  const recommendations = useMemo(
    () => smartRecommendations(queue, likedIds, followed, currentTrack.id, lang, 10),
    [queue, likedIds, followed, currentTrack.id, lang],
  );

  // Строго ДО раннего return ниже (как recommendations выше) — иначе при выходе
  // из аккаунта onboarded переключается true→false в рамках той же сессии,
  // ранний return пропускает этот хук, и React падает с "Rendered fewer hooks
  // than expected" (#300). Этот useCallback просочился ниже return при
  // бренд-редизайне и ломал выход из аккаунта у слушателя.
  const openFreePlan = useCallback(() => toast.success(t("plan.freeAllToast")), [t]);

  if (!onboarded || passwordRecovery) {
    return themedRoot(
      <Suspense fallback={null}>
        <OnboardingFlow
          onDone={finishOnboarding}
          forceRecovery={passwordRecovery}
          onRecoveryDone={() => setPasswordRecovery(false)}
        />
      </Suspense>,
    );
  }

  // Производные значения реальной статистики — общий источник для рейтинга/профиля/аккаунта
  const xp = xpOf(stats);
  const lvl = levelInfo(xp);
  const statMinutesWeek = minutesOf(weekSeconds(stats));
  const statTopGenre = topGenre(stats);

  // Для слушателя приложение полностью бесплатное; Pro остаётся только
  // инструментом монетизации студии артиста.
  const planLabel = userRole === "artist"
    ? (cpStatus === "active" ? t("plan.proActive") : cpStatus === "grace" ? t("plan.proGrace") : t("plan.free"))
    : t("plan.freeAll");
  const openPlan = userRole === "artist" ? openCreatorPlus : openFreePlan;

  // Счётчики для скрытых достижений — их полный список видит только дев-панель
  const achCounters: AchievementCounters = {
    totalPlays, streak: stats.streak, likedCount: likedIds.size,
    playlistCount: customPls.length, releaseCount: myTracks.length,
    donationCount, level: lvl.level,
  };

  const screens: Record<Tab, React.ReactNode> = {
    home: (
      <HomeScreen
        onPlay={playTrack}
        currentTrack={currentTrack}
        playing={audio.playing}
        buffered={audio.buffered}
        onNavigate={navigateTab}
        onOpenBlend={setBlendFriend}
        onOpenRooms={openRooms}
        onPlayWave={startWave}
        onPlayRadio={playRadio}
        onLikeTrack={toggleLike}
        onPauseMain={audio.pause}
        onOpenArtist={openArtist}
        onOpenRealArtist={openRealArtist}
        avatar={avatar}
        activity={activity}
        friendsFeed={friendsFeed}
        onOpenPeopleSearch={openPeopleSearch}
        onOpenRealProfile={setRealProfile}
        uid={uid}
        recommendations={recommendations}
      />
    ),
    browse: (
      <BrowseScreen onPlay={playTrack} onOpenArtist={openArtist} />
    ),
    between: (
      <BetweenScreen
        currentTrack={currentTrack}
        playing={audio.playing}
        friendsFeed={friendsFeed}
        uid={uid}
        onPlay={playTrack}
        onPause={audio.pause}
        onOpenPeopleSearch={openPeopleSearch}
        onOpenRealProfile={setRealProfile}
        onOpenRealArtist={openRealArtist}
        onOpenRooms={openRooms}
      />
    ),
    rating: (
      <RatingScreen
        c2={currentTrack.c2}
        userName={userName}
        avatar={avatar}
        level={lvl.level}
        minutesWeek={statMinutesWeek}
        streak={stats.streak}
        onOpenPeer={setPeerProfile}
      />
    ),
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
        onUploadFiles={addFiles}
        playlists={customPls}
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
        onStartRelease={startRelease}
        onPlay={playTrack}
        myPlaysByTrack={myPlays.byTrack}
        myPlaysByDay={myPlays.byDay}
        balance={balance}
        onWithdraw={withdraw}
        realDonationsTotal={realDonationsTotal}
      />
    ),
    profile: (
      <ProfileScreen
        c2={currentTrack.c2}
        userName={userName}
        handle={handle}
        avatar={avatar}
        creatorPlus={creatorPlus}
        follows={followed.size}
        totalPlays={totalPlays}
        onOpenBlend={setBlendFriend}
        onOpenAccount={openAccount}
        onOpenWrapped={openWrapped}
        onOpenSplit={openSplit}
        onOpenAchievements={openAchievements}
        achDone={achDone}
        achTotal={ACHIEVEMENTS.length}
        onLogout={handleLogout}
        simpleFx={simpleFx}
        onToggleSimpleFx={toggleSimpleFx}
        quality={qualityIdx}
        onSetQuality={setQualityIdx}
        userRole={userRole}
        donationCount={donationCount}
        devMode={devMode}
        onOpenDevPanel={openDevPanel}
        onOpenStudio={() => setTab("creator")}
        companionController={companionController}
        onOpenIdentity={openIdentityCollection}
      />
    ),
  };

  return themedRoot(
      <div className="myra-app-shell flex h-full w-full overflow-hidden relative">
      <DynamicBg track={currentTrack} />
      <div className="myra-brand-atmosphere" aria-hidden="true"><i /><i /></div>

      {/* Desktop sidebar */}
      {isDesktop && (
      <aside className="myra-desktop-rail hidden lg:flex flex-col py-7 gap-1 flex-shrink-0 relative z-10">
        <div className="myra-desktop-brand px-5 mb-8">
          <MyraBrandLockup />
        </div>
        {navItems(showStudio).map(n => {
          const Icon = n.icon;
          const active = tab === n.id;
          return (
            <button key={n.id} onClick={() => setTab(n.id as Tab)} data-active={active || undefined} className="myra-desktop-nav-item relative flex items-center gap-3 mx-3 px-4 py-3 rounded-2xl text-sm font-medium text-left" style={{ fontFamily: F.b, color: active ? "var(--myra-pearl)" : "color-mix(in srgb, var(--fg) 50%, transparent)" }}>
              {active && <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25 }} className="myra-desktop-nav-active absolute inset-0 rounded-2xl" />}
              <span className="myra-desktop-nav-glyph relative z-10"><Icon size={18} /></span>
              <span className="relative z-10">{t(n.label)}</span>
            </button>
          );
        })}
        <div className="flex-1" />
        <div className="mx-3">
          <div className="myra-rail-player rounded-[20px] overflow-hidden cursor-pointer" onClick={() => setPlayerOpen(true)}>
            <span className="myra-rail-player-label">NOW · DEEPLY YOURS</span>
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
              <DetailWave progress={audio.progress} buffered={audio.buffered} accent={currentTrack.c2} onSeek={audio.seek} height={24} compact playing={audio.playing} />
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
      )}

      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <div className="flex-1 overflow-hidden relative">
          {/* Кроссфейд без mode="wait" и без filter: экраны перетекают без провала,
              а fixed-диалоги внутри вкладок позиционируются от вьюпорта */}
          <AnimatePresence initial={false} custom={tabDirection}>
            <motion.div
              key={tab}
              custom={tabDirection}
              variants={{
                enter: (direction: number) => ({ opacity: 0, x: direction * 18, scale: 0.994 }),
                active: { opacity: 1, x: 0, scale: 1 },
                leave: (direction: number) => ({ opacity: 0, x: direction * -12, scale: 0.997 }),
              }}
              initial="enter"
              animate="active"
              exit="leave"
              transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
              className="myra-screen-transition absolute inset-0"
            >
              {screens[tab]}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="lg:hidden">
          <BottomIsland
            track={currentTrack}
            playing={audio.playing}
            progress={Math.round(audio.progress)}
            onToggle={togglePlay}
            onOpen={openPlayer}
            activeTab={tab}
            onTab={navigateTab}
            liked={likedIds.has(currentTrack.id)}
            onLike={likeCurrent}
            onSeek={audio.seek}
            showStudio={showStudio}
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
              buffered={audio.buffered}
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
              crossfade={crossfade}
              onToggleCrossfade={toggleCrossfade}
              shuffle={shuffle}
              onToggleShuffle={() => setShuffle(s => !s)}
              repeat={repeat}
              onToggleRepeat={() => setRepeat(r => !r)}
              queue={queue}
              downloaded={downloads.has(currentTrack.id)}
              onDownload={() => downloadTrack(currentTrack)}
              handle={handle}
              uid={uid}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <IdentityCollectionSheet open={identityCollectionOpen} onClose={() => setIdentityCollectionOpen(false)} controller={companionController} />

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
        onDonate={(name, amt) => {
          logActivity("act.donateSent", amt, name);
          sendDonation(name, amt);
        }}
      />

      <RealArtistSheet
        artistId={realArtistId}
        onClose={() => setRealArtistId(null)}
        onPlay={playTrack}
        currentTrack={currentTrack}
        playing={audio.playing}
        onDonate={(toUserId, name, amt) => {
          logActivity("act.donateSent", amt, name);
          sendDonation(name, amt, toUserId);
        }}
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
        email={email}
        onSetEmail={setEmail}
        handle={handle}
        onSetHandle={setHandle}
        avatarIdx={avatarIdx}
        onAvatar={i => { setAvatarIdx(i); ls.set("avatarIdx", i); setCustomAvatar(null); ls.set("customAvatar", null); }}
        customAvatar={customAvatar}
        onAvatarFile={dataUrl => { setCustomAvatar(dataUrl); ls.set("customAvatar", dataUrl); }}
        onDeleted={handleDeleteAccount}
        onOpenImport={() => setImportOpen(true)}
        onOpenSupport={() => setSupportOpen(true)}
        level={lvl.level}
        xpIntoLevel={lvl.xpIntoLevel}
        xpForLevel={lvl.xpForLevel}
        minutesWeek={statMinutesWeek}
        streak={stats.streak}
        topGenre={statTopGenre}
        planLabel={planLabel}
        onOpenPlan={openPlan}
      />

      <ImportSheet
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(name, ids) => { createPlaylist(name, ids); }}
      />

      <SupportSheet open={supportOpen} onClose={() => setSupportOpen(false)} uid={uid} />

      <CreatorPlusSheet
        open={creatorPlusOpen}
        onClose={() => setCreatorPlusOpen(false)}
        status={cpStatus}
        onActivate={activateCreatorPlus}
        onCancelSub={cancelCreatorPlusSub}
        onResume={resumeCreatorPlus}
      />

      {devEver && (
        <Suspense fallback={null}>
          <DevPanelSheet
            open={devPanelOpen}
            onClose={() => setDevPanelOpen(false)}
            level={lvl.level}
            counters={achCounters}
            userRole={userRole}
            onSetRole={setRole}
            cpStatus={cpStatus}
            onSetCp={setCp}
            balance={balance}
            onAddBalance={addBalance}
            onGrantXp={handleGrantXp}
            onOpenAdminSupport={openAdminSupport}
            onOpenModeration={openModeration}
            uid={uid}
            adminAccess={adminAccess}
            simpleFx={simpleFx}
          />
        </Suspense>
      )}

      {adminEver && (
        <Suspense fallback={null}>
          <AdminSupportSheet open={adminSupportOpen} onClose={() => setAdminSupportOpen(false)} uid={uid} />
        </Suspense>
      )}

      {moderationEver && (
        <Suspense fallback={null}>
          <ModerationSheet open={moderationOpen} onClose={() => setModerationOpen(false)} uid={uid} />
        </Suspense>
      )}

      <StudioStatsSheet
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
        c2={currentTrack.c2}
        myTracks={myTracks}
        myPlaysByTrack={myPlays.byTrack}
        myPlaysByDay={myPlays.byDay}
        balance={balance}
      />

      <ReleaseFormSheet
        open={!!pendingRelease}
        file={pendingRelease?.file ?? null}
        defaultCover={pendingRelease?.defaultImg ?? ""}
        onClose={() => setPendingRelease(null)}
        onPublish={publishRelease}
      />

      {roomEver && (
        <Suspense fallback={null}>
          <RoomSheet
            open={roomOpen}
            onClose={() => setRoomOpen(false)}
            currentTrack={currentTrack}
            playing={audio.playing}
            progress={Math.round(audio.progress)}
            onToggle={togglePlay}
            onPlayTrack={playTrack}
            onSeek={audio.seek}
            queue={queue}
            avatar={avatar}
          />
        </Suspense>
      )}

      <WrappedModal
        open={wrappedOpen}
        onClose={() => setWrappedOpen(false)}
        minutes={wrappedData.minutes}
        topArtistName={wrappedData.artist}
        topArtistImg={wrappedData.artistImg}
        topGenreName={wrappedData.genre}
        tracksCount={wrappedData.tracks}
        genresCount={wrappedData.genres}
      />

      <PeerProfileSheet peer={peerProfile} onClose={() => setPeerProfile(null)} />

      <RealProfileSheet
        profile={realProfile}
        onClose={() => setRealProfile(null)}
        isFollowing={realProfile ? followingSet.has(realProfile.id) : false}
        onToggleFollow={toggleRealFollow}
      />

      <PeopleSearchSheet
        open={peopleSearchOpen}
        onClose={() => setPeopleSearchOpen(false)}
        followingIds={followingSet}
        onToggleFollow={toggleRealFollow}
        onOpenProfile={p => { setPeopleSearchOpen(false); setRealProfile(p); }}
      />

      <AchievementsSheet open={achOpen} onClose={() => setAchOpen(false)} counters={achCounters} c2={currentTrack.c2} />

      <SplitSheet
        open={splitOpen}
        onClose={() => setSplitOpen(false)}
        shares={monthShares}
        monthKey={splitMonthKey}
        donatedTotal={monthDonations.total}
        donatedByArtist={monthDonations.byArtist}
        onSplitDonate={handleSplitDonate}
        ritualOn={splitRitual}
        onToggleRitual={toggleSplitRitual}
      />

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
