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
  const ang = Math.round(r() * 360);
  // Мягкие аврора-пятна на радиальных градиентах (без SVG-фильтров — надёжно
  // рендерятся в Android WebView, в отличие от feGaussianBlur), плюс глубокий
  // диагональный градиент, глянцевый блик сверху и виньетка. Вариативность —
  // по seed трека, поэтому обложки отличаются друг от друга.
  const palette = [c2, c1, "#ffffff", c2];
  const blobDefs: string[] = [];
  const blobEls: string[] = [];
  for (let i = 0; i < 4; i++) {
    const col = palette[i];
    const cx = (8 + r() * 84).toFixed(1);
    const cy = (8 + r() * 84).toFixed(1);
    const rad = (32 + r() * 34).toFixed(1);
    const op = 0.6 - i * 0.09;
    blobDefs.push(
      `<radialGradient id="b${i}" cx="${cx}%" cy="${cy}%" r="${rad}%">` +
        `<stop offset="0" stop-color="${col}" stop-opacity="${op.toFixed(2)}"/>` +
        `<stop offset="0.5" stop-color="${col}" stop-opacity="${(op * 0.4).toFixed(2)}"/>` +
        `<stop offset="1" stop-color="${col}" stop-opacity="0"/>` +
      `</radialGradient>`,
    );
    blobEls.push(`<rect width="500" height="500" fill="url(#b${i})"/>`);
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">` +
    `<defs>` +
    `<linearGradient id="bg" gradientTransform="rotate(${ang} 0.5 0.5)"><stop offset="0" stop-color="${c1}"/><stop offset="0.6" stop-color="#140a24"/><stop offset="1" stop-color="#08060f"/></linearGradient>` +
    blobDefs.join("") +
    `<linearGradient id="sheen" x1="0" y1="0" x2="0.55" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.42"/><stop offset="0.42" stop-color="#ffffff" stop-opacity="0"/></linearGradient>` +
    `<radialGradient id="vig" cx="0.5" cy="0.42" r="0.75"><stop offset="0.55" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.5"/></radialGradient>` +
    `</defs>` +
    `<rect width="500" height="500" fill="url(#bg)"/>` +
    blobEls.join("") +
    `<path d="M-30,150 C130,70 300,190 530,90 L530,-30 L-30,-30 Z" fill="url(#sheen)"/>` +
    `<rect width="500" height="500" fill="url(#vig)"/>` +
    `</svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
};

// «Характер» артиста для образа: причёска/головной убор, аксессуар, наушники.
export interface ArtistLook {
  hair: "buzz" | "afro" | "curls" | "long" | "cap" | "beanie" | "bun" | "hood";
  acc?: "glasses" | "shades" | "visor" | "chain";
  phones?: boolean;   // наушники (чашки на ушах)
  band?: boolean;     // дужка наушников над головой (только когда макушка свободна)
  side?: -1 | 1;      // сторона света
  tone?: string;      // подтон «кожи» силуэта (тёмный) — чтобы артисты были разные
  beard?: boolean;    // щетина/борода
}

/**
 * Стилизованный образ артиста для демо-каталога: силуэт с индивидуальным
 * характером (причёска/убор + аксессуар + опц. наушники) под «прожектором»
 * его цвета. Это заведомо ИЛЛЮСТРАЦИЯ (не фото реального человека) —
 * демо-каталог вымышленный. Нужен, чтобы на профиле артиста и в списках было
 * видно узнаваемый образ, а не пустой градиент. data-URI, офлайн, без
 * SVG-фильтров (надёжно рендерится в Android WebView).
 */
export const svgArtistPortrait = (c1: string, c2: string, seed: number, look: ArtistLook) => {
  const r = rnd(seed * 13 + 5);
  const side = look.side ?? (r() < 0.5 ? -1 : 1);
  const tilt = (r() * 7 - 3.5).toFixed(1);
  const glowX = (50 + side * 15).toFixed(0);
  const hx = 250, hy = 210, hr = 84;
  const FIG = "url(#fig)";

  // Причёски/уборы, которые рисуются ЗА головой (объём, обрамление лица)
  const back: Record<string, string> = {
    buzz: "",
    afro: `<circle cx="${hx}" cy="${hy - 16}" r="${hr + 28}" fill="${FIG}"/>`,
    curls: `<g fill="${FIG}"><circle cx="${hx}" cy="${hy - 66}" r="44"/><circle cx="${hx - 54}" cy="${hy - 42}" r="40"/><circle cx="${hx + 54}" cy="${hy - 42}" r="40"/><circle cx="${hx - 82}" cy="${hy}" r="32"/><circle cx="${hx + 82}" cy="${hy}" r="32"/><circle cx="${hx - 28}" cy="${hy - 76}" r="32"/><circle cx="${hx + 28}" cy="${hy - 76}" r="32"/></g>`,
    long: `<path d="M156,190 C106,206 120,370 176,404 L222,404 C200,320 200,234 214,190 Z" fill="${FIG}"/><path d="M344,190 C394,206 380,370 324,404 L278,404 C300,320 300,234 286,190 Z" fill="${FIG}"/><path d="M166,186 Q250,114 334,186 Q250,162 166,186 Z" fill="${FIG}"/><path d="M156,190 C106,206 120,370 176,404" stroke="${c2}" stroke-width="4" fill="none" opacity="0.5" stroke-linecap="round"/><path d="M344,190 C394,206 380,370 324,404" stroke="${c2}" stroke-width="4" fill="none" opacity="0.5" stroke-linecap="round"/>`,
    hood: "",
    cap: "",
    beanie: "",
    bun: "",
  };
  // Уборы, которые рисуются ПЕРЕД головой (сидят сверху)
  const front: Record<string, string> = {
    buzz: "", afro: "", curls: "", long: "", hood: "",
    cap: `<path d="M172,196 Q250,116 328,196 Q250,178 172,196 Z" fill="${FIG}"/><rect x="170" y="188" width="160" height="20" rx="10" fill="${c2}"/><path d="M250,200 Q${hx + side * 128},188 ${hx + side * 150},207 Q${hx + side * 120},215 250,208 Z" fill="${c2}"/>`,
    beanie: `<path d="M164,206 Q250,118 336,206 Z" fill="${c2}"/><rect x="160" y="196" width="180" height="24" rx="12" fill="${c2}"/><circle cx="${hx}" cy="122" r="13" fill="${c2}"/>`,
    bun: `<circle cx="${hx}" cy="118" r="28" fill="${FIG}"/>`,
  };
  // Аксессуары на лице/шее (после головы)
  const accEls: Record<string, string> = {
    glasses: `<g fill="none" stroke="#ece7ff" stroke-width="6" stroke-opacity="0.92"><rect x="192" y="180" width="44" height="36" rx="13"/><rect x="264" y="180" width="44" height="36" rx="13"/><path d="M236,198 L264,198"/></g>`,
    shades: `<g><rect x="190" y="178" width="48" height="38" rx="14" fill="#080610" stroke="${c2}" stroke-width="4"/><rect x="262" y="178" width="48" height="38" rx="14" fill="#080610" stroke="${c2}" stroke-width="4"/><path d="M238,190 L262,190" stroke="${c2}" stroke-width="5"/></g>`,
    visor: `<rect x="188" y="184" width="124" height="24" rx="12" fill="${c2}" opacity="0.92"/><rect x="196" y="188" width="58" height="6" rx="3" fill="#ffffff" opacity="0.5"/>`,
    chain: `<path d="M198,350 Q250,398 302,350" fill="none" stroke="${c2}" stroke-width="7" stroke-linecap="round"/><circle cx="${hx}" cy="392" r="8" fill="${c2}"/>`,
  };

  // Наушники: объёмные чашки, плотно сидящие на ушах (край головы), с мягкой
  // амбушюрой и бликом; дужка соединяет ВЕРХ чашек над макушкой (не через лицо).
  const cupW = 34, cupH = 56, cupTop = hy - 28;
  const cup = (x: number) =>
    `<rect x="${x}" y="${cupTop}" width="${cupW}" height="${cupH}" rx="15" fill="${c2}"/>` +
    `<rect x="${x + 5}" y="${cupTop + 6}" width="${cupW - 10}" height="${cupH - 12}" rx="10" fill="#0a0712" opacity="0.5"/>` +
    `<rect x="${x + 4}" y="${cupTop + 3}" width="${cupW - 8}" height="7" rx="3.5" fill="#ffffff" opacity="0.3"/>`;
  const phones = look.phones
    ? (look.band ? `<path d="M${hx - hr + 12},${cupTop + 3} Q${hx},${hy - hr - 12} ${hx + hr - 12},${cupTop + 3}" stroke="${c2}" stroke-width="13" fill="none" stroke-linecap="round"/>` : "")
      + cup(hx - hr - 4) + cup(hx + hr - 30)
    : "";

  const tone = look.tone ?? "#241a30";                    // подтон «кожи» силуэта
  const rimR = look.hair === "afro" ? hr + 30 : look.hair === "curls" ? hr + 36 : look.hair === "long" ? hr + 10 : hr + 6;
  const rimY = look.hair === "afro" || look.hair === "curls" ? hy - 16 : hy; // центр рим-света с учётом объёма причёски

  // Освещённый край для рим-света (флаг направления дуги/плеча зависит от side)
  const litHead = `M${hx},${hy - hr} A${hr},${hr} 0 0 ${side > 0 ? 1 : 0} ${hx},${hy + hr}`;
  const litShoulder = side > 0 ? `M250,322 C356,322 438,372 438,500` : `M250,322 C144,322 62,372 62,500`;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">` +
    `<defs>` +
      `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="0.55" stop-color="#0c0716"/><stop offset="1" stop-color="#05040a"/></linearGradient>` +
      `<radialGradient id="glow" cx="${glowX}%" cy="36%" r="58%"><stop offset="0" stop-color="${c2}" stop-opacity="0.9"/><stop offset="0.45" stop-color="${c2}" stop-opacity="0.28"/><stop offset="1" stop-color="${c2}" stop-opacity="0"/></radialGradient>` +
      `<linearGradient id="fig" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tone}"/><stop offset="0.55" stop-color="#0b0714"/><stop offset="1" stop-color="#050409"/></linearGradient>` +
      `<linearGradient id="grm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="#070510"/></linearGradient>` +
      `<radialGradient id="halo" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${c2}" stop-opacity="0.5"/><stop offset="0.6" stop-color="${c2}" stop-opacity="0.14"/><stop offset="1" stop-color="${c2}" stop-opacity="0"/></radialGradient>` +
      `<radialGradient id="vig" cx="0.5" cy="0.42" r="0.78"><stop offset="0.55" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.55"/></radialGradient>` +
    `</defs>` +
    `<rect width="500" height="500" fill="url(#bg)"/>` +
    `<rect width="500" height="500" fill="url(#glow)"/>` +
    `<g transform="rotate(${tilt} ${hx} ${hy + 60})">` +
      // Мягкое свечение за фигурой
      `<circle cx="${hx + side * 8}" cy="${rimY}" r="${rimR + 26}" fill="url(#halo)"/>` +
      // Плоский силуэт: плечи (выше и шире), короткая широкая шея, причёска-сзади, голова
      `<path d="M62,500 C62,368 146,322 ${hx},322 C354,322 438,368 438,500 Z" fill="${FIG}"/>` +
      (look.hair === "hood" ? `<path d="M112,500 C102,296 148,200 ${hx},186 C352,200 398,296 388,500 Z" fill="url(#grm)"/>` : "") +
      `<rect x="${hx - 42}" y="248" width="84" height="92" rx="26" fill="${FIG}"/>` +
      back[look.hair] +
      `<circle cx="${hx}" cy="${hy}" r="${hr}" fill="${FIG}"/>` +
      // Рим-свет по освещённому краю головы и плеча (чистый постер-стиль, без псевдо-3D на лице)
      `<path d="${litHead}" stroke="${c2}" stroke-width="4" fill="none" opacity="0.72" stroke-linecap="round"/>` +
      front[look.hair] +
      (look.acc ? accEls[look.acc] : "") +
      phones +
      `<path d="${litShoulder}" stroke="${c2}" stroke-width="3.5" fill="none" opacity="0.4"/>` +
    `</g>` +
    `<rect width="500" height="500" fill="url(#vig)"/>` +
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

// Стабильные названия жанров для данных и рекомендаций. До русификации
// каталога вкусы и память спутника сохранялись по-английски; без миграции
// старые значения больше не совпадали с track.genre и персонализация
// обнулялась после обновления.
const GENRE_ALIASES: Record<string, string> = {
  synthwave: "Синтвейв",
  "синтвейв": "Синтвейв",
  electronic: "Электроника",
  electronica: "Электроника",
  "электроника": "Электроника",
  "lo-fi": "Лоу-фай",
  lofi: "Лоу-фай",
  "lo fi": "Лоу-фай",
  "лоу-фай": "Лоу-фай",
  ambient: "Эмбиент",
  "эмбиент": "Эмбиент",
  "dream pop": "Дрим-поп",
  "dream-pop": "Дрим-поп",
  "дрим-поп": "Дрим-поп",
  indie: "Инди",
  "инди": "Инди",
  pop: "Поп",
  "поп": "Поп",
  rock: "Рок",
  "рок": "Рок",
  "hip-hop": "Хип-хоп",
  "hip hop": "Хип-хоп",
  "хип-хоп": "Хип-хоп",
  jazz: "Джаз",
  "джаз": "Джаз",
  classical: "Классика",
  classicals: "Классика",
  "классика": "Классика",
  techno: "Техно",
  "техно": "Техно",
  house: "Хаус",
  "хаус": "Хаус",
  "r&b": "R&B",
  rnb: "R&B",
};

export function normalizeGenre(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return GENRE_ALIASES[trimmed.toLocaleLowerCase()] ?? trimmed;
}

export function normalizeGenres(values: string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const genre = normalizeGenre(value);
    const key = genre.toLocaleLowerCase();
    if (!genre || seen.has(key)) continue;
    seen.add(key);
    normalized.push(genre);
  }
  return normalized;
}

