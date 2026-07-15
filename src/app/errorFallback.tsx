import { GLASS, F, THEMES, type ThemeName } from "./lib";

// ─── Экран после краха рендера ─────────────────────────────────────────────
// Показывается Sentry ErrorBoundary в main.tsx вместо белого экрана — именно
// той ситуации, которую однажды уже пришлось разгадывать вручную (см. фикс
// белого экрана в App.tsx/supabase.ts). Этот компонент обязан пережить крах
// ГДЕ УГОДНО в дереве App, поэтому не полагается на ThemeCtx.Provider App.tsx
// (тот мог не успеть примонтироваться) — сам проставляет CSS-переменные темы
// на своём корне, как это делает themedRoot в App.tsx.
function readTheme(): ThemeName {
  // Тот же формат, что у ls.get("theme", …) в data.ts, но без импорта самого
  // data.ts — он вполне мог быть как раз причиной краха
  try {
    const raw = localStorage.getItem("myra.theme");
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed === "light" || parsed === "neon") return parsed;
  } catch { /* приватный режим или битые данные */ }
  return "dark";
}

export function ErrorFallback() {
  const theme = readTheme();
  return (
    <div
      style={{
        ...(THEMES[theme] as React.CSSProperties),
        position: "fixed",
        inset: 0,
        background: "var(--bg)",
        color: "var(--fg)",
        fontFamily: F.b,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center",
        zIndex: 9999,
      }}
    >
      <div style={{ ...GLASS, borderRadius: 28, padding: "36px 28px", maxWidth: 360, width: "100%" }}>
        <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 21, letterSpacing: "-0.02em", marginBottom: 10 }}>
          Что-то пошло не так
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.5, color: "color-mix(in srgb, var(--fg) 70%, transparent)", marginBottom: 22 }}>
          Приложение столкнулось с ошибкой. Мы уже знаем о ней — попробуйте перезагрузить страницу.
        </div>
        <button
          onClick={() => window.location.reload()}
          className="w-full"
          style={{
            padding: "13px 0",
            borderRadius: 999,
            border: "none",
            fontSize: 14,
            fontWeight: 700,
            fontFamily: F.b,
            background: "linear-gradient(135deg, #f472b6, #f9a8d4)",
            color: "#3f0d24",
            cursor: "pointer",
          }}
        >
          Перезагрузить
        </button>
      </div>
    </div>
  );
}
