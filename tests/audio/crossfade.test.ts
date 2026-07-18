// Почему тест смонтирован именно так (без @testing-library/react):
// в проекте до этого не было ни одного автотеста, и добавлять RTL ради одного
// хука — лишняя зависимость с собственной матрицей совместимости с react/react-dom.
// useAudio — обычный хук, вызвать его можно из любого функционального компонента,
// поэтому используем минимальный тестовый компонент (без JSX — файл .ts, а не .tsx),
// монтируем его через react-dom/client в jsdom и управляем эффектами через
// act() из "react" (react 18.3 экспортирует его напрямую, без react-dom/test-utils).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useAudio, type AudioApi } from "../../src/app/lib";

// React 18 требует явно объявить среду как act()-совместимую, если не подключать
// react-dom/test-utils ради его сайд-эффекта — делаем это напрямую.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// ─── Моки окружения ────────────────────────────────────────────────────────
// jsdom не реализует AudioContext, HTMLMediaElement.play/pause и настоящий rAF —
// без этих моков useAudio упадёт ещё на этапе монтирования (см. try/catch вокруг
// AudioContext в lib.tsx — без мока код просто тихо уйдёт в ветку "без DSP", но
// play()/pause() и volume-диапазон jsdom проверяет по-настоящему и без мока бросит).

function makeFakeNode() {
  const node: any = {};
  node.connect = vi.fn(() => node);
  node.frequency = { value: 0, setTargetAtTime: vi.fn() };
  node.gain = { value: 0, setTargetAtTime: vi.fn() };
  return node;
}

class FakeAudioContext {
  state = "running";
  destination = {};
  createMediaElementSource() { return makeFakeNode(); }
  createBiquadFilter() { return makeFakeNode(); }
  createGain() { return makeFakeNode(); }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
}
(window as any).AudioContext = FakeAudioContext;
(window as any).webkitAudioContext = FakeAudioContext;

// Все реально созданные <audio>-элементы (mk() из lib.tsx вызывает new Audio()) —
// перехватываем конструктор, чтобы получить прямой доступ к paused/src/volume
// в тестах, не полагаясь на published API хука (он их не отдаёт).
let createdAudios: HTMLAudioElement[] = [];
(window as any).Audio = function (this: unknown) {
  const el = document.createElement("audio");
  createdAudios.push(el);
  return el;
} as unknown as typeof Audio;

// jsdom не реализует play()/pause() (бросает "Not implemented" через virtual
// console и возвращает undefined) — подменяем на управляемые заглушки, которые
// хотя бы поддерживают корректное чтение .paused (в jsdom это геттер-аксессор
// на прототипе без сеттера, поэтому переопределяем как собственное свойство).
window.HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
  Object.defineProperty(this, "paused", { value: false, configurable: true, writable: true });
  return Promise.resolve();
};
window.HTMLMediaElement.prototype.pause = function (this: HTMLMediaElement) {
  Object.defineProperty(this, "paused", { value: true, configurable: true, writable: true });
};

// Спай на .volume: считает каждое присваивание и его значение. jsdom у себя
// САМ бросает DOMException при попытке присвоить значение вне [0,1] (проверено
// отдельно), так что если clampVol() в lib.tsx убрать/сломать — вызов упадёт
// прямо здесь, а не молча пройдёт мимо.
const volumeLog: number[] = [];
const volumeDescriptor = Object.getOwnPropertyDescriptor(window.HTMLMediaElement.prototype, "volume")!;
Object.defineProperty(window.HTMLMediaElement.prototype, "volume", {
  configurable: true,
  get() { return volumeDescriptor.get!.call(this); },
  set(v: number) {
    volumeLog.push(v);
    volumeDescriptor.set!.call(this, v); // если v вне [0,1] — jsdom бросит здесь
  },
});

// Управляемый rAF: колбэки складываем в очередь и продвигаем вручную, вместе
// с замоканным performance.now(), чтобы детерминированно долистывать кроссфейд
// (1400мс) до любой нужной точки без реального ожидания.
let rafCallbacks: Map<number, FrameRequestCallback>;
let rafId: number;
let mockNow: number;
window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
  const id = ++rafId;
  rafCallbacks.set(id, cb);
  return id;
}) as typeof requestAnimationFrame;
window.cancelAnimationFrame = ((id: number) => {
  rafCallbacks.delete(id);
}) as typeof cancelAnimationFrame;