export interface LyricsLine {
  en: string[];
  ru: string;
}

/** Превращает вставленный автором текст в строки плеера, сохраняя переносы. */
export function parseLyrics(text?: string): LyricsLine[] | null {
  const normalized = text?.trim();
  if (!normalized) return null;
  const lines = normalized
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => ({ en: line.split(/\s+/), ru: "" }));
  return lines.length ? lines : null;
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
  mk(1, "Midnight Echo",   "Luna Wave",   "Synthwave Sessions", "6:12", "Синтвейв",  "2.1M", true,  "#12083a", "#8b5cf6"),
  mk(2, "Glass City",      "KRVT",        "Urban Frequencies",  "7:04", "Электроника", "890K", false, "#071a10", "#34d399"),
  mk(3, "Neon Drift",      "Solstice",    "Phase II",           "5:20", "Лоу-фай",      "4.5M", true,  "#1a0a08", "#fb923c"),
  mk(4, "Ivory Keys",      "Mara Dell",   "Piano Diaries",      "5:47", "Эмбиент",    "1.3M", false, "#071218", "#38bdf8"),
  mk(5, "Dissolve",        "Yara Voss",   "Dissolution EP",     "5:59", "Дрим-поп",  "670K", true,  "#181200", "#facc15"),
  mk(6, "Carbon Skies",    "Axel Rune",   "Dark Matter",        "6:26", "Инди",      "3.2M", false, "#0f0818", "#f472b6"),
  mk(7, "Hollow Ground",   "Echo & Glow", "Resonance",          "6:52", "Инди",      "12K",  false, "#071018", "#22d3ee"),
  mk(8, "Saltwater Dream", "Nadia Sol",   "Sol EP",             "6:03", "Поп",        "8.4K", false, "#180f07", "#fdba74"),
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

