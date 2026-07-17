import { useState, useEffect, useCallback, useRef } from "react";
import { ls } from "./data";
import { supabaseEnabled, setSubscriptionStatus, fetchSubscriptionStatus } from "./supabase";
import type { UserRole } from "./auth";

export type CpStatus = "none" | "active" | "grace";

// Подписка MYRA Pro/Plus целиком: none → active → grace (отменена, но
// действует до конца периода). RLS специально не даёт клиенту самому
// ставить 'active' напрямую — это делает только Edge Function
// set-subscription (см. supabase.ts), клиент лишь читает и просит.
//
// userRole принимается параметром, а не читается отсюда: роль (артист/
// слушатель) — часть identity-кластера в App.tsx, ещё не вынесенного;
// здесь она нужна только чтобы понять, какой апгрейд (Pro или Plus)
// считать "своим".
export function useSubscription(params: { userRole: UserRole; uid: string | null; onboarded: boolean; logActivity: (key: string, ...args: (string | number)[]) => void }) {
  const { userRole, uid, onboarded, logActivity } = params;
  const uidRef = useRef(uid);
  uidRef.current = uid;

  const [cpStatus, setCpStatus] = useState<CpStatus>(() => {
    const raw = ls.get<CpStatus | boolean>("cpStatus", ls.get("creatorPlus", false) ? "active" : "none");
    return raw === true ? "active" : raw === false ? "none" : raw;
  });
  const setCp = useCallback((s: CpStatus) => {
    setCpStatus(s);
    ls.set("cpStatus", s);
    if (supabaseEnabled && uidRef.current) setSubscriptionStatus(s).catch(err => console.warn("setSubscriptionStatus:", err));
  }, []);
  const creatorPlus = cpStatus !== "none";

  // MYRA Plus — бесплатный план слушателя (Pro оставлен артистам)
  const [plusActive, setPlusActiveState] = useState(() => ls.get("plusActive", false));
  const setPlusActive = useCallback((v: boolean) => {
    setPlusActiveState(v);
    ls.set("plusActive", v);
    if (supabaseEnabled && uidRef.current) setSubscriptionStatus(v ? "active" : "none").catch(err => console.warn("setSubscriptionStatus:", err));
  }, []);

  // Единая проверка апгрейда своей роли — Pro для артиста, Plus для слушателя.
  // На неё завязаны реальные ограничения бесплатного тарифа (качество, офлайн-лимит),
  // а не только бейджи и текст — иначе Free и Pro/Plus не отличались бы ничем, кроме подписи
  const hasUpgrade = userRole === "artist" ? creatorPlus : plusActive;
  // Апгрейд любого типа (в т.ч. Pro в grace) — используется App.tsx для гейта неоновой темы
  const hasAnyUpgrade = plusActive || cpStatus === "active" || cpStatus === "grace";

  const activateCreatorPlus = useCallback(() => { setCp("active"); logActivity("act.cpActivated"); }, [logActivity]);
  const cancelCreatorPlusSub = useCallback(() => { setCp("grace"); logActivity("act.cpCancelled"); }, [logActivity]);
  const resumeCreatorPlus = useCallback(() => { setCp("active"); logActivity("act.cpResumed"); }, [logActivity]);
  const activatePlus = useCallback(() => { setPlusActive(true); logActivity("act.plusActivated"); }, [logActivity]);
  const deactivatePlus = useCallback(() => { setPlusActive(false); }, []);

  // Статус Pro/Plus — правда живёт на сервере (см. Edge Function set-subscription);
  // подтягиваем один раз, когда есть и сессия, и завершённый онбординг, чтобы
  // подписка была видна с любого устройства, а не только с того, где её оформили
  useEffect(() => {
    if (!supabaseEnabled || !uid || !onboarded) return;
    fetchSubscriptionStatus(uid).then(status => {
      if (status === null) return;
      if (userRole === "artist") { setCpStatus(status); ls.set("cpStatus", status); }
      else { const active = status === "active"; setPlusActiveState(active); ls.set("plusActive", active); }
    });
  }, [uid, onboarded, userRole]);

  // Логаут: новый аккаунт на этом устройстве не наследует чужую подписку
  const clearSubscription = useCallback(() => {
    setCpStatus("none");
    setPlusActiveState(false);
  }, []);

  return {
    cpStatus, creatorPlus, plusActive, hasUpgrade, hasAnyUpgrade,
    setCp, setPlusActive,
    activateCreatorPlus, cancelCreatorPlusSub, resumeCreatorPlus, activatePlus, deactivatePlus,
    clearSubscription,
  };
}
