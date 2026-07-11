// ─── Данные MYRA (демо) ───────────────────────────────────────────────────────

// ─── Генеративные обложки (SVG data-URI, работают офлайн) ────────────────────

const rnd = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 16807 + 11) % 2147483647;
    return (s % 10000) / 10000;
  };
};

/** Абстрактная обложка: градиент + светящиеся круги + волна */
export const svgCover = (c1: string, c2: string, seed: number) => {
  const r = rnd(seed * 7 + 3);
  const circles = Array.from({ length: 4 }, (_, i) => {
    const cx = Math.round(60 + r() * 380);
    const cy = Math.round(60 + r() * 380);
    const rad = Math.round(50 + r() * 150);
    const o = (0.10 + r() * 0.22).toFixed(2);
    return `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="url(#o${i % 2})" opacity="${o}"/>`;
  }).join("");
  const wavePts = Array.from({ length: 11 }, (_, i) => `${i * 50},${Math.round(330 + Math.sin(i * 1.3 + seed) * 40)}`).join(" L");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">` +
    `<defs>` +
    `<radialGradient id="bg" cx="0.3" cy="0.22" r="1.1"><stop offset="0" stop-color="${c2}"/><stop offset="0.55" stop-color="${c1}"/><stop offset="1" stop-color="#07070f"/></radialGradient>` +
    `<radialGradient id="o0" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="o1" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${c2}"/><stop offset="1" stop-color="${c2}" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c2}" stop-opacity="0.55"/><stop offset="1" stop-color="${c2}" stop-opacity="0"/></linearGradient>` +
    `</defs>` +
    `<rect width="500" height="500" fill="url(#bg)"/>` +
    circles +
    `<path d="M0,340 L${wavePts} L500,500 L0,500 Z" fill="url(#w)"/>` +
    `<rect width="500" height="500" fill="#000000" opacity="0.08"/>` +
    `</svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
};

/** Аватар: инициал на градиенте */
export const svgAvatar = (initial: string, c1: string, c2: string) => {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c2}"/><stop offset="1" stop-color="${c1}"/></linearGradient></defs>` +
    `<rect width="160" height="160" fill="url(#g)"/>` +
    `<circle cx="48" cy="38" r="60" fill="#ffffff" opacity="0.14"/>` +
    `<text x="80" y="80" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-size="64" font-weight="700" fill="#ffffff">${initial}</text>` +
    `</svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
};

// ─── Треки ────────────────────────────────────────────────────────────────────

export interface Track {
  id: number;
  title: string;
  artist: string;
  album: string;
  duration: string;
  genre: string;
  plays: string;
  liked: boolean;
  c1: string;
  c2: string;
  img: string;
  url: string;
  local?: boolean;
  lyrics?: string;
  // uuid строки public.tracks — проставляется асинхронно после фоновой
  // публикации в Supabase (см. publishRelease в App.tsx). Пока его нет
  // (Supabase выключен, ещё не синхронизировалось или это демо-трек каталога) —
  // трек не «настоящий» с точки зрения комментариев, и они идут в localStorage
  remoteId?: string;
}

const mk = (id: number, title: string, artist: string, album: string, duration: string, genre: string, plays: string, liked: boolean, c1: string, c2: string): Track => ({
  id, title, artist, album, duration, genre, plays, liked, c1, c2,
  img: svgCover(c1, c2, id),
  url: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${id}.mp3`,
});

export const LOCAL_PALETTE: [string, string][] = [
  ["#12083a", "#8b5cf6"], ["#071a10", "#34d399"], ["#1a0a08", "#fb923c"],
  ["#0f0818", "#f472b6"], ["#071218", "#38bdf8"], ["#181200", "#facc15"],
];

