import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from "react";
import { SkipBack, SkipForward, Play, Pause } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Toaster, toast } from "sonner";

import { TRACKS, AVATARS, PLAYLISTS, ls, svgCover, LEADERBOARD_PEERS, type Track, type Friend, type Playlist } from "./data";
import { F, GLASS, SPRING, useAudio, DynamicBg, Waveform, EQ, THEMES, ThemeCtx, ON_DARK, onDark, deriveHandle, type ThemeName } from "./lib";
import { smartNext, pushHistory } from "./smart";
import {
  loadStats, saveStats, touchDailyStreak, addListenSeconds, markTrackPlayed, totalSeconds, weekSeconds, minutesOf, xpOf, levelInfo, topGenre,
  topArtist, distinctTracksPlayed, distinctGenresPlayed, currentMonthSeconds, grantXp,
  loadActivity, pushActivity, loadMyPlays, logMyTrackPlay, loadTotalPlays, bumpTotalPlays,
  latestSharesMonth, loadDonationLedger, logDonationSent, donationsOfMonth, currentMonthKey,
  type ProfileStats, type ActivityItem, type MyPlays, type DonationLedger,
} from "./stats";
import { ACHIEVEMENTS, type AchievementCounters } from "./achievements";
import { MyraWordmark } from "./logo";
// Ленивые чанки: дев-панель с админ-инбоксом нужна двум создателям, live-сессии
// недостижимы без реальных друзей, онбординг после входа — мёртвый груз.
// Маунт «после первого открытия» (см. useEverOpened) гарантирует, что чанк не
// скачивается, пока фича ни разу не понадобилась, но exit-анимации сохраняются
const DevPanelSheet = lazy(() => import("./dev").then(m => ({ default: m.DevPanelSheet })));
const AdminSupportSheet = lazy(() => import("./dev").then(m => ({ default: m.AdminSupportSheet })));
import { saveDownload, loadDownloads, deleteDownload } from "./idb";
import { LangProvider, useLang } from "./i18n";
import type { UserRole } from "./auth";
import { enqueueSyncOp, flushSyncQueue, isNetworkError } from "./syncQueue";
const OnboardingFlow = lazy(() => import("./auth").then(m => ({ default: m.OnboardingFlow })));
import {
  supabaseEnabled, getSession, onAuthStateChange, fetchProfile, upsertProfile, signOutRemote, recordDonation, setSubscriptionStatus, fetchSubscriptionStatus, fetchReceivedDonationsTotal, uploadTrackAudio, insertTrack, deleteAccountRemote,
  fetchFollowingIds, followUser, unfollowUser, fetchFriendsFeed, type SubStatus, type PublicProfile, type FriendFeedItem,
} from "./supabase";
import { HomeScreen, RatingScreen, LibraryScreen, CreatorScreen, ProfileScreen } from "./screens";
import { FullPlayer, BottomIsland, navItems } from "./player";
import { ArtistSheet, RealArtistSheet, AlbumSheet, PlaylistSheet, BlendSheet, AccountSheet, CreatorPlusSheet, ListenerPlusSheet, WrappedModal, SplitSheet, AchievementsSheet, StudioStatsSheet, ImportSheet, SupportSheet, PeerProfileSheet, ReleaseFormSheet, RealProfileSheet, PeopleSearchSheet } from "./overlays";
const LiveSessionSheet = lazy(() => import("./live").then(m => ({ default: m.LiveSessionSheet })));
import { saveLocalTrack, loadLocalTracks, deleteLocalTrack } from "./idb";

// Вынесено на уровень модуля — статичная строка, незачем пересобирать на каждый рендер
const GLOBAL_STYLE = `
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
  /* Упрощённая графика для слабых устройств: главный убийца композитора на
     Android WebView — десятки backdrop-filter одновременно + полноэкранные
     размытые обложки. Отключаем их одним классом на корне; полупрозрачные
     фоны стеклянных панелей остаются читабельными и без блюра */
  .fx-simple *{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
  .fx-simple .fx-heavy{display:none!important}
  .fx-simple .fx-aurora div{animation:none!important;filter:none!important;opacity:0.55}
  .fx-simple .fx-parallax{transform:none!important}
`;

const LOCAL_PALETTE: [string, string][] = [
  ["#12083a", "#8b5cf6"], ["#071a10", "#34d399"], ["#1a0a08", "#fb923c"],
  ["#0f0818", "#f472b6"], ["#071218", "#38bdf8"], ["#181200", "#facc15"],
];

// Без MYRA Pro/Plus офлайн-загрузки ограничены — иначе "безлимит" на апгрейде
// ничем не отличался бы от того, что и так доступно всем
const FREE_DOWNLOAD_LIMIT = 20;