/** Продвигает время на deltaMs и исполняет все колбэки, ожидавшие кадра (обычно один). */
function advanceFrame(deltaMs: number) {
  mockNow += deltaMs;
  const pending = Array.from(rafCallbacks.entries());
  rafCallbacks.clear();
  pending.forEach(([, cb]) => cb(mockNow));
}

// ─── Тестовый компонент-обвязка ─────────────────────────────────────────────
const apiRef: { current: AudioApi | null } = { current: null };
const fadeEnabledRef: { current: boolean } = { current: true };

function Harness() {
  const api = useAudio(() => {}, () => fadeEnabledRef.current);
  apiRef.current = api;
  return null;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  createdAudios = [];
  rafCallbacks = new Map();
  rafId = 0;
  mockNow = 0;
  volumeLog.length = 0;
  fadeEnabledRef.current = true;
  vi.spyOn(performance, "now").mockImplementation(() => mockNow);

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(Harness));
  });
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
});

// Общий диапазон кроссфейда в lib.tsx — держим в синхроне с durationMs там же.
const FADE_MS = 1400;

describe("useAudio: кроссфейд при повторном прерывании (baг 'volume вне [0,1]')", () => {
  it("не бросает и не выставляет .volume вне [0,1] при быстрой повторной смене трека посреди активного кроссфейда", () => {
    expect(() => {
      act(() => { apiRef.current!.load("track-1.mp3"); }); // первая загрузка — без кроссфейда (ничего ещё не играло)
      act(() => { apiRef.current!.setVolume(1.0000000005); }); // имитация float-дрейфа громкости "сверху" из UI
      act(() => { apiRef.current!.load("track-2.mp3"); }); // trackом-1 уже "играет" — запускается кроссфейд
      act(() => { advanceFrame(FADE_MS * 0.5); }); // долистали кроссфейд до середины (k≈0.5)
      act(() => { apiRef.current!.load("track-3.mp3"); }); // прерываем ДО завершения предыдущего кроссфейда
      act(() => { advanceFrame(FADE_MS * 0.5); });
      act(() => { apiRef.current!.load("track-4.mp3"); }); // прерываем ещё раз
      act(() => { advanceFrame(FADE_MS * 2); }); // долистываем с запасом до полного завершения
    }).not.toThrow();

    expect(volumeLog.length).toBeGreaterThan(0);
    for (const v of volumeLog) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("после прерывания кроссфейда старый (фейд-аут) элемент поставлен на паузу и его src очищен", () => {
    act(() => { apiRef.current!.load("track-1.mp3"); }); // pair[0] играет track-1
    act(() => { apiRef.current!.load("track-2.mp3"); }); // кроссфейд: pair[0] фейд-аут, pair[1] фейд-ин (track-2)
    act(() => { advanceFrame(FADE_MS * 0.3); }); // прервём фейд, не дав ему завершиться

    const fadingOutEl = createdAudios[0]; // тот, что играл track-1 и сейчас затухает
    expect(fadingOutEl.paused).toBe(false); // ещё активен — фейд не завершён

    // Отключаем кроссфейд для прерывающего load(), чтобы он не переиспользовал
    // fadingOutEl немедленно внутри той же ветки — так можно проверить именно
    // состояние, в которое его привела stopFade(), а не то, что случилось потом.
    fadeEnabledRef.current = false;
    act(() => { apiRef.current!.load("track-3.mp3"); });

    expect(fadingOutEl.paused).toBe(true);
    // .src (IDL) резолвится в абсолютный URL даже для "" — реальный сброс проверяем
    // по content-атрибуту, как и в реальных браузерах.
    expect(fadingOutEl.getAttribute("src")).toBe("");
  });

  it("после серии из 5 быстрых next подряд ровно один аудиоэлемент играет актуальный трек", () => {
    const urls = ["t1.mp3", "t2.mp3", "t3.mp3", "t4.mp3", "t5.mp3"];
    for (const url of urls) {
      act(() => { apiRef.current!.load(url); }); // каждый следующий load() прерывает предыдущий кроссфейд, не дожидаясь его конца
    }
    // Даём последнему (пятому) кроссфейду досчитать до конца — это и есть
    // "итоговое состояние" после серии быстрых next.
    act(() => { advanceFrame(FADE_MS * 2); });

    expect(createdAudios).toHaveLength(2);
    const [a, b] = createdAudios;
    const notPaused = [a, b].filter(el => !el.paused);
    expect(notPaused).toHaveLength(1);
    expect(notPaused[0].src).toContain("t5.mp3");

    const paused = [a, b].find(el => el.paused)!;
    expect(paused.getAttribute("src")).toBe("");
  });
});
