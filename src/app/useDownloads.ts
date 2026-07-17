import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { saveDownload, loadDownloads, deleteDownload } from "./idb";
import { useLang } from "./i18n";
import type { Track } from "./data";

// Без MYRA Pro/Plus офлайн-загрузки ограничены — иначе "безлимит" на апгрейде
// ничем не отличался бы от того, что и так доступно всем
const FREE_DOWNLOAD_LIMIT = 20;

// Скачанные для офлайна треки каталога (IndexedDB). resolveUrl используется
// по всей логике плеера (playTrack/step/playWave/playRadio/автопереход) —
// скачанный офлайн-файл важнее стрима.
export function useDownloads(params: {
  hasUpgrade: boolean;
  logActivity: (key: string, ...args: (string | number)[]) => void;
}) {
  const { hasUpgrade, logActivity } = params;
  const { t } = useLang();
  const [downloads, setDownloads] = useState<Map<number, string>>(new Map());
  const downloadsRef = useRef(downloads);
  downloadsRef.current = downloads;

  useEffect(() => {
    loadDownloads().then(recs => {
      if (recs.length) setDownloads(new Map(recs.map(r => [r.id, URL.createObjectURL(r.blob)])));
    });
  }, []);

  const resolveUrl = useCallback((tr: Track) => downloadsRef.current.get(tr.id) ?? tr.url, []);

  const downloadTrack = useCallback(async (tr: Track) => {
    if (downloadsRef.current.has(tr.id)) {
      const url = downloadsRef.current.get(tr.id)!;
      URL.revokeObjectURL(url);
      setDownloads(prev => { const m = new Map(prev); m.delete(tr.id); return m; });
      deleteDownload(tr.id).catch(() => {});
      toast(t("dl.removed"));
      return;
    }
    if (!hasUpgrade && downloadsRef.current.size >= FREE_DOWNLOAD_LIMIT) {
      toast(t("dl.limitReached", FREE_DOWNLOAD_LIMIT));
      return;
    }
    toast(t("dl.loading", tr.title));
    try {
      const res = await fetch(tr.url);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      await saveDownload(tr.id, blob).catch(() => {});
      setDownloads(prev => new Map(prev).set(tr.id, URL.createObjectURL(blob)));
      toast.success(t("dl.done", tr.title));
      logActivity("dl.done", tr.title);
    } catch {
      toast(t("dl.fail"));
    }
  }, [t, logActivity, hasUpgrade]);

  // Логаут: снимаем все blob-URL из памяти и чистим IndexedDB — новый аккаунт
  // на этом устройстве не должен унаследовать чужие офлайн-файлы
  const clearDownloads = useCallback(() => {
    downloadsRef.current.forEach((url, id) => {
      URL.revokeObjectURL(url);
      deleteDownload(id).catch(() => {});
    });
    setDownloads(new Map());
  }, []);

  return { downloads, resolveUrl, downloadTrack, clearDownloads };
}
