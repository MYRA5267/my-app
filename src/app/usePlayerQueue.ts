import { useState, useEffect, useCallback, useMemo, useRef, type MutableRefObject } from "react";
import { toast } from "sonner";
import { TRACKS, type Track } from "./data";
import { useAudio } from "./lib";
import { smartNext, pushHistory } from "./smart";
import { useLang } from "./i18n";

// Очередь и воспроизведение: единственное место, которое реально трогает
// живой <audio> (через useAudio) — playTrack/togglePlay/step/playWave/
// playRadio и автопереход при ended.
//
// currentTrack намеренно НЕ живёт в этом хуке: его пишет ещё и
// handlePublishedRemote в App.tsx, который передаётся параметром В
// useLocalTracks, а useLocalTracks, в свою очередь, отдаёт myTracks —
// один из входов очереди здесь. Если бы currentTrack принадлежал этому
// хуку, получился бы цикл вызовов между ним и useLocalTracks; вместо
// этого currentTrack остаётся состоянием AppInner и приходит сюда
// параметром, как uid/userRole для useSubscription
export function usePlayerQueue(params: {
  currentTrack: Track;
  setCurrentTrack: (updater: Track | ((prev: Track) => Track)) => void;
  myTracks: Track[];
  resolveUrl: (tr: Track) => string;
  registerPlay: (tr: Track) => void;
  likedIds: Set<number>;
  followed: Set<string>;
  fadeRef: MutableRefObject<boolean>;
}) {
  const { currentTrack, setCurrentTrack, myTracks, resolveUrl, registerPlay, likedIds, followed, fadeRef } = params;
  const { t, lang } = useLang();

  const loadedRef = useRef(false);
  const currentTrackRef = useRef(currentTrack);
  currentTrackRef.current = currentTrack;
  const nextRef = useRef<() => void>(() => {});
  const audio = useAudio(() => nextRef.current(), () => fadeRef.current);

  const playTrack = useCallback((tr: Track) => {
    if (currentTrackRef.current.id === tr.id && loadedRef.current) {
      audio.toggle();
      return;
    }
    // play() должен происходить прямо в обработчике клика, иначе браузер
    // теряет user activation и может заблокировать звук.
    loadedRef.current = true;
    currentTrackRef.current = tr;
    setCurrentTrack(tr);
    audio.load(resolveUrl(tr));
    pushHistory(tr.id);
    registerPlay(tr);
  }, [audio, resolveUrl, registerPlay, setCurrentTrack]);

  const togglePlay = useCallback(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      audio.load(resolveUrl(currentTrack));
      pushHistory(currentTrack.id);
      // Первый запуск через кнопку play — такое же прослушивание, как тап по
      // треку: без registerPlay терялись статистика и ачивка «Первые ноты»
      registerPlay(currentTrack);
    } else {
      audio.toggle();
    }
  }, [audio, currentTrack, resolveUrl, registerPlay]);

  // Очередь = локальные файлы + каталог — пересобираем, только когда реально меняются свои треки
  const queue = useMemo(() => (myTracks.length ? [...myTracks, ...TRACKS] : TRACKS), [myTracks]);
  const queueRef = useRef<Track[]>(queue);
  queueRef.current = queue;

  // Перемешивание и повтор — настоящие, а не декоративные тумблеры: shuffle
  // меняет и ручной next, и автопереход; repeat заново запускает текущий трек
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const shuffleRef = useRef(shuffle); shuffleRef.current = shuffle;
  const repeatRef = useRef(repeat); repeatRef.current = repeat;

  const step = useCallback((dir: 1 | -1) => {
    const prev = currentTrackRef.current;
    const q = queueRef.current;
    let next: Track;
    if (shuffleRef.current && q.length > 1) {
      const pool = q.filter(tr => tr.id !== prev.id);
      next = pool[Math.floor(Math.random() * pool.length)];
    } else {
      const idx = q.findIndex(tr => tr.id === prev.id);
      next = q[(idx + dir + q.length) % q.length] ?? q[0];
    }
    loadedRef.current = true;
    currentTrackRef.current = next;
    setCurrentTrack(next);
    audio.load(resolveUrl(next));
    pushHistory(next.id);
    registerPlay(next);
  }, [audio, resolveUrl, registerPlay, setCurrentTrack]);

  const handleNext = useCallback(() => step(1), [step]);
  const handlePrev = useCallback(() => step(-1), [step]);

  // «Прилив» (личный поток): умный подбор без повторов + причина выбора
  const likedRef = useRef(likedIds); likedRef.current = likedIds;
  const followedRef = useRef(followed); followedRef.current = followed;
  const langRef = useRef(lang); langRef.current = lang;
  const playWave = useCallback((silent = false) => {
    const { track, reason } = smartNext(queueRef.current, likedRef.current, followedRef.current, currentTrackRef.current.id, langRef.current);
    loadedRef.current = true;
    currentTrackRef.current = track;
    setCurrentTrack(track);
    audio.load(resolveUrl(track));
    pushHistory(track.id);
    registerPlay(track);
    if (!silent) toast(`MYRA AI · ${track.title} — ${reason}`);
  }, [audio, resolveUrl, registerPlay, setCurrentTrack]);

  // «Течение» — радио от текущего трека: случайный трек того же жанра.
  // Раньше кнопка молча дублировала «Прилив», хотя называлась иначе
  const playRadio = useCallback(() => {
    const prev = currentTrackRef.current;
    const sameGenre = queueRef.current.filter(tr => tr.genre === prev.genre && tr.id !== prev.id);
    const pool = sameGenre.length ? sameGenre : queueRef.current.filter(tr => tr.id !== prev.id);
    if (!pool.length) return;
    const next = pool[Math.floor(Math.random() * pool.length)];
    loadedRef.current = true;
    currentTrackRef.current = next;
    setCurrentTrack(next);
    audio.load(resolveUrl(next));
    pushHistory(next.id);
    registerPlay(next);
    toast(t("home.radioToast", next.title, next.artist));
  }, [audio, resolveUrl, registerPlay, setCurrentTrack, t]);

  // Стабильная обёртка: playWave пересоздаётся при смене зависимостей, а
  // мемоизации HomeScreen нужен неизменный проп — иначе React.memo бесполезен
  const playWaveRef = useRef<() => void>(() => {});
  const startWave = useCallback(() => playWaveRef.current(), []);

  // Автопереход: повтор → тот же трек заново, перемешивание → случайный,
  // иначе умная волна без повторов. Ручной next — по очереди (или случайно)
  useEffect(() => {
    nextRef.current = () => {
      if (repeatRef.current) {
        // после ended элемент на паузе — заново load запускает воспроизведение
        const track = currentTrackRef.current;
        audio.load(resolveUrl(track));
        registerPlay(track);
        return;
      }
      if (shuffleRef.current) { step(1); return; }
      playWave(true);
    };
    playWaveRef.current = () => playWave();
  }, [playWave, step, audio, resolveUrl, registerPlay]);

  return {
    audio, queue, shuffle, setShuffle, repeat, setRepeat,
    playTrack, togglePlay, handleNext, handlePrev, playRadio, startWave,
  };
}
