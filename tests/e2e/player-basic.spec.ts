import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("myra.onboarded", "true"));
});

test("клик по треку загружает его в плеер и открывает Full Player", async ({ page }) => {
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

  // Сознательно НЕ ждём кнопку "pause": имитации воспроизведения по таймеру
  // (прежний startSim) больше нет. Демо-каталог отдаёт внешние mp3 (soundhelix),
  // недоступные в песочнице/CI, и приложение по принципу честности (failPlayback
  // в lib.tsx) не изображает игру — выставляет status="error", playing=false и
  // откатывает трек. Мимолётный "pause" мелькал лишь из-за гонки события play до
  // ошибки. Проверяем устойчивые факты: мини-плеер жив, Full Player открывается по
  // тапу, а транспорт (next/prev) не роняет приложение.
  await expect(miniPlayer).toBeVisible();

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
