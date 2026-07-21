import { useState, useEffect, useRef } from "react";
import { ArrowRight, Mail, Lock, User, Check, Moon, Sun, Mic2, Headphones, KeyRound } from "./myraIcons";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { TASTE_GENRES, TRACKS, ls } from "./data";
import { F, GLASS, SPRING, useTheme } from "./lib";
import { MyraBrandLockup } from "./logo";
import { MyraGlyph } from "./myraIcons";
import { DetailBackdrop, DetailWave } from "./detail";
import { useLang } from "./i18n";
import { track } from "./analytics";
import {
  supabaseEnabled, signUpWithEmail, signInWithEmail, signInWithOAuth,
  requestPasswordReset, updatePassword, oauthProviders, onAuthEvent,
  canUsePasskeys, signInWithPasskey,
  getSession, upsertProfile, fetchProfile, resendConfirmation,
  type MyraOAuthProvider,
} from "./supabase";

type Step = "slides" | "auth" | "forgot" | "recovery" | "taste" | "role" | "confirm";
export type UserRole = "artist" | "listener";

export function OnboardingFlow({ onDone, forceRecovery = false, onRecoveryDone }: {
  onDone: (name: string, role: UserRole, email: string, handle?: string | null) => void;
  forceRecovery?: boolean;
  onRecoveryDone?: () => void;
}) {
  const { t, lang, setLang } = useLang();
  const { theme, toggleTheme } = useTheme();
  const [step, setStep] = useState<Step>(() => forceRecovery || new URL(window.location.href).searchParams.get("password-recovery") === "1" ? "recovery" : "slides");
  const [slide, setSlide] = useState(0);
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [role, setRole] = useState<UserRole | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const SLIDES = [
    { title: t("ob.s1t"), sub: t("ob.s1s"), c2: "#f0b08a", img: TRACKS[0].img },
    { title: t("ob.s2t"), sub: t("ob.s2s"), c2: "#c17c96", img: TRACKS[1].img },
    { title: t("ob.s3t"), sub: t("ob.s3s"), c2: "#b390c5", img: TRACKS[5].img },
  ];

  const finishName = name.trim() || (lang === "ru" ? "Алекс" : "Alex");

  const submitAuth = async () => {
    if (busy) return;
    const emailOk = /.+@.+\..+/.test(email);
    if (mode === "signup" && !name.trim()) { toast(t("au.errName")); return; }
    if (!emailOk) { toast(t("au.errEmail")); return; }
    if (pass.length < 8) { toast(t("au.errPass")); return; }
    setBusy(true);
    try {
      if (mode === "login") {
        if (supabaseEnabled) {
          const { error } = await signInWithEmail(email, pass);
          if (error) { toast(t("au.loginFailed", error.message)); return; }
          // Существующий аккаунт: имя, роль и хендл живут в серверном профиле,
          // а не в localStorage этого устройства. Подтягиваем их прямо сейчас.
          const uid = (await getSession())?.user?.id;
          if (uid) {
            const { data: profile } = await fetchProfile(uid);
            if (profile?.username) {
              const role: UserRole = profile.role === "artist" ? "artist" : "listener";
              track({ name: "login", method: "email" });
              toast(t("au.welcomeBack", profile.username));
              onDone(profile.username, role, email.trim(), profile.handle ?? null);
              return;
            }
          }
        }
        track({ name: "login", method: "email" });
        toast(t("au.welcomeBack", finishName));
        onDone(finishName, ls.get<UserRole>("userRole", "listener"), email.trim());
      } else {
        if (supabaseEnabled) {
          // Роль ещё не выбрана — её допишет upsertProfile в finishRole.
          const { error } = await signUpWithEmail(email, pass, name.trim());
          if (error) { toast(t("au.signupFailed", error.message)); return; }
        }
        track({ name: "sign_up", method: "email" });
        toast(t("au.created"));
        setStep("taste");
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (forceRecovery) setStep("recovery");
  }, [forceRecovery]);

  useEffect(() => {
    const { data } = onAuthEvent(event => {
      if (event === "PASSWORD_RECOVERY") setStep("recovery");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const sendPasswordReset = async () => {
    const normalized = email.trim();
    if (!/.+@.+\..+/.test(normalized)) { toast(t("au.errEmail")); return; }
    setBusy(true);
    try {
      const { error } = await requestPasswordReset(normalized);
      if (error) { toast(t("au.resetFailed", error.message)); return; }
      track({ name: "password_recovery" });
      toast.success(t("au.resetSent"));
      setStep("auth");
      setMode("login");
    } finally {
      setBusy(false);
    }
  };

  const clearRecoveryParam = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("password-recovery");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const saveNewPassword = async () => {
    if (pass.length < 8) { toast(t("au.errNewPass")); return; }
    if (pass !== confirmPass) { toast(t("au.errPassMatch")); return; }
    setBusy(true);
    try {
      const { error } = await updatePassword(pass);
      if (error) { toast(t("au.updatePassFailed", error.message)); return; }
      const session = await getSession();
      const uid = session?.user?.id;
      const { data: profile } = uid ? await fetchProfile(uid) : { data: null };
      clearRecoveryParam();
      toast.success(t("au.passwordUpdated"));
      onRecoveryDone?.();
      if (profile) {
        onDone(profile.username, profile.role === "artist" ? "artist" : "listener", profile.email ?? session?.user?.email ?? "", profile.handle ?? null);
      } else {
        setPass("");
        setConfirmPass("");
        setStep("auth");
        setMode("login");
      }
    } finally {
      setBusy(false);
    }
  };

  const startOAuth = async (provider: MyraOAuthProvider) => {
    setBusy(true);
    try {
      const { error } = await signInWithOAuth(provider);
      if (error) toast(t("au.oauthFailed", error.message));
    } finally {
      setBusy(false);
    }
  };

  const startPasskey = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { data, error } = await signInWithPasskey();
      if (error || !data?.session?.user?.id) {
        toast.error(t("au.passkeyFailed"));
        return;
      }
      const { data: profile } = await fetchProfile(data.session.user.id);
      if (!profile?.username) {
        toast.error(t("au.passkeyProfileFailed"));
        return;
      }
      track({ name: "login", method: "passkey" });
      toast.success(t("au.welcomeBack", profile.username));
      onDone(
        profile.username,
        profile.role === "artist" ? "artist" : "listener",
        profile.email ?? data.session.user.email ?? "",
        profile.handle ?? null,
      );
    } finally {
      setBusy(false);
    }
  };

  const finishRole = async (r: UserRole) => {
    setRole(r);
    ls.set("taste", [...picked]);
    // Пользователь прошёл онбординг до выбора роли — фиксируем завершение
    // (роль — enum, не PII).
    track({ name: "onboarding_complete", role: r });
    if (supabaseEnabled) {
      const session = await getSession();
      const uid = session?.user?.id;
      if (uid) {
        // Ждём апсерт, чтобы ошибка успела попасть в лог, но не показываем тост —
        // неудачная синхронизация профиля не должна запирать пользователя в онбординге
        try {
          const { error } = await upsertProfile(uid, { username: finishName, role: r, email: email.trim() });
          if (error) console.warn("upsertProfile:", error.message);
        } catch (err) {
          console.warn("upsertProfile:", err);
        }
        onDone(finishName, r, email.trim());
        return;
      }
      // Сессии ещё нет — почта не подтверждена (включено подтверждение email).
      // Сохраняем данные локально: их доведёт до конца App.tsx, когда пользователь
      // перейдёт по ссылке из письма и в приложении появится настоящая сессия.
      ls.set("pendingProfile", { name: finishName, role: r, email: email.trim() });
      setStep("confirm");
      return;
    }
    onDone(finishName, r, email.trim());
  };

  // Интервал в ref + очистка на размонтировании: без этого отсчёт продолжал бы
  // дёргать setState после закрытия онбординга
  const resendIv = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (resendIv.current) clearInterval(resendIv.current); }, []);

  const resendEmail = async () => {
    if (resendCooldown > 0) return;
    await resendConfirmation(email.trim());
    toast(t("au.resendDone"));
    setResendCooldown(30);
    if (resendIv.current) clearInterval(resendIv.current);
    resendIv.current = setInterval(() => {
      setResendCooldown(c => {
        if (c <= 1) {
          if (resendIv.current) { clearInterval(resendIv.current); resendIv.current = null; }
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const S = SLIDES[slide];

  return (
    <div className="myra-onboarding fixed inset-0 z-[90] flex flex-col overflow-hidden" style={{ background: "var(--bg)", fontFamily: F.b, color: "var(--fg)" }}>
      {/* Фон */}
      <AnimatePresence>
        <motion.img
          key={step === "slides" ? slide : step}
          src={S.img}
          alt=""
          className="myra-onboarding-backdrop absolute inset-0 w-full h-full object-cover"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          style={{ filter: "var(--cover-filter)", transform: "scale(1.2)" }}
        />
      </AnimatePresence>
      <DetailBackdrop variant="soft" accent={S.c2} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 0%, var(--bg) var(--aurora-fade))" }} />
      <div className="absolute bottom-0 left-0 right-0 h-80" style={{ background: "linear-gradient(to top, var(--bg) 0%, transparent 100%)" }} />

      {/* Верх: лого + тема + язык */}
      <div className="myra-onboarding-header relative z-10 flex items-center justify-between px-7 pt-9">
        <MyraBrandLockup />
        <div className="flex items-center gap-2">
          <motion.button whileTap={{ scale: 0.88 }} onClick={toggleTheme} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ ...GLASS }}>
            {theme === "dark" ? <Moon size={15} /> : <Sun size={15} />}
          </motion.button>
          <button onClick={() => setLang(lang === "ru" ? "en" : "ru")} className="px-3.5 py-1.5 rounded-full text-xs font-semibold" style={{ ...GLASS, fontFamily: F.m }}>
            {lang === "ru" ? "EN" : "RU"}
          </button>
        </div>
      </div>

      <aside className="myra-onboarding-showcase" aria-hidden="true">
        <div className="myra-onboarding-showcase-art">
          <img src={S.img} alt="" />
          <span />
        </div>
        <div className="myra-onboarding-showcase-copy">
          <small>MYRA IMMERSIVE AUDIO</small>
          <strong>{S.title}</strong>
          <p>{S.sub}</p>
          <DetailWave progress={38} accent={S.c2} height={38} compact />
        </div>
      </aside>

      {/* На телефоне контент прижат вниз (удобно большим пальцем), на планшете/ПК/ТВ — по центру */}
      <div className="myra-onboarding-content relative z-10 flex-1 flex flex-col justify-end md:justify-center overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {/* ── Слайды ── */}
          {step === "slides" && (
            <motion.div key={"slide" + slide} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }} className="myra-onboarding-panel px-7 pb-10 max-w-md mx-auto w-full">
              <div className="mb-8">
                <DetailWave progress={38} accent={S.c2} height={40} compact />
              </div>
              <h1 style={{ fontFamily: F.d, fontWeight: 900, fontSize: 36, letterSpacing: "-0.04em", lineHeight: 1.05 }} className="mb-4">{S.title}</h1>
              <p className="text-base mb-9" style={{ color: "color-mix(in srgb, var(--fg) 55%, transparent)", lineHeight: 1.55 }}>{S.sub}</p>

              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {SLIDES.map((_, i) => (
                    <button key={i} onClick={() => setSlide(i)} className="rounded-full transition-all duration-300" style={{ width: i === slide ? 26 : 8, height: 8, background: i === slide ? S.c2 : "color-mix(in srgb, var(--wash) 16%, transparent)" }} />
                  ))}
                </div>
                <div className="flex items-center gap-4">
                  <button onClick={() => setStep("auth")} className="text-sm" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)" }}>{t("ob.skip")}</button>
                  <motion.button
                    whileTap={{ scale: 0.93 }}
                    onClick={() => slide < 2 ? setSlide(slide + 1) : setStep("auth")}
                    className="flex items-center gap-2 pl-6 pr-5 py-3.5 rounded-full text-sm font-bold"
                    style={{ background: `linear-gradient(135deg, ${S.c2}, ${S.c2}99)`, boxShadow: `0 12px 40px ${S.c2}44` }}
                  >
                    {slide < 2 ? t("ob.next") : t("ob.start")} <MyraGlyph name="arrow" size={15} />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Вход / регистрация ── */}
          {step === "auth" && (
            <motion.div key="auth" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }} className="myra-onboarding-panel px-7 pb-10 max-w-md mx-auto w-full">
              <h1 style={{ fontFamily: F.d, fontWeight: 900, fontSize: 32, letterSpacing: "-0.04em" }} className="mb-1.5">{t("au.welcome")}</h1>
              <p className="text-sm mb-6" style={{ color: "color-mix(in srgb, var(--fg) 50%, transparent)" }}>{t("au.sub")}</p>

              <div className="flex gap-1 p-1 rounded-full mb-6 w-fit" style={GLASS}>
                {(["signup", "login"] as const).map(m => (
                  <button key={m} onClick={() => setMode(m)} className="relative px-5 py-2 rounded-full text-xs font-semibold" style={{ color: mode === m ? "#fff" : "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>
                    {mode === m && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="absolute inset-0 rounded-full myra-brand-fill" />}
                    <span className="relative z-10">{m === "signup" ? t("au.signup") : t("au.login")}</span>
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-2.5 mb-5">
                <AnimatePresence>
                  {mode === "signup" && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl" style={GLASS}>
                        <User size={15} style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", flexShrink: 0 }} />
                        <input value={name} onChange={e => setName(e.target.value)} placeholder={t("au.name")} className="flex-1 bg-transparent outline-none text-sm min-w-0" style={{ color: "var(--fg)" }} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl" style={GLASS}>
                  <Mail size={15} style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", flexShrink: 0 }} />
                  <input value={email} onChange={e => setEmail(e.target.value)} placeholder={t("au.email")} type="email" className="flex-1 bg-transparent outline-none text-sm min-w-0" style={{ color: "var(--fg)" }} />
                </div>
                <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl" style={GLASS}>
                  <Lock size={15} style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", flexShrink: 0 }} />
                  <input value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => { if (e.key === "Enter") submitAuth(); }} placeholder={t("au.pass")} type="password" className="flex-1 bg-transparent outline-none text-sm min-w-0" style={{ color: "var(--fg)" }} />
                </div>
              </div>

              <motion.button whileTap={{ scale: 0.97 }} disabled={busy} onClick={submitAuth} className="myra-primary-cta w-full py-4 rounded-full text-sm font-bold mb-3 disabled:opacity-50" style={{ fontFamily: F.b }}>
                {mode === "signup" ? t("au.doSignup") : t("au.doLogin")}
              </motion.button>

              {canUsePasskeys() && (
                <button type="button" disabled={busy} onClick={startPasskey} className="myra-passkey-button">
                  <KeyRound size={15} />
                  <span>{t("au.passkey")}</span>
                  <small>{t("au.passkeySub")}</small>
                </button>
              )}

              {mode === "login" && (
                <button onClick={() => setStep("forgot")} className="block mx-auto mb-5 text-xs font-semibold" style={{ color: "color-mix(in srgb, var(--fg) 52%, transparent)" }}>
                  {t("au.forgot")}
                </button>
              )}

              {oauthProviders.length > 0 && (
                <div className="myra-oauth-block">
                  <div><span>{t("au.or")}</span></div>
                  <div className="myra-oauth-grid">
                    {oauthProviders.map(provider => (
                      <button key={provider} disabled={busy} onClick={() => startOAuth(provider)}>
                        <i>{provider === "google" ? "G" : provider === "github" ? "GH" : provider === "spotify" ? "S" : "D"}</i>
                        {t(`au.oauth.${provider}`)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {step === "forgot" && (
            <motion.div key="forgot" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="myra-onboarding-panel px-7 pb-10 max-w-md mx-auto w-full">
              <span className="myra-page-eyebrow">MYRA ACCOUNT</span>
              <h1 style={{ fontFamily: F.d, fontWeight: 900, fontSize: 30, letterSpacing: "-0.04em" }} className="mt-3 mb-2">{t("au.resetTitle")}</h1>
              <p className="text-sm mb-6" style={{ color: "color-mix(in srgb, var(--fg) 50%, transparent)", lineHeight: 1.55 }}>{t("au.resetSub")}</p>
              <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl mb-4" style={GLASS}>
                <Mail size={15} style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", flexShrink: 0 }} />
                <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === "Enter") sendPasswordReset(); }} placeholder={t("au.email")} type="email" className="flex-1 bg-transparent outline-none text-sm min-w-0" style={{ color: "var(--fg)" }} />
              </div>
              <motion.button whileTap={{ scale: 0.97 }} disabled={busy} onClick={sendPasswordReset} className="myra-primary-cta w-full py-4 rounded-full text-sm font-bold disabled:opacity-50" style={{ fontFamily: F.b }}>
                {busy ? t("au.sending") : t("au.sendReset")}
              </motion.button>
              <button onClick={() => { setStep("auth"); setMode("login"); }} className="block mx-auto mt-5 text-xs font-semibold" style={{ color: "color-mix(in srgb, var(--fg) 52%, transparent)" }}>{t("au.backLogin")}</button>
            </motion.div>
          )}

          {step === "recovery" && (
            <motion.div key="recovery" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="myra-onboarding-panel px-7 pb-10 max-w-md mx-auto w-full">
              <span className="myra-page-eyebrow">MYRA SECURITY</span>
              <h1 style={{ fontFamily: F.d, fontWeight: 900, fontSize: 30, letterSpacing: "-0.04em" }} className="mt-3 mb-2">{t("au.newPassTitle")}</h1>
              <p className="text-sm mb-6" style={{ color: "color-mix(in srgb, var(--fg) 50%, transparent)", lineHeight: 1.55 }}>{t("au.newPassSub")}</p>
              <div className="flex flex-col gap-2.5 mb-4">
                <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl" style={GLASS}>
                  <Lock size={15} style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", flexShrink: 0 }} />
                  <input value={pass} onChange={e => setPass(e.target.value)} placeholder={t("au.newPass")} type="password" autoComplete="new-password" className="flex-1 bg-transparent outline-none text-sm min-w-0" style={{ color: "var(--fg)" }} />
                </div>
                <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl" style={GLASS}>
                  <Check size={15} style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", flexShrink: 0 }} />
                  <input value={confirmPass} onChange={e => setConfirmPass(e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveNewPassword(); }} placeholder={t("au.repeatPass")} type="password" autoComplete="new-password" className="flex-1 bg-transparent outline-none text-sm min-w-0" style={{ color: "var(--fg)" }} />
                </div>
              </div>
              <motion.button whileTap={{ scale: 0.97 }} disabled={busy} onClick={saveNewPassword} className="myra-primary-cta w-full py-4 rounded-full text-sm font-bold disabled:opacity-50" style={{ fontFamily: F.b }}>
                {busy ? t("au.saving") : t("au.savePassword")}
              </motion.button>
            </motion.div>
          )}

          {/* ── Вкусы ── */}
          {step === "taste" && (
            <motion.div key="taste" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }} className="myra-onboarding-panel px-7 pb-10 max-w-md mx-auto w-full">
              <h1 style={{ fontFamily: F.d, fontWeight: 900, fontSize: 30, letterSpacing: "-0.04em" }} className="mb-1.5">{t("ta.title")}</h1>
              <p className="text-sm mb-6" style={{ color: "color-mix(in srgb, var(--fg) 50%, transparent)" }}>{t("ta.sub")}</p>

              <div className="flex flex-wrap gap-2.5 mb-7">
                {TASTE_GENRES.map(([g, c], i) => {
                  const on = picked.has(g);
                  return (
                    <motion.button
                      key={g}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.035, ...SPRING }}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => setPicked(p => { const n = new Set(p); if (n.has(g)) n.delete(g); else n.add(g); return n; })}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-colors"
                      style={{ background: on ? `${c}2b` : "color-mix(in srgb, var(--wash) 5.5%, transparent)", border: `1px solid ${on ? c : "color-mix(in srgb, var(--wash) 10%, transparent)"}`, color: on ? c : "color-mix(in srgb, var(--fg) 65%, transparent)", fontFamily: F.b }}
                    >
                      {on && <Check size={13} />}
                      {g}
                    </motion.button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}>{t("ta.picked", picked.size)}</span>
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={() => { if (picked.size >= 3) setStep("role"); }}
                  className="flex items-center gap-2 pl-6 pr-5 py-3.5 rounded-full text-sm font-bold transition-opacity"
                  style={{ background: "var(--myra-brand-gradient)", opacity: picked.size >= 3 ? 1 : 0.35, fontFamily: F.b }}
                >
                  {t("ta.continue")} <MyraGlyph name="arrow" size={15} />
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── Артист или слушатель ── */}
          {step === "role" && (
            <motion.div key="role" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }} className="myra-onboarding-panel px-7 pb-10 max-w-md mx-auto w-full">
              <h1 style={{ fontFamily: F.d, fontWeight: 900, fontSize: 30, letterSpacing: "-0.04em" }} className="mb-1.5">{t("role.title")}</h1>
              <p className="text-sm mb-7" style={{ color: "color-mix(in srgb, var(--fg) 50%, transparent)" }}>{t("role.sub")}</p>

              <div className="flex flex-col gap-3">
                {([
                  ["artist", Mic2, t("role.artistT"), t("role.artistS"), "#8b5cf6"],
                  ["listener", Headphones, t("role.listenerT"), t("role.listenerS"), "#34d399"],
                ] as const).map(([r, Icon, title, sub, c]) => (
                  <motion.button
                    key={r}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => finishRole(r as UserRole)}
                    className="flex items-start gap-4 p-5 rounded-3xl text-left"
                    style={{ ...GLASS, border: `1px solid ${c}30` }}
                  >
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${c}22` }}>
                      <Icon size={20} style={{ color: c }} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-base font-bold mb-1" style={{ fontFamily: F.b }}>{title}</div>
                      <div className="text-xs leading-relaxed" style={{ color: "color-mix(in srgb, var(--fg) 50%, transparent)" }}>{sub}</div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Подтверждение почты ── */}
          {step === "confirm" && (
            <motion.div key="confirm" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }} className="myra-onboarding-panel px-7 pb-10 max-w-md mx-auto w-full text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: "rgba(139,92,246,0.16)", border: "1px solid rgba(139,92,246,0.35)" }}>
                <Mail size={24} style={{ color: "#c4b5fd" }} />
              </div>
              <h1 style={{ fontFamily: F.d, fontWeight: 900, fontSize: 28, letterSpacing: "-0.04em" }} className="mb-2">{t("au.confirmTitle")}</h1>
              <p className="text-sm mb-8" style={{ color: "color-mix(in srgb, var(--fg) 55%, transparent)", lineHeight: 1.5 }}>{t("au.confirmSub", email.trim())}</p>

              <motion.button
                whileTap={{ scale: resendCooldown ? 1 : 0.97 }}
                onClick={resendEmail}
                className="w-full py-4 rounded-full text-sm font-bold mb-4 transition-opacity"
                style={{ background: "var(--myra-brand-gradient)", fontFamily: F.b, opacity: resendCooldown ? 0.5 : 1 }}
              >
                {t("au.resend")}{resendCooldown ? ` · ${resendCooldown}s` : ""}
              </motion.button>
              <button onClick={() => setStep("auth")} className="text-sm" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)" }}>
                {t("au.confirmBack")}
              </button>
            </motion.div>
          )}
      </div>
    </div>
  );
}
