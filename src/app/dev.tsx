import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Zap, Sparkles, Wallet, Mic2, Headphones, Lock, RotateCcw, Wrench, Inbox, ChevronRight, ChevronLeft, Send, Loader2, ShieldAlert, Bug, Flag, EyeOff, Eye, CheckCheck, XCircle, ExternalLink } from "./myraIcons";
import { motion } from "motion/react";
import { toast } from "sonner";
import { ls, REPORT_REASONS } from "./data";
import { F, GLASS, Sheet } from "./lib";
import { useLang } from "./i18n";
import { buildAchievements, type AchievementCounters } from "./achievements";
import type { UserRole } from "./auth";
import { isAdmin, fetchAllSupportThreads, fetchSupportThread, sendSupportMessage, markSupportThreadRead, fetchOpenReports, resolveReport, hideTrack, type SupportMessageRow, type SupportThreadPreview, type OpenReportRow } from "./supabase";

// ─── Панель разработчика ──────────────────────────────────────────────────────
// Только для создателей MYRA. Активируется семью быстрыми тапами по аватару в
// профиле и позволяет проверять фичи до релиза: выдавать себе XP и уровни,
// переключать роль, включать подписки, пополнять баланс и смотреть скрытые
// достижения. Никакого бэкенда за этим нет — панель крутит те же локальные
// состояния, что и обычные пользовательские действия.

const XP_PRESETS = [500, 2500, 10000];
const BALANCE_PRESETS = [1000, 10000];

export function DevPanelSheet({ open, onClose, level, counters, userRole, onSetRole, cpStatus, onSetCp, plusActive, onSetPlus, balance, onAddBalance, onGrantXp, onOpenAdminSupport, onOpenModeration }: {
  open: boolean; onClose: () => void; level: number;
  counters: AchievementCounters;
  userRole: UserRole; onSetRole: (r: UserRole) => void;
  cpStatus: "none" | "active" | "grace"; onSetCp: (s: "none" | "active" | "grace") => void;
  plusActive: boolean; onSetPlus: (v: boolean) => void;
  balance: number; onAddBalance: (amt: number) => void;
  onGrantXp: (xp: number) => void;
  onOpenAdminSupport: () => void;
  onOpenModeration: () => void;
}) {
  const { t } = useLang();
  // achVersion — форс-пересчёт после сброса прогресса кнопкой ниже
  const [achVersion, setAchVersion] = useState(0);
  const achievements = useMemo(() => buildAchievements(counters), [counters]);
  const unlocked = useMemo(() => new Set(ls.get<string[]>("achUnlocked", [])), [achievements, achVersion, open]);

  const toggleEruda = async () => {
    const eruda = (await import("eruda")).default;
    if ((window as any).__erudaOn) { eruda.destroy(); (window as any).__erudaOn = false; toast(t("dev.consoleOff")); }
    else { eruda.init(); (window as any).__erudaOn = true; toast(t("dev.consoleOn")); }
  };

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

        {/* Инбокс поддержки — devMode только открывает эту кнопку, реальный
            доступ к чужим переписке проверяет сам AdminSupportSheet (таблица admins) */}
        <motion.button whileTap={{ scale: 0.98 }} onClick={onOpenAdminSupport} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl mb-2" style={{ ...GLASS, border: "1px solid rgba(34,211,238,0.3)" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(34,211,238,0.14)" }}>
            <Inbox size={15} style={{ color: "#22d3ee" }} />
          </div>
          <div className="flex-1 text-left text-sm font-semibold" style={{ fontFamily: F.b }}>{t("dev.supportRow")}</div>
          <ChevronRight size={15} style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }} />
        </motion.button>

        {/* Очередь модерации — тот же паттерн, что и инбокс поддержки выше:
            devMode лишь показывает кнопку, реальный доступ к чужим жалобам
            проверяет сам ModerationSheet (таблица admins) */}
        <motion.button whileTap={{ scale: 0.98 }} onClick={onOpenModeration} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl mb-2" style={{ ...GLASS, border: "1px solid rgba(248,113,113,0.3)" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(248,113,113,0.14)" }}>
            <Flag size={15} style={{ color: "#f87171" }} />
          </div>
          <div className="flex-1 text-left text-sm font-semibold" style={{ fontFamily: F.b }}>{t("dev.moderationRow")}</div>
          <ChevronRight size={15} style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }} />
        </motion.button>

        {/* Консоль отладки прямо на устройстве (eruda): единственный способ
            увидеть реальные ошибки на телефоне без подключения к компьютеру.
            Пакет грузится лениво отдельным чанком только при первом включении */}
        <motion.button whileTap={{ scale: 0.98 }} onClick={toggleEruda} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl mb-2" style={{ ...GLASS, border: "1px solid rgba(250,204,21,0.3)" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(250,204,21,0.14)" }}>
            <Bug size={15} style={{ color: "#facc15" }} />
          </div>
          <div className="flex-1 text-left text-sm font-semibold" style={{ fontFamily: F.b }}>{t("dev.console")}</div>
          <ChevronRight size={15} style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }} />
        </motion.button>

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

