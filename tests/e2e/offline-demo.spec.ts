import { test, expect, type Page } from "@playwright/test";

// Главный инвариант проекта (CLAUDE.md): приложение обязано полностью работать
// без единого настроенного бэкенда. Здесь он проверяется жёстче, чем в
// app-launch: ВСЕ внешние запросы принудительно абортируются на уровне
// page.route, а запросы к supabase считаются отдельным счётчиком.

const LOCAL_ORIGIN = "http://localhost:4173";

// Возвращает массив-счётчик ВНЕШНИХ запросов к supabase.
// ВАЖНО: отдельный page.route("**supabase**") здесь нельзя — собственный
// JS-чанк приложения называется assets/supabase-*.js (код-сплит supabase.ts),
// и такой маршрут абортировал бы его, роняя всё приложение в белый экран
// (проверено). Поэтому один catch-all: локальный origin проходит, всё
// внешнее абортируется, и среди внешнего считаются обращения к supabase
// (реальный бэкенд — это всегда внешний https://*.supabase.co).
async function blockAllExternal(page: Page): Promise<string[]> {
  const supabaseHits: string[] = [];
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url.startsWith(LOCAL_ORIGIN)) return route.continue();
    if (/supabase/i.test(url)) supabaseHits.push(url);
    return route.abort();
  });
  return supabaseHits;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("myra.onboarded", "true"));
});

test("при полностью заблокированной внешней сети приложение стартует и все 4 вкладки работают", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", err => pageErrors.push(err.message));
  await blockAllExternal(page);

  await page.goto("/");
  await expect(page).toHaveTitle("MYRA");

  const bottomNav = page.locator(".myra-mobile-nav");
  await expect(bottomNav).toBeVisible();

  // Обзор — живой поиск по локальному каталогу
  await bottomNav.getByRole("button", { name: "Обзор" }).click();
  await expect(page.getByPlaceholder("Треки, артисты, жанры…")).toBeVisible();

  // Полка — вкладки библиотеки отрисованы
  await bottomNav.getByRole("button", { name: "Полка" }).click();
  await expect(page.getByRole("tab", { name: "Плейлисты" })).toBeVisible();

  // Профиль — карточка аккаунта на месте
  await bottomNav.getByRole("button", { name: "Профиль" }).click();
  await expect(page.getByRole("button", { name: "Управление аккаунтом" })).toBeVisible();

  // Обратно на Главную — рекомендации из локального демо-каталога
  await bottomNav.getByRole("button", { name: "Главная" }).click();
  await expect(page.locator(".myra-release-grid .myra-release-cover").first()).toBeVisible();

  expect(pageErrors, `Необработанные исключения: ${pageErrors.join("; ")}`).toEqual([]);
});

test("воспроизведение без сети падает ЧЕСТНО: ошибка вместо имитации, UI живёт дальше", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", err => pageErrors.push(err.message));
  await blockAllExternal(page);

  await page.goto("/");

  // Кликаем первый трек из "Для тебя". aria-label обложки (формат
  // "Название — Артист", см. ReleaseCard в screens.tsx) читаем только чтобы
  // убедиться, что это реальная озвученная карточка каталога — и что клик
  // запускает НАСТОЯЩУЮ попытку воспроизведения, а не заглушку.
  const cover = page.locator(".myra-release-grid .myra-release-cover").first();
  await expect(cover).toBeVisible();
  const ariaLabel = (await cover.getAttribute("aria-label")) ?? "";
  expect(ariaLabel).toContain(" — "); // «Название — Артист»
  await cover.click();

  // Сознательно НЕ проверяем, что мини-плеер покажет ИМЕННО кликнутый трек.
  // По принципу честности (usePlayerQueue.playTrack -> audio.load(onSwitchFailed)
  // в lib.tsx) при неудачной загрузке нового трека плеер откатывает currentTrack
  // обратно к предыдущему (на первом клике — дефолтный TRACKS[0]), а не изображает
  // воспроизведение того, что не загрузилось. Здесь трек демо-каталога заведомо
  // НЕ загрузится (внешний mp3 soundhelix абортирован выше), поэтому откат —
  // ожидаемая часть честного поведения, а не показ выбранного трека. Суть теста
  // ниже — именно честная ошибка, а не то, чьё имя осталось в мини-плеере.
  const miniPlayer = page.locator(".myra-mini-player");
  await expect(miniPlayer).toBeVisible();

  // ФАКТИЧЕСКОЕ поведение (useAudio в lib.tsx): sim-фолбэка больше НЕТ —
  // failPlayback по принципу честности не изображает воспроизведение, а
  // выставляет status="error", playing=false и показывает тост об ошибке.
  // (Демо-каталог указывает на внешние mp3 soundhelix — здесь они абортированы.)
  await expect(page.getByText("Аудио не загрузилось")).toBeVisible({ timeout: 15_000 });
  await expect
    .poll(async () => page.evaluate(() => (window as any).__myra?.audio?.status), { timeout: 15_000 })
    .toBe("error");

  // Прогресс честно стоит на нуле и НЕ двигается: два замера с паузой
  const readAudio = () =>
    page.evaluate(() => {
      const a = (window as any).__myra?.audio;
      return { progress: a?.progress as number, playing: a?.playing as boolean };
    });
  const first = await readAudio();
  await page.waitForTimeout(1500);
  const second = await readAudio();
  expect(first.playing).toBe(false);
  expect(second.playing).toBe(false);
  expect(first.progress).toBe(0);
  expect(second.progress).toBe(0);

  // Кнопка мини-плеера вернулась в состояние "play" — UI не завис в ошибке
  await expect(miniPlayer.getByRole("button", { name: "play", exact: true })).toBeVisible();

  // Приложение живо: навигация после ошибки воспроизведения работает
  await page.locator(".myra-mobile-nav").getByRole("button", { name: "Обзор" }).click();
  await expect(page.getByPlaceholder("Треки, артисты, жанры…")).toBeVisible();

  expect(pageErrors, `Необработанные исключения: ${pageErrors.join("; ")}`).toEqual([]);
});

test("ни одного запроса к supabase за всю офлайн-сессию (supabaseEnabled=false)", async ({ page }) => {
  const supabaseHits = await blockAllExternal(page);

  await page.goto("/");
  const bottomNav = page.locator(".myra-mobile-nav");
  await expect(bottomNav).toBeVisible();

  // Проходим по вкладкам и запускаем воспроизведение — самые «сетевые» сценарии
  await bottomNav.getByRole("button", { name: "Обзор" }).click();
  await bottomNav.getByRole("button", { name: "Профиль" }).click();
  await bottomNav.getByRole("button", { name: "Главная" }).click();
  await page.locator(".myra-release-grid .myra-release-cover").first().click();

  // Даём отработать ленивым эффектам (рекомендации, соцслой, retry-очередь)
  await page.waitForTimeout(1500);

  expect(
    supabaseHits,
    `Запросы к supabase в офлайн-конфигурации: ${supabaseHits.join("; ")}`,
  ).toEqual([]);
});