// img — стилизованный образ артиста со СВОИМ характером (причёска/убор +
// аксессуар + опц. наушники), не абстрактная обложка: на профиле и в списках
// артист должен быть узнаваем и не похож на других. Палитра — из его
// фирменного трека.
export const ARTISTS: Artist[] = [
  { name: "Luna Wave",   listeners: "1.2M", genre: "Синтвейв",  verified: true,  img: svgArtistPortrait(TRACKS[0].c1, TRACKS[0].c2, 71,  { hair: "long",   side: 1,  tone: "#2b1f3a" }),               c2: TRACKS[0].c2, similar: ["Solstice", "KRVT"] },
  { name: "KRVT",        listeners: "640K", genre: "Электроника", verified: true,  img: svgArtistPortrait(TRACKS[1].c1, TRACKS[1].c2, 82,  { hair: "buzz",   phones: true, band: true, side: -1, tone: "#26241f" }), c2: TRACKS[1].c2, similar: ["Luna Wave", "Axel Rune"] },
  { name: "Solstice",    listeners: "2.8M", genre: "Лоу-фай",      verified: true,  img: svgArtistPortrait(TRACKS[2].c1, TRACKS[2].c2, 93,  { hair: "beanie", phones: true, side: 1,  tone: "#33261c" }),  c2: TRACKS[2].c2, similar: ["Mara Dell", "Luna Wave"] },
  { name: "Mara Dell",   listeners: "890K", genre: "Эмбиент",    verified: false, img: svgArtistPortrait(TRACKS[3].c1, TRACKS[3].c2, 104, { hair: "bun",    side: -1, tone: "#1f2436" }),               c2: TRACKS[3].c2, similar: ["Solstice", "Yara Voss"] },
  { name: "Yara Voss",   listeners: "410K", genre: "Дрим-поп",  verified: false, img: svgArtistPortrait(TRACKS[4].c1, TRACKS[4].c2, 115, { hair: "curls",  side: 1,  tone: "#301f2c" }),               c2: TRACKS[4].c2, similar: ["Nadia Sol", "Mara Dell"] },
  { name: "Axel Rune",   listeners: "1.9M", genre: "Инди",      verified: true,  img: svgArtistPortrait(TRACKS[5].c1, TRACKS[5].c2, 126, { hair: "cap",    phones: true, side: -1, tone: "#2c2130" }),  c2: TRACKS[5].c2, similar: ["Echo & Glow", "KRVT"] },
  { name: "Echo & Glow", listeners: "8K",   genre: "Инди",      verified: false, img: svgArtistPortrait(TRACKS[6].c1, TRACKS[6].c2, 137, { hair: "hood",   side: 1,  tone: "#1b2733" }),               c2: TRACKS[6].c2, similar: ["Axel Rune", "Nadia Sol"] },
  { name: "Nadia Sol",   listeners: "5K",   genre: "Поп",        verified: false, img: svgArtistPortrait(TRACKS[7].c1, TRACKS[7].c2, 148, { hair: "afro",   acc: "chain", side: -1, tone: "#33221f" }), c2: TRACKS[7].c2, similar: ["Yara Voss", "Echo & Glow"] },
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

// Чарт — из вымышленных артистов демо-каталога: под именами реальных звёзд
// играло бы чужое демо-аудио, а это прямой обман
export const CHARTS = [
  { pos: 1, title: "Neon Drift",      artist: "Solstice",    delta: +2, img: svgCover("#1a0a08", "#fb923c", 21) },
  { pos: 2, title: "Midnight Echo",   artist: "Luna Wave",   delta: +5, img: svgCover("#12083a", "#a78bfa", 22) },
  { pos: 3, title: "Carbon Skies",    artist: "Axel Rune",   delta: -1, img: svgCover("#0f0818", "#f472b6", 23) },
  { pos: 4, title: "Ivory Keys",      artist: "Mara Dell",   delta: +3, img: svgCover("#071218", "#38bdf8", 24) },
  { pos: 5, title: "Glass City",      artist: "KRVT",        delta:  0, img: svgCover("#071a10", "#34d399", 25) },
];

// У каждого трека каталога — свой текст со своим переводом
const L = (s: string, ru: string) => ({ en: s.split(" "), ru });
export const LYRICS: Record<number, LyricsLine[]> = {
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

// id — только у комментариев из public.comments (реальный трек, синхронизированный
// с Supabase): нужен, чтобы дать пожаловаться на конкретный комментарий (см.
// submitReport/ReportSheet). У затравочных и локальных комментариев id нет и
// быть не может — они не строки в базе, жаловаться там физически не на что.
export interface Comment { id?: string; pct: number; user: string; text: string; likes: number; avatar: string }

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
  ["Синтвейв", "#8b5cf6"], ["Лоу-фай", "#34d399"], ["Хип-хоп", "#fb923c"], ["Эмбиент", "#38bdf8"],
  ["Инди", "#f472b6"], ["Поп", "#fdba74"], ["Рок", "#f87171"], ["Электроника", "#22d3ee"],
  ["Джаз", "#facc15"], ["Классика", "#c4b5fd"], ["Техно", "#4ade80"], ["R&B", "#fb7185"],
] as const;

// Причины жалобы (Студия → публичный трек, чат плеера → комментарий). code —
// то, что реально пишется в reports.reason (стабильная строка, не зависящая
// от языка интерфейса), labelKey — i18n-ключ для отображения в UI (пикер
// в ReportSheet и очередь модерации в dev.tsx делят один и тот же список).
export const REPORT_REASONS = [
  { code: "copyright", labelKey: "report.reasonCopyright" },
  { code: "abusive",   labelKey: "report.reasonAbusive" },
  { code: "spam",      labelKey: "report.reasonSpam" },
  { code: "other",     labelKey: "report.reasonOther" },
] as const;

export interface Playlist {
  id: string;
  name: string;
  img: string;
  trackIds: number[];
}

export const PLAYLISTS: Playlist[] = [
  { id: "focus", name: "Deep Focus",    img: svgCover("#071218", "#38bdf8", 31), trackIds: [4, 3, 1, 7, 5] },
  { id: "blend", name: "Созвук",        img: svgCover("#12083a", "#f472b6", 32), trackIds: [3, 1, 6, 2, 5, 8] },
  { id: "chill", name: "Chill Evening", img: svgCover("#071018", "#22d3ee", 33), trackIds: [5, 4, 8, 3] },
  { id: "wave",  name: "Morning Wave",  img: svgCover("#181200", "#facc15", 34), trackIds: [1, 2, 6, 3, 4] },
];

export const PODCASTS = [
  { name: "The Future of Sound",   ep: "Эп. 42 · 1:12:34", p: 68, img: svgCover("#0a1a2a", "#60a5fa", 41) },
  { name: "Indie Creator Stories", ep: "Эп. 19 · 48:21",   p: 30, img: svgCover("#1a0a1a", "#e879f9", 42) },
];

export const GENRE_TILES = [
  ["Синтвейв", "#8b5cf6"], ["Лоу-фай", "#34d399"], ["Хип-хоп", "#fb923c"], ["Эмбиент", "#38bdf8"],
  ["Электроника", "#c084fc"], ["Дрим-поп", "#f472b6"], ["Инди", "#f59e0b"], ["R&B", "#e879f9"],
  ["Рок", "#ef6b61"], ["Джаз", "#f4b76a"], ["Классика", "#93c5fd"], ["Хаус", "#22d3ee"],
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
      // Storage — не обычный объект: в новых браузерах/Node его ключи не
      // обязаны попадать в Object.keys(). Идём через стандартные length/key.
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith("myra.")) localStorage.removeItem(key);
      }
    } catch { /* приватный режим */ }
  },
};
