import { test, expect, type ConsoleMessage } from "@playwright/test";

const LOCAL_ORIGIN = "http://localhost:4173";

// Сетевые паттерны Chromium — используются ТОЛЬКО для ошибок без location.url
// (см. isExpectedConsoleError). Нарочно без generic-текста "Failed to load
// resource": он печатается для ЛЮБОГО упавшего ресурса, включая локальные
// 404/500 от самого preview-сервера (битый путь чанка, пропавший ассет), и
// фильтр по нему молча глушил бы реальные поломки приложения.
const EXPECTED_NETWORK_ERROR = /ERR_CONNECTION|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|net::ERR_/i;

// Песочница/CI не имеют доступа к внешним демо-хостам (например, соундхеликс
// для аудио демо-каталога) — такие сетевые ошибки ожидаемы и не являются
// падением приложения (см. CLAUDE.md: оно обязано работать полностью офлайн).
// Ожидаемой считается только ошибка ВНЕШНЕГО ресурса: судим по URL источника
// (msg.location().url), а не по тексту сообщения — ошибка локального ресурса
// (наш preview-сервер) всегда неожиданна и должна валить тест.
function isExpectedConsoleError(msg: ConsoleMessage): boolean {
  const url = msg.location().url;
  if (url) return !url.startsWith(LOCAL_ORIGIN);
  // Без location (редкий случай) остаётся только текст — но уже строго
  // по кодам net::ERR_*, без generic "Failed to load resource"
  return EXPECTED_NETWORK_ERROR.test(msg.text());
}

test.beforeEach(async ({ page }) => {
  // Обходим онбординг — тестируем локальный/офлайн-демо-режим без Supabase,
  // как и должно работать приложение "из коробки" (см. CLAUDE.md).
  await page.addInitScript(() => localStorage.setItem("myra.onboarded", "true"));
});

test("приложение запускается без неожиданных ошибок консоли", async ({ page }) => {
  const unexpectedErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", msg => {
    if (msg.type() === "error" && !isExpectedConsoleError(msg)) {
      unexpectedErrors.push(msg.text());
    }
  });
  page.on("pageerror", err => pageErrors.push(err.message));

  await page.goto("/");

  await expect(page).toHaveTitle("MYRA");

  // Даём приложению домонтироваться и дозагрузить ленивые чанки (auth и т.п.
  // не тянутся при onboarded=true, но recommendations/community-эффекты успевают отработать)
  await page.waitForTimeout(1000);

  expect(pageErrors, `Необработанные исключения в рантайме: ${pageErrors.join("; ")}`).toEqual([]);
  expect(unexpectedErrors, `Неожиданные ошибки консоли: ${unexpectedErrors.join("; ")}`).toEqual([]);
});

test("показывает нижнюю навигацию для дефолтного слушателя", async ({ page }) => {
  await page.goto("/");

  // "Профиль" совпадает ещё и с отдельной кнопкой-аватаром в шапке Home —
  // поэтому здесь и далее скоупим поиск именно в нижнюю нав-панель.
  const bottomNav = page.locator(".myra-mobile-nav");
  await expect(bottomNav).toBeVisible();
  await expect(bottomNav.getByRole("button", { name: "Главная" })).toBeVisible();
  await expect(bottomNav.getByRole("button", { name: "Обзор" })).toBeVisible();
  await expect(bottomNav.getByRole("button", { name: "Полка" })).toBeVisible();
  await expect(bottomNav.getByRole("button", { name: "Профиль" })).toBeVisible();

  // Студия (Creator) видна только артистам — свежий аккаунт по умолчанию
  // "listener", так что вкладки быть не должно (see player.tsx navItems()).
  await expect(bottomNav.getByRole("button", { name: "Студия" })).toHaveCount(0);
});
