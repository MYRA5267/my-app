// ─── Клиент Supabase ──────────────────────────────────────────────────────
// Единственный файл, импортирующий "@supabase/supabase-js" — весь остальной
// код приложения дергает только функции-хелперы отсюда.
// Пока проект не подключён (нет env-переменных), приложение должно работать
// ровно как раньше: каждый хелпер сам проверяет supabaseEnabled и тихо
// возвращает безопасный no-op, чтобы не городить проверки на каждом вызове.

import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";

const env = (import.meta as any).env ?? {};
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;

// createClient() кидает синхронно на невалидный URL (например опечатка в
// секрете CI) — без try/catch это падение случалось бы на этапе загрузки
// модуля, ДО монтирования React, и давало бы белый экран без единой строки
// UI. Офлайн-режим должен быть безопасным фолбэком и для битой конфигурации,
// не только для отсутствующей
let client: SupabaseClient | null = null;
try {
  if (url && anonKey) client = createClient(url, anonKey);
} catch (err) {
  console.warn("Supabase createClient:", err);
  client = null;
}

export const supabaseEnabled = client !== null;
export const supabase: SupabaseClient | null = client;

export type UserRole = "artist" | "listener";

export async function signUpWithEmail(email: string, password: string, username: string, role?: UserRole) {
  if (!supabaseEnabled || !supabase) return { data: null, error: null };
  return supabase.auth.signUp({ email, password, options: { data: { username, role } } });
}

