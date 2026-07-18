import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("myra.onboarded", "true"));
});

test("поиск на вкладке Обзор фильтрует локальный демо-каталог", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Обзор" }).click();

  const searchInput = page.getByPlaceholder("Треки, артисты, жанры…");
  await expect(searchInput).toBeVisible();

  // "Solstice" — уникальный артист демо-каталога (data.ts), встречается
  // ровно в одном треке ("Neon Drift"), поэтому результат детерминирован.
  await searchInput.fill("Solstice");

  // BrowseScreen использует useDeferredValue — ждём, пока отфильтрованный
  // список реально отрисуется, а не полагаемся на фиксированную паузу.
  await expect(page.getByText("Найдено: 1")).toBeVisible();
  // Скоуп внутри .myra-search-results: тот же трек "Neon Drift" может
  // существовать в DOM и вне результатов поиска (например, в секции "Для тебя"
  // на Главной — если он же попал туда через рекомендации, а предыдущий
  // экран ещё не размонтировался после кроссфейда AnimatePresence). Сам
  // .myra-release-cover — это и есть <button aria-label="...">, поэтому
  // проверяем атрибут у самого найденного элемента, а не ищем вложенную кнопку.
  const results = page.locator(".myra-search-results .myra-release-cover");
  await expect(results).toHaveCount(1);
  await expect(results).toHaveAttribute("aria-label", "Neon Drift — Solstice");
  await expect(results).toBeVisible();

  // Очистка поиска (крестик) возвращает к дефолтному виду вкладки — треки исчезают,
  // но чарт/жанры снова на месте, значит фильтр действительно сбросился
  await page.getByRole("button", { name: "Очистить" }).click();
  await expect(searchInput).toHaveValue("");
  await expect(page.locator(".myra-search-results")).toHaveCount(0);
});

test("поиск без совпадений показывает пустое состояние", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Обзор" }).click();

  const searchInput = page.getByPlaceholder("Треки, артисты, жанры…");
  await searchInput.fill("zzzNoSuchTrackzzz");

  await expect(page.getByText("Ничего не найдено. Попробуй другой запрос.")).toBeVisible();
});
