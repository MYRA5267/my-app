import { defineConfig, configDefaults } from "vitest/config";
import path from "path";
import react from "@vitejs/plugin-react";

// react() нужен здесь же, где мы его подключаем в vite.config.ts: lib.tsx —
// это .tsx-файл с JSX в других экспортах (TiltCard, Sheet и т.д.), и без
// плагина esbuild не разберёт файл целиком, даже если useAudio JSX не использует.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    // tests/e2e/* — Playwright-спеки (playwright.config.ts, testDir tests/e2e):
    // Vitest не должен их исполнять — у Playwright свой раннер, и его
    // test.beforeEach() падает вне контекста Playwright Test.
    // Расширяем configDefaults.exclude, а не заменяем целиком — иначе
    // потеряются дефолтные исключения (node_modules, dist и т.д.).
    exclude: [...configDefaults.exclude, "tests/e2e/**"],
  },
});
