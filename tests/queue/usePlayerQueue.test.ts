// Почему тест смонтирован именно так — см. tests/audio/crossfade.test.ts (тот же
// паттерн: без RTL, минимальный тестовый компонент без JSX, react-dom/client + act()).
//
// usePlayerQueue сам вызывает useAudio() из lib.tsx — реальный useAudio (со всеми
// AudioContext/rAF-моками) уже отдельно покрыт tests/audio/crossfade.test.ts.
// Здесь нас интересует только логика очереди/shuffle/repeat/next/prev, поэтому
// модуль "./lib" мокается целиком — это исключает тяжёлые моки аудио-мотора
// и держит тест сфокусированным именно на очереди.
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";
import { act } from "react";
import { createElement, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// vi.mock(...) ниже поднимается транспайлером выше обычных объявлений — если бы
// fakeAudioApi/onEndedBox были обычным const, фабрика мока ловила бы их в TDZ.
// vi.hoisted() гарантирует, что они уже инициализированы к моменту вызова фабрики.
const { fakeAudioApi, onEndedBox } = vi.hoisted(() => ({
  fakeAudioApi: {
    playing: false,
    progress: 0,
    duration: 0,
    volume: 1,
    load: (() => {}) as (...args: unknown[]) => void,
    toggle: (() => {}) as (...args: unknown[]) => void,
    pause: (() => {}) as (...args: unknown[]) => void,
    seek: (() => {}) as (...args: unknown[]) => void,
    setVolume: (() => {}) as (...args: unknown[]) => void,
    setQuality: (() => {}) as (...args: unknown[]) => void,
  },
  // Последний onEnded, переданный usePlayerQueue в useAudio(onEnded, getFade) —
  // вызов onEndedBox.current() имитирует событие "трек доигран до конца".
  onEndedBox: { current: (() => {}) as () => void },
}));

vi.mock("../../src/app/lib", () => ({
  useAudio: (onEnded: () => void) => {
    onEndedBox.current = onEnded;
    return fakeAudioApi;
  },
}));

import { usePlayerQueue } from "../../src/app/usePlayerQueue";
import { TRACKS, type Track } from "../../src/app/data";
import { smartNext } from "../../src/app/smart";

// Стабильные (не пересоздаваемые на каждый рендер) значения для параметров
// хука, которые в самом тесте не варьируются, — так useCallback-зависимости
// внутри usePlayerQueue не дёргаются лишний раз без необходимости.
const EMPTY_MY_TRACKS: Track[] = [];
const EMPTY_LIKED = new Set<number>();
const EMPTY_FOLLOWED = new Set<string>();
const resolveUrl = (tr: Track) => tr.url ?? String(tr.id);

let registerPlayMock: Mock<(tr: Track) => void>;
// Стабильная обёртка над мокой: сама ссылка не меняется между рендерами,
// а внутри всегда обращается к актуальному registerPlayMock текущего теста.
const registerPlay = (tr: Track) => registerPlayMock(tr);

const apiRef: { current: ReturnType<typeof usePlayerQueue> | null } = { current: null };
const currentTrackRef: { current: Track | null } = { current: null };

function Harness({ initial }: { initial: Track }) {
  const [currentTrack, setCurrentTrack] = useState<Track>(initial);
  currentTrackRef.current = currentTrack;
  const fadeRef = useRef(true);
  const api = usePlayerQueue({
    currentTrack,
    setCurrentTrack,
    myTracks: EMPTY_MY_TRACKS,
    resolveUrl,
    registerPlay,
    likedIds: EMPTY_LIKED,
    followed: EMPTY_FOLLOWED,
    fadeRef,
  });
  apiRef.current = api;
  return null;
}

let container: HTMLDivElement;
let root: Root;

function mount(initial: Track) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(Harness, { initial }));
  });
}

