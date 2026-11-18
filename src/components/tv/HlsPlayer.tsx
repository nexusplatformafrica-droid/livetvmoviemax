import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Settings,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type PlayerStatus = "connecting" | "live" | "error";

export interface PlayerStats {
  height: number | null;
  bitrateKbps: number | null;
  bufferSec: number;
}

export interface QualityLevel {
  index: number;
  height: number;
  bitrate: number;
}

interface Props {
  src: string;
  poster?: string;
  quality: number; // -1 = auto
  onQuality?: (q: number) => void;
  onStatus: (s: PlayerStatus) => void;
  onStats: (s: PlayerStats) => void;
  onLevels: (levels: QualityLevel[]) => void;
}

type HlsLike = { currentLevel: number; liveSyncPosition: number | null; destroy: () => void };

const HIDE_AFTER_MS = 2600;
/** Seconds behind the live edge before the LIVE chip turns grey */
const BEHIND_SEC = 10;

function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex h-9 items-center rounded-full bg-glass px-0.5 backdrop-blur-md sm:h-10", className)}>
      {children}
    </div>
  );
}

function Btn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="grid h-8 w-8 place-items-center rounded-full text-foreground transition-colors hover:bg-foreground/15 sm:h-9 sm:w-9"
    >
      {children}
    </button>
  );
}

/**
 * Live HLS player with a YouTube-style overlay: floating glass control pills,
 * auto-hiding controls, centre tap feedback, settings menu with quality, PiP and fullscreen.
 * hls.js is imported inside an effect only (browser-only library).
 */
