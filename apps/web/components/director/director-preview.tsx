"use client";
import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { Maximize2, Move3D, Video, Volume2 } from "lucide-react";
import {
  directorDuration,
  directorShotAt,
  type DirectorDocument,
  type DirectorAsset,
} from "@actbyme/shared";
import { directorApi } from "@/lib/api/client";
const DirectorCanvas = dynamic(() => import("./director-canvas"), {
  ssr: false,
  loading: () => <div className="director-loading">Preparing the 3D scene…</div>,
});
class PreviewBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? (
      <div className="director-loading">
        WebGL is unavailable. Use the top view and camera controls.
      </div>
    ) : (
      this.props.children
    );
  }
}
function Media({
  url,
  time,
  playing,
  volume,
  video = false,
  preload = "auto",
  onError,
}: {
  url: string;
  time: number;
  playing: boolean;
  volume: number;
  video?: boolean;
  preload?: "metadata" | "auto";
  onError: (message: string) => void;
}) {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let active = true;
    element.volume = Math.min(1, Math.max(0, volume));
    const sync = () => {
      if (Number.isFinite(element.duration) && Math.abs(element.currentTime - time) > 0.15)
        element.currentTime = Math.min(Math.max(0, time), element.duration);
    };
    sync();
    element.addEventListener("loadedmetadata", sync, { once: true });
    if (playing && element.paused)
      void element.play().catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) return;
        onError(
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "The browser paused audio or playback. Click Play again once loading finishes."
            : "The browser cannot play this media. Check the format and try previewing again.",
        );
      });
    if (!playing && !element.paused) element.pause();
    return () => {
      active = false;
      element.removeEventListener("loadedmetadata", sync);
    };
  }, [time, playing, volume, url, onError]);
  useEffect(() => {
    const element = ref.current;
    return () => element?.pause();
  }, []);
  return video ? (
    <video
      ref={ref}
      src={url}
      className="director-clip-preview"
      playsInline
      preload={preload}
      muted={volume === 0}
      onError={() => onError("Clip unavailable. Refresh the preview and try again.")}
    />
  ) : (
    <audio ref={ref} src={url} preload={preload} />
  );
}
export function DirectorPreview({
  id,
  document,
  assets,
  time,
  playing,
  onError,
}: {
  id?: string;
  document: DirectorDocument;
  assets: DirectorAsset[];
  time: number;
  playing: boolean;
  onError: (message: string) => void;
}) {
  const [free, setFree] = useState(false),
    [mode, setMode] = useState("3d"),
    [available, setAvailable] = useState<boolean | null>(null);
  const [urls, setUrls] = useState<Record<string, { url: string; expires: number }>>({});
  const root = useRef<HTMLDivElement>(null);
  const requested = useRef(new Set<string>());
  const mounted = useRef(true),
    projectId = useRef(id);
  projectId.current = id;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [refreshTick, setRefreshTick] = useState(0);
  const { shot, localTime } = directorShotAt(document, time);
  useEffect(() => {
    const canvas = window.document.createElement("canvas"),
      context = canvas.getContext("webgl2");
    setAvailable(Boolean(context));
    context?.getExtension("WEBGL_lose_context")?.loseContext();
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setRefreshTick((value) => value + 1), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!id) return;
    const active = () => mounted.current && projectId.current === id;
    const needed = new Set(
      [
        ...document.tracks.map((item) => item.assetId),
        ...document.shots.map((item) => item.clipAssetId),
      ].filter((assetId): assetId is string => Boolean(assetId)),
    );
    const pending = [...needed].filter(
      (assetId) =>
        (urls[assetId]?.expires ?? 0) <= Date.now() + 45000 && !requested.current.has(assetId),
    );
    pending.forEach((assetId) => requested.current.add(assetId));
    if (pending.length)
      void Promise.all(
        pending.map(async (assetId) => {
          try {
            const result = await directorApi.media(id, assetId);
            return {
              assetId,
              url: result.url,
              expires: Date.now() + result.expiresInSeconds * 1000,
            };
          } catch {
            if (active()) onError("Unable to load a private preview asset.");
            return null;
          } finally {
            requested.current.delete(assetId);
          }
        }),
      ).then((results) => {
        if (active() && results.some(Boolean))
          setUrls((current) => ({
            ...current,
            ...Object.fromEntries(
              results
                .filter((result) => result !== null)
                .map(({ assetId, ...result }) => [assetId, result]),
            ),
          }));
      });
  }, [id, document.shots, document.tracks, urls, refreshTick, onError]);
  let fadeOpacity = 0;
  if (shot.transition === "fade" && shot.transitionDuration > 0)
    fadeOpacity = Math.max(0, 1 - localTime / shot.transitionDuration);
  const index = document.shots.findIndex((item) => item.id === shot.id),
    nextShot = document.shots[index + 1];
  if (nextShot?.transition === "fade" && nextShot.transitionDuration > 0)
    fadeOpacity = Math.max(
      fadeOpacity,
      1 - (shot.duration - localTime) / Math.min(shot.duration / 2, nextShot.transitionDuration),
    );
  const activeCues = document.tracks.filter(
    (item) =>
      item.track === "performance" && time >= item.start && time < item.start + item.duration,
  );
  const clipUrl = shot.clipAssetId ? urls[shot.clipAssetId]?.url : undefined;
  const volumeFor = (
    start: number,
    duration: number,
    volume: number,
    fadeIn: number,
    fadeOut: number,
  ) => {
    const local = time - start;
    return (
      volume *
      (fadeIn ? Math.min(1, local / fadeIn) : 1) *
      (fadeOut ? Math.min(1, (duration - local) / fadeOut) : 1)
    );
  };
  return (
    <div className="director-preview-panel" ref={root} data-testid="director-preview">
      <div className="director-panel-heading">
        <div>
          <strong>Camera preview</strong>
          <span className="director-badge">
            {mode === "3d" ? "3D preview · free" : "Imported / generated clips"}
          </span>
        </div>
        <div className="director-inline">
          <select
            aria-label="Preview mode"
            value={mode}
            onChange={(event) => setMode(event.target.value)}
          >
            <option value="3d">3D preview</option>
            <option value="clips">Production clips</option>
          </select>
          <button
            title="Free view: drag to orbit, scroll to zoom"
            aria-pressed={free}
            aria-label="Free 3D view"
            onClick={() => setFree(!free)}
          >
            <Move3D size={15} />
          </button>
          <button
            aria-label="Full screen"
            onClick={() => {
              if (!window.document.fullscreenElement)
                void root.current
                  ?.requestFullscreen()
                  .catch(() => onError("Full screen is unavailable."));
              else void window.document.exitFullscreen();
            }}
          >
            <Maximize2 size={15} />
          </button>
        </div>
      </div>
      <div
        className="director-picture-frame"
        style={
          {
            "--director-picture-ratio":
              Number(document.aspectRatio.split(":")[0]) /
              Number(document.aspectRatio.split(":")[1]),
          } as CSSProperties
        }
      >
        <div
          className="director-viewport"
          style={{ aspectRatio: document.aspectRatio.replace(":", "/") }}
        >
          {mode === "3d" ? (
            available ? (
              <PreviewBoundary onFailure={() => setAvailable(false)}>
                <DirectorCanvas
                  document={document}
                  time={time}
                  free={free}
                  onFailure={() => setAvailable(false)}
                />
              </PreviewBoundary>
            ) : (
              <div className="director-loading">
                <Move3D size={30} />
                <p>
                  {available === null
                    ? "Checking WebGL…"
                    : "3D is unavailable in this browser. The map and editor are still usable."}
                </p>
              </div>
            )
          ) : clipUrl ? (
            <Media
              key={shot.clipAssetId}
              url={clipUrl}
              time={shot.clipOffset + localTime}
              playing={playing}
              volume={0}
              video
              onError={onError}
            />
          ) : (
            <div className="director-loading">
              <Video size={30} />
              <p>Assign a clip to this shot in Generate to watch it here.</p>
            </div>
          )}
          <div className="director-framing" aria-hidden="true" />
          <div className="director-shot-label">
            <span className="director-live-dot" />
            {String(index + 1).padStart(2, "0")} / {shot.name}
          </div>
          <div className="director-timecode">
            {time.toFixed(2)}s / {directorDuration(document).toFixed(1)}s
          </div>
          {fadeOpacity > 0 ? (
            <div
              className="director-fade"
              style={{ opacity: Math.max(0, Math.min(1, fadeOpacity)) }}
            />
          ) : null}
          {activeCues.length > 0 ? (
            <div className="director-cue">
              {activeCues.map((item) => (
                <p key={item.id}>{item.instructions || item.label}</p>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="director-preview-caption">
        <span>
          {mode === "3d"
            ? "Schematic scene and characters — no reconstruction of your photos."
            : "Viewing source clips. The final MP4 applies the timeline audio mix."}
        </span>
        <span>
          <Volume2 size={12} /> Synced audio
        </span>
      </div>
      {document.tracks
        .filter(
          (item) => item.assetId && assets.find((asset) => asset.id === item.assetId)?.hasAudio,
        )
        .map((item) =>
          urls[item.assetId!]?.url ? (
            <Media
              key={item.id}
              url={urls[item.assetId!]!.url}
              time={item.offset + Math.max(0, Math.min(item.duration, time - item.start))}
              playing={playing && time >= item.start && time < item.start + item.duration}
              preload={
                time >= item.start - 3 && time < item.start + item.duration ? "auto" : "metadata"
              }
              volume={
                time >= item.start && time < item.start + item.duration
                  ? volumeFor(item.start, item.duration, item.volume, item.fadeIn, item.fadeOut)
                  : 0
              }
              onError={onError}
            />
          ) : null,
        )}
      {shot.clipAssetId &&
      shot.originalAudio &&
      assets.find((asset) => asset.id === shot.clipAssetId)?.hasAudio &&
      clipUrl ? (
        <Media
          key={`shot_audio_${shot.id}`}
          url={clipUrl}
          time={shot.clipOffset + localTime}
          playing={playing}
          volume={1}
          onError={onError}
        />
      ) : null}
    </div>
  );
}
