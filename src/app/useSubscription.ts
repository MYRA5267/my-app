import { useState, useEffect, useCallback, useRef } from "react";
import { ls } from "./data";
import { supabaseEnabled, setSubscriptionStatus, fetchSubscriptionStatus } from "./supabase";
import type { UserRole } from "./auth";

export type CpStatus = "none" | "active" | "grace";

// Подписка MYRA Pro для студии: none → active → grace (отменена, но
// действует до конца периода). RLS специально не даёт клиенту самому
// ставить 'active' напрямую — это делает только Edge Function
// set-subscription (см. supabase.ts), клиент лишь читает и просит.
//
// userRole принимается параметром, а не читается отсюда: роль (артист/
// слушатель) — часть identity-кластера в App.tsx, ещё не вынесенного;
// здесь она нужна, чтобы не синхронизировать студийный тариф слушателю.
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
    // active/grace задаёт только подтверждённый платёжный webhook. Прямой
    // клиентский вызов разрешён лишь для полного отключения подписки.
    if (s === "none" && supabaseEnabled && uidRef.current) {
      setSubscriptionStatus(s).catch(err => console.warn("setSubscriptionStatus:", err));
    }
  }, []);
  const creatorPlus = cpStatus !== "none";

  const activateCreatorPlus = useCallback(() => { setCp("active"); logActivity("act.cpActivated"); }, [logActivity]);
  const cancelCreatorPlusSub = useCallback(() => { setCp("none"); logActivity("act.cpCancelled"); }, [logActivity]);
  const resumeCreatorPlus = useCallback(() => { setCp("active"); logActivity("act.cpResumed"); }, [logActivity]);

  // Статус Pro — правда живёт на сервере (см. Edge Function set-subscription);
  // подтягиваем один раз, когда есть и сессия, и завершённый онбординг, чтобы
  // подписка была видна с любого устройства, а не только с того, где её оформили
  useEffect(() => {
    if (!supabaseEnabled || !uid || !onboarded || userRole !== "artist") return;
    fetchSubscriptionStatus(uid).then(status => {
      if (status === null) return;
      setCpStatus(status);
      ls.set("cpStatus", status);
    });
  }, [uid, onboarded, userRole]);

  // Логаут: новый аккаунт на этом устройстве не наследует чужую подписку
  const clearSubscription = useCallback(() => {
    setCpStatus("none");
  }, []);

  return {
    cpStatus, creatorPlus, setCp,
    activateCreatorPlus, cancelCreatorPlusSub, resumeCreatorPlus,
    clearSubscription,
  };
}
