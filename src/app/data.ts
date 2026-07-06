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
}

const mk = (id: number, title: string, artist: string, album: string, duration: string, genre: string, plays: string, liked: boolean, c1: string, c2: string): Track => ({
  id, title, artist, album, duration, genre, plays, liked, c1, c2,
  img: svgCover(c1, c2, id),
  url: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${id}.mp3`,
});

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

export const FRIENDS = [
  { name: "Рома", inst: "Ромой",  en: "Roma", track: TRACKS[2], match: 87, img: svgAvatar("Р", "#1a0a08", "#fb923c"), live: true },
  { name: "Лиза", inst: "Лизой",  en: "Liza", track: TRACKS[5], match: 74, img: svgAvatar("Л", "#0f0818", "#f472b6"), live: true },
  { name: "Макс", inst: "Максом", en: "Max",  track: TRACKS[3], match: 63, img: svgAvatar("М", "#071218", "#38bdf8"), live: false },
  { name: "Аня",  inst: "Аней",   en: "Anya", track: TRACKS[7], match: 58, img: svgAvatar("А", "#181200", "#facc15"), live: false },
];
export type Friend = typeof FRIENDS[number];

export const CHARTS = [
  { pos: 1, title: "Espresso",           artist: "Sabrina Carpenter",      delta: +2, img: svgCover("#3a0a12", "#fb7185", 21) },
  { pos: 2, title: "Die With A Smile",   artist: "Lady Gaga & Bruno Mars", delta: +5, img: svgCover("#12083a", "#a78bfa", 22) },
  { pos: 3, title: "Birds of a Feather", artist: "Billie Eilish",          delta: -1, img: svgCover("#07181a", "#4ade80", 23) },
  { pos: 4, title: "Good Luck, Babe!",   artist: "Chappell Roan",          delta: +3, img: svgCover("#181207", "#facc15", 24) },
  { pos: 5, title: "Feather",            artist: "Sabrina Carpenter",      delta:  0, img: svgCover("#071226", "#60a5fa", 25) },
];

export const LYRICS_DATA = [
  { en: ["In", "the", "midnight", "hour,", "when", "silence", "speaks"], ru: "В полночный час, когда тишина говорит" },
  { en: ["I", "hear", "the", "echo", "of", "forgotten", "weeks"], ru: "Я слышу эхо забытых недель" },
  { en: ["Neon", "ghosts", "are", "dancing", "on", "the", "wall"], ru: "Неоновые призраки танцуют на стене" },
  { en: ["Synthesized", "and", "dreaming", "through", "the", "fall"], ru: "Синтезированы и мечтают сквозь падение" },
  { en: ["Glass", "reflections", "carry", "what", "we", "lost"], ru: "Отражения стекла несут то, что мы потеряли" },
  { en: ["Electric", "memories", "at", "any", "cost"], ru: "Электрические воспоминания любой ценой" },
  { en: ["And", "I", "dissolve", "into", "the", "frequency"], ru: "И я растворяюсь в частоте" },
  { en: ["The", "midnight", "echo", "—", "all", "that's", "left", "of", "me"], ru: "Полночное эхо — всё, что осталось от меня" },
];

export const INITIAL_COMMENTS = [
  { pct: 16, user: "@neon_rabbit", text: "этот бит просто космос", likes: 142, avatar: "#8b5cf6" },
  { pct: 34, user: "@dj_marzipan", text: "synth line идеальная",   likes: 89,  avatar: "#34d399" },
  { pct: 58, user: "@luna_fan",    text: "мурашки каждый раз...",  likes: 211, avatar: "#f472b6" },
  { pct: 80, user: "@wavelet",     text: "ДРОП!!",                 likes: 367, avatar: "#fb923c" },
];

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
