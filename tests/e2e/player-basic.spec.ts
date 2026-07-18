import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("myra.onboarded", "true"));
});

test("клик по треку запускает воспроизведение и открывает Full Player", async ({ page }) => {
  // Listener — до любых действий: ошибка, брошенная асинхронно в любой момент
  // теста (а не только после кликов Next/Prev), должна попасть в массив.
  const pageErrors: string[] = [];
  page.on("pageerror", err => pageErrors.push(err.message));

  await page.goto("/");

  // Мини-плеер (BottomIsland) смонтирован всегда на мобильном виджете —
  // см. App.tsx (`<div className="lg:hidden"><BottomIsland .../></div>`),
  // так что он виден ещё до какого-либо клика по треку.
  const miniPlayer = page.locator(".myra-mini-player");
  await expect(miniPlayer).toBeVisible();

  // Первый трек в секции "Для тебя" на Главной (ReleaseCard — см. screens.tsx)
  const firstTrackCover = page.locator(".myra-release-grid .myra-release-cover").first();
  await expect(firstTrackCover).toBeVisible();
  await firstTrackCover.click();

  // Демо-каталог отдаёт реальные mp3 с внешнего хоста (soundhelix), недоступного
  // в этой песочнице/CI — приложение по дизайну (useAudio в lib.tsx) ловит ошибку
  // загрузки и переключается на симулированное воспроизведение (startSim), выставляя
  // playing=true по таймеру — так что кнопка мини-плеера всё равно должна дойти до "pause".
  await expect(page.getByRole("button", { name: "pause" })).toBeVisible({ timeout: 20_000 });

  // Клик по мини-плееру открывает Full Player
  await miniPlayer.click();
  const fullPlayer = page.locator(".myra-full-player");
  await expect(fullPlayer).toBeVisible();

  // Следующий/Предыдущий трек — кликабельны и не бросают ошибок
  await page.getByRole("button", { name: "Следующий трек" }).click();
  await page.getByRole("button", { name: "Предыдущий трек" }).click();

  // Даём асинхронным ошибкам (rejected promise, эффекты после смены трека)
  // время всплыть, прежде чем проверять накопленный массив
  await page.waitForTimeout(300);
  expect(pageErrors).toEqual([]);
});