export async function signInWithEmail(email: string, password: string) {
  if (!supabaseEnabled || !supabase) return { data: null, error: null };
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOutRemote() {
  if (!supabaseEnabled || !supabase) return { error: null };
  return supabase.auth.signOut();
}

// Повторная отправка письма с подтверждением — на случай, если письмо
// потерялось или пользователь просто не заметил его сразу
export async function resendConfirmation(email: string) {
  if (!supabaseEnabled || !supabase) return { data: null, error: null };
  return supabase.auth.resend({ type: "signup", email });
}

export async function getSession(): Promise<Session | null> {
  if (!supabaseEnabled || !supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthStateChange(callback: (session: Session | null) => void) {
  if (!supabaseEnabled || !supabase) return { data: { subscription: { unsubscribe() {} } } };
  return supabase.auth.onAuthStateChange((_event: string, session: Session | null) => callback(session));
}

export interface ProfileFields {
  username: string;
  email: string;
  avatar_url: string;
  role: UserRole;
  handle: string;
}

// Почта — PII, в схеме она сознательно вынесена из publicly-readable profiles
// в отдельную profile_private (иначе email каждого пользователя утёк бы всем
// через "profiles_select_public"). Здесь это скрыто за тем же интерфейсом —
// вызывающий код (auth.tsx, App.tsx) как писал/читал единый объект профиля
// с полем email, так и продолжает, не зная о разделении на две таблицы.
export async function upsertProfile(id: string, fields: Partial<ProfileFields>) {
  if (!supabaseEnabled || !supabase) return { data: null, error: null };
  const { email, ...profileFields } = fields;
  const [profileRes, emailRes] = await Promise.all([
    Object.keys(profileFields).length
      ? supabase.from("profiles").upsert({ id, ...profileFields }).select().single()
      : Promise.resolve({ data: null, error: null }),
    email !== undefined
      ? supabase.from("profile_private").upsert({ user_id: id, email }).select().single()
      : Promise.resolve({ data: null, error: null }),
  ]);
  return { data: profileRes.data, error: profileRes.error ?? emailRes.error };
}

export async function fetchProfile(id: string) {
  if (!supabaseEnabled || !supabase) return { data: null, error: null };
  const [profileRes, emailRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).single(),
    supabase.from("profile_private").select("email").eq("user_id", id).single(),
  ]);
  if (profileRes.error) return { data: null, error: profileRes.error };
  return { data: { ...profileRes.data, email: emailRes.data?.email ?? null }, error: null };
}

// Реальный ИИ-ответ в чате поддержки — идёт через Edge Function support-chat,
// которая держит ключ OpenRouter на сервере (см. supabase/functions/support-chat)
export async function askSupportAI(messages: { role: "user" | "assistant"; content: string }[]) {
  if (!supabaseEnabled || !supabase) return { data: null, error: new Error("supabase not configured") };
  return supabase.functions.invoke<{ reply: string }>("support-chat", { body: { messages } });
}

// Донат — обычная запись в таблицу, RLS уже разрешает insert от своего имени
// (donations_insert_own), никакой edge function тут не нужно. toUserId — для
// доната настоящему артисту (профиль с реальным аккаунтом); для демо-артистов
// каталога его просто нет, to_artist остаётся единственной привязкой получателя
export async function recordDonation(userId: string, toArtist: string, amount: number, toUserId?: string) {
  if (!supabaseEnabled || !supabase) return { error: null };
  const { error } = await supabase.from("donations").insert({ from_user: userId, to_artist: toArtist, amount, to_user_id: toUserId ?? null });
  return { error };
}

export type SubStatus = "none" | "active" | "grace";

// Статус подписки читаем напрямую (RLS разрешает select своей строки), но
// СТАВИМ его только через Edge Function set-subscription — RLS сознательно
// запрещает клиенту самому проставлять 'active' (см. schema.sql)
export async function fetchSubscriptionStatus(userId: string): Promise<SubStatus | null> {
  if (!supabaseEnabled || !supabase) return null;
  const { data, error } = await supabase.from("subscriptions").select("status").eq("user_id", userId).single();
  if (error || !data) return null;
  return data.status as SubStatus;
}

export async function setSubscriptionStatus(status: SubStatus) {
  if (!supabaseEnabled || !supabase) return { error: null };
  return supabase.functions.invoke<{ ok: boolean }>("set-subscription", { body: { status } });
}

// Реальный платёж через ЮKassa — идёт через Edge Function create-payment,
// которая держит YOOKASSA_SHOP_ID/YOOKASSA_SECRET_KEY на сервере (см.
// supabase/functions/create-payment). Пока их там нет (мерчант-аккаунт ещё не
// оформлен), функция отвечает 503 payments_not_configured — вызывающий код
// (DonateWidget/CreatorPlusSheet/ListenerPlusSheet в overlays.tsx) трактует
// ЛЮБУЮ ошибку отсюда (включая supabaseEnabled === false) как "откатись на
// прежний симулированный флоу", а не как повод падать.
export async function createPayment(
  kind: "donation" | "subscription",
  amount: number,
  opts: { toArtist?: string; toUserId?: string; planId?: string } = {},
) {
  if (!supabaseEnabled || !supabase) return { data: null, error: new Error("supabase not configured") };
  return supabase.functions.invoke<{ confirmation_url: string; payment_id: string }>("create-payment", { body: { kind, amount, ...opts } });
}

// Реальное удаление аккаунта (auth.users + всё, что на него ссылается, через
// on delete cascade) — идёт через Edge Function delete-account, потому что
// удалить самого себя из auth.users клиент не может ни при каком RLS
export async function deleteAccountRemote() {
  if (!supabaseEnabled || !supabase) return { error: null };
  const { error } = await supabase.functions.invoke<{ ok: boolean }>("delete-account", { body: {} });
  return { error };
}

// ─── Поддержка: тред пользователя + инбокс для админов ───────────────────────
// (два создателя MYRA, строки в admins проставляются вручную ими самими через
// Supabase Dashboard — см. schema.sql)

export type SupportRole = "user" | "support" | "ai";

export interface SupportMessageRow {
  id: string;
  user_id: string;
  from_role: SupportRole;
  text: string;
  created_at: string;
  read_at: string | null;
}

// "Я админ?" — читаем свою же строку в admins (RLS разрешает select только
// auth.uid() = user_id), поэтому у обычного пользователя тут всегда пусто,
// без ошибки доступа
export async function isAdmin(uid: string): Promise<boolean> {
  if (!supabaseEnabled || !supabase) return false;
  const { data, error } = await supabase.from("admins").select("user_id").eq("user_id", uid).maybeSingle();
  return !error && !!data;
}

// Вся переписка одного треда — для самого пользователя это его собственный
// тред, для админа это может быть любой чужой тред (обе ситуации разрешает
// RLS: support_messages_select_own или support_messages_select_admin)
export async function fetchSupportThread(userId: string) {
  if (!supabaseEnabled || !supabase) return { data: [] as SupportMessageRow[], error: null };
  const { data, error } = await supabase
    .from("support_messages")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  return { data: (data as SupportMessageRow[] | null) ?? [], error };
}

// userId — это ID ТРЕДА (не автора конкретной строки): пользователь пишет в
// свой же тред (userId = свой uid), админ отвечает в чужом (userId = uid
// человека, чей это тикет, а from_role='support' — id самого админа нигде
// отдельно не хранится, это не нужно продукту сейчас)
export async function sendSupportMessage(userId: string, fromRole: SupportRole, text: string) {
  if (!supabaseEnabled || !supabase) return { data: null, error: null };
  return supabase.from("support_messages").insert({ user_id: userId, from_role: fromRole, text }).select().single();
}

export interface SupportThreadPreview {
  userId: string;
  username: string | null;
  lastText: string;
  lastFromRole: SupportRole;
  lastAt: string;
  unreadCount: number;
}

// Инбокс для админов: один select всех сообщений (RLS сама отдаёт все строки,
// если запрос идёт от админа) + группировка по треду на клиенте — переписки
// поддержки мало, отдельная RPC/view ради этого объёма избыточна
export async function fetchAllSupportThreads(): Promise<SupportThreadPreview[]> {
  if (!supabaseEnabled || !supabase) return [];
  const { data, error } = await supabase.from("support_messages").select("*").order("created_at", { ascending: true });
  if (error || !data) return [];

  const rows = data as SupportMessageRow[];
  const byUser = new Map<string, SupportMessageRow[]>();
  for (const row of rows) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }

  const userIds = [...byUser.keys()];
  // Имя треда для инбокса — просто для удобства чтения (профили публично
  // читаемы, см. profiles_select_public), само по себе не влияет на доступ
  const { data: profilesData } = userIds.length
    ? await supabase.from("profiles").select("id, username").in("id", userIds)
    : { data: [] as { id: string; username: string }[] };
  const usernames = new Map((profilesData ?? []).map(p => [p.id, p.username]));

  const threads: SupportThreadPreview[] = userIds.map(userId => {
    const userRows = byUser.get(userId)!;
    const last = userRows[userRows.length - 1];
    const unreadCount = userRows.filter(r => r.from_role === "user" && !r.read_at).length;
    return {
      userId,
      username: usernames.get(userId) ?? null,
      lastText: last.text,
      lastFromRole: last.from_role,
      lastAt: last.created_at,
      unreadCount,
    };
  });
  threads.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
  return threads;
}

