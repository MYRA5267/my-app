// ─── Мониторинг ошибок (Sentry) ────────────────────────────────────────────
// Единственный файл, импортирующий "@sentry/react" — тот же принцип, что и
// у supabase.ts с "@supabase/supabase-js": весь остальной код не должен
// знать, настроен Sentry или нет. Без VITE_SENTRY_DSN приложение обязано
// работать ровно как раньше — ни одного сетевого запроса к Sentry, ни одной
// новой зависимости в рантайме.

import * as Sentry from "@sentry/react";

const env = (import.meta as any).env ?? {};
const dsn = env.VITE_SENTRY_DSN;

// init() на пустом DSN сама по себе ничего не делает, но оборачиваем в
// try/catch по той же причине, что и createClient() в supabase.ts: белый
// экран от синхронного краха на этапе загрузки модуля (ДО монтирования
// React) уже случался один раз, и это не должно повториться из-за нового
// модуля мониторинга
try {
  if (dsn) {
    Sentry.init({
      dsn,
      // Трейсинг производительности, source maps и релизы — отдельная задача
      // на будущее, здесь только базовый перехват ошибок
      tracesSampleRate: 0,
      sendDefaultPii: false,
    });
  }
} catch (err) {
  console.warn("Sentry.init:", err);
}

export const sentryEnabled = !!dsn;

// ErrorBoundary оборачивает корень приложения в main.tsx ВСЕГДА, вне
// зависимости от того, задан DSN или нет: без клиента Sentry.captureException
// внутри неё просто ничего никуда не шлёт, но сама поимка краха рендера и
// показ фолбэка вместо белого экрана не должны зависеть от конфигурации
export const SentryErrorBoundary = Sentry.ErrorBoundary;
