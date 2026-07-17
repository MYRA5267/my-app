import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { svgCover, LOCAL_PALETTE, type Track } from "./data";
import { saveLocalTrack, loadLocalTracks, deleteLocalTrack } from "./idb";
import { supabaseEnabled, uploadTrackAudio, insertTrack } from "./supabase";
import { useLang } from "./i18n";

// Собственные аудиофайлы пользователя: локальный импорт в Полке (addFiles) и
// формальная публикация релиза в Студии (startRelease/publishRelease, с
// промежуточной формой названия/жанра/обложки — pendingRelease). Оба пути
// пишут в IndexedDB и сразу играют локально; publishRelease дополнительно
// пытается фоново синхронизировать трек в Supabase, если он настроен и есть сессия.
export function useLocalTracks(params: {
  userName: string;
  uid: string | null;
  logActivity: (key: string, ...args: (string | number)[]) => void;
  // Публикация в фоне может завершиться позже, чем пользователь уже открыл
  // именно этот трек в плеере — вызывающая сторона (App.tsx) сама решает,
  // как обновить currentTrack, если он совпадает по id
  onPublishedRemote: (localId: number, remoteId: string) => void;
}) {
  const { userName, uid, logActivity, onPublishedRemote } = params;
  const { t } = useLang();
  const [myTracks, setMyTracks] = useState<Track[]>([]);

  // Локальные файлы пользователя из IndexedDB
  useEffect(() => {
    loadLocalTracks().then(recs => {
      if (!recs.length) return;
      setMyTracks(recs.map(r => ({
        id: r.id, title: r.title, artist: r.artist, album: "Local", duration: r.duration,
        genre: "Local", plays: "0", liked: false, c1: r.c1, c2: r.c2,
        img: svgCover(r.c1, r.c2, r.id), url: URL.createObjectURL(r.blob), local: true,
      })));
    });
  }, []);

  // Добавление своих аудиофайлов (клик или drag-n-drop)
  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = [...files].filter(f => f.type.startsWith("audio/") || /\.(mp3|wav|flac|m4a|ogg|aac)$/i.test(f.name));
    if (!list.length) return;
    const added: Track[] = [];
    for (const f of list) {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const [c1, c2] = LOCAL_PALETTE[id % LOCAL_PALETTE.length];
      const title = f.name.replace(/\.[^.]+$/, "");
      try { await saveLocalTrack({ id, title, artist: userName, duration: "", c1, c2, blob: f }); } catch { /* без сохранения */ }
      added.push({
        id, title, artist: userName, album: "Local", duration: "", genre: "Local", plays: "0",
        liked: false, c1, c2, img: svgCover(c1, c2, id), url: URL.createObjectURL(f), local: true,
      });
    }
    setMyTracks(prev => [...added, ...prev]);
    toast(t("cr.added", added.length));
    logActivity("cr.added", added.length);
  }, [userName, t, logActivity]);

  // Релиз в Студии: выбор файла не публикует его сразу — сперва форма
  // с названием, жанром, текстом и обложкой, и только потом явный "Опубликовать"
  const [pendingRelease, setPendingRelease] = useState<{ file: File; id: number; c1: string; c2: string; defaultImg: string } | null>(null);

  const startRelease = useCallback((files: FileList | File[]) => {
    const f = [...files].find(f => f.type.startsWith("audio/") || /\.(mp3|wav|flac|m4a|ogg|aac)$/i.test(f.name));
    if (!f) return;
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const [c1, c2] = LOCAL_PALETTE[id % LOCAL_PALETTE.length];
    setPendingRelease({ file: f, id, c1, c2, defaultImg: svgCover(c1, c2, id) });
  }, []);

  const publishRelease = useCallback(async (meta: { title: string; genre: string; lyrics: string; cover: string | null }) => {
    if (!pendingRelease) return;
    const { file, id, c1, c2, defaultImg } = pendingRelease;
    try { await saveLocalTrack({ id, title: meta.title, artist: userName, duration: "", c1, c2, blob: file }); } catch { /* без сохранения */ }
    const track: Track = {
      id, title: meta.title, artist: userName, album: "Local", duration: "", genre: meta.genre, plays: "0",
      liked: false, c1, c2, img: meta.cover ?? defaultImg, url: URL.createObjectURL(file), local: true,
      lyrics: meta.lyrics || undefined,
    };
    setMyTracks(prev => [track, ...prev]);
    setPendingRelease(null);
    toast(t("cr.published", meta.title));
    logActivity("cr.added", 1);

    // Публикация в Supabase — строго в фоне и без ожидания: локальный трек
    // (IndexedDB + myTracks) уже живёт и играет сам по себе, а без сети/логина
    // это так и останется единственной копией — как и было до этой фичи
    if (supabaseEnabled && uid) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
      uploadTrackAudio(uid, String(id), file, ext)
        .then(async ({ url, error: upErr }) => {
          if (upErr || !url) { console.warn("uploadTrackAudio:", upErr); return; }
          const { data, error } = await insertTrack(uid, {
            title: meta.title, genre: meta.genre, lyrics: meta.lyrics || null, cover_url: meta.cover, audio_url: url,
          });
          if (error || !data) { console.warn("insertTrack:", error); return; }
          setMyTracks(prev => prev.map(tr => (tr.id === id ? { ...tr, remoteId: data.id } : tr)));
          onPublishedRemote(id, data.id);
        })
        .catch(err => console.warn("publishRelease sync:", err));
    }
  }, [pendingRelease, userName, t, logActivity, uid, onPublishedRemote]);

  const removeLocal = useCallback((id: number) => {
    setMyTracks(prev => {
      // blob-URL без revoke держит аудиофайл в памяти до перезагрузки страницы
      const gone = prev.find(tr => tr.id === id);
      if (gone?.url.startsWith("blob:")) URL.revokeObjectURL(gone.url);
      return prev.filter(tr => tr.id !== id);
    });
    deleteLocalTrack(id).catch(() => {});
    toast(t("cr.deleted"));
  }, [t]);

  // Логаут: revoke всех blob-URL + очистка IndexedDB, затем сброс до пустого списка
  const clearLocalTracks = useCallback(() => {
    setMyTracks(prev => {
      prev.forEach(tr => {
        if (tr.url.startsWith("blob:")) URL.revokeObjectURL(tr.url);
        deleteLocalTrack(tr.id).catch(() => {});
      });
      return [];
    });
  }, []);

  return { myTracks, addFiles, startRelease, publishRelease, removeLocal, pendingRelease, setPendingRelease, clearLocalTracks };
}
