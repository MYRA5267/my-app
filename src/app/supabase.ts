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

export const supabaseEnabled = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = supabaseEnabled ? createClient(url, anonKey) : null;

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
// (donations_insert_own), никакой edge function тут не нужно
export async function recordDonation(userId: string, toArtist: string, amount: number) {
  if (!supabaseEnabled || !supabase) return { error: null };
  const { error } = await supabase.from("donations").insert({ from_user: userId, to_artist: toArtist, amount });
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
