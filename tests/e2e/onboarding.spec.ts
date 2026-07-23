import { test, expect } from "@playwright/test";

// Без "myra.onboarded" в localStorage (свежий контекст браузера — Playwright
// изолирует storage между тестами по умолчанию, поэтому здесь нарочно нет
// beforeEach с addInitScript) приложение обязано показать онбординг, а не
// сразу главный экран — см. App.tsx: `if (!onboarded) return <OnboardingFlow ... />`.

test("свежий пользователь видит онбординг (выбор спутника), а не главный экран", async ({ page }) => {
  await page.goto("/");

  // Корневой контейнер онбординга (см. src/app/auth.tsx OnboardingFlow)
  await expect(page.locator(".myra-onboarding")).toBeVisible();

  // Первый шаг — выбор спутника (comp.title, ru — дефолтный язык)
  await expect(page.getByRole("heading", { name: "Выбери спутника" })).toBeVisible();
  // Ссылка на вход для существующих аккаунтов
  await expect(page.getByRole("button", { name: /Войти в аккаунт/ })).toBeVisible();

  // Главный экран (нижняя навигация) не должен присутствовать вообще
  await expect(page.locator(".myra-mobile-nav")).toHaveCount(0);
});

test("ссылка входа переводит на шаг входа/регистрации, а не в приложение", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /Войти в аккаунт/ }).click();

  // Шаг auth в режиме входа: заголовок "С возвращением" (au.backTitle) и
  // переключатель Регистрация/Вход
  await expect(page.getByText("С возвращением")).toBeVisible();
  await expect(page.getByRole("button", { name: "Регистрация" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Вход" })).toBeVisible();

  // Всё ещё не главный экран — онбординг не завершён (нет email/пароля)
  await expect(page.locator(".myra-mobile-nav")).toHaveCount(0);
});

test("из входа можно открыть восстановление пароля", async ({ page }) => {
  await page.goto("/");
  // "Войти в аккаунт" со стартового экрана сразу открывает auth в режиме входа
  await page.getByRole("button", { name: /Войти в аккаунт/ }).click();
  await page.getByRole("button", { name: "Забыли пароль?" }).click();

  await expect(page.getByRole("heading", { name: "Вернём доступ" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Отправить ссылку" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Вернуться ко входу" })).toBeVisible();
});

test("ссылка восстановления открывает форму нового пароля", async ({ page }) => {
  await page.goto("/?password-recovery=1");

  await expect(page.getByRole("heading", { name: "Новый пароль" })).toBeVisible();
  await expect(page.getByPlaceholder("Новый пароль")).toBeVisible();
  await expect(page.getByPlaceholder("Повтори пароль")).toBeVisible();
  await expect(page.getByRole("button", { name: "Сохранить пароль" })).toBeVisible();
});
