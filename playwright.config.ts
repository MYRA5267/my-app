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
  ],
  webServer: {
    // В CI dist/ уже собран отдельным шагом `pnpm build` в ci.yml до
    // `pnpm test:e2e` — повторный полный Vite-build здесь был бы чистой
    // тратой времени на каждый прогон. Локально build оставляем: dist/
    // на машине разработчика может быть протухшим или отсутствовать.
    command: process.env.CI
      ? "pnpm preview --port 4173"
      : "pnpm build && pnpm preview --port 4173",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
