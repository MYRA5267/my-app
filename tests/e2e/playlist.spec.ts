import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("myra.onboarded", "true"));
});

// Форма записи в localStorage — см. usePlaylists.ts: ls.set("customPls", ...)
// (ключ на диске — "myra.customPls"), id = "u" + Date.now()
type StoredPlaylist = { id: string; name: string; img: string; trackIds: number[] };

const readCustomPls = (page: Page): Promise<StoredPlaylist[]> =>
  page.evaluate(() => JSON.parse(localStorage.getItem("myra.customPls") ?? "[]"));

async function openPlaylistsTab(page: Page) {
  await page.locator(".myra-mobile-nav").getByRole("button", { name: "Полка" }).click();
  await page.getByRole("tab", { name: "Плейлисты" }).click();
}

async function createPlaylistViaUI(page: Page, name: string) {
  // Кнопка "+" в шапке Полки — единственная кнопка внутри header и без
  // aria-label (LibraryScreen, screens.tsx), поэтому скоупим по классу шапки
  await page.locator(".myra-library-header button").click();
  await expect(page.getByText("Новый плейлист")).toBeVisible();
  await page.getByPlaceholder("Название плейлиста…").fill(name);
  await page.getByRole("button", { name: "Создать" }).click();
  await expect(page.getByText("Плейлист создан")).toBeVisible();
}

// ВАЖНО (фактическое поведение приложения): пер-трекового «добавить в
// плейлист» из контекста трека или Full Player в MYRA нет. Единственный
// UI-путь, кладущий треки в кастомный плейлист, — «Импорт музыки»
// (Профиль → Управление аккаунтом → ImportSheet, overlays.tsx):
// createPlaylist(name, trackIds) вызывается с непустыми trackIds только
// оттуда, с фиксированным именем "Импортированное" (im2.plName).
async function importTrackAsPlaylist(page: Page) {
  await page.locator(".myra-mobile-nav").getByRole("button", { name: "Профиль" }).click();
  await page.getByRole("button", { name: "Управление аккаунтом" }).click();
  await page.getByText("Импорт музыки").click();
  // Строка формата «Артист — Название» (парсер ImportSheet); "Midnight Echo" —
  // TRACKS[0] демо-каталога, id=1 (data.ts)
  await page.locator("textarea").fill("Luna Wave — Midnight Echo");
  await page.getByRole("button", { name: "Найти треки" }).click();
  await expect(page.getByText("Найдено 1 · не найдено 0")).toBeVisible();
  await page.getByRole("button", { name: "Создать плейлист" }).click();
  await expect(page.getByText("Плейлист из 1 треков создан")).toBeVisible();
}

test("создание плейлиста через UI: пустое состояние исчезает, запись попадает в myra.customPls", async ({ page }) => {
  await page.goto("/");
  await openPlaylistsTab(page);
  await expect(page.getByText("Пока нет своих плейлистов — создай первый")).toBeVisible();

  await createPlaylistViaUI(page, "Мой тестовый");

  await expect(page.getByText("Пока нет своих плейлистов — создай первый")).toHaveCount(0);
  const card = page.locator(".myra-playlist-card", { hasText: "Мой тестовый" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("0 треков"); // lib.nTracks с нулём треков

  await expect(async () => {
    const pls = await readCustomPls(page);
    expect(pls).toHaveLength(1);
    expect(pls[0].name).toBe("Мой тестовый");
    expect(pls[0].trackIds).toEqual([]);
    expect(pls[0].id).toMatch(/^u\d+$/);
  }).toPass();
});

test("трек попадает в кастомный плейлист (через импорт): счётчик 1, конкретный трек внутри", async ({ page }) => {
  await page.goto("/");
  await importTrackAsPlaylist(page);

  await openPlaylistsTab(page);
  const card = page.locator(".myra-playlist-card", { hasText: "Импортированное" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("1 треков");

  // Внутри PlaylistSheet — ровно один трек, и именно импортированный
  await card.click();
  await expect(page.locator(".myra-playlist-hero-title")).toHaveText("Импортированное");
  const row = page.locator(".myra-playlist-track-row");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Midnight Echo");
  await expect(row).toContainText("Luna Wave");

  const pls = await readCustomPls(page);
  expect(pls).toHaveLength(1);
  expect(pls[0].name).toBe("Импортированное");
  expect(pls[0].trackIds).toEqual([1]); // id "Midnight Echo" в демо-каталоге
});

test("созданный и наполненный плейлисты переживают reload — UI и myra.customPls совпадают", async ({ page }) => {
  // Два полных UI-флоу + reload не укладываются в дефолтные 30s: событие
  // load здесь ждёт зависший внешний запрос Google Fonts (песочница без
  // сети держит соединение до таймаута прокси — на трейсе reload занял 13s)
  test.setTimeout(60_000);
  await page.goto("/");
  await openPlaylistsTab(page);
  await createPlaylistViaUI(page, "Мой тестовый");
  await expect(page.locator(".myra-playlist-card", { hasText: "Мой тестовый" })).toBeVisible();
  await importTrackAsPlaylist(page);

  // domcontentloaded вместо дефолтного load: см. комментарий к таймауту выше,
  // все последующие expect и так авто-ждут отрисовку
  await page.reload({ waitUntil: "domcontentloaded" });
  await openPlaylistsTab(page);

  // createPlaylist добавляет в начало списка ([pl, ...prev] в usePlaylists),
  // поэтому порядок после reload детерминирован: сперва "Импортированное"
  const cards = page.locator(".myra-playlist-card");
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText("Импортированное");
  await expect(cards.nth(0)).toContainText("1 треков");
  await expect(cards.nth(1)).toContainText("Мой тестовый");
  await expect(cards.nth(1)).toContainText("0 треков");

  const pls = await readCustomPls(page);
  expect(pls.map(p => p.name)).toEqual(["Импортированное", "Мой тестовый"]);
  expect(pls[0].trackIds).toEqual([1]);
  expect(pls[1].trackIds).toEqual([]);
});
