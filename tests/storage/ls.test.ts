import { describe, it, expect, beforeEach } from "vitest";
import { ls } from "../../src/app/data";

// jsdom реализует localStorage по-настоящему (не мок) — достаточно чистить
// его перед каждым тестом, чтобы тесты не текли друг в друга.
beforeEach(() => {
  localStorage.clear();
});

describe("ls.get: значение по умолчанию", () => {
  it("возвращает def, если ключа нет вообще", () => {
    expect(ls.get("missingKey", "fallback")).toBe("fallback");
    expect(ls.get("missingObj", { a: 1 })).toEqual({ a: 1 });
  });
});

describe("ls.set + ls.get: круговой обмен по разным типам", () => {
  it("строка", () => {
    ls.set("str", "hello");
    expect(ls.get("str", "")).toBe("hello");
  });

  it("число", () => {
    ls.set("num", 42);
    expect(ls.get("num", 0)).toBe(42);
  });

  it("булево", () => {
    ls.set("bool", true);
    expect(ls.get("bool", false)).toBe(true);
    ls.set("bool", false);
    expect(ls.get("bool", true)).toBe(false);
  });

  it("объект", () => {
    const val = { volume: 0.75, quality: 1 };
    ls.set("obj", val);
    expect(ls.get("obj", {})).toEqual(val);
  });

  it("массив", () => {
    const val = [3, 1, 2];
    ls.set("arr", val);
    expect(ls.get("arr", [] as number[])).toEqual(val);
  });
});

describe("ls: префикс и формат хранения", () => {
  it("set пишет в localStorage под ключом 'myra.' + key в виде JSON", () => {
    ls.set("history", [1, 2, 3]);
    const raw = localStorage.getItem("myra.history");
    expect(raw).toBe(JSON.stringify([1, 2, 3]));
  });

  it("get реально читает 'myra.' + key напрямую из localStorage, а не какой-то другой источник", () => {
    // Пишем напрямую в localStorage, минуя ls.set, — get должен это увидеть
    localStorage.setItem("myra.direct", JSON.stringify("written-directly"));
    expect(ls.get("direct", "def")).toBe("written-directly");
  });
});

describe("ls.clear: удаляет только ключи с префиксом myra.", () => {
  it("не трогает посторонние ключи localStorage без префикса", () => {
    ls.set("taste", ["Lo-fi"]);
    localStorage.setItem("someOtherApp.setting", "keep-me");

    ls.clear();

    expect(localStorage.getItem("myra.taste")).toBeNull();
    expect(localStorage.getItem("someOtherApp.setting")).toBe("keep-me");
  });
});

describe("ls.get: невалидный JSON в localStorage", () => {
  it("не падает и возвращает def, если сохранённое значение — не валидный JSON", () => {
    // Пишем напрямую, чтобы обойти JSON.stringify внутри ls.set и получить
    // заведомо битую строку, как будто она была испорчена вручную/сторонним кодом.
    localStorage.setItem("myra.broken", "{not valid json");

    expect(() => ls.get("broken", "safe-default")).not.toThrow();
    expect(ls.get("broken", "safe-default")).toBe("safe-default");
  });
});
