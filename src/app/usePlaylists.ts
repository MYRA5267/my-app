import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { ls, svgCover, PLAYLISTS, type Playlist } from "./data";
import { useLang } from "./i18n";
import { track } from "./analytics";

// Свои плейлисты: создание/удаление/переименование состава, порядок треков
// внутри плейлиста и то, какой плейлист сейчас открыт шторкой — всё вместе,
// это одна замкнутая подсистема, ничего из неё не читает плеер/подписки/соцслой.
export function usePlaylists(logActivity: (key: string, ...args: (string | number)[]) => void) {
  const { t } = useLang();
  const [customPls, setCustomPls] = useState<Playlist[]>(() => ls.get<Playlist[]>("customPls", []));
  const [plOrders, setPlOrders] = useState<Record<string, number[]>>(() => ls.get("plOrders", {}));
  const [playlistId, setPlaylistId] = useState<string | null>(null);

  const allPlaylists = useMemo(() => [...customPls, ...PLAYLISTS], [customPls]);
  const customPlIds = useMemo(() => new Set(customPls.map(p => p.id)), [customPls]);
  const plOrder = playlistId
    ? (plOrders[playlistId] ?? allPlaylists.find(p => p.id === playlistId)?.trackIds ?? [])
    : [];

  const createPlaylist = useCallback((name: string, trackIds: number[]) => {
    const pl: Playlist = { id: "u" + Date.now(), name, img: svgCover("#12083a", "#8b5cf6", Date.now() % 97), trackIds };
    setCustomPls(prev => { const next = [pl, ...prev]; ls.set("customPls", next); return next; });
    logActivity("act.plCreated", name);
    track({ name: "playlist_create" });
    return pl;
  }, [logActivity]);

  const deletePlaylist = useCallback((id: string) => {
    setCustomPls(prev => {
      const pl = prev.find(p => p.id === id);
      const next = prev.filter(p => p.id !== id);
      ls.set("customPls", next);
      if (pl) logActivity("act.plDeleted", pl.name);
      return next;
    });
    setPlaylistId(cur => (cur === id ? null : cur));
    // Порядок треков удалённого плейлиста больше не нужен — иначе ключи
    // копились бы в myra.plOrders бесконечно
    setPlOrders(prev => {
      if (!(id in prev)) return prev;
      const { [id]: _gone, ...rest } = prev;
      ls.set("plOrders", rest);
      return rest;
    });
    toast(t("lib.plDeleted"));
  }, [t, logActivity]);

  const handleCreatePlaylist = useCallback((name: string) => { createPlaylist(name, []); }, [createPlaylist]);

  const reorderPlaylist = useCallback((ids: number[]) => {
    if (!playlistId) return;
    setPlOrders(prev => {
      const next = { ...prev, [playlistId]: ids };
      ls.set("plOrders", next);
      return next;
    });
  }, [playlistId]);

  // Логаут: свои плейлисты — тоже данные текущего аккаунта на этом устройстве
  const clearPlaylists = useCallback(() => {
    setCustomPls([]);
    setPlOrders({});
  }, []);

  return {
    customPls, playlistId, setPlaylistId,
    allPlaylists, customPlIds, plOrder,
    createPlaylist, deletePlaylist, handleCreatePlaylist, reorderPlaylist,
    clearPlaylists,
  };
}
