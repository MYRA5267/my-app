import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Track } from "./data";
import {
  isNativeAndroid,
  MyraMedia,
  prepareNativeArtwork,
  type NativeMediaCommand,
} from "./nativeMedia";

type MediaControls = {
  playing: boolean;
  duration: number;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (pct: number) => void;
  like: () => void;
  flow: () => void;
};

/**
 * Keeps two media surfaces in sync:
 * - the browser Media Session API for the web/PWA;
 * - MYRA's native Android MediaSession for the notification shade and lock screen.
 */
export function useMediaSession(params: {
  currentTrack: Track;
  playing: boolean;
  duration: number;
  progress: number;
  liked: boolean;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (pct: number) => void;
  like: () => void;
  flow: () => void;
}) {
  const {
    currentTrack, playing, duration, progress, liked,
    toggle, next, prev, seek, like, flow,
  } = params;

  const controlsRef = useRef<MediaControls>({
    playing: false,
    duration: 0,
    toggle: () => {},
    next: () => {},
    prev: () => {},
    seek: () => {},
    like: () => {},
    flow: () => {},
  });
  const permissionRequestedRef = useRef(false);
  const permissionDeniedShownRef = useRef(false);
  const nativeErrorShownRef = useRef(false);
  controlsRef.current = { playing, duration, toggle, next, prev, seek, like, flow };

  const reportNativeError = (cause: unknown) => {
    const message = cause instanceof Error ? cause.message : String(cause || "Неизвестная ошибка MediaSession");
    console.error("[MYRA native media]", cause);
    if (nativeErrorShownRef.current) return;
    nativeErrorShownRef.current = true;
    toast.error("Системный плеер Android не запустился", { description: message });
  };

  // Web/PWA handlers. Refs keep system callbacks fresh without re-registering
  // them on every React render.
  useEffect(() => {
    if (isNativeAndroid || !("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    session.setActionHandler("play", () => {
      if (!controlsRef.current.playing) controlsRef.current.toggle();
    });
    session.setActionHandler("pause", () => {
      if (controlsRef.current.playing) controlsRef.current.toggle();
    });
    session.setActionHandler("nexttrack", () => controlsRef.current.next());
    session.setActionHandler("previoustrack", () => controlsRef.current.prev());
    try {
      session.setActionHandler("seekto", (details) => {
        const total = controlsRef.current.duration;
        if (details.seekTime == null || !total) return;
        controlsRef.current.seek((details.seekTime / total) * 100);
      });
    } catch {
      // Some older WebViews do not implement seekto.
    }
    return () => {
      session.setActionHandler("play", null);
      session.setActionHandler("pause", null);
      session.setActionHandler("nexttrack", null);
      session.setActionHandler("previoustrack", null);
      try { session.setActionHandler("seekto", null); } catch { /* unsupported */ }
    };
  }, []);

  useEffect(() => {
    if (isNativeAndroid || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: currentTrack.album,
      artwork: [{ src: currentTrack.img, sizes: "512x512" }],
    });
  }, [currentTrack]);

  useEffect(() => {
    if (isNativeAndroid || !("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }, [playing]);

  useEffect(() => {
    if (isNativeAndroid || !("mediaSession" in navigator) || !navigator.mediaSession.setPositionState) return;
    if (!duration || !Number.isFinite(duration)) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        position: Math.min((progress / 100) * duration, duration),
        playbackRate: 1,
      });
    } catch {
      // Track changes can briefly make duration and position disagree.
    }
  }, [duration, progress]);

  // Android system actions are delivered back by the foreground service.
  useEffect(() => {
    if (!isNativeAndroid) return;
    let disposed = false;
    let removeCommandListener: (() => Promise<void>) | undefined;
    let removeErrorListener: (() => Promise<void>) | undefined;

    const onCommand = (event: NativeMediaCommand) => {
      const ctl = controlsRef.current;
      switch (event.command) {
        case "play": if (!ctl.playing) ctl.toggle(); break;
        case "pause": if (ctl.playing) ctl.toggle(); break;
        case "next": ctl.next(); break;
        case "previous": ctl.prev(); break;
        case "flow": ctl.flow(); break;
        case "like": ctl.like(); break;
        case "seek":
          if (ctl.duration > 0) ctl.seek((event.position / ctl.duration) * 100);
          break;
      }
    };

    void MyraMedia.addListener("mediaCommand", onCommand).then((handle) => {
      if (disposed) void handle.remove();
      else removeCommandListener = () => handle.remove();
    }).catch(reportNativeError);
    void MyraMedia.addListener("mediaError", (event) => {
      reportNativeError(event.message);
    }).then((handle) => {
      if (disposed) void handle.remove();
      else removeErrorListener = () => handle.remove();
    }).catch(reportNativeError);
    return () => {
      disposed = true;
      void removeCommandListener?.();
      void removeErrorListener?.();
    };
  }, []);

  // PlaybackState already extrapolates position while speed=1. Sending an
  // Android service intent every second is unnecessary and, once the app is
  // backgrounded, can trigger OEM foreground-service restrictions. Update
  // only when the track or an actual control state changes.
  const nativeKey = isNativeAndroid
    ? `${currentTrack.id}|${playing}|${liked}|${Math.round(duration)}`
    : "";
  useEffect(() => {
    if (!isNativeAndroid || (!playing && !duration)) return;
    if (!permissionRequestedRef.current) {
      permissionRequestedRef.current = true;
      // Ask at the first playback attempt, when the reason for the system
      // notification is clear to the user.
      void MyraMedia.requestPermissions().then((status) => {
        const notifications = status.notifications;
        if (
          notifications
          && notifications !== "granted"
          && !permissionDeniedShownRef.current
        ) {
          permissionDeniedShownRef.current = true;
          toast.warning("Разреши уведомления MYRA", {
            description: "Без этого системный мини‑плеер не появится в шторке Android.",
          });
        }
      }).catch((error) => {
        console.warn("[MYRA notification permission]", error);
      });
    }
    let cancelled = false;
    const position = duration > 0 ? Math.min((progress / 100) * duration, duration) : 0;
    const baseState = {
      id: String(currentTrack.id),
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: currentTrack.album,
      playing,
      liked,
      duration,
      position,
    };

    // Never make the foreground service wait for SVG decoding. Android gets a
    // valid media session immediately and uses the bundled MYRA artwork until
    // the optional cover conversion finishes.
    const directArtwork = currentTrack.img.startsWith("data:image/svg+xml")
      ? undefined
      : currentTrack.img;
    void MyraMedia.update({ ...baseState, artwork: directArtwork }).catch(reportNativeError);

    void prepareNativeArtwork(currentTrack.img).then((artwork) => {
      if (cancelled || !artwork || artwork === directArtwork) return;
      void MyraMedia.update({ ...baseState, artwork }).catch(reportNativeError);
    });
    return () => { cancelled = true; };
    // nativeKey intentionally excludes high-frequency progress updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nativeKey]);
}
