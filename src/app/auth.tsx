import { useState, useEffect, useRef } from "react";
import { ArrowRight, Mail, Lock, User, Check, Moon, Sun, Mic2, Headphones, KeyRound } from "./myraIcons";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { TASTE_GENRES, TRACKS, ls } from "./data";
import { F, GLASS, SPRING, useTheme } from "./lib";
import { MyraWordmark } from "./logo";
import { MyraGlyph } from "./myraIcons";
import { DetailBackdrop, DetailWave } from "./detail";
import { useLang } from "./i18n";
import { track } from "./analytics";
import { COMPANIONS, type CompanionId, type CompanionController } from "./companion";
import {
  supabaseEnabled, signUpWithEmail, signInWithEmail, signInWithOAuth,
  requestPasswordReset, updatePassword, oauthProviders, onAuthEvent,
  canUsePasskeys, signInWithPasskey,
  getSession, upsertProfile, fetchProfile, resendConfirmation,
  type MyraOAuthProvider,
} from "./supabase";

type Step = "companion" | "slides" | "auth" | "forgot" | "recovery" | "taste" | "role" | "confirm";
export type UserRole = "artist" | "listener";

// Круговой частотный визуализатор вокруг спутника (наш FrequencyOrb-мотив).
// Геометрия статична — считаем один раз на модуль, красим акцентом в рендере.
const RING_BARS = Array.from({ length: 60 }, (_, i) => {
  const a = (i / 60) * Math.PI * 2;
  const h = 8 + 26 * Math.abs(Math.sin(i * 1.7));
  return {
    x1: 150 + Math.cos(a) * 118, y1: 150 + Math.sin(a) * 118,
    x2: 150 + Math.cos(a) * (118 + h), y2: 150 + Math.sin(a) * (118 + h),
    o: +(0.3 + 0.5 * Math.abs(Math.sin(i * 1.7))).toFixed(2), alt: i % 2 === 0,
  };
});

