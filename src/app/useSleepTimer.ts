import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useLang } from "./i18n";

// Таймер сна плеера — тик раз в 30 с, а не каждую секунду: UI показывает
// только минуты, а посекундный setState перерисовывал бы всё дерево (и
// пересоздавал интервал)
export function useSleepTimer(pause: () => void) {
  const { t } = useLang();
  const [sleepLeft, setSleepLeft] = useState<number | null>(null);
  const sleepActive = sleepLeft !== null;

  useEffect(() => {
    if (!sleepActive) return;
    const iv = setInterval(() => {
      setSleepLeft(s => {
        if (s === null) return null;
        if (s <= 30) {
          pause();
          toast(t("pl.sleepDone"));
          return null;
        }
        return s - 30;
      });
    }, 30_000);
    return () => clearInterval(iv);
  }, [sleepActive, pause, t]);

  const handleSleep = useCallback((minutes: number | null) => {
    setSleepLeft(minutes === null ? null : minutes * 60);
  }, []);

  return { sleepLeft, handleSleep };
}