beforeEach(() => {
  // step()/playWave() пишут историю (pushHistory) в настоящий jsdom-localStorage —
  // без очистки она текла бы между тестами и влияла на выбор smartNext в guard'е
  localStorage.clear();
  fakeAudioApi.playing = false;
  fakeAudioApi.progress = 0;
  fakeAudioApi.duration = 0;
  fakeAudioApi.volume = 1;
  fakeAudioApi.load = vi.fn();
  fakeAudioApi.toggle = vi.fn();
  fakeAudioApi.pause = vi.fn();
  fakeAudioApi.seek = vi.fn();
  fakeAudioApi.setVolume = vi.fn();
  fakeAudioApi.setQuality = vi.fn();
  onEndedBox.current = () => {};
  registerPlayMock = vi.fn<(tr: Track) => void>();
  apiRef.current = null;
  currentTrackRef.current = null;
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  vi.restoreAllMocks(); // снимает spy с Math.random между тестами
});

describe("usePlayerQueue: handleNext/handlePrev по каталогу", () => {
  it("handleNext от последнего трека каталога переходит на первый ((idx+1) % length)", () => {
    const last = TRACKS[TRACKS.length - 1];
    mount(last);

    act(() => { apiRef.current!.handleNext(); });

    expect(currentTrackRef.current!.id).toBe(TRACKS[0].id);
  });

  it("handlePrev от первого трека каталога переходит на последний ((idx-1+length) % length)", () => {
    const first = TRACKS[0];
    mount(first);

    act(() => { apiRef.current!.handlePrev(); });

    expect(currentTrackRef.current!.id).toBe(TRACKS[TRACKS.length - 1].id);
  });
});

describe("usePlayerQueue: shuffle", () => {
  // Math.random застаблен → shuffle-выбор детерминирован, и можно ассертить
  // КОНКРЕТНЫЙ id. Guard-ассерты подтверждают, что ожидание отличается от
  // результата последовательной ветки ((idx+1)%len) — иначе тест не отличал бы
  // работающий shuffle от сломанного (если shuffleRef перестанет обновляться,
  // step() молча уйдёт в последовательный перебор, и «мягкие» проверки вроде
  // «другой трек из очереди» останутся зелёными).
  it("при включённом shuffle handleNext детерминированно берёт pool[floor(random*len)], а не следующий по порядку", () => {
    const R = 0.5;
    vi.spyOn(Math, "random").mockReturnValue(R);
    mount(TRACKS[0]);
    act(() => { apiRef.current!.setShuffle(true); });

    // Переход 1: ожидание зеркалит формулу shuffle-ветки на реальном TRACKS,
    // guard же гарантирует, что оно НЕ совпадает с последовательной веткой —
    // т.е. ассерт ниже действительно различает эти две ветки.
    const prev1 = currentTrackRef.current!;
    const pool1 = TRACKS.filter(tr => tr.id !== prev1.id);
    const expected1 = pool1[Math.floor(R * pool1.length)];
    const seq1 = TRACKS[(TRACKS.findIndex(tr => tr.id === prev1.id) + 1) % TRACKS.length];
    expect(expected1.id).not.toBe(seq1.id); // guard: shuffle ≠ последовательный next

    act(() => { apiRef.current!.handleNext(); });
    expect(currentTrackRef.current!.id).toBe(expected1.id);
    expect(fakeAudioApi.load).toHaveBeenLastCalledWith(resolveUrl(expected1));

    // Переход 2 ловит потерю фильтра pool: при prev=expected1 тот же индекс
    // floor(R*len) по НЕсфильтрованной очереди попал бы ровно на prev (guard),
    // так что совпадение с expected2 возможно только через pool без prev.
    const prev2 = currentTrackRef.current!;
    const pool2 = TRACKS.filter(tr => tr.id !== prev2.id);
    const expected2 = pool2[Math.floor(R * pool2.length)];
    const unfiltered2 = TRACKS[Math.floor(R * TRACKS.length)];
    expect(unfiltered2.id).toBe(prev2.id); // guard: несфильтрованный выбор == prev
    const seq2 = TRACKS[(TRACKS.findIndex(tr => tr.id === prev2.id) + 1) % TRACKS.length];
    expect(expected2.id).not.toBe(seq2.id); // guard: и здесь shuffle ≠ последовательный

    act(() => { apiRef.current!.handleNext(); });
    expect(currentTrackRef.current!.id).toBe(expected2.id);
    expect(fakeAudioApi.load).toHaveBeenLastCalledWith(resolveUrl(expected2));
  });

  it("при включённом shuffle handleNext даёт реальный трек из очереди и никогда не повторяет предыдущий", () => {
    mount(TRACKS[0]);
    act(() => { apiRef.current!.setShuffle(true); });

    const seenIds = new Set<number>();
    let prevId = currentTrackRef.current!.id;

    for (let i = 0; i < 20; i++) {
      act(() => { apiRef.current!.handleNext(); });
      const nowId = currentTrackRef.current!.id;

      expect(TRACKS.some(tr => tr.id === nowId)).toBe(true); // реальный трек из очереди, не выдуманный
      expect(nowId).not.toBe(prevId); // pool = q.filter(tr => tr.id !== prev.id) — никогда не тот же трек

      seenIds.add(nowId);
      prevId = nowId;
    }

    // Проверка, что результат не залип на одном и том же id 20 раз подряд случайно
    expect(seenIds.size).toBeGreaterThan(1);
  });
});