type Tab = "home" | "rating" | "library" | "creator" | "profile";

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

  const [theme, setTheme] = useState<ThemeName>(() => ls.get<ThemeName>("theme", "dark"));
  // Неон — эксклюзив апгрейда (Plus у слушателя, Pro у артиста): цикл тем
  // включает его только при активной подписке, иначе честный тост вместо темы
  const neonAllowedRef = useRef(false);
  const toggleTheme = useCallback(() => {
    setTheme(th => {
      let next: ThemeName = th === "dark" ? "light" : th === "light" ? "neon" : "dark";
      if (next === "neon" && !neonAllowedRef.current) {
        toast(t("pr.themeLocked"));
        next = "dark";
      }
      ls.set("theme", next);
      return next;
    });
  }, [t]);

  // Упрощённая графика: слабые Android-устройства роняют слои композитора
  // (мигающие/пропадающие элементы) под грузом backdrop-filter и блюров
  const [simpleFx, setSimpleFxState] = useState(() => {
    // Явный выбор пользователя всегда важнее автоэвристики
    try { if (localStorage.getItem("myra.simpleFx") !== null) return ls.get("simpleFx", false); } catch { /* приватный режим */ }
    // Автовключение на слабом железе и при системном "убрать анимации"
    // (энергосбережение Android часто включает prefers-reduced-motion)
    const nav = navigator as Navigator & { deviceMemory?: number };
    return (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4
      || (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  });
  const toggleSimpleFx = useCallback(() => {
    setSimpleFxState((s: boolean) => { ls.set("simpleFx", !s); return !s; });
  }, []);

  const [crossfade, setCrossfade] = useState(() => ls.get("crossfade", true));
  const fadeRef = useRef(crossfade);
  fadeRef.current = crossfade;
  const toggleCrossfade = useCallback(() => {
    setCrossfade(c => { ls.set("crossfade", !c); return !c; });
  }, []);

  const [onboarded, setOnboarded] = useState(() => ls.get("onboarded", false));
  const [userName, setUserName] = useState(() => ls.get("userName", "Алекс"));
  const [email, setEmailState] = useState(() => ls.get("email", ""));
  const setEmail = useCallback((next: string) => { setEmailState(next); ls.set("email", next); }, []);
  // Хендл: если пользователь не задавал свой — показываем автосгенерированный из имени
  const [customHandle, setCustomHandleState] = useState<string | null>(() => ls.get<string | null>("customHandle", null));
  const setCustomHandle = useCallback((next: string | null) => { setCustomHandleState(next); ls.set("customHandle", next); }, []);
  const handle = customHandle ?? deriveHandle(userName);
  const setHandle = useCallback(async (h: string) => {
    setCustomHandle(h);
    if (supabaseEnabled) {
      const session = await getSession();
      const uid = session?.user?.id;
      if (uid) {
        try { await upsertProfile(uid, { handle: h }); } catch (err) { console.warn("upsertProfile handle:", err); }
      }
    }
  }, [setCustomHandle]);
  const [avatarIdx, setAvatarIdx] = useState(() => ls.get("avatarIdx", 0));

  // uid текущей сессии Supabase — нужен, чтобы донаты и статус подписки
  // писались на сервер, а не только в localStorage этого устройства
  const [uid, setUid] = useState<string | null>(null);
  const uidRef = useRef<string | null>(null);
  uidRef.current = uid;
  useEffect(() => {
    if (!supabaseEnabled) return;
    getSession().then(s => setUid(s?.user?.id ?? null));
    const { data } = onAuthStateChange(s => setUid(s?.user?.id ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  // ─── Соцслой: реальные подписки между аккаунтами (не путать с toggleFollow
  // ниже — тем локальным (localStorage), который работает только с 8 демо-
  // артистами каталога) ───────────────────────────────────────────────────
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const followingSet = useMemo(() => new Set(followingIds), [followingIds]);
  const [friendsFeed, setFriendsFeed] = useState<FriendFeedItem[]>([]);
  const [realProfile, setRealProfile] = useState<PublicProfile | null>(null);
  const [peopleSearchOpen, setPeopleSearchOpen] = useState(false);

  // Подтягиваем список реальных подписок один раз, когда есть сессия
  // (аналогично статусу подписки Pro/Plus ниже)
  useEffect(() => {
    if (!supabaseEnabled || !uid) { setFollowingIds([]); return; }
    fetchFollowingIds(uid).then(setFollowingIds);
  }, [uid]);

  // Лента подписок — недавние реальные релизы людей, на которых подписан
  // пользователь; перезагружается при каждом изменении списка подписок
  useEffect(() => {
    if (!supabaseEnabled || !followingIds.length) { setFriendsFeed([]); return; }
    fetchFriendsFeed(followingIds).then(setFriendsFeed);
  }, [followingIds]);

  // Реальная подписка/отписка между аккаунтами — обновление оптимистичное:
  // если сервер откажет, откатываем список обратно и сообщаем об этом
  const toggleRealFollow = useCallback(async (targetId: string) => {
    const myId = uidRef.current;
    if (!myId) return;
    const isFollowing = followingIds.includes(targetId);
    setFollowingIds(prev => (isFollowing ? prev.filter(id => id !== targetId) : [...prev, targetId]));
    const { error } = isFollowing ? await unfollowUser(myId, targetId) : await followUser(myId, targetId);
    if (error) {
      setFollowingIds(prev => (isFollowing ? [...prev, targetId] : prev.filter(id => id !== targetId)));
      toast.error(t("soc.followError"));
      return;
    }
    toast(isFollowing ? t("soc.unfollowedToast") : t("soc.followedToast"));
  }, [followingIds, t]);

  // Подписка: none → active → grace (отменена, но действует до конца периода).
  // RLS специально не даёт клиенту самому ставить 'active' напрямую — это
  // делает только Edge Function set-subscription (см. supabase.ts)
  const [cpStatus, setCpStatus] = useState<"none" | "active" | "grace">(() => {
    const raw = ls.get<"none" | "active" | "grace" | boolean>("cpStatus", ls.get("creatorPlus", false) ? "active" : "none");
    return raw === true ? "active" : raw === false ? "none" : raw;
  });
  const setCp = useCallback((s: "none" | "active" | "grace") => {
    setCpStatus(s);
    ls.set("cpStatus", s);
    if (supabaseEnabled && uidRef.current) setSubscriptionStatus(s).catch(err => console.warn("setSubscriptionStatus:", err));
  }, []);
  const creatorPlus = cpStatus !== "none";
  // MYRA Plus — бесплатный план слушателя (Pro оставлен артистам)
  const [plusActive, setPlusActiveState] = useState(() => ls.get("plusActive", false));
  const setPlusActive = useCallback((v: boolean) => {
    setPlusActiveState(v);
    ls.set("plusActive", v);
    if (supabaseEnabled && uidRef.current) setSubscriptionStatus(v ? "active" : "none").catch(err => console.warn("setSubscriptionStatus:", err));
  }, []);
  const [userRole, setUserRole] = useState<UserRole>(() => ls.get<UserRole>("userRole", "listener"));
  const setRole = useCallback((r: UserRole) => { setUserRole(r); ls.set("userRole", r); }, []);
  // Студия — только артистам: MYRA Pro больше не открывает её слушателям
  const showStudio = userRole === "artist";
  // Единая проверка апгрейда своей роли — Pro для артиста, Plus для слушателя.
  // На неё завязаны реальные ограничения бесплатного тарифа (качество, офлайн-лимит),
  // а не только бейджи и текст — иначе Free и Pro/Plus не отличались бы ничем, кроме подписи
  const hasUpgrade = userRole === "artist" ? creatorPlus : plusActive;
  // Режим разработчика — для нас, создателей: включается 7 тапами по аватару в профиле
  const [devMode, setDevModeState] = useState(() => ls.get("devMode", false));
  const [devPanelOpen, setDevPanelOpen] = useState(false);
  const [adminSupportOpen, setAdminSupportOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [customAvatar, setCustomAvatar] = useState<string | null>(() => ls.get<string | null>("customAvatar", null));
  const [followed, setFollowed] = useState<Set<string>>(() => new Set(ls.get<string[]>("followed", [])));

  const [tab, setTabState] = useState<Tab>(() => ls.get<Tab>("tab", "home"));
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

  const activateCreatorPlus = useCallback(() => { setCp("active"); logActivity("act.cpActivated"); }, [logActivity]);
  const cancelCreatorPlusSub = useCallback(() => { setCp("grace"); logActivity("act.cpCancelled"); }, [logActivity]);
  const resumeCreatorPlus = useCallback(() => { setCp("active"); logActivity("act.cpResumed"); }, [logActivity]);
  const activatePlus = useCallback(() => { setPlusActive(true); logActivity("act.plusActivated"); }, [setPlusActive, logActivity]);
  const deactivatePlus = useCallback(() => { setPlusActive(false); }, [setPlusActive]);

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

  // Режим разработчика: тумблер дергается секретным жестом из ProfileScreen
  const toggleDevMode = useCallback(() => {
    setDevModeState(d => {
      const next = !d;
      ls.set("devMode", next);
      toast(next ? t("dev.on") : t("dev.off"));
      if (!next) setDevPanelOpen(false);
      return next;
    });
  }, [t]);
  const openDevPanel = useCallback(() => setDevPanelOpen(true), []);
  const openAdminSupport = useCallback(() => setAdminSupportOpen(true), []);
  const openPlus = useCallback(() => setPlusOpen(true), []);
  const handleGrantXp = useCallback((xp: number) => { setStats(prev => grantXp(prev, xp)); }, []);
  const addBalance = useCallback((amt: number) => {
    setBalance(b => { const nb = b + amt; ls.set("balance", nb); return nb; });
  }, []);

  const withdraw = useCallback((amt: number) => {
    setBalance(b => { const nb = b - amt; ls.set("balance", nb); return nb; });
    logActivity("act.withdrawDone", amt);
  }, [logActivity]);

  const loadedRef = useRef(false);
  const nextRef = useRef<() => void>(() => {});
  const audio = useAudio(() => nextRef.current(), () => fadeRef.current);

  // Качество звука — реально применяется к DSP-цепочке, не только меняет подпись в UI.
  // Hi-Res (индекс 2) — настоящая, а не только косметическая привилегия Pro/Plus:
  // без апгрейда потолок — FLAC (индекс 1)
  const [qualityIdx, setQualityIdxState] = useState(() => ls.get("qualityIdx", 1));
  const setQualityIdx = useCallback((idx: number) => { setQualityIdxState(idx); ls.set("qualityIdx", idx); }, []);
  useEffect(() => { audio.setQuality(qualityIdx); }, [qualityIdx, audio]);
  // Если апгрейд закончился (отмена/grace), а качество уже стояло на Hi-Res —
  // тихо откатываем на FLAC, а не оставляем недоступный уровень висеть в настройках
  useEffect(() => {
    if (!hasUpgrade && qualityIdx > 1) setQualityIdx(1);
  }, [hasUpgrade, qualityIdx, setQualityIdx]);

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

  // Скачанные для офлайна треки каталога
  useEffect(() => {
    loadDownloads().then(recs => {
      if (recs.length) setDownloads(new Map(recs.map(r => [r.id, URL.createObjectURL(r.blob)])));
    });
  }, []);

  // Уже зарегистрирован на Supabase, но локально флаг онбординга не стоит —
  // это либо (а) только что подтвердил почту по ссылке из письма и вернулся
  // на этот же адрес (тогда доводим до конца профиль, отложенный в finishRole),
  // либо (б) другое устройство/очищенный localStorage — просто подтягиваем профиль
  useEffect(() => {
    if (!supabaseEnabled) return;
    (async () => {
      const session = await getSession();
      const uid = session?.user?.id;
      if (!uid || ls.get("onboarded", false)) return;

      const pending = ls.get<{ name: string; role: UserRole; email: string } | null>("pendingProfile", null);
      if (pending) {
        try {
          const { error } = await upsertProfile(uid, { username: pending.name, role: pending.role, email: pending.email });
          if (error) console.warn("upsertProfile:", error.message);
        } catch (err) {
          console.warn("upsertProfile:", err);
        }
        ls.set("pendingProfile", null);
        setUserName(pending.name);
        ls.set("userName", pending.name);
        setEmail(pending.email);
        setUserRole(pending.role);
        ls.set("userRole", pending.role);
        ls.set("onboarded", true);
        setOnboarded(true);
        toast.success(t("au.emailConfirmed"));
        return;
      }

      const { data: profile } = await fetchProfile(uid);
      if (!profile) return;
      setUserName(profile.username);
      ls.set("userName", profile.username);
      setEmail(profile.email ?? "");
      if (profile.handle) setCustomHandle(profile.handle);
      if (profile.role === "artist" || profile.role === "listener") {
        setUserRole(profile.role);
        ls.set("userRole", profile.role);
      }
      ls.set("onboarded", true);
      setOnboarded(true);
    })();
  }, [setEmail, t]);

  // Статус Pro/Plus — правда живёт на сервере (см. Edge Function set-subscription);
  // подтягиваем один раз, когда есть и сессия, и завершённый онбординг, чтобы
  // подписка была видна с любого устройства, а не только с того, где её оформили
  useEffect(() => {
    if (!supabaseEnabled || !uid || !onboarded) return;
    fetchSubscriptionStatus(uid).then(status => {
      if (status === null) return;
      if (userRole === "artist") { setCpStatus(status); ls.set("cpStatus", status); }
      else { const active = status === "active"; setPlusActiveState(active); ls.set("plusActive", active); }
    });
  }, [uid, onboarded, userRole]);

  // Реально полученные донаты (from RealArtistSheet, to_user_id = uid) — не
  // тот же счётчик, что локальный симулированный balance/withdraw ниже:
  // подтягиваем при каждом заходе в Студию, чтобы сумма была свежей
  const [realDonationsTotal, setRealDonationsTotal] = useState(0);
  useEffect(() => {
    if (!supabaseEnabled || !uid || tab !== "creator") return;
    fetchReceivedDonationsTotal(uid).then(setRealDonationsTotal);
  }, [uid, tab]);

  // Апгрейд любого типа открывает неоновую тему; при его потере тема честно
  // откатывается — иначе отключивший Plus навсегда остался бы с эксклюзивом
  const hasAnyUpgrade = plusActive || cpStatus === "active" || cpStatus === "grace";
  neonAllowedRef.current = hasAnyUpgrade;
  useEffect(() => {
    if (theme === "neon" && !hasAnyUpgrade) { setTheme("dark"); ls.set("theme", "dark"); }
  }, [theme, hasAnyUpgrade]);

  const avatar = customAvatar ?? AVATARS[avatarIdx] ?? AVATARS[0];

  // dev-хук для интеграционных проверок
  if ((import.meta as any).env?.DEV) {
    (window as any).__myra = { tab, playerOpen, artistName, blendFriend: blendFriend?.name ?? null, liveFriend: liveFriend?.name ?? null, accountOpen, creatorPlusOpen, wrappedOpen, statsOpen, playlistId, onboarded, myTracks: myTracks.length, audio, qualityIdx };
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

  // Реальный счётчик "начал слушать трек" — для профиля и (если это свой трек) студии
  const registerPlay = useCallback((tr: Track) => {
    setTotalPlays(bumpTotalPlays());
    setStats(prev => markTrackPlayed(prev, tr.id));
    if (tr.local) setMyPlays(logMyTrackPlay(tr.id));
  }, []);

  const playTrack = useCallback((tr: Track) => {
    setCurrentTrack(prev => {
      if (prev.id === tr.id && loadedRef.current) {
        audio.toggle();
        return prev;
      }
      loadedRef.current = true;
      audio.load(resolveUrl(tr));
      pushHistory(tr.id);
      registerPlay(tr);
      return tr;
    });
  }, [audio, resolveUrl, registerPlay]);

  const togglePlay = useCallback(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      audio.load(resolveUrl(currentTrack));
      pushHistory(currentTrack.id);
    } else {
      audio.toggle();
    }
  }, [audio, currentTrack, resolveUrl]);

  // Очередь = локальные файлы + каталог — пересобираем, только когда реально меняются свои треки
  const queue = useMemo(() => (myTracks.length ? [...myTracks, ...TRACKS] : TRACKS), [myTracks]);
  const queueRef = useRef<Track[]>(queue);
  queueRef.current = queue;

  const step = useCallback((dir: 1 | -1) => {
    setCurrentTrack(prev => {
      const q = queueRef.current;
      const idx = q.findIndex(tr => tr.id === prev.id);
      const next = q[(idx + dir + q.length) % q.length] ?? q[0];
      loadedRef.current = true;
      audio.load(resolveUrl(next));
      pushHistory(next.id);
      registerPlay(next);
      return next;
    });
  }, [audio, resolveUrl, registerPlay]);

  const handleNext = useCallback(() => step(1), [step]);
  const handlePrev = useCallback(() => step(-1), [step]);

  // ─── Media Session: управление из шторки уведомлений и с локскрина ─────────
  // Телефон показывает "сейчас играет" с обложкой и кнопками системно — без
  // этого музыка из MYRA жила только внутри открытого приложения. Обработчики
  // через ref: сами колбэки пересоздаются, а системе нужны живые ссылки
  const mediaCtlRef = useRef({ toggle: () => {}, next: () => {}, prev: () => {} });
  useEffect(() => {
    mediaCtlRef.current = { toggle: togglePlay, next: handleNext, prev: handlePrev };
  }, [togglePlay, handleNext, handlePrev]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return; // старые WebView — просто без системной карточки
    const ms = navigator.mediaSession;
    ms.setActionHandler("play", () => mediaCtlRef.current.toggle());
    ms.setActionHandler("pause", () => mediaCtlRef.current.toggle());
    ms.setActionHandler("nexttrack", () => mediaCtlRef.current.next());
    ms.setActionHandler("previoustrack", () => mediaCtlRef.current.prev());
    return () => {
      ms.setActionHandler("play", null);
      ms.setActionHandler("pause", null);
      ms.setActionHandler("nexttrack", null);
      ms.setActionHandler("previoustrack", null);
    };
  }, []);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: currentTrack.album,
      // Обложки — data-URI (svg/png), системная карточка Android их понимает
      artwork: [{ src: currentTrack.img, sizes: "500x500" }],
    });
  }, [currentTrack]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = audio.playing ? "playing" : "paused";
  }, [audio.playing]);

  // «Прилив» (личный поток): умный подбор без повторов + причина выбора
  const likedRef = useRef(likedIds); likedRef.current = likedIds;
  const followedRef = useRef(followed); followedRef.current = followed;
  const langRef = useRef(lang); langRef.current = lang;
  const playWave = useCallback((silent = false) => {
    setCurrentTrack(prev => {
      const { track, reason } = smartNext(queueRef.current, likedRef.current, followedRef.current, prev.id, langRef.current);
      loadedRef.current = true;
      audio.load(resolveUrl(track));
      pushHistory(track.id);
      registerPlay(track);
      if (!silent) toast(`MYRA AI · ${track.title} — ${reason}`);
      return track;
    });
  }, [audio, resolveUrl, registerPlay]);

  // Загрузка трека для офлайна — без апгрейда лимит FREE_DOWNLOAD_LIMIT треков,
  // иначе "безлимит на Plus/Pro" ничем не отличался бы от того, что уже есть у всех
  const downloadTrack = useCallback(async (tr: Track) => {
    if (downloadsRef.current.has(tr.id)) {
      const url = downloadsRef.current.get(tr.id)!;
      URL.revokeObjectURL(url);
      setDownloads(prev => { const m = new Map(prev); m.delete(tr.id); return m; });
      deleteDownload(tr.id).catch(() => {});
      toast(t("dl.removed"));
      return;
    }
    if (!hasUpgrade && downloadsRef.current.size >= FREE_DOWNLOAD_LIMIT) {
      toast(t("dl.limitReached", FREE_DOWNLOAD_LIMIT));
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
      logActivity("dl.done", tr.title);
    } catch {
      toast(t("dl.fail"));
    }
  }, [t, logActivity, hasUpgrade]);

  // Свои плейлисты (создание + импорт)
  const createPlaylist = useCallback((name: string, trackIds: number[]) => {
    const pl: Playlist = { id: "u" + Date.now(), name, img: svgCover("#12083a", "#8b5cf6", Date.now() % 97), trackIds };
    setCustomPls(prev => { const next = [pl, ...prev]; ls.set("customPls", next); return next; });
    logActivity("act.plCreated", name);
    return pl;
  }, [logActivity]);

  const deletePlaylist = useCallback((id: string) => {
    setCustomPls(prev => {
      const pl = prev.find(p => p.id === id);
      const next = prev.filter(p => p.id !== id);
      ls.set("customPls", next);
      if (pl) logActivity("act.plDeleted", pl.name);
      return next;
    });
    setPlaylistId(cur => (cur === id ? null : cur));
    toast(t("lib.plDeleted"));
  }, [t, logActivity]);

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
    logActivity("cr.added", added.length);
  }, [userName, t, logActivity]);

  // Релиз в Студии: выбор файла не публикует его сразу — сперва форма
  // с названием, жанром, текстом и обложкой, и только потом явный "Опубликовать"
  const [pendingRelease, setPendingRelease] = useState<{ file: File; id: number; c1: string; c2: string; defaultImg: string } | null>(null);

  const startRelease = useCallback((files: FileList | File[]) => {
    const f = [...files].find(f => f.type.startsWith("audio/") || /\.(mp3|wav|flac|m4a|ogg|aac)$/i.test(f.name));
    if (!f) return;
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const [c1, c2] = LOCAL_PALETTE[id % LOCAL_PALETTE.length];
    setPendingRelease({ file: f, id, c1, c2, defaultImg: svgCover(c1, c2, id) });
  }, []);

  const publishRelease = useCallback(async (meta: { title: string; genre: string; lyrics: string; cover: string | null }) => {
    if (!pendingRelease) return;
    const { file, id, c1, c2, defaultImg } = pendingRelease;
    try { await saveLocalTrack({ id, title: meta.title, artist: userName, duration: "", c1, c2, blob: file }); } catch { /* без сохранения */ }
    const track: Track = {
      id, title: meta.title, artist: userName, album: "Local", duration: "", genre: meta.genre, plays: "0",
      liked: false, c1, c2, img: meta.cover ?? defaultImg, url: URL.createObjectURL(file), local: true,
      lyrics: meta.lyrics || undefined,
    };
    setMyTracks(prev => [track, ...prev]);
    setPendingRelease(null);
    toast(t("cr.published", meta.title));
    logActivity("cr.added", 1);

    // Публикация в Supabase — строго в фоне и без ожидания: локальный трек
    // (IndexedDB + myTracks) уже живёт и играет сам по себе, а без сети/логина
    // это так и останется единственной копией — как и было до этой фичи
    if (supabaseEnabled && uid) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
      uploadTrackAudio(uid, String(id), file, ext)
        .then(async ({ url, error: upErr }) => {
          if (upErr || !url) { console.warn("uploadTrackAudio:", upErr); return; }
          const { data, error } = await insertTrack(uid, {
            title: meta.title, genre: meta.genre, lyrics: meta.lyrics || null, cover_url: meta.cover, audio_url: url,
          });
          if (error || !data) { console.warn("insertTrack:", error); return; }
          setMyTracks(prev => prev.map(tr => (tr.id === id ? { ...tr, remoteId: data.id } : tr)));
          // currentTrack — отдельный снимок объекта, а не производное от myTracks:
          // если пользователь уже открыл именно этот трек в плеере до того, как
          // фоновая публикация успела дойти сюда, повторный клик по нему же не
          // обновит currentTrack (playTrack рано возвращается на "тот же id"), и
          // вкладка комментариев осталась бы на localStorage до следующего трека
          setCurrentTrack(prev => (prev.id === id ? { ...prev, remoteId: data.id } : prev));
        })
        .catch(err => console.warn("publishRelease sync:", err));
    }
  }, [pendingRelease, userName, t, logActivity, uid]);

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
  useEffect(() => { nextRef.current = () => playWave(true); playWaveRef.current = () => playWave(); }, [playWave]);

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

  // Стабильные обёртки: playWave пересоздаётся при смене зависимостей, а
  // мемоизации HomeScreen нужен неизменный проп — иначе React.memo бесполезен
  const playWaveRef = useRef<() => void>(() => {});
  const navigateTab = useCallback((id: string) => setTab(id as Tab), [setTab]);
  const openPeopleSearch = useCallback(() => setPeopleSearchOpen(true), []);
  const startWave = useCallback(() => playWaveRef.current(), []);

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

  // Тост здесь не нужен: каждый путь онбординга (регистрация, вход, соцсети)
  // уже показывает свой — раньше «Аккаунт создан» дублировался и вылезал даже при входе
  const finishOnboarding = useCallback((name: string, role: UserRole, enteredEmail: string, handle?: string | null) => {
    setUserName(name);
    ls.set("userName", name);
    setUserRole(role);
    ls.set("userRole", role);
    setEmail(enteredEmail);
    // При входе в существующий аккаунт приходит серверный хендл; при регистрации —
    // null, чтобы не унаследовать кастомный хендл предыдущего владельца устройства
    setCustomHandle(handle ?? null);
    ls.set("onboarded", true);
    setOnboarded(true);
  }, [setEmail, setCustomHandle]);

  const handleLogout = useCallback(() => {
    audio.pause();
    // Гасим и серверную сессию Supabase — иначе getSession() на следующем запуске
    // решит, что пользователь всё ещё залогинен, и попытается восстановить профиль
    if (supabaseEnabled) signOutRemote().catch(() => {});
    // Чистим и офлайн-хранилище (IndexedDB), не только localStorage —
    // иначе после входа в новый аккаунт старые файлы всё ещё будут тут
    myTracks.forEach(tr => deleteLocalTrack(tr.id).catch(() => {}));
    downloads.forEach((_url, id) => deleteDownload(id).catch(() => {}));
    ls.clear();
    setOnboarded(false);
    setTab("home");
    setPlayerOpen(false);
    setAccountOpen(false);
    // Полный сброс в памяти — новый аккаунт должен быть по-настоящему пустым,
    // а не просто выглядеть так до следующей перезагрузки страницы
    setLikedIds(new Set());
    setFollowed(new Set());
    setCustomPls([]);
    setMyTracks([]);
    setDownloads(new Map());
    setPlOrders({});
    setCpStatus("none");
    setPlusActiveState(false);
    setDevModeState(false);
    setDevPanelOpen(false);
    setAdminSupportOpen(false);
    setPlusOpen(false);
    setUserRole("listener");
    setCustomAvatar(null);
    setAvatarIdx(0);
    setCustomHandleState(null);
    setEmailState("");
    setStats(touchDailyStreak(loadStats()));
    setActivity([]);
    setMyPlays({ byTrack: {}, byDay: {} });
    setTotalPlays(0);
    setBalance(0);
    prevLevelRef.current = null;
    // Соцслой — тоже полностью сброшен, иначе подписки предыдущего аккаунта
    // этого устройства всплыли бы у следующего, вошедшего на нём же
    setFollowingIds([]);
    setFriendsFeed([]);
    setRealProfile(null);
    setPeopleSearchOpen(false);
    // Прозрачный сплит: ls.clear() выше стёр ключ на диске, но состояние в
    // памяти пережило бы логаут — донаты прошлого аккаунта не должны
    // показываться следующему
    setDonationLedger({});
    setSplitOpen(false);
    toast(t("pr.loggedOut"));
  }, [audio, t, myTracks, downloads]);

  // В отличие от остальных фоновых синхронизаций (донаты, подписки), здесь
  // нельзя молча проглотить ошибку и продолжить как ни в чём не бывало:
  // текст в UI прямым текстом обещает "сотрутся навсегда", и если реальное
  // удаление на сервере не прошло, пользователь должен об этом узнать, а не
  // считать аккаунт удалённым, пока он на самом деле жив в базе
  const handleDeleteAccount = useCallback(async () => {
    if (supabaseEnabled && uid) {
      const { error } = await deleteAccountRemote();
      if (error) { toast.error(t("acc.deleteFailed")); return; }
    }
    handleLogout();
    toast(t("acc.deleted"));
  }, [handleLogout, t, uid]);

  const handleSleep = useCallback((minutes: number | null) => {
    setSleepLeft(minutes === null ? null : minutes * 60);
  }, []);

  // Тема оборачивает и онбординг, и приложение; Toaster общий
  const themedRoot = (children: React.ReactNode) => (
    <ThemeCtx.Provider value={{ theme, toggleTheme }}>
      <div className={`h-screen w-full${simpleFx ? " fx-simple" : ""}`} style={{ ...(THEMES[theme] as React.CSSProperties), background: "var(--bg)", color: "var(--fg)", fontFamily: F.b, transition: "background 0.4s ease, color 0.4s ease" }}>
        <style>{GLOBAL_STYLE}</style>
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

  // Хуки ленивого маунта — строго до раннего return (правила хуков)
  const devEver = useEverOpened(devPanelOpen);
  const adminEver = useEverOpened(adminSupportOpen);
  const liveEver = useEverOpened(liveFriend !== null);

  if (!onboarded) {
    return themedRoot(<Suspense fallback={null}><OnboardingFlow onDone={finishOnboarding} /></Suspense>);
  }

  // Производные значения реальной статистики — общий источник для рейтинга/профиля/аккаунта
  const xp = xpOf(stats);
  const lvl = levelInfo(xp);
  const statMinutesWeek = minutesOf(weekSeconds(stats));
  const statTopGenre = topGenre(stats);

  // Текущий план для строки в аккаунте: Pro — у артистов, Plus — у слушателей
  const planLabel = userRole === "artist"
    ? (cpStatus === "active" ? t("plan.proActive") : cpStatus === "grace" ? t("plan.proGrace") : t("plan.free"))
    : (plusActive ? t("plan.plus") : t("plan.free"));
  const openPlan = userRole === "artist" ? openCreatorPlus : openPlus;

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
        progress={Math.round(audio.progress)}
        onNavigate={navigateTab}
        onOpenBlend={setBlendFriend}
        onOpenLive={openLive}
        onPlayWave={startWave}
        onOpenArtist={openArtist}
        onOpenRealArtist={openRealArtist}
        avatar={avatar}
        activity={activity}
        friendsFeed={friendsFeed}
        onOpenPeopleSearch={openPeopleSearch}
        onOpenRealProfile={setRealProfile}
        uid={uid}
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
        plusActive={plusActive}
        donationCount={donationCount}
        devMode={devMode}
        onToggleDevMode={toggleDevMode}
        onOpenDevPanel={openDevPanel}
        onOpenPlus={openPlus}
      />
    ),
  };

  return themedRoot(
    <div className="flex h-full w-full overflow-hidden relative">
      <DynamicBg track={currentTrack} />

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col py-8 gap-1 flex-shrink-0 relative z-10" style={{ width: 224, borderRight: "1px solid color-mix(in srgb, var(--wash) 05%, transparent)", background: "var(--island)", backdropFilter: "blur(32px)" }}>
        <div className="px-6 mb-9 flex items-center gap-2">
          <MyraWordmark height={20} style={{ color: "var(--fg)" }} />
          <span className="text-[9px] px-1.5 py-0.5 rounded-md" style={{ fontFamily: F.m, color: currentTrack.c2, background: `${currentTrack.c2}18` }}>beta</span>
        </div>
        {navItems(showStudio).map(n => {
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
              <Waveform progress={Math.round(audio.progress)} color={currentTrack.c2} onSeek={audio.seek} height={22} seed={currentTrack.id + 3} bars={40} dim playing={audio.playing} />
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
              downloaded={downloads.has(currentTrack.id)}
              onDownload={() => downloadTrack(currentTrack)}
              handle={handle}
              uid={uid}
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

      <ListenerPlusSheet
        open={plusOpen}
        onClose={() => setPlusOpen(false)}
        active={plusActive}
        onActivate={activatePlus}
        onDeactivate={deactivatePlus}
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
            plusActive={plusActive}
            onSetPlus={setPlusActive}
            balance={balance}
            onAddBalance={addBalance}
            onGrantXp={handleGrantXp}
            onOpenAdminSupport={openAdminSupport}
          />
        </Suspense>
      )}

      {adminEver && (
        <Suspense fallback={null}>
          <AdminSupportSheet open={adminSupportOpen} onClose={() => setAdminSupportOpen(false)} uid={uid} />
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

      {liveEver && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}

      <WrappedModal
        open={wrappedOpen}
        onClose={() => setWrappedOpen(false)}
        minutes={minutesOf(currentMonthSeconds(stats))}
        topArtistName={topArtist(stats)}
        topArtistImg={queue.find(tr => tr.artist === topArtist(stats))?.img}
        topGenreName={topGenre(stats)}
        tracksCount={distinctTracksPlayed(stats)}
        genresCount={distinctGenresPlayed(stats)}
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
