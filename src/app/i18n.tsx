import { createContext, useContext, useState, useCallback } from "react";
import { ls } from "./data";

export type Lang = "ru" | "en";

// {0}, {1} — подстановки аргументов
const STR: Record<string, { ru: string; en: string }> = {
  // Навигация
  "nav.home":    { ru: "Главная",   en: "Home" },
  "nav.browse":  { ru: "Обзор",     en: "Browse" },
  "nav.library": { ru: "Медиатека", en: "Library" },
  "nav.creator": { ru: "Студия",    en: "Studio" },
  "nav.profile": { ru: "Профиль",   en: "Profile" },

  // Главная
  "home.flow":       { ru: "Персональный поток", en: "Personal flow" },
  "home.my":         { ru: "Моя ",   en: "My " },
  "home.wave":       { ru: "волна",  en: "wave" },
  "home.liked":      { ru: "Любимое",  en: "Liked" },
  "home.charts":     { ru: "Чарты",    en: "Charts" },
  "home.radio":      { ru: "Радио",    en: "Radio" },
  "home.blend":      { ru: "Blend",    en: "Blend" },
  "home.discover":   { ru: "Открой новое", en: "Discover" },
  "home.swipeHint":  { ru: "свайп → слушать", en: "swipe → play" },
  "home.friends":    { ru: "Друзья слушают", en: "Friends listening" },
  "home.continue":   { ru: "Продолжить", en: "Continue" },
  "home.all":        { ru: "Все", en: "All" },
  "home.notifs":     { ru: "УВЕДОМЛЕНИЯ", en: "NOTIFICATIONS" },
  "home.radioToast": { ru: "Радио: {0} — {1}", en: "Radio: {0} — {1}" },
  "home.withFriend": { ru: "Слушаешь вместе с {0}: {1}", en: "Listening with {0}: {1}" },
  "notif.1": { ru: "Luna Wave выпустила новый трек", en: "Luna Wave released a new track" },
  "notif.2": { ru: "Рома добавил 3 трека в ваш Blend", en: "Roma added 3 tracks to your Blend" },
  "notif.3": { ru: "Новый донат +150₽ от @wavelet", en: "New donation +150₽ from @wavelet" },
  "notif.ago": { ru: "{0} назад", en: "{0} ago" },
  "time.min": { ru: "мин", en: "min" },
  "time.h":   { ru: "ч",   en: "h" },

  // Дека
  "deck.play": { ru: "Слушать", en: "Play" },
  "deck.skip": { ru: "Пропустить", en: "Skip" },

  // Обзор
  "browse.search":     { ru: "Треки, артисты, жанры…", en: "Tracks, artists, genres…" },
  "browse.found":      { ru: "Найдено: {0}", en: "Found: {0}" },
  "browse.chart":      { ru: "Мировой чарт", en: "Global chart" },
  "browse.genres":     { ru: "Жанры", en: "Genres" },
  "browse.mixStarted": { ru: "Микс «{0}» запущен", en: "“{0}” mix started" },
  "mood.focus":   { ru: "Фокус",      en: "Focus" },
  "mood.workout": { ru: "Тренировка", en: "Workout" },
  "mood.road":    { ru: "В дороге",   en: "On the road" },
  "mood.sleep":   { ru: "Сон",        en: "Sleep" },
  "mood.energy":  { ru: "Энергия",    en: "Energy" },

  // Медиатека
  "lib.tracks":    { ru: "Треки · {0}", en: "Tracks · {0}" },
  "lib.playlists": { ru: "Плейлисты", en: "Playlists" },
  "lib.podcasts":  { ru: "Подкасты", en: "Podcasts" },
  "lib.nTracks":   { ru: "{0} треков", en: "{0} tracks" },
  "lib.newPl":     { ru: "Создание плейлистов — в следующей версии", en: "Playlist creation — next version" },
  "lib.plToast":   { ru: "Плейлист «{0}» — {1} треков", en: "Playlist “{0}” — {1} tracks" },
  "lib.podToast":  { ru: "«{0}» — продолжить с {1}%", en: "“{0}” — continue from {1}%" },
  "lib.listened":  { ru: "{0}% прослушано", en: "{0}% listened" },

  // Студия
  "cr.creator":    { ru: "Creator", en: "Creator" },
  "cr.studio":     { ru: "Студия", en: "Studio" },
  "cr.plays7":     { ru: "Прослушиваний за неделю", en: "Plays this week" },
  "cr.fans":       { ru: "Фанатов", en: "Fans" },
  "cr.donations":  { ru: "Донаты", en: "Donations" },
  "cr.releases":   { ru: "Релиза", en: "Releases" },
  "cr.analytics":  { ru: "{0}: детальная аналитика — скоро", en: "{0}: detailed analytics — soon" },
  "cr.newRelease": { ru: "Новый релиз", en: "New release" },
  "cr.published":  { ru: "«{0}» опубликован", en: "“{0}” published" },
  "cr.appearIn":   { ru: "Появится в «Новинках инди» через ~15 мин", en: "Will appear in Indie Fresh in ~15 min" },
  "cr.trackName":  { ru: "Название трека…", en: "Track name…" },
  "cr.uploading":  { ru: "Загрузка…", en: "Uploading…" },
  "cr.dropFile":   { ru: "Перетащи файл или нажми", en: "Drop a file or click" },
  "cr.upload":     { ru: "Загрузить трек", en: "Upload track" },
  "cr.nameFirst":  { ru: "Сначала введи название", en: "Enter a name first" },
  "cr.myReleases": { ru: "Мои релизы", en: "My releases" },
  "cr.myFiles":    { ru: "Мои файлы", en: "My files" },
  "cr.added":      { ru: "Добавлено треков: {0}", en: "Tracks added: {0}" },
  "cr.local":      { ru: "локальный файл", en: "local file" },
  "cr.deleted":    { ru: "Файл удалён", en: "File removed" },
  "st.title":      { ru: "Детальная аналитика", en: "Detailed analytics" },
  "st.days30":     { ru: "Прослушивания · 30 дней", en: "Plays · 30 days" },
  "st.topTracks":  { ru: "Топ треков", en: "Top tracks" },
  "st.cities":     { ru: "Города слушателей", en: "Listener cities" },
  "st.sources":    { ru: "Откуда слушают", en: "Where plays come from" },
  "st.srcWave":    { ru: "Моя волна", en: "My Wave" },
  "st.srcSearch":  { ru: "Поиск", en: "Search" },
  "st.srcProfile": { ru: "Профиль артиста", en: "Artist profile" },
  "st.srcBlend":   { ru: "Blend и друзья", en: "Blend & friends" },
  "st.donations":  { ru: "Донаты за месяц", en: "Donations this month" },
  "cr.plays":      { ru: "{0} прослушиваний", en: "{0} plays" },
  "cr.earn":       { ru: "Начни зарабатывать", en: "Start earning" },
  "cr.earnSub":    { ru: "Донаты, подписки фанатов, приоритет в алгоритмах", en: "Donations, fan subscriptions, algorithm priority" },
  "cr.connect":    { ru: "Подключить · 499₽/мес", en: "Subscribe · 499₽/mo" },
  "cr.active":     { ru: "Creator+ активен", en: "Creator+ active" },
  "cr.manage":     { ru: "Управлять подпиской", en: "Manage subscription" },

  // Creator+ шторка
  "cp.title":     { ru: "Creator+", en: "Creator+" },
  "cp.sub":       { ru: "Инструменты для роста и честный доход", en: "Growth tools and fair income" },
  "cp.b1":        { ru: "Донаты без комиссии MYRA", en: "Donations with zero MYRA fee" },
  "cp.b2":        { ru: "Приоритет в «Моей волне» слушателей", en: "Priority in listeners' My Wave" },
  "cp.b3":        { ru: "Расширенная аналитика аудитории", en: "Advanced audience analytics" },
  "cp.b4":        { ru: "Поддержка — ответ за 1 час", en: "Support replies within 1 hour" },
  "cp.pay":       { ru: "Оформить за 499₽/мес", en: "Subscribe for 499₽/mo" },
  "cp.cancelBtn": { ru: "Отменить подписку", en: "Cancel subscription" },
  "cp.cancelQ":   { ru: "Отменить Creator+?", en: "Cancel Creator+?" },
  "cp.cancelSub": { ru: "Преимущества сохранятся до 05.08.2026, дальше ничего не спишется", en: "Perks stay until 05.08.2026, no further charges" },
  "cp.cancelled": { ru: "Подписка Creator+ отменена", en: "Creator+ subscription cancelled" },
  "cp.paying":    { ru: "Обрабатываем платёж…", en: "Processing payment…" },
  "cp.done":      { ru: "Creator+ подключён", en: "Creator+ activated" },
  "cp.doneSub":   { ru: "Твои треки уже получают приоритет", en: "Your tracks are already prioritized" },
  "cp.great":     { ru: "Отлично", en: "Great" },
  "cp.cancel":    { ru: "Подписка активна до 05.08.2026", en: "Active until 05.08.2026" },

  // Профиль / настройки
  "pr.wrapped":     { ru: "Wrapped ", en: "Wrapped " },
  "pr.month":       { ru: "месяца", en: "monthly" },
  "pr.july":        { ru: "Июль 2026", en: "July 2026" },
  "pr.follows":     { ru: "Подписок", en: "Following" },
  "pr.fans":        { ru: "Фанатов", en: "Fans" },
  "pr.plays":       { ru: "Прослушиваний", en: "Plays" },
  "pr.notifs":      { ru: "Уведомления", en: "Notifications" },
  "pr.notifsOn":    { ru: "Уведомления включены", en: "Notifications on" },
  "pr.notifsOff":   { ru: "Уведомления выключены", en: "Notifications off" },
  "pr.autoDl":      { ru: "Автозагрузка", en: "Auto-download" },
  "pr.autoDlOn":    { ru: "Новые лайки будут скачиваться", en: "New likes will be downloaded" },
  "pr.autoDlOff":   { ru: "Автозагрузка выключена", en: "Auto-download off" },
  "pr.quality":     { ru: "Качество звука", en: "Audio quality" },
  "pr.lossless":    { ru: "lossless — без доплат", en: "lossless — no extra cost" },
  "pr.qualitySet":  { ru: "Качество звука: {0}", en: "Audio quality: {0}" },
  "pr.aiFilter":    { ru: "Фильтр AI-музыки", en: "AI music filter" },
  "pr.aiSub":       { ru: "скрывать треки, созданные ИИ", en: "hide AI-generated tracks" },
  "pr.aiOn":        { ru: "AI-музыка скрыта из рекомендаций", en: "AI music hidden from recommendations" },
  "pr.aiOff":       { ru: "AI-музыка снова видна", en: "AI music visible again" },
  "pr.crossfade":   { ru: "Кроссфейд", en: "Crossfade" },
  "pr.crossOn":     { ru: "Кроссфейд 6 сек включён", en: "6s crossfade on" },
  "pr.crossOff":    { ru: "Кроссфейд выключен", en: "Crossfade off" },
  "pr.blendRow":    { ru: "Друзья и Blend", en: "Friends & Blend" },
  "pr.blendWith":   { ru: "Blend с {0}", en: "Blend with {0}" },
  "pr.match":       { ru: "совпадение вкуса {0}%", en: "{0}% taste match" },
  "pr.open":        { ru: "Открыть", en: "Open" },
  "pr.lang":        { ru: "Язык", en: "Language" },
  "pr.account":     { ru: "Аккаунт", en: "Account" },
  "pr.logout":      { ru: "Выйти", en: "Log out" },
  "pr.logoutQ":     { ru: "Выйти из аккаунта?", en: "Log out of your account?" },
  "pr.logoutSub":   { ru: "Твоя музыка и настройки сохранятся", en: "Your music and settings will be kept" },
  "pr.cancel":      { ru: "Отмена", en: "Cancel" },

  // Live-сессия «Слушают вместе»
  "live.with":      { ru: "Вместе с {0}", en: "Together with {0}" },
  "live.sync":      { ru: "синхронно · без задержки", en: "in sync · zero delay" },
  "live.listeners": { ru: "{0} слушают сейчас", en: "{0} listening now" },
  "live.you":       { ru: "Ты", en: "You" },
  "live.upNext":    { ru: "Дальше у {0}", en: "Up next from {0}" },
  "live.invite":    { ru: "Позвать друзей", en: "Invite friends" },
  "live.invited":   { ru: "Ссылка на сессию скопирована", en: "Session link copied" },
  "live.leave":     { ru: "Выйти из сессии", en: "Leave session" },
  "live.left":      { ru: "Ты вышел из совместного прослушивания", en: "You left the session" },
  "live.react":     { ru: "Отправь реакцию — {0} увидит её сразу", en: "Send a reaction — {0} sees it instantly" },

  // Wrapped
  "wr.yourMonth": { ru: "Твой ", en: "Your " },
  "wr.monthWord": { ru: "месяц", en: "month" },
  "wr.tap":       { ru: "жми справа, чтобы дальше", en: "tap right to continue" },
  "wr.streak":    { ru: "21 день", en: "21 days" },
  "wr.streakSub": { ru: "подряд с музыкой — ни дня тишины", en: "in a row with music — not one silent day" },
  "wr.minutesEyebrow": { ru: "ты слушал музыку", en: "you listened for" },
  "wr.artistEyebrow":  { ru: "артист месяца", en: "artist of the month" },
  "wr.genreEyebrow":   { ru: "жанр номер один", en: "genre number one" },
  "wr.tracksEyebrow":  { ru: "новая музыка", en: "new music" },
  "wr.shareEyebrow":   { ru: "твой месяц в одной карточке", en: "your month in one card" },
  "wr.shareTitle":     { ru: "Покажи друзьям", en: "Show your friends" },
  "wr.minutes":   { ru: "4 210 минут", en: "4,210 minutes" },
  "wr.minutesSub":{ ru: "музыки прослушано", en: "of music played" },
  "wr.artist":    { ru: "твой артист месяца", en: "your artist of the month" },
  "wr.genre":     { ru: "жанр номер один", en: "genre number one" },
  "wr.tracksSub": { ru: "и 3 новых жанра", en: "and 3 new genres" },
  "wr.tracksVal": { ru: "248 треков", en: "248 tracks" },
  "wr.share":     { ru: "Поделиться", en: "Share" },
  "wr.shared":    { ru: "Карточка Wrapped скопирована — делись", en: "Wrapped card copied — share away" },

  // Аккаунт
  "acc.title":     { ru: "Аккаунт", en: "Account" },
  "acc.name":      { ru: "Имя", en: "Name" },
  "acc.save":      { ru: "Сохранить", en: "Save" },
  "acc.saved":     { ru: "Имя обновлено", en: "Name updated" },
  "acc.email":     { ru: "Почта", en: "Email" },
  "acc.plan":      { ru: "Подписка", en: "Plan" },
  "acc.planVal":   { ru: "MYRA+ · до 05.08.2026", en: "MYRA+ · until 05.08.2026" },
  "acc.planTap":   { ru: "Управление подпиской — скоро", en: "Plan management — soon" },
  "acc.avatar":    { ru: "Аватар", en: "Avatar" },
  "acc.support":   { ru: "Поддержка", en: "Support" },
  "acc.supportSub":{ ru: "отвечаем в течение часа", en: "we reply within an hour" },
  "acc.supportGo": { ru: "Чат с поддержкой откроется в приложении", en: "Support chat opens in the app" },
  "acc.delete":    { ru: "Удалить аккаунт", en: "Delete account" },
  "acc.deleteQ":   { ru: "Точно удалить аккаунт?", en: "Really delete your account?" },
  "acc.deleteSub": { ru: "Плейлисты, лайки и Blend будут стёрты навсегда", en: "Playlists, likes and Blends will be erased forever" },
  "acc.deleteYes": { ru: "Да, удалить", en: "Yes, delete" },

  // Артист
  "ar.listeners":  { ru: "слушателей в месяц", en: "monthly listeners" },
  "ar.follow":     { ru: "Подписаться", en: "Follow" },
  "ar.following":  { ru: "Ты подписан", en: "Following" },
  "ar.followed":   { ru: "Подписка на {0} оформлена", en: "Now following {0}" },
  "ar.unfollowed": { ru: "Подписка отменена", en: "Unfollowed" },
  "ar.support":    { ru: "Поддержать", en: "Support" },
  "ar.popular":    { ru: "Популярное", en: "Popular" },
  "ar.similarTr":  { ru: "Похожее звучание", en: "Similar sound" },
  "ar.similar":    { ru: "Похожие артисты", en: "Similar artists" },
  "don.title":     { ru: "Поддержать {0}", en: "Support {0}" },
  "don.sub":       { ru: "100% суммы уходит артисту", en: "100% goes to the artist" },
  "don.custom":    { ru: "Своя сумма", en: "Custom" },
  "don.send":      { ru: "Отправить {0}₽", en: "Send {0}₽" },
  "don.sent":      { ru: "{0}₽ отправлено. {1} скажет спасибо!", en: "{0}₽ sent. {1} says thanks!" },

  // Blend
  "bl.title":    { ru: "Blend с {0}", en: "Blend with {0}" },
  "bl.match":    { ru: "совпадение вкуса", en: "taste match" },
  "bl.genres":   { ru: "Общие жанры", en: "Shared genres" },
  "bl.playlist": { ru: "Общий плейлист", en: "Shared playlist" },
  "bl.updates":  { ru: "обновляется каждую пятницу", en: "updates every Friday" },
  "bl.invite":   { ru: "Пригласить ещё друга", en: "Invite another friend" },
  "bl.invited":  { ru: "Ссылка-приглашение скопирована", en: "Invite link copied" },
  "bl.updated":  { ru: "Blend с {0} обновлён", en: "Blend with {0} refreshed" },
  "bl.refresh":  { ru: "Обновить", en: "Refresh" },

  // Плеер
  "pl.track":     { ru: "Трек", en: "Track" },
  "pl.lyrics":    { ru: "Текст", en: "Lyrics" },
  "pl.chat":      { ru: "Чат", en: "Chat" },
  "pl.queue":     { ru: "Далее", en: "Queue" },
  "pl.nowPlays":  { ru: "Сейчас играет", en: "Now playing" },
  "pl.upNext":    { ru: "Дальше в очереди", en: "Up next" },
  "pl.more":      { ru: "Поделиться, скачать, в плейлист — скоро", en: "Share, download, add to playlist — soon" },
  "pl.shuffleOn": { ru: "Перемешивание включено", en: "Shuffle on" },
  "pl.shuffleOff":{ ru: "Перемешивание выключено", en: "Shuffle off" },
  "pl.repeatOn":  { ru: "Повтор трека включён", en: "Repeat on" },
  "pl.repeatOff": { ru: "Повтор выключен", en: "Repeat off" },
  "pl.translate": { ru: "Перевод включён", en: "Original lyrics" },
  "pl.comment":   { ru: "Комментарий на {0}…", en: "Comment at {0}…" },
  "pl.commented": { ru: "Комментарий закреплён на {0}", en: "Comment pinned at {0}" },
  "pl.sleep":     { ru: "Таймер сна", en: "Sleep timer" },
  "pl.sleepOff":  { ru: "Выключен", en: "Off" },
  "pl.sleepSet":  { ru: "Музыка остановится через {0} мин", en: "Music stops in {0} min" },
  "pl.sleepUnset":{ ru: "Таймер сна выключен", en: "Sleep timer off" },
  "pl.sleepDone": { ru: "Таймер сна: музыка остановлена. Спокойной ночи", en: "Sleep timer: music stopped. Good night" },

  // Лайки
  "like.add": { ru: "Добавлено в любимое", en: "Added to Liked" },
  "like.rm":  { ru: "Убрано из любимого", en: "Removed from Liked" },

  // Альбом
  "al.type":     { ru: "Альбом", en: "Album" },
  "al.nTracks":  { ru: "{0} треков", en: "{0} tracks" },
  "al.play":     { ru: "Слушать альбом", en: "Play album" },
  "al.shuffled": { ru: "Альбом перемешан", en: "Album shuffled" },

  // Плейлист (drag-n-drop)
  "pl.dragHint":  { ru: "зажми и перетащи, чтобы изменить порядок", en: "hold & drag to reorder" },
  "pl.reordered": { ru: "Порядок треков обновлён", en: "Track order updated" },

  // Онбординг и вход
  "ob.s1t":     { ru: "Вся музыка — в одном месте", en: "All your music in one place" },
  "ob.s1s":     { ru: "Стриминг, чарты и инди-сцена. Больше не нужно три приложения.", en: "Streaming, charts and the indie scene. No more juggling three apps." },
  "ob.s2t":     { ru: "Артисты получают напрямую", en: "Artists get paid directly" },
  "ob.s2s":     { ru: "Донаты без комиссии и честные алгоритмы для новых имён.", en: "Zero-fee donations and fair algorithms for new names." },
  "ob.s3t":     { ru: "Слушай вместе с друзьями", en: "Listen together" },
  "ob.s3s":     { ru: "Blend-плейлисты, комментарии на волне трека и общие вайбы.", en: "Blend playlists, comments pinned to the waveform, shared vibes." },
  "ob.next":    { ru: "Дальше", en: "Next" },
  "ob.start":   { ru: "Начать", en: "Get started" },
  "ob.skip":    { ru: "Пропустить", en: "Skip" },
  "au.welcome": { ru: "Привет!", en: "Hey there!" },
  "au.sub":     { ru: "Войди или создай аккаунт MYRA", en: "Log in or create a MYRA account" },
  "au.login":   { ru: "Вход", en: "Log in" },
  "au.signup":  { ru: "Регистрация", en: "Sign up" },
  "au.name":    { ru: "Как тебя зовут?", en: "Your name" },
  "au.email":   { ru: "Почта", en: "Email" },
  "au.pass":    { ru: "Пароль", en: "Password" },
  "au.doLogin": { ru: "Войти", en: "Log in" },
  "au.doSignup":{ ru: "Создать аккаунт", en: "Create account" },
  "au.or":      { ru: "или продолжить с", en: "or continue with" },
  "au.errName": { ru: "Введи имя", en: "Enter your name" },
  "au.errEmail":{ ru: "Похоже, почта с опечаткой", en: "That email looks off" },
  "au.errPass": { ru: "Пароль — минимум 6 символов", en: "Password: 6+ characters" },
  "au.social":  { ru: "Входим через {0}…", en: "Signing in with {0}…" },
  "ta.title":   { ru: "Что ты слушаешь?", en: "What do you listen to?" },
  "ta.sub":     { ru: "Выбери минимум 3 жанра — настроим «Мою волну»", en: "Pick at least 3 genres — we'll tune My Wave" },
  "ta.continue":{ ru: "Продолжить", en: "Continue" },
  "ta.picked":  { ru: "Выбрано: {0}", en: "Picked: {0}" },
  "im.title":   { ru: "Перенеси свою музыку", en: "Bring your music over" },
  "im.sub":     { ru: "Плейлисты и лайки переедут из другого сервиса за минуту", en: "Playlists and likes move over from another service in a minute" },
  "im.scan":    { ru: "Ищем твою библиотеку…", en: "Scanning your library…" },
  "im.found":   { ru: "Найдено: 248 треков · 12 плейлистов", en: "Found: 248 tracks · 12 playlists" },
  "im.import":  { ru: "Импортировать всё", en: "Import everything" },
  "im.doing":   { ru: "Переносим…", en: "Importing…" },
  "im.done":    { ru: "Готово! Библиотека уже в MYRA", en: "Done! Your library is in MYRA" },
  "im.later":   { ru: "Позже", en: "Later" },
  "im.go":      { ru: "В приложение", en: "Open the app" },
  "au.welcomeBack": { ru: "С возвращением, {0}!", en: "Welcome back, {0}!" },
  "au.created":     { ru: "Аккаунт создан. Добро пожаловать в MYRA!", en: "Account created. Welcome to MYRA!" },
  "pr.loggedOut":   { ru: "Ты вышел из аккаунта", en: "You've been logged out" },
  "acc.deleted":    { ru: "Аккаунт удалён", en: "Account deleted" },
};

interface LangCtxT {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, ...args: (string | number)[]) => string;
}

const LangCtx = createContext<LangCtxT>({ lang: "ru", setLang: () => {}, t: k => k });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => ls.get<Lang>("lang", "ru"));

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    ls.set("lang", l);
  }, []);

  const t = useCallback((key: string, ...args: (string | number)[]) => {
    let s = STR[key]?.[lang] ?? STR[key]?.ru ?? key;
    args.forEach((a, i) => { s = s.replace(`{${i}}`, String(a)); });
    return s;
  }, [lang]);

  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>;
}

export const useLang = () => useContext(LangCtx);
