import { useState } from "react";
import { ArrowRight, Mail, Lock, User, Check, Moon, Sun, Mic2, Headphones } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { TASTE_GENRES, TRACKS, ls } from "./data";
import { F, GLASS, SPRING, Aurora, Waveform, useTheme, GoogleIcon, VKIcon, YandexIcon } from "./lib";
import { useLang } from "./i18n";
import { supabaseEnabled, signUpWithEmail, signInWithEmail, getSession, upsertProfile } from "./supabase";

type Step = "slides" | "auth" | "taste" | "role";
export type UserRole = "artist" | "listener";

const SOCIALS: [string, (p: { size?: number }) => React.JSX.Element][] = [
  ["Google", GoogleIcon],
  ["VK", VKIcon],
  ["Яндекс", YandexIcon],
];

export function OnboardingFlow({ onDone }: { onDone: (name: string, role: UserRole, email: string) => void }) {
  const { t, lang, setLang } = useLang();
  const { theme, toggleTheme } = useTheme();
  const [step, setStep] = useState<Step>("slides");
  const [slide, setSlide] = useState(0);
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [role, setRole] = useState<UserRole | null>(null);

  const SLIDES = [
    { title: t("ob.s1t"), sub: t("ob.s1s"), c2: "#8b5cf6", img: TRACKS[0].img },
    { title: t("ob.s2t"), sub: t("ob.s2s"), c2: "#34d399", img: TRACKS[1].img },
    { title: t("ob.s3t"), sub: t("ob.s3s"), c2: "#f472b6", img: TRACKS[5].img },
  ];

  const finishName = name.trim() || (lang === "ru" ? "Алекс" : "Alex");

  const submitAuth = async () => {
    const emailOk = /.+@.+\..+/.test(email);
    if (mode === "signup" && !name.trim()) { toast(t("au.errName")); return; }
    if (!emailOk) { toast(t("au.errEmail")); return; }
    if (pass.length < 6) { toast(t("au.errPass")); return; }
    if (mode === "login") {
      if (supabaseEnabled) {
        const { error } = await signInWithEmail(email, pass);
        if (error) { toast(t("au.loginFailed", error.message)); return; }
      }
      toast(t("au.welcomeBack", finishName));
      onDone(finishName, ls.get<UserRole>("userRole", "listener"), email.trim());
    } else {
      if (supabaseEnabled) {
        // Роль ещё не выбрана — на этом шаге её нет, метаданные о ней допишет upsertProfile в finishRole
        const { error } = await signUpWithEmail(email, pass, name.trim());
        if (error) { toast(t("au.signupFailed", error.message)); return; }
      }
      toast(t("au.created"));
      setStep("taste");
    }
  };

  const social = (service: string) => {
    toast(t("au.social", service));
    setTimeout(() => setStep("taste"), 900);
  };

  const finishRole = async (r: UserRole) => {
    setRole(r);
    ls.set("taste", [...picked]);
    if (supabaseEnabled) {
      const session = await getSession();
      const uid = session?.user?.id;
      // Ждём апсерт, чтобы ошибка успела попасть в лог, но не показываем тост —
      // неудачная синхронизация профиля не должна запирать пользователя в онбординге
      if (uid) {
        try {
          const { error } = await upsertProfile(uid, { username: finishName, role: r, email: email.trim() });
          if (error) console.warn("upsertProfile:", error.message);
        } catch (err) {
          console.warn("upsertProfile:", err);
        }
      }
    }
    onDone(finishName, r, email.trim());
  };

  const S = SLIDES[slide];

  return (
    <div className="fixed inset-0 z-[90] flex flex-col overflow-hidden" style={{ background: "var(--bg)", fontFamily: F.b, color: "var(--fg)" }}>
      {/* Фон */}
      <AnimatePresence>
        <motion.img
          key={step === "slides" ? slide : step}
          src={S.img}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          style={{ filter: "var(--cover-filter)", transform: "scale(1.2)" }}
        />
      </AnimatePresence>
      <Aurora c2={S.c2} opacity={0.55} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 0%, var(--bg) var(--aurora-fade))" }} />
      <div className="absolute bottom-0 left-0 right-0 h-80" style={{ background: "linear-gradient(to top, var(--bg) 0%, transparent 100%)" }} />

      {/* Верх: лого + тема + язык */}
      <div className="relative z-10 flex items-center justify-between px-7 pt-9">
        <div style={{ fontFamily: F.d, fontWeight: 900, fontSize: 26, letterSpacing: "-0.04em" }}>MYRA</div>
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
      <div className="relative z-10 flex-1 flex flex-col justify-end md:justify-center overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {/* ── Слайды ── */}
          {step === "slides" && (
            <motion.div key={"slide" + slide} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }} className="px-7 pb-10 max-w-md mx-auto w-full">
              <div className="mb-8">
                <Waveform progress={38} color={S.c2} height={40} seed={slide * 4 + 5} bars={48} dim />
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
                    {slide < 2 ? t("ob.next") : t("ob.start")} <ArrowRight size={15} />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Вход / регистрация ── */}
          {step === "auth" && (
            <motion.div key="auth" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }} className="px-7 pb-10 max-w-md mx-auto w-full">
              <h1 style={{ fontFamily: F.d, fontWeight: 900, fontSize: 32, letterSpacing: "-0.04em" }} className="mb-1.5">{t("au.welcome")}</h1>
              <p className="text-sm mb-6" style={{ color: "color-mix(in srgb, var(--fg) 50%, transparent)" }}>{t("au.sub")}</p>

              <div className="flex gap-1 p-1 rounded-full mb-6 w-fit" style={GLASS}>
                {(["signup", "login"] as const).map(m => (
                  <button key={m} onClick={() => setMode(m)} className="relative px-5 py-2 rounded-full text-xs font-semibold" style={{ color: mode === m ? "#fff" : "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>
                    {mode === m && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="absolute inset-0 rounded-full" style={{ background: "#8b5cf6" }} />}
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

              <motion.button whileTap={{ scale: 0.97 }} onClick={submitAuth} className="w-full py-4 rounded-full text-sm font-bold mb-5" style={{ background: "linear-gradient(135deg, #8b5cf6, #a78bfa)", boxShadow: "0 12px 40px rgba(139,92,246,0.4)", fontFamily: F.b }}>
                {mode === "signup" ? t("au.doSignup") : t("au.doLogin")}
              </motion.button>

              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px" style={{ background: "color-mix(in srgb, var(--wash) 09%, transparent)" }} />
                <span className="text-[11px]" style={{ color: "color-mix(in srgb, var(--fg) 35%, transparent)", fontFamily: F.m }}>{t("au.or")}</span>
                <div className="flex-1 h-px" style={{ background: "color-mix(in srgb, var(--wash) 09%, transparent)" }} />
              </div>

              <div className="flex gap-2.5">
                {SOCIALS.map(([s, Icon]) => (
                  <motion.button key={s} whileTap={{ scale: 0.95 }} onClick={() => social(s)} className="flex-1 py-3.5 rounded-2xl flex items-center justify-center" style={{ ...GLASS }}>
                    <Icon size={20} />
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Вкусы ── */}
          {step === "taste" && (
            <motion.div key="taste" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }} className="px-7 pb-10 max-w-md mx-auto w-full">
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
                  style={{ background: "linear-gradient(135deg, #8b5cf6, #a78bfa)", opacity: picked.size >= 3 ? 1 : 0.35, fontFamily: F.b }}
                >
                  {t("ta.continue")} <ArrowRight size={15} />
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── Артист или слушатель ── */}
          {step === "role" && (
            <motion.div key="role" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }} className="px-7 pb-10 max-w-md mx-auto w-full">
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
      </div>
    </div>
  );
}