// Стабильный (не крипто) хэш uuid → положительное число: реальным трекам из
// Supabase (community-лента, профиль настоящего артиста) нужен числовой
// Track.id для React key / подсветки "сейчас играет", а их единственный
// стабильный идентификатор — строковый uuid. Коллизии теоретически возможны,
// но не критичны — id тут не хранится и не используется как ключ БД.
const hashToId = (uuid: string): number => {
  let h = 0;
  for (let i = 0; i < uuid.length; i++) h = (h * 31 + uuid.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
};

// Превращает строку public.tracks (Supabase) в Track для существующего
// плеера/очереди — используется в ленте «Релизы сообщества» и в профиле
// настоящего артиста, там, где треки принадлежат ДРУГИМ пользователям.
export function trackFromRow(row: { id: string; title: string; genre: string; lyrics: string | null; cover_url: string | null; audio_url: string }, artistName: string): Track {
  const id = hashToId(row.id);
  const [c1, c2] = LOCAL_PALETTE[id % LOCAL_PALETTE.length];
  return {
    id, title: row.title, artist: artistName, album: "Community", duration: "",
    genre: row.genre, plays: "", liked: false, c1, c2,
    img: row.cover_url || svgCover(c1, c2, id),
    // local НЕ ставим: этот флаг также означает "это мой трек" для счётчика
    // logMyTrackPlay в App.tsx — трек чужого артиста не должен попадать в
    // собственную статистику прослушиваний пользователя
    url: row.audio_url, lyrics: row.lyrics ?? undefined, remoteId: row.id,
  };
}

export const TRACKS: Track[] = [
  mk(1, "Midnight Echo",   "Luna Wave",   "Synthwave Sessions", "6:12", "Synthwave",  "2.1M", true,  "#12083a", "#8b5cf6"),
  mk(2, "Glass City",      "KRVT",        "Urban Frequencies",  "7:04", "Electronic", "890K", false, "#071a10", "#34d399"),
  mk(3, "Neon Drift",      "Solstice",    "Phase II",           "5:20", "Lo-fi",      "4.5M", true,  "#1a0a08", "#fb923c"),
  mk(4, "Ivory Keys",      "Mara Dell",   "Piano Diaries",      "5:47", "Ambient",    "1.3M", false, "#071218", "#38bdf8"),
  mk(5, "Dissolve",        "Yara Voss",   "Dissolution EP",     "5:59", "Dream Pop",  "670K", true,  "#181200", "#facc15"),
  mk(6, "Carbon Skies",    "Axel Rune",   "Dark Matter",        "6:26", "Indie",      "3.2M", false, "#0f0818", "#f472b6"),
  mk(7, "Hollow Ground",   "Echo & Glow", "Resonance",          "6:52", "Indie",      "12K",  false, "#071018", "#22d3ee"),
  mk(8, "Saltwater Dream", "Nadia Sol",   "Sol EP",             "6:03", "Pop",        "8.4K", false, "#180f07", "#fdba74"),
];

export interface Artist {
  name: string;
  listeners: string;
  genre: string;
  verified: boolean;
  img: string;
  c2: string;
  similar: string[];
}

export const ARTISTS: Artist[] = [
  { name: "Luna Wave",   listeners: "1.2M", genre: "Synthwave",  verified: true,  img: TRACKS[0].img, c2: TRACKS[0].c2, similar: ["Solstice", "KRVT"] },
  { name: "KRVT",        listeners: "640K", genre: "Electronic", verified: true,  img: TRACKS[1].img, c2: TRACKS[1].c2, similar: ["Luna Wave", "Axel Rune"] },
  { name: "Solstice",    listeners: "2.8M", genre: "Lo-fi",      verified: true,  img: TRACKS[2].img, c2: TRACKS[2].c2, similar: ["Mara Dell", "Luna Wave"] },
  { name: "Mara Dell",   listeners: "890K", genre: "Ambient",    verified: false, img: TRACKS[3].img, c2: TRACKS[3].c2, similar: ["Solstice", "Yara Voss"] },
  { name: "Yara Voss",   listeners: "410K", genre: "Dream Pop",  verified: false, img: TRACKS[4].img, c2: TRACKS[4].c2, similar: ["Nadia Sol", "Mara Dell"] },
  { name: "Axel Rune",   listeners: "1.9M", genre: "Indie",      verified: true,  img: TRACKS[5].img, c2: TRACKS[5].c2, similar: ["Echo & Glow", "KRVT"] },
  { name: "Echo & Glow", listeners: "8K",   genre: "Indie",      verified: false, img: TRACKS[6].img, c2: TRACKS[6].c2, similar: ["Axel Rune", "Nadia Sol"] },
  { name: "Nadia Sol",   listeners: "5K",   genre: "Pop",        verified: false, img: TRACKS[7].img, c2: TRACKS[7].c2, similar: ["Yara Voss", "Echo & Glow"] },
];

export const artistByName = (name: string) => ARTISTS.find(a => a.name === name);
export const tracksOf = (name: string) => {
  const own = TRACKS.filter(t => t.artist === name);
  const genre = own[0]?.genre;
  const similar = TRACKS.filter(t => t.artist !== name && t.genre === genre);
  return { own, similar };
};

// Друзья — по-настоящему пустой список у свежего аккаунта (нет бэкенда для
// добавления живых людей); тип задан явно, чтобы форма осталась прежней.
export interface Friend { name: string; inst: string; en: string; track: Track; match: number; img: string; live: boolean }
export const FRIENDS: Friend[] = [];

// Соперники в общем рейтинге — тоже по-настоящему пусто: без бэкенда нет
// других реальных пользователей. Тип задан явно для PeerProfileSheet/RatingScreen.
export interface Peer { name: string; en: string; avatar: string; level: number; minutesWeek: number; streak: number; c2: string; topGenre: string }
export const LEADERBOARD_PEERS: Peer[] = [];

export const CHARTS = [
  { pos: 1, title: "Espresso",           artist: "Sabrina Carpenter",      delta: +2, img: svgCover("#3a0a12", "#fb7185", 21) },
  { pos: 2, title: "Die With A Smile",   artist: "Lady Gaga & Bruno Mars", delta: +5, img: svgCover("#12083a", "#a78bfa", 22) },
  { pos: 3, title: "Birds of a Feather", artist: "Billie Eilish",          delta: -1, img: svgCover("#07181a", "#4ade80", 23) },
  { pos: 4, title: "Good Luck, Babe!",   artist: "Chappell Roan",          delta: +3, img: svgCover("#181207", "#facc15", 24) },
  { pos: 5, title: "Feather",            artist: "Sabrina Carpenter",      delta:  0, img: svgCover("#071226", "#60a5fa", 25) },
];

// У каждого трека каталога — свой текст со своим переводом
const L = (s: string, ru: string) => ({ en: s.split(" "), ru });
export const LYRICS: Record<number, { en: string[]; ru: string }[]> = {
  1: [
    L("In the midnight hour, when silence speaks", "В полночный час, когда тишина говорит"),
    L("I hear the echo of forgotten weeks", "Я слышу эхо забытых недель"),
    L("Neon ghosts are dancing on the wall", "Неоновые призраки танцуют на стене"),
    L("Synthesized and dreaming through the fall", "Синтезированы и мечтают сквозь падение"),
    L("And I dissolve into the frequency", "И я растворяюсь в частоте"),
    L("The midnight echo — all that's left of me", "Полночное эхо — всё, что осталось от меня"),
  ],
  2: [
    L("Glass city breathing under sodium light", "Стеклянный город дышит под натриевым светом"),
    L("A million windows and not one of them mine", "Миллион окон — и ни одно не моё"),
    L("I ride the bassline through the underpass", "Я еду по басовой линии сквозь подземку"),
    L("The future's loud and it's arriving fast", "Будущее громкое — и оно приходит быстро"),
    L("Concrete gardens where the signals grow", "Бетонные сады, где растут сигналы"),
    L("Glass city, take me where the rivers glow", "Стеклянный город, отведи меня к светящимся рекам"),
  ],
  3: [
    L("Neon drifting down an empty street", "Неон плывёт по пустой улице"),
    L("Coffee's cold but the loop stays sweet", "Кофе остыл, но луп всё так же сладок"),
    L("Rain on vinyl, static in my head", "Дождь по винилу, статика в голове"),
    L("Half asleep on words I never said", "В полусне от слов, что я не сказал"),
    L("Slow horizon, tape machine rewinds", "Медленный горизонт, плёнка мотает назад"),
    L("Neon drift — I leave the world behind", "Неоновый дрейф — я оставляю мир позади"),
  ],
  4: [
    L("Ivory keys under winter hands", "Клавиши слоновой кости под зимними руками"),
    L("Every chord a country, every rest a land", "Каждый аккорд — страна, каждая пауза — земля"),
    L("The room is dark, the pedal holds the light", "В комнате темно, педаль держит свет"),
    L("Melodies like snowfall through the night", "Мелодии как снегопад сквозь ночь"),
    L("If you listen close, the quiet sings", "Прислушайся — и тишина поёт"),
    L("Ivory keys remember everything", "Клавиши помнят всё"),
  ],
  5: [
    L("I dissolve like sugar in the rain", "Я растворяюсь, как сахар под дождём"),
    L("Every colour running down the pane", "Все цвета стекают по стеклу"),
    L("Dreaming in a language with no name", "Мечтаю на языке без имени"),
    L("You and I were never quite the same", "Мы с тобой никогда не были одинаковыми"),
    L("Hold me till the edges disappear", "Держи меня, пока края не исчезнут"),
    L("Dissolution sounds a lot like here", "Растворение звучит совсем как «здесь»"),
  ],
  6: [
    L("Carbon skies above the terminal", "Углеродные небеса над терминалом"),
    L("Waiting for a sign that's personal", "Жду знака, который только для меня"),
    L("Jet trails stitching wounds across the grey", "Инверсионные следы зашивают серость"),
    L("Everyone I love is far away", "Все, кого я люблю, далеко"),
    L("But dark matter holds us just the same", "Но тёмная материя всё равно держит нас"),
    L("Carbon skies still whisper out my name", "Углеродные небеса всё шепчут моё имя"),
  ],
  7: [
    L("Hollow ground beneath the old pine floor", "Пустота под старым сосновым полом"),
    L("Echoes live where we don't live anymore", "Эхо живёт там, где нас больше нет"),
    L("I sing into the hollow, hear it grow", "Я пою в пустоту и слышу, как она растёт"),
    L("Resonance of everything we know", "Резонанс всего, что мы знаем"),
    L("If the ground is empty, let it ring", "Если земля пуста — пусть звенит"),
    L("Hollow ground can hold most anything", "Пустая земля может вместить почти всё"),
  ],
  8: [
    L("Saltwater dream, I'm floating out again", "Солёный сон — я снова уплываю"),
    L("The tide rewrites the letters that I penned", "Прилив переписывает мои письма"),
    L("Sunlight breaking soft across the bay", "Солнце мягко ломается о залив"),
    L("Every wave a word I couldn't say", "Каждая волна — слово, что я не смог сказать"),
    L("Keep me in the shallows of your mind", "Оставь меня на отмели своей памяти"),
    L("Saltwater dreams are easiest to find", "Солёные сны легче всего найти"),
  ],
};

export interface Comment { pct: number; user: string; text: string; likes: number; avatar: string }

/** Затравочные комментарии — свои для каждого трека, а не один и тот же набор на все */
export const SEED_COMMENTS: Record<number, Comment[]> = {
  1: [
    { pct: 12, user: "@neon_rabbit",  text: "этот бит просто космос",              likes: 142, avatar: "#8b5cf6" },
    { pct: 41, user: "@luna_fan",     text: "«растворяюсь в частоте» — мурашки",   likes: 211, avatar: "#f472b6" },
    { pct: 74, user: "@dj_marzipan",  text: "synth line на этом дропе идеальная",  likes: 89,  avatar: "#34d399" },
  ],
  2: [
    { pct: 18, user: "@urban_ghost",  text: "бас на «underpass» просто ломает",    likes: 96,  avatar: "#34d399" },
    { pct: 47, user: "@night_driver", text: "миллион окон и ни одно не моё — это про меня", likes: 133, avatar: "#22d3ee" },
    { pct: 82, user: "@krvt_stan",    text: "KRVT никогда не разочаровывает",      likes: 58,  avatar: "#fb923c" },
  ],
  3: [
    { pct: 15, user: "@rainy_tapes",  text: "дождь по винилу — прямо ощущается",   likes: 174, avatar: "#fb923c" },
    { pct: 39, user: "@lofi_diary",   text: "под это идеально засыпать",           likes: 245, avatar: "#c4b5fd" },
    { pct: 63, user: "@solstice_fan", text: "плёнка мотает назад в самый кайф",    likes: 71,  avatar: "#38bdf8" },
  ],
  4: [
    { pct: 22, user: "@piano_soul",   text: "клавиши слоновой кости звучат как снег",  likes: 118, avatar: "#38bdf8" },
    { pct: 55, user: "@quiet_hours",  text: "пауза держит больше, чем ноты",       likes: 90,  avatar: "#818cf8" },
    { pct: 88, user: "@mara_dell_fan",text: "включаю каждый вечер перед сном",     likes: 203, avatar: "#f472b6" },
  ],
  5: [
    { pct: 20, user: "@dreampop_kid", text: "«сахар под дождём» — лучшая строчка", likes: 156, avatar: "#facc15" },
    { pct: 50, user: "@yara_voss_fan",text: "голос просто тает в динамиках",       likes: 199, avatar: "#f472b6" },
    { pct: 79, user: "@colorwave",    text: "слушаю на повторе третий день",       likes: 64,  avatar: "#fb7185" },
  ],
  6: [
    { pct: 17, user: "@skywatcher",   text: "джет-трейлы в тексте — прямо вижу картинку", likes: 87, avatar: "#f472b6" },
    { pct: 46, user: "@darkmatter_",  text: "тёмная материя держит и правда крепко", likes: 121, avatar: "#a78bfa" },
    { pct: 71, user: "@axel_rune_hq", text: "лучший трек с Dark Matter, точка",     likes: 175, avatar: "#22d3ee" },
  ],
  7: [
    { pct: 25, user: "@resonance__",  text: "эхо там, где нас больше нет — жестко", likes: 61,  avatar: "#22d3ee" },
    { pct: 60, user: "@indie_ears",   text: "недооценённый трек, все спят",        likes: 143, avatar: "#4ade80" },
  ],
  8: [
    { pct: 14, user: "@bay_sunset",   text: "солнце на этой обложке прямо как в тексте", likes: 55,  avatar: "#fdba74" },
    { pct: 48, user: "@saltwater__",  text: "каждая волна — слово, что я не смог сказать... больно", likes: 98, avatar: "#fb7185" },
  ],
};

export function loadMyComments(): Record<number, Comment[]> {
  return ls.get<Record<number, Comment[]>>("myComments", {});
}

export function addMyComment(trackId: number, c: Comment): Record<number, Comment[]> {
  const all = loadMyComments();
  const next = { ...all, [trackId]: [...(all[trackId] ?? []), c] };
  ls.set("myComments", next);
  return next;
}

export function commentsFor(trackId: number, mine: Record<number, Comment[]>): Comment[] {
  return [...(SEED_COMMENTS[trackId] ?? []), ...(mine[trackId] ?? [])].sort((a, b) => a.pct - b.pct);
}

export const AVATARS = [
  svgAvatar("A", "#12083a", "#8b5cf6"),
  svgAvatar("A", "#071a10", "#34d399"),
  svgAvatar("A", "#1a0a08", "#fb923c"),
  svgAvatar("A", "#0f0818", "#f472b6"),
];

export const TASTE_GENRES = [
  ["Synthwave", "#8b5cf6"], ["Lo-fi", "#34d399"], ["Hip-Hop", "#fb923c"], ["Ambient", "#38bdf8"],
  ["Indie", "#f472b6"], ["Pop", "#fdba74"], ["Rock", "#f87171"], ["Electronic", "#22d3ee"],
  ["Jazz", "#facc15"], ["Classical", "#c4b5fd"], ["Techno", "#4ade80"], ["R&B", "#fb7185"],
] as const;

export interface Playlist {
  id: string;
  name: string;
  img: string;
  trackIds: number[];
}

export const PLAYLISTS: Playlist[] = [
  { id: "focus", name: "Deep Focus",    img: svgCover("#071218", "#38bdf8", 31), trackIds: [4, 3, 1, 7, 5] },
  { id: "blend", name: "Blend",         img: svgCover("#12083a", "#f472b6", 32), trackIds: [3, 1, 6, 2, 5, 8] },
  { id: "chill", name: "Chill Evening", img: svgCover("#071018", "#22d3ee", 33), trackIds: [5, 4, 8, 3] },
  { id: "wave",  name: "Morning Wave",  img: svgCover("#181200", "#facc15", 34), trackIds: [1, 2, 6, 3, 4] },
];

export const PODCASTS = [
  { name: "The Future of Sound",   ep: "Эп. 42 · 1:12:34", p: 68, img: svgCover("#0a1a2a", "#60a5fa", 41) },
  { name: "Indie Creator Stories", ep: "Эп. 19 · 48:21",   p: 30, img: svgCover("#1a0a1a", "#e879f9", 42) },
];

export const GENRE_TILES = [
  ["Synthwave", "#8b5cf6"], ["Lo-fi", "#34d399"], ["Hip-Hop", "#fb923c"], ["Ambient", "#38bdf8"],
] as const;

export const albumTracks = (album: string) => TRACKS.filter(t => t.album === album);
export const albums = () => [...new Set(TRACKS.map(t => t.album))];

// localStorage с защитой от ошибок
export const ls = {
  get<T>(key: string, def: T): T {
    try {
      const raw = localStorage.getItem("myra." + key);
      return raw === null ? def : JSON.parse(raw);
    } catch { return def; }
  },
  set(key: string, val: unknown) {
    try { localStorage.setItem("myra." + key, JSON.stringify(val)); } catch { /* приватный режим */ }
  },
  clear() {
    try {
      Object.keys(localStorage).filter(k => k.startsWith("myra.")).forEach(k => localStorage.removeItem(k));
    } catch { /* приватный режим */ }
  },
};
