import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    // Мобильный viewport по умолчанию — это основная платформа MYRA
    // (Android/iOS через Capacitor, нижняя нав-панель рассчитана на телефон).
    // devices["iPhone 14"] в этой версии @playwright/test тянет за собой
    // defaultBrowserType: "webkit" (эмулирует Mobile Safari) — переопределяем
    // обратно на chromium: это и есть реально установленный браузер в
    // песочнице/CI, а Android-обёртка MYRA (Capacitor WebView) в проде тоже
    // на Chromium, так что chromium даже точнее отражает основную платформу,
    // чем WebKit.
    { name: "chromium", use: { ...devices["iPhone 14"], defaultBrowserType: "chromium" } },
    // Релизный smoke-набор дополнительно запускается в Firefox и WebKit через
    // `pnpm test:e2e:cross-browser`. Узкий viewport сохраняет мобильную
    // навигацию, но движки и рендеринг остаются настоящими.
    { name: "firefox-mobile", use: { browserName: "firefox", viewport: { width: 390, height: 844 } } },
    { name: "webkit-mobile", use: { ...devices["iPhone 14"], defaultBrowserType: "webkit" } },
  ],
  webServer: {
    // В CI dist/ уже собран отдельным шагом `pnpm build` в ci.yml до
    // `pnpm test:e2e` — повторный полный Vite-build здесь был бы чистой
    // тратой времени на каждый прогон. Локально build оставляем: dist/
    // на машине разработчика может быть протухшим или отсутствовать.
    command: process.env.CI
      ? "pnpm preview --port 4173"
      : "pnpm build && pnpm preview --port 4173",
    // E2E должен быть герметичным: локальный .env разработчика может содержать
    // production Supabase, но offline-demo проверяет именно отключённый backend.
    // Playwright передаёт эти значения дочернему Vite-процессу поверх .env.
    env: {
      ...process.env,
      VITE_SUPABASE_DISABLED: "true",
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_ANON_KEY: "",
    },
    url: "http://localhost:4173",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
