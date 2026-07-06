import { useState, useEffect, useRef } from "react";
import { Play, Pause, Heart, Flame, Zap, Sparkles, UserPlus, LogOut, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { TRACKS, type Track, type Friend } from "./data";
import { F, GLASS, SPRING, Sheet, Aurora, Waveform, EQ } from "./lib";
import { useLang } from "./i18n";

const REACTIONS = [
  { id: "heart", Icon: Heart,    color: "#f472b6" },
  { id: "flame", Icon: Flame,    color: "#fb923c" },
  { id: "zap",   Icon: Zap,      color: "#facc15" },
  { id: "spark", Icon: Sparkles, color: "#8b5cf6" },
];

interface Floater { key: number; reaction: typeof REACTIONS[number]; x: number; mine: boolean }

export function LiveSessionSheet({ friend, onClose, currentTrack, playing, progress, onToggle, onPlay, avatar }: {
  friend: Friend | null; onClose: () => void;
  currentTrack: Track; playing: boolean; progress: number;
  onToggle: () => void; onPlay: (t: Track) => void; avatar: string;
}) {
  const { t, lang } = useLang();
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const keyRef = useRef(0);

  const spawn = (reaction: typeof REACTIONS[number], mine: boolean) => {
    const f: Floater = { key: ++keyRef.current, reaction, x: 12 + Math.random() * 76, mine };
    setFloaters(fs => [...fs.slice(-14), f]);
  };

  // Друг «в реальном времени» шлёт реакции, пока сессия открыта
  useEffect(() => {
    if (!friend) { setFloaters([]); return; }
    const iv = setInterval(() => {
      spawn(REACTIONS[Math.floor(Math.random() * REACTIONS.length)], false);
    }, 2800);
    return () => clearInterval(iv);
  }, [friend]);

  if (!friend) return <Sheet open={false} onClose={onClose} z={58}><div /></Sheet>;

  const fname = lang === "ru" ? friend.inst : friend.en;
  const c2 = currentTrack.c2;
  const upNext = TRACKS.filter(tr => tr.id !== currentTrack.id && tr.genre === friend.track.genre).slice(0, 2);
  const queue = upNext.length ? upNext : TRACKS.slice(0, 2);

  return (
    <Sheet open={!!friend} onClose={onClose} z={58}>
      <div className="relative px-6 pt-7 pb-8 overflow-hidden">
        <Aurora c2={c2} opacity={0.55} />

        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center z-20" style={{ background: "rgba(255,255,255,0.07)" }}>
          <X size={16} />
        </button>

        {/* LIVE + заголовок */}
        <div className="relative z-10 flex items-center gap-2.5 mb-5">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-[0.14em]" style={{ background: "rgba(248,113,113,0.14)", border: "1px solid rgba(248,113,113,0.35)", color: "#f87171", fontFamily: F.m }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#f87171", animation: "orbPulse 1.6s ease-in-out infinite" }} />
            LIVE
          </span>
          <span className="text-[10px]" style={{ color: "rgba(242,242,248,0.4)", fontFamily: F.m }}>{t("live.sync")}</span>
        </div>

        <div className="relative z-10 mb-6">
          <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 26, letterSpacing: "-0.03em" }}>{t("live.with", fname)}</div>
          <div className="flex items-center gap-3 mt-3">
            <div className="flex -space-x-3">
              <img src={avatar} alt="" className="w-10 h-10 rounded-full object-cover relative z-10" style={{ border: `2px solid ${c2}` }} />
              <img src={friend.img} alt="" className="w-10 h-10 rounded-full object-cover" style={{ border: "2px solid #8b5cf6" }} />
            </div>
            <span className="text-xs" style={{ color: "rgba(242,242,248,0.5)", fontFamily: F.b }}>{t("live.listeners", 2)}</span>
          </div>
        </div>

        {/* Сейчас играет + летящие реакции */}
        <div className="relative z-10 rounded-[22px] overflow-hidden mb-5" style={GLASS}>
          {/* зона реакций */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 20 }}>
            <AnimatePresence>
              {floaters.map(f => {
                const Icon = f.reaction.Icon;
                return (
                  <motion.div
                    key={f.key}
                    initial={{ opacity: 0, y: 0, scale: 0.6 }}
                    animate={{ opacity: [0, 1, 1, 0], y: -150, scale: 1.1, rotate: f.mine ? 8 : -8 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 2.2, ease: "easeOut" }}
                    onAnimationComplete={() => setFloaters(fs => fs.filter(x => x.key !== f.key))}
                    className="absolute bottom-2"
                    style={{ left: `${f.x}%` }}
                  >
                    <Icon size={f.mine ? 22 : 17} fill={f.reaction.color} stroke="none" style={{ filter: `drop-shadow(0 0 6px ${f.reaction.color}aa)` }} />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-4 p-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0" style={{ boxShadow: `0 8px 26px ${c2}44` }}>
              <img src={currentTrack.img} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate flex items-center gap-2" style={{ fontFamily: F.b }}>
                {currentTrack.title}
                {playing && <EQ color={c2} size={10} />}
              </div>
              <div className="text-xs truncate mb-2" style={{ color: "rgba(242,242,248,0.45)", fontFamily: F.b }}>{currentTrack.artist}</div>
              <Waveform progress={progress} color={c2} height={22} seed={currentTrack.id + 3} bars={40} dim playing={playing} />
            </div>
            <motion.button whileTap={{ scale: 0.85 }} onClick={onToggle} className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg, ${c2}, ${c2}aa)` }}>
              {playing ? <Pause size={16} fill="white" stroke="none" /> : <Play size={16} fill="white" stroke="none" className="ml-0.5" />}
            </motion.button>
          </div>
        </div>

        {/* Реакции */}
        <div className="relative z-10 mb-6">
          <div className="text-[10px] mb-2.5" style={{ color: "rgba(242,242,248,0.4)", fontFamily: F.m }}>{t("live.react", lang === "ru" ? friend.name : friend.en)}</div>
          <div className="flex gap-2.5">
            {REACTIONS.map(r => {
              const Icon = r.Icon;
              return (
                <motion.button key={r.id} whileTap={{ scale: 0.8 }} onClick={() => spawn(r, true)} className="w-12 h-12 rounded-full flex items-center justify-center" style={{ ...GLASS, border: `1px solid ${r.color}33` }}>
                  <Icon size={18} style={{ color: r.color }} />
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Дальше у друга */}
        <div className="relative z-10 mb-6">
          <div className="text-[10px] uppercase tracking-[0.16em] mb-2.5" style={{ color: "rgba(242,242,248,0.4)", fontFamily: F.m }}>{t("live.upNext", lang === "ru" ? friend.name : friend.en)}</div>
          {queue.map(tr => (
            <div key={tr.id} onClick={() => onPlay(tr)} className="flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer hover:bg-white/5 transition-colors">
              <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
                <img src={tr.img} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate" style={{ fontFamily: F.b }}>{tr.title}</div>
                <div className="text-xs truncate" style={{ color: "rgba(242,242,248,0.4)", fontFamily: F.b }}>{tr.artist}</div>
              </div>
              <Play size={13} style={{ color: "rgba(242,242,248,0.3)" }} />
            </div>
          ))}
        </div>

        <div className="relative z-10 flex gap-2.5">
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => toast(t("live.invited"))} className="flex-1 py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2" style={{ background: `linear-gradient(135deg, ${c2}, ${c2}99)`, color: "#fff", fontFamily: F.b }}>
            <UserPlus size={13} /> {t("live.invite")}
          </motion.button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => { toast(t("live.left")); onClose(); }} className="flex-1 py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2" style={{ ...GLASS, color: "rgba(242,242,248,0.65)", fontFamily: F.b }}>
            <LogOut size={13} /> {t("live.leave")}
          </motion.button>
        </div>
      </div>
    </Sheet>
  );
}