// Помечаем сообщения пользователя прочитанными — вызывается, когда админ
// открывает тред в инбоксе
export async function markSupportThreadRead(userId: string) {
  if (!supabaseEnabled || !supabase) return { error: null };
  const { error } = await supabase
    .from("support_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("from_role", "user")
    .is("read_at", null);
  return { error };
}

// ─── Треки: реальный релиз, опубликованный через Студию ────────────────────

export interface TrackInput {
  title: string;
  genre: string;
  lyrics: string | null;
  cover_url: string | null;
  audio_url: string;
}

export interface TrackRow extends TrackInput {
  id: string;
  owner_id: string;
  created_at: string;
}

// Аудио — в Storage, а не в text-колонке tracks.audio_url (иначе бинарник
// раздул бы таблицу): путь "{uid}/{trackId}.{ext}" даёт RLS-политикам бакета
// "tracks" (см. schema.sql) проверить владельца по первому сегменту пути.
// trackId здесь — локальный числовой id трека с фронтенда, а не будущий
// tracks.id (его ещё не существует на момент аплоада), но для уникальности
// пути этого достаточно.
export async function uploadTrackAudio(uid: string, trackId: string, file: Blob, ext: string) {
  if (!supabaseEnabled || !supabase) return { url: null as string | null, error: null };
  const path = `${uid}/${trackId}.${ext}`;
  const { error } = await supabase.storage.from("tracks").upload(path, file, {
    contentType: file.type || undefined,
    upsert: true,
  });
  if (error) return { url: null as string | null, error };
  const { data } = supabase.storage.from("tracks").getPublicUrl(path);
  return { url: data.publicUrl as string | null, error: null };
}

export async function insertTrack(ownerId: string, fields: TrackInput) {
  if (!supabaseEnabled || !supabase) return { data: null as TrackRow | null, error: null };
  const { data, error } = await supabase.from("tracks").insert({ owner_id: ownerId, ...fields }).select().single();
  return { data: data as TrackRow | null, error };
}

// Лента «Релизы сообщества» на главной — последние реально опубликованные
// треки ДРУГИХ пользователей. excludeOwnerId — чтобы не показывать в общей
// ленте свои же треки, они и так видны в Студии/Медиатеке.
export interface CommunityTrackRow extends TrackRow {
  profiles: { username: string; handle: string | null } | null;
}

export async function fetchRecentTracks(excludeOwnerId?: string, limit = 12) {
  if (!supabaseEnabled || !supabase) return { data: [] as CommunityTrackRow[], error: null };
  let query = supabase
    .from("tracks")
    .select("id, owner_id, title, genre, lyrics, cover_url, audio_url, created_at, profiles(username, handle)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (excludeOwnerId) query = query.neq("owner_id", excludeOwnerId);
  const { data, error } = await query;
  return { data: (data as unknown as CommunityTrackRow[] | null) ?? [], error };
}

export interface ArtistProfileData {
  id: string;
  username: string;
  handle: string | null;
  avatar_url: string | null;
  tracks: TrackRow[];
}

// Профиль настоящего артиста для RealArtistSheet — публичные поля profiles
// (profiles_select_public) + все его опубликованные треки
export async function fetchArtistProfile(userId: string) {
  if (!supabaseEnabled || !supabase) return { data: null as ArtistProfileData | null, error: null };
  const [profileRes, tracksRes] = await Promise.all([
    supabase.from("profiles").select("id, username, handle, avatar_url").eq("id", userId).single(),
    supabase.from("tracks").select("id, owner_id, title, genre, lyrics, cover_url, audio_url, created_at").eq("owner_id", userId).order("created_at", { ascending: false }),
  ]);
  if (profileRes.error || !profileRes.data) return { data: null, error: profileRes.error };
  return {
    data: { ...profileRes.data, tracks: (tracksRes.data as TrackRow[] | null) ?? [] } as ArtistProfileData,
    error: tracksRes.error,
  };
}

// Сколько реально задонатили этому артисту — сумма считается на клиенте,
// строк донатов на одного артиста не настолько много, чтобы это было
// проблемой, а отдельная Postgres-функция ради одного sum() избыточна
export async function fetchReceivedDonationsTotal(userId: string): Promise<number> {
  if (!supabaseEnabled || !supabase) return 0;
  const { data, error } = await supabase.from("donations").select("amount").eq("to_user_id", userId);
  if (error || !data) return 0;
  return data.reduce((sum, row) => sum + Number(row.amount), 0);
}

// ─── Комментарии на волне трека ─────────────────────────────────────────────
// Только для по-настоящему опубликованных треков (track_id = uuid из tracks).
// Демо-треки каталога (числовые id 1-8) в эту таблицу не пишутся — см. границу
// в шапке schema.sql — для них комментарии остаются в localStorage (data.ts).

export interface CommentRow {
  id: string;
  track_id: string;
  user_id: string;
  pct: number;
  text: string;
  created_at: string;
  // Подтягивается через embed по FK comments.user_id -> profiles.id — профиль
  // публично читаем (profiles_select_public), лишнего запроса на клиенте не нужно
  profiles: { handle: string | null; username: string } | null;
}

export async function fetchComments(trackId: string) {
  if (!supabaseEnabled || !supabase) return { data: [] as CommentRow[], error: null };
  const { data, error } = await supabase
    .from("comments")
    .select("id, track_id, user_id, pct, text, created_at, profiles(handle, username)")
    .eq("track_id", trackId)
    .order("pct", { ascending: true });
  return { data: (data as unknown as CommentRow[] | null) ?? [], error };
}

export async function postComment(userId: string, trackId: string, pct: number, text: string) {
  if (!supabaseEnabled || !supabase) return { error: null };
  const { error } = await supabase.from("comments").insert({ user_id: userId, track_id: trackId, pct, text });
  return { error };
}

// ─── Соцслой: реальные подписки между аккаунтами ────────────────────────────
// Отдельно от локального (localStorage) toggleFollow в App.tsx, который
// работает только с 8 фиксированными демо-артистами каталога (ARTISTS в
// data.ts), и отдельно от таблицы follows в schema.sql (та тоже про демо-
// каталог — follows.artist_name это текст с именем артиста, не uuid реального
// аккаунта). Здесь — настоящие подписки человек-на-человека, единственный
// первый кирпичик социального слоя (см. таблицу user_follows в schema.sql).

export interface PublicProfile {
  id: string;
  username: string;
  handle: string | null;
  avatar_url: string | null;
  role: UserRole;
}

// Список id тех, на кого подписан пользователь — источник правды для кнопки
// "подписаться/отписаться" на любом профиле и для ленты друзей ниже
export async function fetchFollowingIds(userId: string): Promise<string[]> {
  if (!supabaseEnabled || !supabase) return [];
  const { data, error } = await supabase.from("user_follows").select("followee_id").eq("follower_id", userId);
  if (error || !data) return [];
  return data.map(row => row.followee_id as string);
}

export async function followUser(followerId: string, followeeId: string) {
  if (!supabaseEnabled || !supabase) return { error: null };
  const { error } = await supabase.from("user_follows").insert({ follower_id: followerId, followee_id: followeeId });
  return { error };
}

export async function unfollowUser(followerId: string, followeeId: string) {
  if (!supabaseEnabled || !supabase) return { error: null };
  const { error } = await supabase
    .from("user_follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("followee_id", followeeId);
  return { error };
}

// Поиск реальных людей по username — пока единственный способ вообще найти
// реальный профиль, на который можно подписаться (нет ни инвайт-ссылок на
// конкретный аккаунт, ни QR)
export async function searchProfiles(query: string): Promise<PublicProfile[]> {
  const q = query.trim();
  if (!supabaseEnabled || !supabase || !q) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, handle, avatar_url, role")
    .ilike("username", `%${q}%`)
    .limit(20);
  if (error || !data) return [];
  return data as PublicProfile[];
}

export interface FriendFeedItem extends TrackRow {
  // Подтягивается через embed по FK tracks.owner_id -> profiles.id — профиль
  // публично читаем (profiles_select_public), лишнего запроса на клиенте не нужно
  owner: { username: string; handle: string | null; avatar_url: string | null; role: UserRole } | null;
}

// Лента друзей: недавние реальные релизы людей, на которых подписан
// пользователь — единственный вид активности, который реально можно достать
// из базы в этом MVP, без выдуманных типов событий сверх того, что произошло
export async function fetchFriendsFeed(followingIds: string[], limit = 30): Promise<FriendFeedItem[]> {
  if (!supabaseEnabled || !supabase || !followingIds.length) return [];
  const { data, error } = await supabase
    .from("tracks")
    .select("id, owner_id, title, genre, lyrics, cover_url, audio_url, created_at, profiles(username, handle, avatar_url, role)")
    .in("owner_id", followingIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as unknown as (TrackRow & { profiles: FriendFeedItem["owner"] })[]).map(row => {
    const { profiles, ...track } = row;
    return { ...track, owner: profiles };
  });
}

// ─── Модерация: жалобы на треки/комментарии + скрытие трека ────────────────
// MVP-модерация (см. schema.sql, секции 12-13): раньше не было вообще
// никакого способа пожаловаться на контент или снять трек с публикации,
// кроме как автору удалить себя самому. reporter_id/admins проверяются RLS,
// клиенту здесь достаточно вызвать insert/select/update — база сама решит,
// что разрешено.

export type ReportTargetType = "track" | "comment";
export type ReportStatus = "open" | "resolved" | "dismissed";

export interface ReportRow {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  created_at: string;
  resolved_at: string | null;
}

// targetId — та же конвенция, что и у comments.track_id (см. fetchComments
// выше): либо настоящий uuid (tracks.id/comments.id), либо "catalog:N" для
// демо-контента статичного каталога, у которого нет строки в базе
export async function submitReport(reporterId: string, targetType: ReportTargetType, targetId: string, reason: string, details?: string) {
  if (!supabaseEnabled || !supabase) return { error: null };
  const { error } = await supabase
    .from("reports")
    .insert({ reporter_id: reporterId, target_type: targetType, target_id: targetId, reason, details: details?.trim() || null });
  return { error };
}

export interface OpenReportRow extends ReportRow {
  // Заполняется только для жалоб на реальный (не catalog:N) трек — чтобы
  // админ увидел название, а не голый uuid. Для комментариев отдельного
  // лукапа нет (MVP): reason/details обычно уже достаточно для решения.
  trackTitle: string | null;
  trackAudioUrl: string | null;
  reporterName: string | null;
}

// Инбокс модерации: один select всех открытых жалоб (RLS сама отдаёт все
// строки, если запрос идёт от админа) + два IN-запроса для подписи (имя
// репортера, название/ссылка трека) — тот же приём, что и в
// fetchAllSupportThreads, объём жалоб слишком мал для отдельной view/RPC
export async function fetchOpenReports(): Promise<OpenReportRow[]> {
  if (!supabaseEnabled || !supabase) return [];
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  const rows = data as ReportRow[];

  const trackIds = [...new Set(rows.filter(r => r.target_type === "track" && !r.target_id.startsWith("catalog:")).map(r => r.target_id))];
  const reporterIds = [...new Set(rows.map(r => r.reporter_id))];

  const [{ data: tracksData }, { data: profilesData }] = await Promise.all([
    trackIds.length
      ? supabase.from("tracks").select("id, title, audio_url").in("id", trackIds)
      : Promise.resolve({ data: [] as { id: string; title: string; audio_url: string }[] }),
    reporterIds.length
      ? supabase.from("profiles").select("id, username").in("id", reporterIds)
      : Promise.resolve({ data: [] as { id: string; username: string }[] }),
  ]);

  const tracks = new Map((tracksData ?? []).map(tr => [tr.id, tr]));
  const reporterNames = new Map((profilesData ?? []).map(p => [p.id, p.username]));

  return rows.map(r => ({
    ...r,
    trackTitle: tracks.get(r.target_id)?.title ?? null,
    trackAudioUrl: tracks.get(r.target_id)?.audio_url ?? null,
    reporterName: reporterNames.get(r.reporter_id) ?? null,
  }));
}

export async function resolveReport(reportId: string, status: "resolved" | "dismissed") {
  if (!supabaseEnabled || !supabase) return { error: null };
  const { error } = await supabase
    .from("reports")
    .update({ status, resolved_at: new Date().toISOString() })
    .eq("id", reportId);
  return { error };
}

// Админ-действие: скрыть/вернуть трек. trackId — обязательно настоящий uuid
// tracks.id (демо-каталог в базе не существует и скрыть его нельзя — это
// вообще не строка). RLS (tracks_update_admin, schema.sql) — единственная
// реальная защита: без неё запрос просто не обновит ни одной строки.
export async function hideTrack(trackId: string, hidden: boolean) {
  if (!supabaseEnabled || !supabase) return { error: null };
  const { error } = await supabase.from("tracks").update({ hidden }).eq("id", trackId);
  return { error };
}