// ─── Инбокс поддержки для админов (двух создателей MYRA) ─────────────────────
// Точка входа — кнопка выше, внутри DevPanelSheet: devMode лишь ПОКАЗЫВАЕТ её
// (обнаружение), а реальное разрешение на чужую переписку тут же, при
// открытии, проверяется отдельно через isAdmin(uid) (таблица admins — она и
// есть источник правды на доступ к данным). Если пользователь не в admins, но
// каким-то образом включил devMode, он увидит только "нет доступа" — ни
// одного чужого сообщения не подгрузится.

const fmtThreadTime = (iso: string) => new Date(iso).toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function AdminThreadView({ userId, username, onBack }: { userId: string; username: string | null; onBack: () => void }) {
  const { t } = useLang();
  const [messages, setMessages] = useState<SupportMessageRow[] | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    fetchSupportThread(userId).then(({ data }) => setMessages(data));
    // Открыли тред — считаем, что админ увидел сообщения пользователя
    markSupportThreadRead(userId).catch(() => {});
  }, [userId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [messages]);

  const send = async () => {
    const text = reply.trim();
    if (!text) return;
    setSending(true);
    const { error } = await sendSupportMessage(userId, "support", text);
    setSending(false);
    if (error) { toast(t("dev.supportErr")); return; }
    setReply("");
    load();
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-semibold mb-3 flex-shrink-0" style={{ color: "color-mix(in srgb, var(--fg) 55%, transparent)", fontFamily: F.b }}>
        <ChevronLeft size={14} /> {t("dev.supportBack")}
      </button>
      <div className="text-sm font-bold mb-3 flex-shrink-0 truncate" style={{ fontFamily: F.d }}>{username ?? userId.slice(0, 8)}</div>

      <div ref={listRef} className="flex-1 overflow-y-auto flex flex-col gap-3 pb-3" style={{ scrollbarWidth: "none" }}>
        {messages === null && (
          <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)" }} /></div>
        )}
        {messages?.map(m => (
          <div key={m.id} className={`flex ${m.from_role === "support" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[85%]">
              <div className="px-4 py-2.5 rounded-[18px] text-sm" style={m.from_role === "support" ? { background: "linear-gradient(135deg, #f472b6, #f9a8d4)", color: "#3f0d24", borderBottomRightRadius: 6, fontFamily: F.b } : { ...GLASS, borderBottomLeftRadius: 6, fontFamily: F.b }}>
                {m.text}
              </div>
              <div className="text-[9px] mt-1 px-1" style={{ textAlign: m.from_role === "support" ? "right" : "left", color: "color-mix(in srgb, var(--fg) 30%, transparent)", fontFamily: F.m }}>
                {m.from_role === "ai" ? `${t("dev.supportAiTag")} · ` : ""}{fmtThreadTime(m.created_at)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-end gap-2.5 flex-shrink-0 pt-1">
        <textarea
          value={reply}
          onChange={e => setReply(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={t("dev.supportReplyPh")}
          rows={1}
          className="flex-1 px-4 py-3 rounded-2xl bg-transparent outline-none text-sm resize-none"
          style={{ ...GLASS, color: "var(--fg)", fontFamily: F.b, maxHeight: 90 }}
        />
        <motion.button whileTap={{ scale: 0.88 }} disabled={sending} onClick={send} className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: reply.trim() ? "linear-gradient(135deg, #f472b6, #f9a8d4)" : "color-mix(in srgb, var(--wash) 8%, transparent)" }}>
          <Send size={16} style={{ color: reply.trim() ? "#3f0d24" : "color-mix(in srgb, var(--fg) 30%, transparent)" }} />
        </motion.button>
      </div>
    </div>
  );
}

export function AdminSupportSheet({ open, onClose, uid }: { open: boolean; onClose: () => void; uid: string | null }) {
  const { t } = useLang();
  // null = проверяем, true/false = результат isAdmin(uid)
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [threads, setThreads] = useState<SupportThreadPreview[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [activeThread, setActiveThread] = useState<SupportThreadPreview | null>(null);

  const loadThreads = useCallback(() => {
    setThreadsLoading(true);
    fetchAllSupportThreads().then(list => { setThreads(list); setThreadsLoading(false); });
  }, []);

  useEffect(() => {
    if (!open) return;
    setActiveThread(null);
    if (!uid) { setAllowed(false); return; }
    setAllowed(null);
    isAdmin(uid).then(ok => { setAllowed(ok); if (ok) loadThreads(); });
  }, [open, uid, loadThreads]);

  return (
    <Sheet open={open} onClose={onClose} z={71}>
      <div className="px-6 pt-7 pb-8 flex flex-col" style={{ height: "min(78vh, 640px)" }}>
        <div className="flex items-center justify-between mb-5 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(34,211,238,0.15)", border: "1px solid rgba(34,211,238,0.4)" }}>
              <Inbox size={15} style={{ color: "#22d3ee" }} />
            </div>
            <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" }}>{t("dev.supportTitle")}</div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)" }}>
            <X size={16} />
          </button>
        </div>

        {allowed === null && (
          <div className="flex-1 flex items-center justify-center"><Loader2 size={20} className="animate-spin" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)" }} /></div>
        )}

        {allowed === false && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 px-4">
            <ShieldAlert size={22} style={{ color: "color-mix(in srgb, var(--fg) 35%, transparent)" }} />
            <div className="text-sm font-semibold" style={{ fontFamily: F.b }}>{t("dev.supportDenied")}</div>
            <div className="text-xs" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("dev.supportDeniedSub")}</div>
          </div>
        )}

        {allowed && !activeThread && (
          <div className="flex-1 overflow-y-auto flex flex-col gap-2" style={{ scrollbarWidth: "none" }}>
            {threadsLoading && (
              <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)" }} /></div>
            )}
            {!threadsLoading && threads.length === 0 && (
              <div className="text-xs text-center py-8" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("dev.supportEmpty")}</div>
            )}
            {threads.map(th => (
              <motion.button key={th.userId} whileTap={{ scale: 0.98 }} onClick={() => setActiveThread(th)} className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left" style={GLASS}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ fontFamily: F.b }}>{th.username ?? th.userId.slice(0, 8)}</div>
                  <div className="text-xs truncate" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{th.lastText}</div>
                </div>
                {th.unreadCount > 0 && (
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: "#f472b6", color: "#3f0d24", fontFamily: F.m }}>
                    {th.unreadCount}
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        )}

        {allowed && activeThread && (
          <AdminThreadView userId={activeThread.userId} username={activeThread.username} onBack={() => { setActiveThread(null); loadThreads(); }} />
        )}
      </div>
    </Sheet>
  );
}

// ─── Очередь модерации для админов (двух создателей MYRA) ────────────────────
// Точка входа — кнопка в DevPanelSheet выше, тот же паттерн, что и у инбокса
// поддержки: devMode лишь ПОКАЗЫВАЕТ кнопку, реальный доступ к чужим жалобам
// проверяется отдельно через isAdmin(uid) при открытии (таблица admins — она
// и есть источник правды, см. schema.sql секции 12-13). Не в admins — пусто,
// без единой чужой жалобы, что бы ни включил девMode на клиенте.

const fmtReportTime = (iso: string) => new Date(iso).toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function reportReasonLabel(code: string, t: (key: string) => string) {
  const found = REPORT_REASONS.find(r => r.code === code);
  return found ? t(found.labelKey) : code;
}

export function ModerationSheet({ open, onClose, uid }: { open: boolean; onClose: () => void; uid: string | null }) {
  const { t } = useLang();
  // null = проверяем, true/false = результат isAdmin(uid)
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [reports, setReports] = useState<OpenReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Локальный оверрайд hidden по target_id трека — чтобы кнопка "скрыть/
  // вернуть" переключалась мгновенно, не дожидаясь рефетча всей очереди
  const [hiddenOverride, setHiddenOverride] = useState<Record<string, boolean>>({});

  const load = useCallback(() => {
    setLoading(true);
    fetchOpenReports().then(list => { setReports(list); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!uid) { setAllowed(false); return; }
    setAllowed(null);
    setHiddenOverride({});
    isAdmin(uid).then(ok => { setAllowed(ok); if (ok) load(); });
  }, [open, uid, load]);

  const resolve = async (id: string, status: "resolved" | "dismissed") => {
    setBusyId(id);
    const { error } = await resolveReport(id, status);
    setBusyId(null);
    if (error) { toast(t("mod.err")); return; }
    setReports(prev => prev.filter(r => r.id !== id));
    toast(status === "resolved" ? t("mod.resolved") : t("mod.dismissed"));
  };

  const toggleHide = async (targetId: string, currentlyHidden: boolean) => {
    setBusyId(targetId);
    const { error } = await hideTrack(targetId, !currentlyHidden);
    setBusyId(null);
    if (error) { toast(t("mod.err")); return; }
    setHiddenOverride(prev => ({ ...prev, [targetId]: !currentlyHidden }));
    toast(!currentlyHidden ? t("mod.hidden") : t("mod.unhidden"));
  };

  return (
    <Sheet open={open} onClose={onClose} z={71}>
      <div className="px-6 pt-7 pb-8 flex flex-col" style={{ height: "min(78vh, 640px)" }}>
        <div className="flex items-center justify-between mb-5 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.4)" }}>
              <Flag size={15} style={{ color: "#f87171" }} />
            </div>
            <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" }}>{t("mod.title")}</div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)" }}>
            <X size={16} />
          </button>
        </div>

        {allowed === null && (
          <div className="flex-1 flex items-center justify-center"><Loader2 size={20} className="animate-spin" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)" }} /></div>
        )}

        {allowed === false && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 px-4">
            <ShieldAlert size={22} style={{ color: "color-mix(in srgb, var(--fg) 35%, transparent)" }} />
            <div className="text-sm font-semibold" style={{ fontFamily: F.b }}>{t("dev.supportDenied")}</div>
            <div className="text-xs" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("dev.supportDeniedSub")}</div>
          </div>
        )}

        {allowed && (
          <div className="flex-1 overflow-y-auto flex flex-col gap-2.5" style={{ scrollbarWidth: "none" }}>
            {loading && (
              <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)" }} /></div>
            )}
            {!loading && reports.length === 0 && (
              <div className="text-xs text-center py-8" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("mod.empty")}</div>
            )}
            {reports.map(r => {
              const isTrack = r.target_type === "track";
              const isRealTrack = isTrack && !r.target_id.startsWith("catalog:");
              const hidden = hiddenOverride[r.target_id] ?? false;
              const busy = busyId === r.id || busyId === r.target_id;
              return (
                <div key={r.id} className="p-3.5 rounded-2xl flex flex-col gap-2" style={GLASS}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: "rgba(248,113,113,0.15)", color: "#f87171", fontFamily: F.m }}>
                      {reportReasonLabel(r.reason, t)}
                    </span>
                    <span className="text-[10px]" style={{ color: "color-mix(in srgb, var(--fg) 35%, transparent)", fontFamily: F.m }}>{fmtReportTime(r.created_at)}</span>
                  </div>

                  <div className="text-sm font-semibold truncate" style={{ fontFamily: F.b }}>
                    {isTrack ? (r.trackTitle ?? r.target_id) : t("mod.commentTarget")}
                  </div>
                  {r.details && (
                    <div className="text-xs" style={{ color: "color-mix(in srgb, var(--fg) 55%, transparent)", fontFamily: F.b }}>{r.details}</div>
                  )}
                  <div className="text-[10px]" style={{ color: "color-mix(in srgb, var(--fg) 35%, transparent)", fontFamily: F.m }}>
                    {t("mod.reporter")}: {r.reporterName ?? r.reporter_id.slice(0, 8)}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    {isRealTrack && r.trackAudioUrl && (
                      <a href={r.trackAudioUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)", color: "color-mix(in srgb, var(--fg) 70%, transparent)", fontFamily: F.b }}>
                        <ExternalLink size={12} /> {t("mod.openTrack")}
                      </a>
                    )}
                    {isRealTrack && (
                      <button disabled={busy} onClick={() => toggleHide(r.target_id, hidden)} className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold" style={{ background: hidden ? "rgba(52,211,153,0.15)" : "rgba(250,204,21,0.15)", color: hidden ? "#34d399" : "#facc15", fontFamily: F.b, opacity: busy ? 0.6 : 1 }}>
                        {hidden ? <Eye size={12} /> : <EyeOff size={12} />} {hidden ? t("mod.unhide") : t("mod.hide")}
                      </button>
                    )}
                    <button disabled={busy} onClick={() => resolve(r.id, "resolved")} className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold" style={{ background: "rgba(34,211,238,0.15)", color: "#22d3ee", fontFamily: F.b, opacity: busy ? 0.6 : 1 }}>
                      <CheckCheck size={12} /> {t("mod.resolve")}
                    </button>
                    <button disabled={busy} onClick={() => resolve(r.id, "dismissed")} className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)", color: "color-mix(in srgb, var(--fg) 55%, transparent)", fontFamily: F.b, opacity: busy ? 0.6 : 1 }}>
                      <XCircle size={12} /> {t("mod.dismiss")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Sheet>
  );
}