export function HlsPlayer({ src, poster, quality, onQuality, onStatus, onStats, onLevels }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<HlsLike | null>(null);
  const cbs = useRef({ onStatus, onStats, onLevels });
  cbs.current = { onStatus, onStats, onLevels };

  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const [visible, setVisible] = useState(true);
  const [menu, setMenu] = useState<null | "main" | "quality">(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [atLive, setAtLive] = useState(true);
  const [levels, setLevels] = useState<QualityLevel[]>([]);
  const [height, setHeight] = useState<number | null>(null);
  const [flash, setFlash] = useState<{ kind: "play" | "pause" | "mute" | "unmute"; key: number } | null>(null);
  const [pipOk, setPipOk] = useState(false);

  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const live = useRef({ playing, menu });
  live.current = { playing, menu };

  /** Show controls, then hide them again after a short idle while playing */
  const poke = useCallback(() => {
    setVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (live.current.playing && !live.current.menu) setVisible(false);
    }, HIDE_AFTER_MS);
  }, []);

  useEffect(() => {
    if (!playing || menu) setVisible(true);
    else poke();
  }, [playing, menu, poke]);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  // Browser-only capabilities and element listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true; // autoplay needs muted
    setPipOk(typeof document !== "undefined" && "pictureInPictureEnabled" in document && document.pictureInPictureEnabled);
    const onPlay = () => setPlaying(true);
    const onPause = () => {
      setPlaying(false);
      setWaiting(false);
    };
    const onWaiting = () => setWaiting(true);
    const onPlaying = () => setWaiting(false);
    const onVolume = () => {
      setMuted(video.muted);
      setVolume(video.volume);
    };
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("volumechange", onVolume);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("volumechange", onVolume);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, []);

  // Stream loading
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    let cancelled = false;
    let levelHeight: number | null = null;
    let levelBitrate: number | null = null;

    setWaiting(true);
    setAtLive(true);
    setLevels([]);
    setHeight(null);
    setMenu(null);
    cbs.current.onStatus("connecting");
    cbs.current.onLevels([]);

    const onPlaying = () => cbs.current.onStatus("live");
    const onError = () => cbs.current.onStatus("error");
    video.addEventListener("playing", onPlaying);
    video.addEventListener("error", onError);

    const liveEdge = () => {
      const sync = hlsRef.current?.liveSyncPosition;
      if (typeof sync === "number" && sync > 0) return sync;
      const s = video.seekable;
      return s.length ? s.end(s.length - 1) : null;
    };

    const tick = () => {
      let buffer = 0;
      const b = video.buffered;
      if (b.length) buffer = Math.max(0, b.end(b.length - 1) - video.currentTime);
      const edge = liveEdge();
      setAtLive(edge == null || edge - video.currentTime < BEHIND_SEC);
      const h = levelHeight ?? (video.videoHeight || null);
      setHeight(h);
      cbs.current.onStats({
        height: h,
        bitrateKbps: levelBitrate ? Math.round(levelBitrate / 1000) : null,
        bufferSec: buffer,
      });
    };
    const timer = setInterval(tick, 1500);

    (async () => {
      const { default: Hls } = await import("hls.js");
      if (cancelled) return;
      if (Hls.isSupported()) {
        // Relayed Super Sport feeds have one large full-HD quality, so stream each piece
        // into the player as it arrives instead of waiting for the whole piece first.
        const relayed = src.startsWith("/api/sports-stream");
        const hls = new Hls({
          ...(relayed ? { progressive: true, startFragPrefetch: true } : {}),
          lowLatencyMode: true,
          backBufferLength: 30,
          startLevel: 0,
          liveSyncDurationCount: 1,
          maxBufferLength: 6,
          maxMaxBufferLength: 12,
        });
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
          const lv = data.levels
            .map((l, index) => ({ index, height: l.height, bitrate: l.bitrate }))
            .filter((l) => l.height > 0);
          setLevels(lv);
          cbs.current.onLevels(lv);
          video.play().catch(() => setWaiting(false));
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
          const lvl = hls.levels[data.level];
          levelHeight = lvl?.height || null;
          levelBitrate = lvl?.bitrate || null;
          tick();
        });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
            else cbs.current.onStatus("error");
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        video.play().catch(() => setWaiting(false));
      } else {
        cbs.current.onStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(timer);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("error", onError);
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.removeAttribute("src");
      video.load();
    };
  }, [src]);

  useEffect(() => {
    if (hlsRef.current) hlsRef.current.currentLevel = quality;
  }, [quality]);

  const showFlash = (kind: "play" | "pause" | "mute" | "unmute") => setFlash({ kind, key: Date.now() });

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      showFlash("play");
    } else {
      v.pause();
      showFlash("pause");
    }
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted && v.volume === 0) v.volume = 1;
    showFlash(v.muted ? "mute" : "unmute");
  }, []);

  const setVol = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    v.muted = val === 0;
  };

  const goLive = () => {
    const v = videoRef.current;
    if (!v) return;
    const sync = hlsRef.current?.liveSyncPosition;
    const s = v.seekable;
    const edge = typeof sync === "number" && sync > 0 ? sync : s.length ? s.end(s.length - 1) - 1 : null;
    if (edge != null) v.currentTime = edge;
    v.play().catch(() => {});
    setAtLive(true);
  };

  const toggleFullscreen = useCallback(() => {
    const wrap = wrapRef.current;
    const v = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else if (wrap?.requestFullscreen) {
      void wrap.requestFullscreen().catch(() => v?.webkitEnterFullscreen?.());
    } else {
      v?.webkitEnterFullscreen?.();
    }
  }, []);

  const togglePip = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch {
      /* not allowed for this stream */
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === " " || k === "k") togglePlay();
    else if (k === "m") toggleMute();
    else if (k === "f") toggleFullscreen();
    else if (k === "escape") setMenu(null);
    else return;
    e.preventDefault();
    poke();
  };

  const onSurface = (e: React.PointerEvent) => {
    if (menu) {
      setMenu(null);
      return;
    }
    if (e.pointerType === "mouse") {
      togglePlay();
      poke();
    } else if (visible && playing) {
      clearTimeout(hideTimer.current);
      setVisible(false);
    } else {
      poke();
    }
  };

  const sortedLevels = [...levels].sort((a, b) => b.height - a.height);
  const qualityLabel =
    quality === -1
      ? `Auto${height ? ` (${height}p)` : ""}`
      : `${levels.find((l) => l.index === quality)?.height ?? "?"}p`;
  const VolIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const shown = visible || !playing || Boolean(menu);

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      onKeyDown={onKey}
      onMouseMove={poke}
      onMouseLeave={() => {
        if (playing && !menu) setVisible(false);
      }}
      className={cn(
        "relative h-full w-full select-none overflow-hidden bg-frame outline-none",
        !shown && "cursor-none",
      )}
    >
      <video
        ref={videoRef}
        poster={poster}
        className="h-full w-full object-contain"
        autoPlay
        playsInline
      />

      {/* Tap / click surface */}
      <div className="absolute inset-0" onPointerUp={onSurface} onDoubleClick={toggleFullscreen} />

      {/* Buffering ring */}
      {waiting && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-foreground/20 border-t-foreground sm:h-14 sm:w-14" />
        </div>
      )}

      {/* Centre feedback bubble */}
      {flash && (
        <div key={flash.key} className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="grid h-14 w-14 animate-player-flash place-items-center rounded-full bg-scrim text-foreground sm:h-16 sm:w-16">
            {flash.kind === "play" && <Play className="h-7 w-7 fill-current" />}
            {flash.kind === "pause" && <Pause className="h-7 w-7 fill-current" />}
            {flash.kind === "mute" && <VolumeX className="h-7 w-7" />}
            {flash.kind === "unmute" && <Volume2 className="h-7 w-7" />}
          </div>
        </div>
      )}

      {/* Big play button when paused */}
      {!playing && !waiting && !flash && (
        <button
          type="button"
          aria-label="Play"
          onClick={togglePlay}
          className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-glass text-foreground backdrop-blur-md transition-transform hover:scale-105"
        >
          <Play className="ml-1 h-8 w-8 fill-current" />
        </button>
      )}

      {/* Tap to unmute */}
      {muted && playing && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleMute();
          }}
          className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-glass px-3 py-1.5 text-[11px] font-semibold text-foreground backdrop-blur-md transition-colors hover:bg-scrim"
        >
          <VolumeX className="h-3.5 w-3.5" /> Tap to unmute
        </button>
      )}

      {/* Bottom controls */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 transition-opacity duration-300",
          shown ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-scrim to-transparent" />

        <div className="relative px-2.5 pb-2 sm:px-3 sm:pb-2.5">
          {/* Live progress bar */}
          <button
            type="button"
            aria-label="Jump to live"
            onClick={(e) => {
              e.stopPropagation();
              goLive();
            }}
            className="group/bar mb-1.5 flex h-3 w-full items-center"
          >
            <span className="relative h-[3px] w-full rounded-full bg-foreground/25 transition-all group-hover/bar:h-[5px]">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-primary"
                style={{ width: atLive ? "100%" : "94%" }}
              />
              <span
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-primary transition-transform group-hover/bar:scale-100"
                style={{ left: atLive ? "100%" : "94%" }}
              />
            </span>
          </button>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Pill>
              <Btn label={playing ? "Pause (k)" : "Play (k)"} onClick={togglePlay}>
                {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
              </Btn>
            </Pill>

            <Pill className="group/vol pr-0 hover:pr-3 focus-within:pr-3">
              <Btn label={muted ? "Unmute (m)" : "Mute (m)"} onClick={toggleMute}>
                <VolIcon className="h-5 w-5" />
              </Btn>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                aria-label="Volume"
                onChange={(e) => setVol(Number(e.target.value))}
                onPointerUp={(e) => e.stopPropagation()}
                className="h-1 w-0 cursor-pointer accent-foreground opacity-0 transition-all duration-200 group-focus-within/vol:w-16 group-focus-within/vol:opacity-100 group-hover/vol:w-16 group-hover/vol:opacity-100"
              />
            </Pill>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goLive();
              }}
              title={atLive ? "You're watching live" : "Jump to live"}
              className="flex h-9 items-center gap-1.5 rounded-full bg-glass px-3 text-[11px] font-bold tracking-wide text-foreground backdrop-blur-md sm:h-10 sm:text-xs"
            >
              <span className={cn("h-2 w-2 rounded-full", atLive ? "bg-primary" : "bg-muted-foreground")} />
              LIVE
            </button>

            <div className="flex-1" />

            <Pill>
              <Btn label="Settings" onClick={() => setMenu((m) => (m ? null : "main"))}>
                <Settings className={cn("h-5 w-5 transition-transform duration-300", menu && "rotate-45")} />
              </Btn>
              {pipOk && (
                <Btn label="Miniplayer" onClick={() => void togglePip()}>
                  <PictureInPicture2 className="h-5 w-5" />
                </Btn>
              )}
              <Btn label={fullscreen ? "Exit full screen (f)" : "Full screen (f)"} onClick={toggleFullscreen}>
                {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
              </Btn>
            </Pill>
          </div>
        </div>

      </div>

      {/* Settings menu */}
      {menu && (
        <div
          onPointerUp={(e) => e.stopPropagation()}
          className="absolute bottom-14 right-2.5 max-h-[calc(100%-4.5rem)] w-56 overflow-y-auto rounded-2xl bg-glass p-1.5 text-[13px] text-foreground backdrop-blur-xl scrollbar-none sm:bottom-16 sm:right-3"
        >
          {menu === "main" ? (
            <button
              type="button"
              onClick={() => setMenu("quality")}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-foreground/10"
            >
              <Settings className="h-4 w-4" />
              <span className="flex-1 text-left font-medium">Quality</span>
              <span className="text-muted-foreground">{qualityLabel}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setMenu("main")}
                className="mb-1 flex w-full items-center gap-2 rounded-xl px-2 py-2 font-semibold hover:bg-foreground/10"
              >
                <ChevronLeft className="h-4 w-4" /> Quality
              </button>
              {[{ index: -1, label: `Auto${quality === -1 && height ? ` (${height}p)` : ""}` }]
                .concat(sortedLevels.map((l) => ({ index: l.index, label: `${l.height}p${l.height >= 720 ? " HD" : ""}` })))
                .map((opt) => (
                  <button
                    key={opt.index}
                    type="button"
                    onClick={() => {
                      onQuality?.(opt.index);
                      setMenu(null);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 hover:bg-foreground/10"
                  >
                    <span className="grid w-4 place-items-center">
                      {quality === opt.index && <Check className="h-4 w-4" />}
                    </span>
                    <span className="flex-1 text-left">{opt.label}</span>
                  </button>
                ))}
              {sortedLevels.length === 0 && (
                <p className="px-3 py-2 text-[12px] text-muted-foreground">This channel has one quality.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
