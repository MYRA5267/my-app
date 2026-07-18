import { test, expect } from "@playwright/test";

// Без "myra.onboarded" в localStorage (свежий контекст браузера — Playwright
// изолирует storage между тестами по умолчанию, поэтому здесь нарочно нет
// beforeEach с addInitScript) приложение обязано показать онбординг, а не
// сразу главный экран — см. App.tsx: `if (!onboarded) return <OnboardingFlow ... />`.

test("свежий пользователь видит онбординг, а не главный экран", async ({ page }) => {
  await page.goto("/");

  // Корневой контейнер онбординга (см. src/app/auth.tsx OnboardingFlow)
  await expect(page.locator(".myra-onboarding")).toBeVisible();

  // Первый слайд — характерный заголовок (ob.s1t, ru — дефолтный язык).
  // Тот же текст дублируется в скрытой от a11y-дерева desktop-витрине
  // (aria-hidden="true", <strong>), поэтому целимся конкретно в <h1> слайда.
  await expect(page.getByRole("heading", { name: "Открывай независимых артистов" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Пропустить" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Дальше" })).toBeVisible();

  // Главный экран (нижняя навигация) не должен присутствовать вообще
  await expect(page.locator(".myra-mobile-nav")).toHaveCount(0);
});

test("кнопка Пропустить переводит на шаг входа/регистрации, а не в приложение", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Пропустить" }).click();

  // Шаг auth: заголовок "Привет!" (au.welcome) и переключатель Регистрация/Вход
  await expect(page.getByText("Привет!")).toBeVisible();
  await expect(page.getByRole("button", { name: "Регистрация" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Вход" })).toBeVisible();

  // Всё ещё не главный экран — онбординг не завершён (нет email/пароля)
  await expect(page.locator(".myra-mobile-nav")).toHaveCount(0);
});
