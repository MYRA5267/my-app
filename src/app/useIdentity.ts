import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { ls } from "./data";
import { deriveHandle } from "./lib";
import { supabaseEnabled, getSession, onAuthStateChange, fetchProfile, upsertProfile } from "./supabase";
import { useLang } from "./i18n";
import type { UserRole } from "./auth";

// Identity/сессия: кто вошёл (имя, email, хэндл, аватар, роль) и сама
// сессия Supabase (uid). Самый связанный кластер после подписки — от
// userRole и uid здесь зависят useSocialLayer/useLocalTracks/useSubscription,
// поэтому этот хук должен вызываться в AppInner раньше них.
export function useIdentity() {
  const { t } = useLang();

  const devPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).has("preview");
  const [onboarded, setOnboarded] = useState(() => devPreview || ls.get("onboarded", false));
  const [userName, setUserName] = useState(() => ls.get("userName", "Алекс"));
  const [email, setEmailState] = useState(() => ls.get("email", ""));
  const setEmail = useCallback((next: string) => { setEmailState(next); ls.set("email", next); }, []);
  // Хендл: если пользователь не задавал свой — показываем автосгенерированный из имени
  const [customHandle, setCustomHandleState] = useState<string | null>(() => ls.get<string | null>("customHandle", null));
  const setCustomHandle = useCallback((next: string | null) => { setCustomHandleState(next); ls.set("customHandle", next); }, []);
  const handle = customHandle ?? deriveHandle(userName);
  const setHandle = useCallback(async (h: string) => {
    setCustomHandle(h);
    if (supabaseEnabled) {
      const session = await getSession();
      const uid = session?.user?.id;
      if (uid) {
        try { await upsertProfile(uid, { handle: h }); } catch (err) { console.warn("upsertProfile handle:", err); }
      }
    }
  }, [setCustomHandle]);
  const [avatarIdx, setAvatarIdx] = useState(() => ls.get("avatarIdx", 0));
  const [customAvatar, setCustomAvatar] = useState<string | null>(() => ls.get<string | null>("customAvatar", null));

  const [userRole, setUserRole] = useState<UserRole>(() => ls.get<UserRole>("userRole", "listener"));
  const setRole = useCallback((r: UserRole) => { setUserRole(r); ls.set("userRole", r); }, []);

  // uid текущей сессии Supabase — нужен, чтобы донаты и статус подписки
  // писались на сервер, а не только в localStorage этого устройства
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    if (!supabaseEnabled) return;
    getSession().then(s => setUid(s?.user?.id ?? null));
    const { data } = onAuthStateChange(s => setUid(s?.user?.id ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  // Уже зарегистрирован на Supabase, но локально флаг онбординга не стоит —
  // это либо (а) только что подтвердил почту по ссылке из письма и вернулся
  // на этот же адрес (тогда доводим до конца профиль, отложенный в finishRole),
  // либо (б) другое устройство/очищенный localStorage — просто подтягиваем профиль
  useEffect(() => {
    if (!supabaseEnabled) return;
    (async () => {
      const session = await getSession();
      const uid = session?.user?.id;
      if (!uid || ls.get("onboarded", false)) return;

      const pending = ls.get<{ name: string; role: UserRole; email: string } | null>("pendingProfile", null);
      if (pending) {
        try {
          const { error } = await upsertProfile(uid, { username: pending.name, role: pending.role, email: pending.email });
          if (error) console.warn("upsertProfile:", error.message);
        } catch (err) {
          console.warn("upsertProfile:", err);
        }
        ls.set("pendingProfile", null);
        setUserName(pending.name);
        ls.set("userName", pending.name);
        setEmail(pending.email);
        setUserRole(pending.role);
        ls.set("userRole", pending.role);
        ls.set("onboarded", true);
        setOnboarded(true);
        toast.success(t("au.emailConfirmed"));
        return;
      }

      const { data: profile } = await fetchProfile(uid);
      if (!profile) return;
      setUserName(profile.username);
      ls.set("userName", profile.username);
      setEmail(profile.email ?? "");
      if (profile.handle) setCustomHandle(profile.handle);
      if (profile.role === "artist" || profile.role === "listener") {
        setUserRole(profile.role);
        ls.set("userRole", profile.role);
      }
      ls.set("onboarded", true);
      setOnboarded(true);
    })();
  }, [setEmail, t]);

  // Тост здесь не нужен: каждый путь онбординга (регистрация, вход, соцсети)
  // уже показывает свой — раньше «Аккаунт создан» дублировался и вылезал даже при входе
  const finishOnboarding = useCallback((name: string, role: UserRole, enteredEmail: string, handle?: string | null) => {
    setUserName(name);
    ls.set("userName", name);
    setUserRole(role);
    ls.set("userRole", role);
    setEmail(enteredEmail);
    // При входе в существующий аккаунт приходит серверный хендл; при регистрации —
    // null, чтобы не унаследовать кастомный хендл предыдущего владельца устройства
    setCustomHandle(handle ?? null);
    ls.set("onboarded", true);
    setOnboarded(true);
  }, [setEmail, setCustomHandle]);

  // Логаут: новый аккаунт на этом устройстве не наследует чужую личность.
  // uid сюда намеренно не входит — его гасит сама Supabase-сессия (signOutRemote
  // в AppInner), и uid обнулится через onAuthStateChange выше
  const clearIdentity = useCallback(() => {
    setOnboarded(false);
    setUserRole("listener");
    setCustomAvatar(null);
    setAvatarIdx(0);
    setCustomHandleState(null);
    setEmailState("");
  }, []);

  return {
    onboarded,
    userName, setUserName,
    email, setEmail,
    handle, setHandle,
    avatarIdx, setAvatarIdx,
    customAvatar, setCustomAvatar,
    userRole, setRole,
    uid,
    finishOnboarding, clearIdentity,
  };
}
