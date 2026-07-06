import { useState } from "react";
import { ArrowRight, Mail, Lock, User, Check, Loader2, ChevronRight, Apple } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { TASTE_GENRES, TRACKS } from "./data";
import { F, GLASS, SPRING, Aurora, Waveform } from "./lib";
import { useLang } from "./i18n";

type Step = "slides" | "auth" | "taste" | "import";

export function OnboardingFlow({ onDone }: { onDone: (name: string) => void }) {
  const { t, lang, setLang } = useLang();
  const [step, setStep] = useState<Step>("slides");
  const [slide, setSlide] = useState(0);
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [importState, setImportState] = useState<"pick" | "scan" | "found" | "doing" | "done">("pick");
  const [importPct, setImportPct] = useState(0);

  const SLIDES = [
    { title: t("ob.s1t"), sub: t("ob.s1s"), c2: "#8b5cf6", img: TRACKS[0].img },
    { title: t("ob.s2t"), sub: t("ob.s2s"), c2: "#34d399", img: TRACKS[1].img },
    { title: t("ob.s3t"), sub: t("ob.s3s"), c2: "#f472b6", img: TRACKS[5].img },
  ];

  const finishName = name.trim() || (lang === "ru" ? "Алекс" : "Alex");

  const submitAuth = () => {
    const emailOk = /.+@.+\..+/.test(email);
    if (mode === "signup" && !name.trim()) { toast(t("au.errName")); return; }
    if (!emailOk) { toast(t("au.errEmail")); return; }
    if (pass.length < 6) { toast(t("au.errPass")); return; }
    if (mode === "login") {
      toast(t("au.welcomeBack", finishName));
      onDone(finishName);
    } else {
      toast(t("au.created"));
      setStep("taste");
    }
  };

  const social = (service: string) => {
    toast(t("au.social", service));
    setTimeout(() => setStep("taste"), 900);
  };

  const startScan = () => {
    setImportState("scan");
    setTimeout(() => setImportState("found"), 1400);
  };

  const doImport = () => {
    setImportState("doing");
    setImportPct(0);
    const iv = setInterval(() => {
      setImportPct(p => {
        if (p >= 100) { clearInterval(iv); setImportState("done"); return 100; }
        return p + Math.random() * 9;
      });
    }, 120);
  };

  const S = SLIDES[slide];

  return (
    <div className="fixed inset-0 z-[90] flex flex-col overflow-hidden" style={{ background: "#05050b", fontFamily: F.b, color: "#f2f2f8" }}>
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
          style={{ filter: "blur(90px) saturate(1.6) brightness(0.22)", transform: "scale(1.2)" }}
        />
      </AnimatePresence>
      <Aurora c2={S.c2} opacity={0.7} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 0%, #05050b 82%)" }} />

      {/* Верх: лого + язык */}
      <div className="relative z-10 flex items-center justify-between px-7 pt-9">
        <div style={{ fontFamily: F.d, fontWeight: 900, fontSize: 26, letterSpacing: "-0.04em" }}>MYRA</div>
        <button onClick={() => setLang(lang === "ru" ? "en" : "ru")} className="px-3.5 py-1.5 rounded-full text-xs font-semibold" style={{ ...GLASS, fontFamily: F.m }}>
          {lang === "ru" ? "EN" : "RU"}
        </button>
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
              <p className="text-base mb-9" style={{ color: "rgba(242,242,248,0.55)", lineHeight: 1.55 }}>{S.sub}</p>

              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {SLIDES.map((_, i) => (
                    <button key={i} onClick={() => setSlide(i)} className="rounded-full transition-all duration-300" style={{ width: i === slide ? 26 : 8, height: 8, background: i === slide ? S.c2 : "rgba(255,255,255,0.16)" }} />
                  ))}
                </div>
                <div className="flex items-center gap-4">
                  <button onClick={() => setStep("auth")} className="text-sm" style={{ color: "rgba(242,242,248,0.4)" }}>{t("ob.skip")}</button>
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
              <p className="text-sm mb-6" style={{ color: "rgba(242,242,248,0.5)" }}>{t("au.sub")}</p>

              <div className="flex gap-1 p-1 rounded-full mb-6 w-fit" style={GLASS}>
                {(["signup", "login"] as const).map(m => (
                  <button key={m} onClick={() => setMode(m)} className="relative px-5 py-2 rounded-full text-xs font-semibold" style={{ color: mode === m ? "#fff" : "rgba(242,242,248,0.45)", fontFamily: F.b }}>
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
                        <User size={15} style={{ color: "rgba(242,242,248,0.4)", flexShrink: 0 }} />
                        <input value={name} onChange={e => setName(e.target.value)} placeholder={t("au.name")} className="flex-1 bg-transparent outline-none text-sm min-w-0" style={{ color: "#f2f2f8" }} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl" style={GLASS}>
                  <Mail size={15} style={{ color: "rgba(242,242,248,0.4)", flexShrink: 0 }} />
                  <input value={email} onChange={e => setEmail(e.target.value)} placeholder={t("au.email")} type="email" className="flex-1 bg-transparent outline-none text-sm min-w-0" style={{ color: "#f2f2f8" }} />
                </div>
                <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl" style={GLASS}>
                  <Lock size={15} style={{ color: "rgba(242,242,248,0.4)", flexShrink: 0 }} />
                  <input value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => { if (e.key === "Enter") submitAuth(); }} placeholder={t("au.pass")} type="password" className="flex-1 bg-transparent outline-none text-sm min-w-0" style={{ color: "#f2f2f8" }} />
                </div>
              </div>

              <motion.button whileTap={{ scale: 0.97 }} onClick={submitAuth} className="w-full py-4 rounded-full text-sm font-bold mb-5" style={{ background: "linear-gradient(135deg, #8b5cf6, #a78bfa)", boxShadow: "0 12px 40px rgba(139,92,246,0.4)", fontFamily: F.b }}>
                {mode === "signup" ? t("au.doSignup") : t("au.doLogin")}
              </motion.button>

              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.09)" }} />
                <span className="text-[11px]" style={{ color: "rgba(242,242,248,0.35)", fontFamily: F.m }}>{t("au.or")}</span>
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.09)" }} />
              </div>

              <div className="flex gap-2.5">
                {[["Google", "G", "#f2f2f8"], ["Apple", "apple", "#f2f2f8"], ["VK", "VK", "#5b9bff"]].map(([s, label, color]) => (
                  <motion.button key={s} whileTap={{ scale: 0.95 }} onClick={() => social(s)} className="flex-1 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center" style={{ ...GLASS, color, fontFamily: F.d }}>
                    {label === "apple" ? <Apple size={17} /> : label}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Вкусы ── */}
          {step === "taste" && (
            <motion.div key="taste" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }} className="px-7 pb-10 max-w-md mx-auto w-full">
              <h1 style={{ fontFamily: F.d, fontWeight: 900, fontSize: 30, letterSpacing: "-0.04em" }} className="mb-1.5">{t("ta.title")}</h1>
              <p className="text-sm mb-6" style={{ color: "rgba(242,242,248,0.5)" }}>{t("ta.sub")}</p>

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
                      style={{ background: on ? `${c}2b` : "rgba(255,255,255,0.055)", border: `1px solid ${on ? c : "rgba(255,255,255,0.1)"}`, color: on ? c : "rgba(242,242,248,0.65)", fontFamily: F.b }}
                    >
                      {on && <Check size={13} />}
                      {g}
                    </motion.button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "rgba(242,242,248,0.4)", fontFamily: F.m }}>{t("ta.picked", picked.size)}</span>
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={() => picked.size >= 3 && setStep("import")}
                  className="flex items-center gap-2 pl-6 pr-5 py-3.5 rounded-full text-sm font-bold transition-opacity"
                  style={{ background: "linear-gradient(135deg, #8b5cf6, #a78bfa)", opacity: picked.size >= 3 ? 1 : 0.35, fontFamily: F.b }}
                >
                  {t("ta.continue")} <ArrowRight size={15} />
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── Импорт библиотеки ── */}
          {step === "import" && (
            <motion.div key="import" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }} className="px-7 pb-10 max-w-md mx-auto w-full">
              <h1 style={{ fontFamily: F.d, fontWeight: 900, fontSize: 30, letterSpacing: "-0.04em" }} className="mb-1.5">{t("im.title")}</h1>
              <p className="text-sm mb-6" style={{ color: "rgba(242,242,248,0.5)" }}>{t("im.sub")}</p>

              {importState === "pick" && (
                <div className="flex flex-col gap-2.5 mb-6">
                  {[["Spotify", "S", "#1db954"], ["Яндекс Музыка", "Я", "#ffcc00"], ["SoundCloud", "SC", "#ff5500"]].map(([s, ini, c], i) => (
                    <motion.button key={s} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} whileTap={{ scale: 0.97 }} onClick={startScan} className="flex items-center gap-4 px-4 py-4 rounded-2xl text-left" style={GLASS}>
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-black flex-shrink-0" style={{ background: `${c}1f`, color: c, fontFamily: F.d, fontSize: 15 }}>{ini}</div>
                      <span className="flex-1 text-sm font-semibold" style={{ fontFamily: F.b }}>{s}</span>
                      <ChevronRight size={16} style={{ color: "rgba(242,242,248,0.3)" }} />
                    </motion.button>
                  ))}
                </div>
              )}

              {importState === "scan" && (
                <div className="flex items-center gap-4 px-5 py-6 rounded-2xl mb-6" style={GLASS}>
                  <Loader2 size={20} className="animate-spin" style={{ color: "#8b5cf6" }} />
                  <span className="text-sm" style={{ fontFamily: F.b }}>{t("im.scan")}</span>
                </div>
              )}

              {importState === "found" && (
                <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="px-5 py-6 rounded-2xl mb-6" style={GLASS}>
                  <div className="text-sm font-semibold mb-4" style={{ fontFamily: F.b }}>{t("im.found")}</div>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={doImport} className="w-full py-3.5 rounded-full text-sm font-bold" style={{ background: "linear-gradient(135deg, #8b5cf6, #a78bfa)", fontFamily: F.b }}>
                    {t("im.import")}
                  </motion.button>
                </motion.div>
              )}

              {importState === "doing" && (
                <div className="px-5 py-6 rounded-2xl mb-6" style={GLASS}>
                  <div className="text-xs mb-2.5" style={{ color: "rgba(242,242,248,0.5)", fontFamily: F.m }}>{t("im.doing")} {Math.round(importPct)}%</div>
                  <div className="rounded-full overflow-hidden" style={{ height: 6, background: "rgba(255,255,255,0.1)" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${importPct}%`, background: "linear-gradient(90deg, #8b5cf6, #c4b5fd)" }} />
                  </div>
                </div>
              )}

              {importState === "done" && (
                <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING} className="flex items-center gap-4 px-5 py-6 rounded-2xl mb-6" style={{ background: "rgba(52,211,153,0.09)", border: "1px solid rgba(52,211,153,0.3)" }}>
                  <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(52,211,153,0.15)" }}>
                    <Check size={20} style={{ color: "#34d399" }} />
                  </div>
                  <span className="text-sm font-semibold" style={{ color: "#34d399", fontFamily: F.b }}>{t("im.done")}</span>
                </motion.div>
              )}

              <div className="flex items-center justify-between">
                <button onClick={() => onDone(finishName)} className="text-sm" style={{ color: "rgba(242,242,248,0.4)" }}>{t("im.later")}</button>
                <motion.button whileTap={{ scale: 0.94 }} onClick={() => onDone(finishName)} className="flex items-center gap-2 pl-6 pr-5 py-3.5 rounded-full text-sm font-bold" style={{ background: importState === "done" ? "linear-gradient(135deg, #34d399, #6ee7b7)" : "linear-gradient(135deg, #8b5cf6, #a78bfa)", color: importState === "done" ? "#04120c" : "#fff", fontFamily: F.b }}>
                  {t("im.go")} <ArrowRight size={15} />
                </motion.button>
              </div>
            </motion.div>
          )}
      </div>
    </div>
  );
}
