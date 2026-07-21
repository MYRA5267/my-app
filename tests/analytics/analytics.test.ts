import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  track,
  setAnalyticsAdapter,
  setAnalyticsConsent,
  hasAnalyticsConsent,
  createMockAdapter,
  noopAdapter,
  devAdapter,
  type AnalyticsEvent,
} from "../../src/app/analytics";

beforeEach(() => {
  localStorage.clear();
  // Каждый тест начинает с чистого состояния модуля: no-op адаптер без гейта.
  setAnalyticsAdapter(null);
  setAnalyticsConsent(false);
});

describe("track: маршрутизация в адаптер", () => {
  it("передаёт событие в установленный адаптер как есть", () => {
    const mock = createMockAdapter();
    setAnalyticsAdapter(mock);
    track({ name: "login", method: "email" });
    track({ name: "track_play", source: "direct", trackId: 7 });
    expect(mock.events).toEqual([
      { name: "login", method: "email" },
      { name: "track_play", source: "direct", trackId: 7 },
    ]);
  });

  it("no-op адаптер по умолчанию ничего не бросает", () => {
    setAnalyticsAdapter(null);
    expect(() => track({ name: "app_open" })).not.toThrow();
    expect(noopAdapter.track({ name: "app_open" })).toBeUndefined();
  });
});

describe("track: устойчивость (аналитика не ломает приложение)", () => {
  it("ошибка адаптера проглатывается, track() не бросает", () => {
    setAnalyticsAdapter({ track() { throw new Error("boom"); } });
    expect(() => track({ name: "logout" })).not.toThrow();
  });
});

describe("track: защита от PII", () => {
  it("отбрасывает событие с запрещённым полем (email/token/text/...)", () => {
    const mock = createMockAdapter();
    setAnalyticsAdapter(mock);
    // Пробиваем систему типов через any — рантайм-страж должен сработать.
    track({ name: "login", method: "email", userEmail: "a@b.c" } as unknown as AnalyticsEvent);
    track({ name: "search", searchQuery: "секрет" } as unknown as AnalyticsEvent);
    track({ name: "login", authToken: "xyz" } as unknown as AnalyticsEvent);
    expect(mock.events).toEqual([]);
  });

  it("пропускает событие только с разрешёнными полями", () => {
    const mock = createMockAdapter();
    setAnalyticsAdapter(mock);
    track({ name: "search", resultCount: 3 });
    expect(mock.events).toEqual([{ name: "search", resultCount: 3 }]);
  });
});

describe("track: гейт согласия для реального провайдера", () => {
  it("не отправляет без согласия, когда адаптер требует его", () => {
    const mock = createMockAdapter();
    setAnalyticsAdapter(mock, { requireConsent: true });
    track({ name: "app_open" });
    expect(mock.events).toEqual([]);

    setAnalyticsConsent(true);
    expect(hasAnalyticsConsent()).toBe(true);
    track({ name: "app_open" });
    expect(mock.events).toEqual([{ name: "app_open" }]);
  });

  it("согласие персистится в localStorage через ls", () => {
    setAnalyticsConsent(true);
    expect(localStorage.getItem("myra.analyticsConsent")).toBe("true");
  });
});

describe("createMockAdapter", () => {
  it("копит события и сбрасывается через reset()", () => {
    const mock = createMockAdapter();
    mock.track({ name: "like", trackId: 1 });
    expect(mock.events).toHaveLength(1);
    mock.reset();
    expect(mock.events).toHaveLength(0);
  });
});

describe("devAdapter", () => {
  it("печатает событие и не бросает", () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    expect(() => devAdapter.track({ name: "app_open" })).not.toThrow();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
