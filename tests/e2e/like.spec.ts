import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("myra.onboarded", "true"));
});

// Сердечко в мини-плеере (BottomIsland, player.tsx) переключает лайк текущего
// трека независимо от того, играет он или нет — оно доступно сразу, без
// клика по треку (BottomIsland смонтирован всегда на мобильном виджете).
test("лайк трека из мини-плеера переключается и переживает reload", async ({ page }) => {
  await page.goto("/");

  const likeButton = page.getByRole("button", { name: "like", exact: true });
  await expect(likeButton).toBeVisible();

  // Трек по умолчанию — TRACKS[0] (id=1, "Midnight Echo"), лайков в localStorage
  // изначально нет (Track.liked — статичное демо-поле, реальный список лайков
  // читается отдельно из "myra.liked", см. data.ts/App.tsx)
  const likedBefore = await page.evaluate(() => localStorage.getItem("myra.liked"));
  expect(JSON.parse(likedBefore ?? "[]")).not.toContain(1);

  await likeButton.click();

  // aria-label и заливка сердечка отражают новое состояние
  const unlikeButton = page.getByRole("button", { name: "unlike", exact: true });
  await expect(unlikeButton).toBeVisible();
  await expect(unlikeButton.locator("svg")).not.toHaveAttribute("fill", "none");

  // Персистентность в localStorage (ls.set в data.ts: ключ "myra." + "liked")
  await expect(async () => {
    const raw = await page.evaluate(() => localStorage.getItem("myra.liked"));
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toContain(1);
  }).toPass();

  // Переживает reload: то же самое состояние без повторного клика
  await page.reload();
  const unlikeAfterReload = page.getByRole("button", { name: "unlike", exact: true });
  await expect(unlikeAfterReload).toBeVisible();
  await expect(unlikeAfterReload.locator("svg")).not.toHaveAttribute("fill", "none");

  // И обратное переключение снимает лайк и тоже сохраняется
  await unlikeAfterReload.click();
  await expect(page.getByRole("button", { name: "like", exact: true })).toBeVisible();
  await expect(async () => {
    const raw = await page.evaluate(() => localStorage.getItem("myra.liked"));
    expect(JSON.parse(raw ?? "[]")).not.toContain(1);
  }).toPass();
});
