// ─── Продуктовая аналитика (типизированная, опциональная) ───────────────────
// По духу optional-backend, как supabase.ts / sentry.ts: пока не подключён
// реальный провайдер, адаптер по умолчанию — no-op (в dev дополнительно
// печатает событие в консоль). Ни одно поле события НЕ содержит PII: типы
// допускают только enum'ы, числовые id, счётчики и флаги — никакого email,
// токенов, паролей, приватных сообщений или произвольного пользовательского
// текста. Компоненты вызывают только track(...), напрямую SDK не трогают.

import { ls } from "./data";

const env = (import.meta as any).env ?? {};
const isDev = !!env.DEV;

// ── Типы событий (Фаза 6 плана релиза) ──────────────────────────────────────
// Свойства каждого события строго ограничены безопасными значениями. Свободный
// пользовательский ввод (поисковый запрос, текст, email) сюда не попадает —
// это гарантируется системой типов и дополнительно проверяется в рантайме.
export type AuthMethod = "email" | "passkey" | "google" | "github" | "spotify" | "discord";
export type PlaySource = "direct" | "toggle" | "queue" | "wave" | "radio" | "auto";
export type ShareKind = "track" | "artist" | "profile" | "playlist";

export type AnalyticsEvent =
  | { name: "app_open" }
  | { name: "onboarding_start" }
  | { name: "onboarding_complete"; role?: "listener" | "artist" }
  | { name: "sign_up"; method: AuthMethod }
  | { name: "login"; method: AuthMethod }
  | { name: "logout" }
  | { name: "password_recovery" }
  | { name: "track_play"; source: PlaySource; trackId?: number }
  | { name: "track_pause" }
  | { name: "track_complete"; trackId?: number }
  | { name: "track_skip"; direction: "next" | "prev" }
  | { name: "playback_error" }
  | { name: "search"; resultCount?: number }
  | { name: "search_result_open" }
  | { name: "like"; trackId?: number }
  | { name: "unlike"; trackId?: number }
  | { name: "playlist_create" }
  | { name: "playlist_add_track" }
  | { name: "playlist_remove_track" }
  | { name: "follow_artist" }
  | { name: "unfollow_artist" }
  | { name: "share"; kind?: ShareKind }
  | { name: "delete_account_start" }
  | { name: "delete_account_complete" };

export type AnalyticsEventName = AnalyticsEvent["name"];

// ── Адаптеры ────────────────────────────────────────────────────────────────
// Единый интерфейс: реальный провайдер (позже) реализует ровно его. track()
// обязан возвращаться мгновенно (fire-and-forget) — любую сеть провайдер
// делает у себя внутри, чтобы не блокировать UI.
export interface AnalyticsAdapter {
  track(event: AnalyticsEvent): void;
}

export const noopAdapter: AnalyticsAdapter = { track() {} };

export const devAdapter: AnalyticsAdapter = {
  track(event) {
    // eslint-disable-next-line no-console
    console.debug("[analytics]", event.name, event);
  },
};

// Мок для тестов: копит события, чтобы по ним можно было делать assert'ы.
export function createMockAdapter(): AnalyticsAdapter & { events: AnalyticsEvent[]; reset(): void } {
  const events: AnalyticsEvent[] = [];
  return {
    events,
    track(event) { events.push(event); },
    reset() { events.length = 0; },
  };
}

// ── Защита от PII (defense-in-depth поверх системы типов) ────────────────────
// Даже если кто-то приведёт объект к any и подсунет запрещённое поле, событие
// не уйдёт в адаптер. Ключи сверяем по подстрокам, а не по точному имени.
const FORBIDDEN_KEY_PARTS = ["email", "password", "pass", "token", "secret", "message", "query", "text", "phone", "address", "content"];

function hasForbiddenField(event: AnalyticsEvent): boolean {
  for (const key of Object.keys(event)) {
    const lower = key.toLowerCase();
    if (FORBIDDEN_KEY_PARTS.some(part => lower.includes(part))) return true;
  }
  return false;
}

// ── Состояние модуля ────────────────────────────────────────────────────────
let adapter: AnalyticsAdapter = isDev ? devAdapter : noopAdapter;

// Учёт будущего пользовательского согласия: по умолчанию согласие не выдано.
// Пока реальный провайдер не подключён, это ни на что не влияет (адаптер no-op),
// но контракт готов: реальному провайдеру track() ничего не отправит без согласия.
let consent = ls.get<boolean>("analyticsConsent", false);
// Пока провайдера нет — включаем поток в текущий адаптер (no-op/dev) без гейта
// согласия, т.к. эти адаптеры никуда не отправляют данные. Реальный провайдер
// выставит requireConsent = true (см. setAnalyticsAdapter).
let requireConsent = false;

/** Подменить адаптер (реальный провайдер в проде или мок в тестах). null → no-op. */
export function setAnalyticsAdapter(next: AnalyticsAdapter | null, opts?: { requireConsent?: boolean }): void {
  adapter = next ?? noopAdapter;
  requireConsent = opts?.requireConsent ?? false;
}

/** Зафиксировать решение пользователя о согласии на аналитику. */
export function setAnalyticsConsent(granted: boolean): void {
  consent = granted;
  ls.set("analyticsConsent", granted);
}

export function hasAnalyticsConsent(): boolean {
  return consent;
}

/**
 * Отправить продуктовое событие. Никогда не бросает и не блокирует вызывающий
 * обработчик: ошибка адаптера проглатывается, событие с запрещённым полем
 * отбрасывается. Это единственная точка входа для всего приложения.
 */
export function track(event: AnalyticsEvent): void {
  if (requireConsent && !consent) return;
  if (hasForbiddenField(event)) {
    if (isDev) console.warn("[analytics] событие отброшено: запрещённое поле", event.name);
    return;
  }
  try {
    adapter.track(event);
  } catch (err) {
    if (isDev) console.warn("[analytics] ошибка адаптера", err);
  }
}
