import { useMemo, useState } from "react";
import { X, Zap, Sparkles, Wallet, Mic2, Headphones, Lock, RotateCcw, Wrench } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { ls } from "./data";
import { F, GLASS, Sheet } from "./lib";
import { useLang } from "./i18n";
import { buildAchievements, type AchievementCounters } from "./achievements";
import type { UserRole } from "./auth";

// ─── Панель разработчика ──────────────────────────────────────────────────────
// Только для создателей MYRA. Активируется семью быстрыми тапами по аватару в
// профиле и позволяет проверять фичи до релиза: выдавать себе XP и уровни,
// переключать роль, включать подписки, пополнять баланс и смотреть скрытые
// достижения. Никакого бэкенда за этим нет — панель крутит те же локальные
// состояния, что и обычные пользовательские действия.

const XP_PRESETS = [500, 2500, 10000];
const BALANCE_PRESETS = [1000, 10000];

export function DevPanelSheet({ open, onClose, level, counters, userRole, onSetRole, cpStatus, onSetCp, plusActive, onSetPlus, balance, onAddBalance, onGrantXp }: {
  open: boolean; onClose: () => void; level: number;
  counters: AchievementCounters;
  userRole: UserRole; onSetRole: (r: UserRole) => void;
  cpStatus: "none" | "active" | "grace"; onSetCp: (s: "none" | "active" | "grace") => void;
  plusActive: boolean; onSetPlus: (v: boolean) => void;
  balance: number; onAddBalance: (amt: number) => void;
  onGrantXp: (xp: number) => void;
}) {
  const { t } = useLang();
  // achVersion — форс-пересчёт после сброса прогресса кнопкой ниже
  const [achVersion, setAchVersion] = useState(0);
  const achievements = useMemo(() => buildAchievements(counters), [counters]);
  const unlocked = useMemo(() => new Set(ls.get<string[]>("achUnlocked", [])), [achievements, achVersion, open]);

  const label = (text: string) => (
    <div className="text-[10px] uppercase tracking-[0.16em] mb-2.5 mt-6" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}>{text}</div>
  );

  const chip = (text: string, on: boolean, act: () => void, c = "#f472b6") => (
    <button key={text} onClick={act} className="px-4 py-2.5 rounded-full text-xs font-semibold transition-colors" style={{ background: on ? `${c}22` : "color-mix(in srgb, var(--wash) 06%, transparent)", border: `1px solid ${on ? c + "55" : "transparent"}`, color: on ? c : "color-mix(in srgb, var(--fg) 60%, transparent)", fontFamily: F.b }}>
      {text}
    </button>
  );

  return (
    <Sheet open={open} onClose={onClose} z={69}>
      <div className="px-6 pt-7 pb-8">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(244,114,182,0.15)", border: "1px solid rgba(244,114,182,0.4)" }}>
              <Wrench size={15} style={{ color: "#f472b6" }} />
            </div>
            <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 20, letterSpacing: "-0.02em" }}>{t("dev.title")}</div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)" }}>
            <X size={16} />
          </button>
        </div>
        <div className="text-xs mb-4" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("dev.sub")}</div>

        {/* XP и уровень */}
        {label(t("dev.xp"))}
        <div className="rounded-2xl p-4" style={GLASS}>
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} style={{ color: "#facc15" }} />
            <span className="text-sm font-semibold" style={{ fontFamily: F.b }}>{t("dev.level", level)}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {XP_PRESETS.map(xp => chip(`+${xp.toLocaleString("ru-RU")} XP`, false, () => { onGrantXp(xp); toast(t("dev.xpDone", xp.toLocaleString("ru-RU"))); }, "#facc15"))}
          </div>
        </div>

        {/* Роль */}
        {label(t("dev.role"))}
        <div className="flex gap-2">
          <button onClick={() => { onSetRole("artist"); toast(t("dev.roleSet", t("dev.artist"))); }} className="flex-1 py-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2" style={{ background: userRole === "artist" ? "rgba(139,92,246,0.2)" : "color-mix(in srgb, var(--wash) 06%, transparent)", border: `1px solid ${userRole === "artist" ? "rgba(139,92,246,0.55)" : "transparent"}`, color: userRole === "artist" ? "#a78bfa" : "color-mix(in srgb, var(--fg) 55%, transparent)", fontFamily: F.b }}>
            <Mic2 size={13} /> {t("dev.artist")}
          </button>
          <button onClick={() => { onSetRole("listener"); toast(t("dev.roleSet", t("dev.listener"))); }} className="flex-1 py-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2" style={{ background: userRole === "listener" ? "rgba(52,211,153,0.16)" : "color-mix(in srgb, var(--wash) 06%, transparent)", border: `1px solid ${userRole === "listener" ? "rgba(52,211,153,0.5)" : "transparent"}`, color: userRole === "listener" ? "#34d399" : "color-mix(in srgb, var(--fg) 55%, transparent)", fontFamily: F.b }}>
            <Headphones size={13} /> {t("dev.listener")}
          </button>
        </div>

        {/* Подписки */}
        {label(t("dev.plans"))}
        <div className="flex gap-2 flex-wrap">
          {chip("MYRA Pro", cpStatus === "active", () => onSetCp(cpStatus === "active" ? "none" : "active"), "#a78bfa")}
          {chip("MYRA Plus", plusActive, () => onSetPlus(!plusActive), "#22d3ee")}
        </div>

        {/* Баланс */}
        {label(t("dev.balance"))}
        <div className="rounded-2xl p-4" style={GLASS}>
          <div className="flex items-center gap-2 mb-3">
            <Wallet size={14} style={{ color: "#34d399" }} />
            <span className="text-sm font-semibold" style={{ fontFamily: F.m }}>{balance.toLocaleString("ru-RU")}₽</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {BALANCE_PRESETS.map(amt => chip(`+${amt.toLocaleString("ru-RU")}₽`, false, () => { onAddBalance(amt); toast(t("dev.balanceDone", amt.toLocaleString("ru-RU"))); }, "#34d399"))}
          </div>
        </div>

        {/* Скрытые достижения — полный список видим только здесь */}
        <div className="flex items-center justify-between mt-6 mb-2.5">
          <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}>{t("dev.ach")}</div>
          <button
            onClick={() => { ls.set("achUnlocked", []); setAchVersion(v => v + 1); toast(t("dev.achResetDone")); }}
            className="flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1.5 rounded-full"
            style={{ background: "rgba(248,113,113,0.1)", color: "#f87171", fontFamily: F.b }}
          >
            <RotateCcw size={11} /> {t("dev.achReset")}
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          {achievements.map(a => {
            const Icon = a.done ? a.icon : Lock;
            return (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-2xl" style={{ ...GLASS, opacity: a.done ? 1 : 0.6 }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: a.done ? "rgba(244,114,182,0.14)" : "color-mix(in srgb, var(--wash) 07%, transparent)" }}>
                  <Icon size={14} style={{ color: a.done ? "#f472b6" : "color-mix(in srgb, var(--fg) 35%, transparent)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate" style={{ fontFamily: F.b }}>
                    {t(a.key)}
                    {a.done && unlocked.has(a.id) && <span className="ml-2 text-[9px] font-bold" style={{ color: "#f472b6", fontFamily: F.m }}>{t("dev.achSeen")}</span>}
                  </div>
                  <div className="text-[10px] truncate" style={{ color: "color-mix(in srgb, var(--fg) 42%, transparent)", fontFamily: F.b }}>{t(a.key + "Sub")}</div>
                </div>
                <span className="text-[10px] flex-shrink-0" style={{ color: a.done ? "#f472b6" : "color-mix(in srgb, var(--fg) 35%, transparent)", fontFamily: F.m }}>
                  {t("rt.achProgress", Math.min(a.have, a.need), a.need)}
                </span>
              </div>
            );
          })}
        </div>

        <motion.button whileTap={{ scale: 0.97 }} onClick={onClose} className="w-full py-3.5 rounded-full text-sm font-semibold mt-6 flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg, #f472b6, #f9a8d4)", color: "#3f0d24", fontFamily: F.b }}>
          <Sparkles size={14} /> {t("dev.close")}
        </motion.button>
      </div>
    </Sheet>
  );
}
