
  import { createRoot } from "react-dom/client";
  import { SentryErrorBoundary } from "./app/sentry";
  import { ErrorFallback } from "./app/errorFallback";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  // Каждый деплой переименовывает JS-чанки (хэш в имени файла) — вкладка,
  // открытая ДО деплоя, или браузер с закэшированным старым index.html,
  // пытается догрузить чанк, которого на сервере уже нет (404), и Vite шлёт
  // "vite:preloadError" вместо тихого падения. Без этого обработчика
  // пользователь видит "сайт не работает" после каждого нашего деплоя —
  // одна перезагрузка страницы получает актуальный index.html и чинит всё.
  // sessionStorage-флаг — чтобы не уйти в бесконечный цикл перезагрузок,
  // если сервер и правда недоступен, а не просто отдал новый деплой.
  window.addEventListener("vite:preloadError", () => {
    const key = "myra.reloadedAfterPreloadError";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    window.location.reload();
  });

  // Service worker — только офлайн-подстраховка (см. public/sw.js), только в
  // проде: в dev он мешал бы HMR, а под Electron (file://) регистрация просто
  // тихо падает сама (не secure context) — оборачивать в доп. проверки незачем.
  // Путь относительный — совместим с base:"./" при деплое из под-пути GitHub Pages.
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  createRoot(document.getElementById("root")!).render(
    <SentryErrorBoundary fallback={ErrorFallback}>
      <App />
    </SentryErrorBoundary>,
  );