describe("usePlayerQueue: audio.load / registerPlay при переходах", () => {
  it("handleNext вызывает audio.load с URL нового трека (resolveUrl) и registerPlay с новым треком", () => {
    mount(TRACKS[0]);

    act(() => { apiRef.current!.handleNext(); });

    const expected = TRACKS[1];
    expect(fakeAudioApi.load).toHaveBeenCalledWith(resolveUrl(expected));
    expect(registerPlayMock).toHaveBeenCalledWith(expect.objectContaining({ id: expected.id }));
  });

  it("handlePrev вызывает audio.load с URL нового трека (resolveUrl) и registerPlay с новым треком", () => {
    mount(TRACKS[0]);

    act(() => { apiRef.current!.handlePrev(); });

    const expected = TRACKS[TRACKS.length - 1];
    expect(fakeAudioApi.load).toHaveBeenCalledWith(resolveUrl(expected));
    expect(registerPlayMock).toHaveBeenCalledWith(expect.objectContaining({ id: expected.id }));
  });
});

describe("usePlayerQueue: автопереход при 'ended'", () => {
  it("repeat=true — load вызывается с URL текущего (не следующего) трека, трек не меняется", () => {
    const current = TRACKS[2];
    mount(current);
    act(() => { apiRef.current!.setRepeat(true); });
    (fakeAudioApi.load as Mock<(...args: unknown[]) => void>).mockClear();

    act(() => { onEndedBox.current(); }); // симулируем "трек доигран"

    expect(fakeAudioApi.load).toHaveBeenCalledWith(resolveUrl(current));
    expect(currentTrackRef.current!.id).toBe(current.id);
  });

  it("shuffle=true и repeat=false — детерминированный shuffle-next, а не волна (smartNext)", () => {
    mount(TRACKS[0]);
    act(() => { apiRef.current!.setShuffle(true); });

    const prev = currentTrackRef.current!;
    const pool = TRACKS.filter(tr => tr.id !== prev.id);
    // Сломанный shuffle увёл бы onEnded либо в последовательный step (если бы
    // сломался сам ref), либо в playWave(true) → smartNext. Выбираем ожидаемый
    // индекс pool так, чтобы он отличался от ОБОИХ альтернативных исходов —
    // тогда ассерт ниже однозначно различает ветки. Индекс подбирается
    // динамически, а не захардкожен: выбор smartNext зависит от дня
    // (stableNoise) и истории, и фиксированный R флакал бы по датам.
    const seq = TRACKS[(TRACKS.findIndex(tr => tr.id === prev.id) + 1) % TRACKS.length];
    const waveWouldPick = smartNext(TRACKS, EMPTY_LIKED, EMPTY_FOLLOWED, prev.id, "ru").track;
    const idx = pool.findIndex(tr => tr.id !== seq.id && tr.id !== waveWouldPick.id);
    expect(idx).toBeGreaterThanOrEqual(0); // pool из 7 треков минус максимум 2 исключения — всегда найдётся
    const expected = pool[idx];
    // floor(((idx + 0.5) / len) * len) === idx — random смотрит ровно в выбранный слот
    vi.spyOn(Math, "random").mockReturnValue((idx + 0.5) / pool.length);

    act(() => { onEndedBox.current(); }); // симулируем "трек доигран"

    expect(currentTrackRef.current!.id).toBe(expected.id);
    expect(fakeAudioApi.load).toHaveBeenCalledWith(resolveUrl(expected));
  });
});
