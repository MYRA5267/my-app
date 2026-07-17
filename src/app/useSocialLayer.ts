import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { supabaseEnabled, fetchFollowingIds, followUser, unfollowUser, fetchFriendsFeed, type PublicProfile, type FriendFeedItem } from "./supabase";
import { useLang } from "./i18n";

// Соцслой: реальные подписки между аккаунтами (не путать с локальным
// toggleFollow в App.tsx — тем, что работает только с 8 демо-артистами
// каталога через localStorage). Всё, что касается реальных людей: кого я
// читаю, лента их релизов, открытый чужой профиль, поиск людей.
export function useSocialLayer(uid: string | null) {
  const { t } = useLang();
  // Ref, а не просто параметр uid в замыкании: toggleRealFollow не должен
  // пересоздаваться при каждой смене uid — только при смене followingIds/t,
  // как и было устроено до выноса
  const uidRef = useRef(uid);
  uidRef.current = uid;

  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const followingSet = useMemo(() => new Set(followingIds), [followingIds]);
  const [friendsFeed, setFriendsFeed] = useState<FriendFeedItem[]>([]);
  const [realProfile, setRealProfile] = useState<PublicProfile | null>(null);
  const [peopleSearchOpen, setPeopleSearchOpen] = useState(false);

  // Подтягиваем список реальных подписок один раз, когда есть сессия
  // (аналогично статусу подписки Pro/Plus в App.tsx)
  useEffect(() => {
    if (!supabaseEnabled || !uid) { setFollowingIds([]); return; }
    fetchFollowingIds(uid).then(setFollowingIds);
  }, [uid]);

  // Лента подписок — недавние реальные релизы людей, на которых подписан
  // пользователь; перезагружается при каждом изменении списка подписок
  useEffect(() => {
    if (!supabaseEnabled || !followingIds.length) { setFriendsFeed([]); return; }
    fetchFriendsFeed(followingIds).then(setFriendsFeed);
  }, [followingIds]);

  // Реальная подписка/отписка между аккаунтами — обновление оптимистичное:
  // если сервер откажет, откатываем список обратно и сообщаем об этом
  const toggleRealFollow = useCallback(async (targetId: string) => {
    const myId = uidRef.current;
    if (!myId) return;
    const isFollowing = followingIds.includes(targetId);
    setFollowingIds(prev => (isFollowing ? prev.filter(id => id !== targetId) : [...prev, targetId]));
    const { error } = isFollowing ? await unfollowUser(myId, targetId) : await followUser(myId, targetId);
    if (error) {
      setFollowingIds(prev => (isFollowing ? [...prev, targetId] : prev.filter(id => id !== targetId)));
      toast.error(t("soc.followError"));
      return;
    }
    toast(isFollowing ? t("soc.unfollowedToast") : t("soc.followedToast"));
  }, [followingIds, t]);

  const openPeopleSearch = useCallback(() => setPeopleSearchOpen(true), []);

  // Логаут: подписки предыдущего аккаунта на этом устройстве не должны
  // всплыть у следующего, вошедшего на нём же
  const clearSocial = useCallback(() => {
    setFollowingIds([]);
    setFriendsFeed([]);
    setRealProfile(null);
    setPeopleSearchOpen(false);
  }, []);

  return {
    followingSet, friendsFeed, realProfile, setRealProfile,
    peopleSearchOpen, setPeopleSearchOpen, openPeopleSearch,
    toggleRealFollow, clearSocial,
  };
}