export function OnboardingFlow({ onDone, forceRecovery = false, onRecoveryDone, companion }: {
  onDone: (name: string, role: UserRole, email: string, handle?: string | null) => void;
  forceRecovery?: boolean;
  onRecoveryDone?: () => void;
  companion?: CompanionController;
}) {
  const { t, lang, setLang } = useLang();
  const { theme, toggleTheme } = useTheme();
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState<Step>(() => forceRecovery || new URL(window.location.href).searchParams.get("password-recovery") === "1" ? "recovery" : "companion");
  const [slide, setSlide] = useState(0);
  // Выбор спутника на входе. Спутник уже связан → входим сразу на auth.
  const [companionPick, setCompanionPick] = useState<CompanionId>(() => (companion?.state.selectedId as CompanionId) ?? "luma");
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
  const pickedComp = COMPANIONS.find(c => c.id === companionPick) ?? COMPANIONS[0];
  const others = COMPANIONS.filter(c => c.id !== companionPick);
  // Спутник задаёт настроение профиля, но не подменяет способ авторизации.
  const enterLabel = lang === "ru"
    ? `Продолжить с ${({ luma: "Люмой", spark: "Искрой", echo: "Эхо" } as Record<CompanionId, string>)[companionPick]}`
    : t("comp.enter", pickedComp.name);
  // Бесконечные лупы отключаем на слабом железе (fx-simple) и при reduce-motion.
  const weakFx = typeof document !== "undefined" && !!document.querySelector(".fx-simple");
  const liveMotion = !reducedMotion && !weakFx;
  // Экраны «вокруг спутника»: спокойный аврора-фон в цвет питомца, без случайной
  // обложки трека — так вход/настройка читаются как единый премиальный портал.
  const companionStep = step === "companion" || step === "auth" || step === "taste";

  const enterWithCompanion = () => {
    // Закрепляем спутника (если ещё не связан) и уходим на регистрацию.
    if (companion && !companion.state.selectedId) companion.select(companionPick);
    setMode("signup");
    setStep("auth");
  };

  return (
    <div className="myra-onboarding fixed inset-0 z-[90] flex flex-col overflow-hidden" style={{ background: "var(--bg)", fontFamily: F.b, color: "var(--fg)" }}>
      {/* Фон */}
      {!companionStep && (
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
      )}
      <DetailBackdrop variant="soft" accent={companionStep ? pickedComp.accent : S.c2} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 0%, var(--bg) var(--aurora-fade))" }} />
      <div className="absolute bottom-0 left-0 right-0 h-80" style={{ background: "linear-gradient(to top, var(--bg) 0%, transparent 100%)" }} />

      {/* Верх: wordmark + тема + язык */}
      <div className="myra-onboarding-header relative z-10 flex items-center justify-between px-7 pt-9">
        <MyraWordmark height={26} />
        <div className="flex items-center gap-2">
          <motion.button whileTap={{ scale: 0.88 }} onClick={toggleTheme} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ ...GLASS }}>
            {theme === "dark" ? <Moon size={15} /> : <Sun size={15} />}
          </motion.button>
          <button onClick={() => setLang(lang === "ru" ? "en" : "ru")} className="px-3.5 py-1.5 rounded-full text-xs font-semibold" style={{ ...GLASS, fontFamily: F.m }}>
            {lang === "ru" ? "EN" : "RU"}
          </button>
        </div>
      </div>

      {/* На телефоне контент прижат вниз (удобно большим пальцем), на планшете/ПК/ТВ — по центру */}
      <div className="myra-onboarding-content relative z-10 flex-1 flex flex-col justify-end md:justify-center overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {/* ── Выбор спутника (вход) ── */}
          {step === "companion" && (
            <motion.div key="companion" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="myra-onboarding-panel is-companion px-6 pb-9 pt-4 max-w-md mx-auto w-full flex flex-col items-center text-center">
              <h1 style={{ fontFamily: F.d, fontWeight: 900, fontSize: 30, letterSpacing: "-0.04em", lineHeight: 1.05 }}>{t("comp.title")}</h1>

              {/* трио: центр — выбранный, по бокам — остальные (тап делает их центром) */}
              <div className="relative flex items-center justify-center gap-1 mt-6" style={{ height: 234 }}>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setCompanionPick(others[0].id)} className="relative shrink-0" style={{ width: 96, transform: "translateY(22px)", opacity: 0.6 }} aria-label={others[0].name}>
                  <div className="absolute inset-0" style={{ borderRadius: "50%", background: `radial-gradient(circle, ${others[0].accent}55, transparent 66%)`, filter: "blur(12px)" }} />
                  <img src={others[0].image} alt={others[0].name} style={{ width: 96, height: 96, objectFit: "contain", position: "relative" }} />
                </motion.button>

                <div className="relative shrink-0" style={{ width: 216, height: 216 }}>
                  <motion.div className="absolute inset-0" animate={liveMotion ? { rotate: 360 } : undefined} transition={{ duration: 42, ease: "linear", repeat: Infinity }}>
                    <svg viewBox="0 0 300 300" style={{ width: "100%", height: "100%" }}>
                      {RING_BARS.map((b, i) => (
                        <line key={i} x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} stroke={b.alt ? pickedComp.accent : pickedComp.accent2} strokeWidth={2.3} strokeLinecap="round" opacity={b.o} />
                      ))}
                    </svg>
                  </motion.div>
                  <div className="absolute" style={{ inset: "16%", borderRadius: "50%", background: `radial-gradient(circle, ${pickedComp.accent}66, ${pickedComp.accent2}33 46%, transparent 68%)`, filter: "blur(8px)" }} />
                  <AnimatePresence mode="popLayout">
                    <motion.img
                      key={pickedComp.id}
                      src={pickedComp.image}
                      alt={pickedComp.name}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={liveMotion ? { opacity: 1, scale: 1, y: [0, -7, 0] } : { opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={liveMotion ? { opacity: { duration: 0.4 }, scale: { duration: 0.4 }, y: { duration: 4, repeat: Infinity, ease: "easeInOut" } } : { duration: 0.3 }}
                      style={{ width: "74%", height: "74%", objectFit: "contain", position: "absolute", inset: 0, margin: "auto", filter: `drop-shadow(0 16px 40px ${pickedComp.accent}99)` }}
                    />
                  </AnimatePresence>
                </div>

                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setCompanionPick(others[1].id)} className="relative shrink-0" style={{ width: 96, transform: "translateY(22px)", opacity: 0.6 }} aria-label={others[1].name}>
                  <div className="absolute inset-0" style={{ borderRadius: "50%", background: `radial-gradient(circle, ${others[1].accent}55, transparent 66%)`, filter: "blur(12px)" }} />
                  <img src={others[1].image} alt={others[1].name} style={{ width: 96, height: 96, objectFit: "contain", position: "relative" }} />
                </motion.button>
              </div>

              <motion.div key={pickedComp.id + "-copy"} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mt-2">
                <h2 style={{ fontFamily: F.d, fontWeight: 900, fontSize: 38, letterSpacing: "-0.03em", lineHeight: 1 }}>{pickedComp.name}</h2>
                <p className="mt-2 mx-auto" style={{ maxWidth: 300, fontSize: 13.5, lineHeight: 1.5, color: "color-mix(in srgb, var(--fg) 58%, transparent)" }}>{pickedComp.copy[lang].ability}</p>
              </motion.div>

              <div className="flex items-center justify-center gap-2 mt-4">
                {COMPANIONS.map(c => (
                  <button key={c.id} onClick={() => setCompanionPick(c.id)} aria-label={c.name} className="rounded-full transition-all duration-300" style={{ width: c.id === companionPick ? 22 : 7, height: 7, background: c.id === companionPick ? `linear-gradient(90deg, ${pickedComp.accent}, ${pickedComp.accent2})` : "color-mix(in srgb, var(--fg) 22%, transparent)" }} />
                ))}
              </div>

              <motion.button whileTap={{ scale: 0.96 }} onClick={enterWithCompanion} className="w-full mt-6 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold" style={{ background: `linear-gradient(108deg, ${pickedComp.accent}, ${pickedComp.accent2})`, color: "#160f26", fontSize: 16, boxShadow: `0 16px 40px ${pickedComp.accent2}55` }}>
                {enterLabel} <MyraGlyph name="arrow" size={16} />
              </motion.button>
              <button onClick={() => { setMode("login"); setStep("auth"); }} className="mt-4 text-sm" style={{ color: "color-mix(in srgb, var(--fg) 50%, transparent)" }}>
                {t("comp.have")} <b style={{ color: pickedComp.accent }}>{t("comp.signin")}</b>
              </button>
            </motion.div>
          )}

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
              {/* Портал спутника — «аватар аккаунта» в духе Yandex ID, но это твой спутник */}
              <div className="flex flex-col items-center text-center mb-6">
                <div className="relative" style={{ width: 104, height: 104 }}>
                  <div className="absolute" style={{ inset: "-16%", borderRadius: 36, background: `radial-gradient(circle, ${pickedComp.accent}55, transparent 70%)`, filter: "blur(16px)" }} />
                  <div className="relative w-full h-full flex items-center justify-center" style={{ borderRadius: 30, background: `linear-gradient(150deg, ${pickedComp.accent}26, ${pickedComp.accent2}14)`, border: `1px solid ${pickedComp.accent}44`, boxShadow: `0 18px 44px ${pickedComp.accent2}44` }}>
                    <motion.img src={pickedComp.image} alt={pickedComp.name} animate={liveMotion ? { y: [0, -5, 0] } : undefined} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} style={{ width: "82%", height: "82%", objectFit: "contain", filter: `drop-shadow(0 10px 22px ${pickedComp.accent}99)` }} />
                  </div>
                </div>
                <h1 style={{ fontFamily: F.d, fontWeight: 900, fontSize: 30, letterSpacing: "-0.04em", marginTop: 16 }}>{mode === "login" ? t("au.backTitle") : t("au.welcome")}</h1>
                <p className="text-sm mt-1.5" style={{ color: "color-mix(in srgb, var(--fg) 48%, transparent)" }}>{mode === "login" ? t("au.backSub") : t("au.sub")}</p>

                <div className="flex gap-1 p-1 rounded-full mt-5" style={GLASS}>
                  {(["signup", "login"] as const).map(m => (
                    <button key={m} onClick={() => setMode(m)} className="relative px-5 py-2 rounded-full text-xs font-semibold" style={{ color: mode === m ? "#fff" : "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>
                      {mode === m && <motion.div layoutId="auth-mode-pill" className="absolute inset-0 rounded-full myra-brand-fill" transition={SPRING} />}
                      <span className="relative z-10">{m === "signup" ? t("au.signup") : t("au.login")}</span>
                    </button>
                  ))}
                </div>
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

          {/* ── Настройка под спутника (без выбора жанров) ── */}
          {step === "taste" && (
            <motion.div key="taste" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }} className="myra-onboarding-panel px-7 pb-10 max-w-md mx-auto w-full flex flex-col items-center text-center">
              <div className="relative" style={{ width: 168, height: 168, marginTop: 6 }}>
                <div className="absolute" style={{ inset: "12%", borderRadius: "50%", background: `radial-gradient(circle, ${pickedComp.accent}66, ${pickedComp.accent2}33 46%, transparent 68%)`, filter: "blur(10px)" }} />
                <motion.img
                  src={pickedComp.image}
                  alt={pickedComp.name}
                  animate={liveMotion ? { y: [0, -7, 0], scale: [1, 1.03, 1] } : undefined}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  style={{ width: "100%", height: "100%", objectFit: "contain", position: "relative", filter: `drop-shadow(0 16px 40px ${pickedComp.accent}88)` }}
                />
              </div>
              <h1 style={{ fontFamily: F.d, fontWeight: 900, fontSize: 28, letterSpacing: "-0.04em", lineHeight: 1.05, marginTop: 12 }}>{t("ta.tuneTitle", pickedComp.name)}</h1>
              <p className="text-sm mt-3" style={{ maxWidth: 320, color: "color-mix(in srgb, var(--fg) 55%, transparent)", lineHeight: 1.55 }}>{t("ta.tuneSub")}</p>

              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => setStep("role")}
                className="w-full mt-8 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold"
                style={{ background: `linear-gradient(108deg, ${pickedComp.accent}, ${pickedComp.accent2})`, color: "#160f26", fontSize: 16, boxShadow: `0 16px 40px ${pickedComp.accent2}55`, fontFamily: F.b }}
              >
                {t("ta.continue")} <MyraGlyph name="arrow" size={16} />
              </motion.button>
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
