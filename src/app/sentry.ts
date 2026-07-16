// ─── Мониторинг ошибок (Sentry) ────────────────────────────────────────────
// SDK грузится в idle-время и только при настроенном DSN. Локальный boundary
// остаётся синхронным, поэтому белого экрана не будет даже до загрузки Sentry.

import React from "react";

const env = (import.meta as any).env ?? {};
const dsn = env.VITE_SENTRY_DSN;

export const sentryEnabled = !!dsn;

let sentryPromise: Promise<typeof import("@sentry/react")> | null = null;
let initialized = false;

const loadSentry = async () => {
  if (!dsn) return null;
  if (!sentryPromise) sentryPromise = import("@sentry/react");
  const Sentry = await sentryPromise;
  if (!initialized) {
    Sentry.init({ dsn, tracesSampleRate: 0, sendDefaultPii: false });
    initialized = true;
  }
  return Sentry;
};

if (dsn && typeof window !== "undefined") {
  const idleWindow = window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number };
  if (idleWindow.requestIdleCallback) idleWindow.requestIdleCallback(() => { void loadSentry(); }, { timeout: 2500 });
  else window.setTimeout(() => { void loadSentry(); }, 1200);
}

type BoundaryProps = { fallback: React.ComponentType; children: React.ReactNode };
type BoundaryState = { failed: boolean };

export class SentryErrorBoundary extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    void loadSentry()
      .then(Sentry => Sentry?.captureException(error, { extra: { componentStack: info.componentStack } }))
      .catch(err => console.warn("Sentry.captureException:", err));
  }

  render() {
    return this.state.failed ? React.createElement(this.props.fallback) : this.props.children;
  }
}
