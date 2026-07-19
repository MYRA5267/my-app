import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("myra.onboarded", "true");
    // Реальные пользовательские данные — чтобы проверить, что логаут
    // действительно их стирает (ls.clear() в handleLogout, App.tsx)
    localStorage.setItem("myra.liked", "[1]");
    localStorage.setItem(
      "myra.customPls",
      JSON.stringify([{ id: "u1", name: "Черновик", img: "", trackIds: [2] }]),
    );
  });
});

async function openLogoutConfirm(page: Page) {
  // "Профиль" совпадает с кнопкой-аватаром в шапке Home — скоупим в нижнюю нав-панель
  await page.locator(".myra-mobile-nav").getByRole("button", { name: "Профиль" }).click();
  await page.getByRole("button", { name: "Выйти из аккаунта" }).click();
  await expect(page.getByText("Выйти из аккаунта?")).toBeVisible();
  await expect(page.getByText("Твоя музыка и настройки сохранятся")).toBeVisible();
}

test("отмена в ConfirmSheet не выходит из аккаунта", async ({ page }) => {
  await page.goto("/");
  await openLogoutConfirm(page);

  await page.getByRole("button", { name: "Отмена" }).click();
  await expect(page.getByText("Выйти из аккаунта?")).toBeHidden();

  // Всё ещё в приложении: нижняя навигация на месте, онбординга нет
  await expect(page.locator(".myra-mobile-nav")).toBeVisible();
  await expect(page.locator(".myra-onboarding")).toHaveCount(0);

  const state = await page.evaluate(() => ({
    onboarded: localStorage.getItem("myra.onboarded"),
    liked: localStorage.getItem("myra.liked"),
  }));
  expect(state.onboarded).toBe("true");
  expect(state.liked).toBe("[1]");
});

test("подтверждение выхода возвращает в онбординг и чистит данные аккаунта в myra.*", async ({ page }) => {
  await page.goto("/");
  await openLogoutConfirm(page);

  // exact: true — иначе имя "Выйти" совпало бы и со строкой "Выйти из аккаунта"
  await page.getByRole("button", { name: "Выйти", exact: true }).click();

  await expect(page.getByText("Ты вышел из аккаунта")).toBeVisible();
  // handleLogout -> clearIdentity() сбрасывает onboarded, и App.tsx
  // (`if (!onboarded) return <OnboardingFlow/>`) показывает онбординг
  await expect(page.locator(".myra-onboarding")).toBeVisible();
  await expect(page.locator(".myra-mobile-nav")).toHaveCount(0);

  // Фактическое поведение handleLogout (App.tsx), а не «идеальная» пустота:
  // ls.clear() стирает все ключи myra.* (onboarded, liked, customPls...),
  // НО сразу после очистки два ключа честно пересоздаются:
  //  - myra.tab = "home" (setTab("home") внутри handleLogout пишет в ls);
  //  - myra.stats — setStats(touchDailyStreak(loadStats())) даёт новый объект
  //    (streak 1, lastActiveDay = сегодня), и эффект saveStats кладёт его на диск.
  await expect(async () => {
    const state = await page.evaluate(() => ({
      onboarded: localStorage.getItem("myra.onboarded"),
      liked: localStorage.getItem("myra.liked"),
      customPls: localStorage.getItem("myra.customPls"),
      tab: localStorage.getItem("myra.tab"),
      stats: localStorage.getItem("myra.stats"),
    }));
    expect(state.onboarded).toBeNull();
    expect(state.liked).toBeNull();
    expect(state.customPls).toBeNull();
    expect(state.tab).toBe(JSON.stringify("home"));
    expect(state.stats).not.toBeNull();
    expect(JSON.parse(state.stats as string).streak).toBe(1);
  }).toPass();
});
