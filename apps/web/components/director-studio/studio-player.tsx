"use client";
import dynamic from "next/dynamic";
import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  studioActionLabels,
  describeStudioMoment,
  sampleCamera,
  sampleCharacter,
  type StudioScene,
  type StudioSelection,
} from "@actbyme/shared";
const StudioCanvas = dynamic(() => import("./studio-canvas"), {
  ssr: false,
  loading: () => <p className="p-6">Loading 3D viewer…</p>,
});
class ViewerBoundary extends Component<
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
      <p className="p-6 text-amber-200">
        3D playback is unavailable. Follow the timed directions below.
      </p>
    ) : (
      this.props.children
    );
  }
}
const control =
  "rounded-lg border border-white/20 bg-[#17171b] px-3 py-2 text-sm text-white disabled:opacity-40";
export function StudioPlayer({
  scene,
  roleId,
  selection,
  onSelect,
  timelineTime,
  onTimelineTimeChange,
  productionPreview = false,
  onCameraChange,
}: {
  scene: StudioScene;
  roleId?: string | null;
  selection?: StudioSelection;
  onSelect?: (selection: StudioSelection) => void;
  timelineTime?: number;
  onTimelineTimeChange?: (time: number) => void;
  productionPreview?: boolean;
  onCameraChange?: (id: string) => void;
}) {
  const [time, setTime] = useState(timelineTime ?? 0);
  const clock = useRef(timelineTime ?? 0);
  const emitted = useRef(timelineTime);
  const notify = useRef(onTimelineTimeChange);
  notify.current = onTimelineTimeChange;
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [shot, setShot] = useState("");
  useEffect(() => {
    if (selection?.kind === "shot") setShot(selection.id);
  }, [selection]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [visible, setVisible] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const updateTime = useCallback((next: number) => {
    clock.current = next;
    setTime(next);
    emitted.current = next;
    notify.current?.(next);
  }, []);
  const selectElement = useCallback(
    (selected: StudioSelection) => {
      setPlaying(false);
      updateTime(clock.current);
      onSelect?.(selected);
    },
    [onSelect, updateTime],
  );
  const fail = useCallback(() => setAvailable(false), []);
  useEffect(() => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2");
    setAvailable(Boolean(context));
    context?.getExtension("WEBGL_lose_context")?.loseContext();
  }, []);
  useEffect(() => {
    let inView = true;
    const update = () => setVisible(inView && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      inView = Boolean(entry?.isIntersecting);
      update();
    });
    if (root.current) observer.observe(root.current);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  useEffect(() => {
    if (timelineTime !== undefined && timelineTime !== emitted.current) {
      clock.current = timelineTime;
      setTime(timelineTime);
      setPlaying(false);
    }
  }, [timelineTime]);
  useEffect(() => {
    if (clock.current > scene.duration) updateTime(scene.duration);
    if (shot && shot !== "free" && !scene.shots.some((item) => item.id === shot)) setShot("");
  }, [scene.duration, scene.shots, shot, updateTime]);
  useEffect(() => {
    if (!playing || !visible) return;
    let previous = performance.now(),
      lastUi = previous,
      lastParent = previous,
      frame = 0;
    const tick = (now: number) => {
      const elapsed = Math.min(0.1, (now - previous) / 1000) * speed;
      previous = now;
      const next = clock.current + elapsed;
      clock.current =
        next >= scene.duration ? (loop ? next % scene.duration : scene.duration) : next;
      const ended = clock.current >= scene.duration && !loop;
      if (now - lastUi >= 100 || ended) {
        setTime(clock.current);
        lastUi = now;
      }
      if (now - lastParent >= 200 || ended) {
        emitted.current = clock.current;
        notify.current?.(clock.current);
        lastParent = now;
      }
      if (ended) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, visible, speed, loop, scene.duration]);
  const safeTime = Math.min(time, scene.duration);
  const activeCamera = sampleCamera(scene, safeTime, shot || undefined);
  const directions = useMemo(
    () =>
      scene.characters
        .filter((character) => !roleId || character.id === roleId)
        .map((character) => ({
          character,
          moments: character.keyframes.map((frame, index) => ({
            frame,
            end: character.keyframes[index + 1]?.time ?? scene.duration,
            text: describeStudioMoment(scene, character.id, index),
            action: sampleCharacter(character, frame.time, scene).action,
          })),
        })),
    [scene, roleId],
  );
  return (
    <div ref={root} data-testid="studio-player" className="min-w-0 space-y-4">
      <div className="relative h-[300px] overflow-hidden rounded-xl border border-white/10 bg-[#111214] sm:h-[420px]">
        {available ? (
          <ViewerBoundary onFailure={fail}>
            <StudioCanvas
              scene={scene}
              clock={clock}
              time={safeTime}
              playing={playing && visible}
              shot={shot}
              selection={selection}
              roleId={roleId}
              onSelect={onSelect ? selectElement : undefined}
              onFailure={fail}
            />
          </ViewerBoundary>
        ) : (
          <p className="p-6 text-sm leading-6 text-amber-100">
            {available === null
              ? "Preparing your preview…"
              : "3D playback is unavailable on this device. All dialogue, movements and timings are available below."}
          </p>
        )}
        {onSelect && available ? (
          <p className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-black/75 px-3 py-2 text-xs text-zinc-100">
            Tap a person or object to give it to the assistant.
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className={control}
          onClick={() => {
            if (playing) updateTime(clock.current);
            else if (safeTime >= scene.duration) updateTime(0);
            setPlaying(!playing);
          }}
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button
          className={control}
          onClick={() => {
            setPlaying(false);
            updateTime(0);
          }}
        >
          Restart
        </button>
        <label className="text-sm">
          Speed{" "}
          <select
            aria-label="Playback speed"
            className={control}
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
          >
            {[0.5, 1, 1.5, 2].map((value) => (
              <option key={value} value={value}>
                {value}x
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={loop}
            onChange={(event) => setLoop(event.target.checked)}
          />
          Loop
        </label>
        <label className="text-sm">
          Camera{" "}
          <select
            aria-label="Camera view"
            className={control}
            value={shot}
            onChange={(event) => {
              setShot(event.target.value);
              onCameraChange?.(event.target.value);
            }}
          >
            <option value="">Automatic cuts</option>
            {scene.shots.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
            <option value="free">Free view</option>
          </select>
        </label>
      </div>
      <label className="block text-sm">
        Timeline ·{" "}
        <span data-testid="studio-time">
          {safeTime.toFixed(1)} / {scene.duration}s
        </span>
        <input
          aria-label="Timeline"
          className="mt-3 w-full accent-amber-300"
          type="range"
          min="0"
          max={scene.duration}
          step="0.1"
          value={safeTime}
          onChange={(event) => {
            setPlaying(false);
            updateTime(Number(event.target.value));
          }}
        />
      </label>
      <p className="text-sm text-zinc-300">
        Camera: {shot === "free" ? "Free view — drag to orbit, scroll to zoom" : activeCamera.name}
      </p>
      {scene.cues
        .filter((cue) => safeTime >= cue.start && safeTime < cue.end)
        .map((cue, index) => (
          <p key={index} className="rounded-lg bg-amber-300/10 p-3 text-sm">
            <strong>
              {scene.characters.find((character) => character.id === cue.characterId)?.name}
              {roleId && roleId !== cue.characterId ? " · Scene partner" : ""}:
            </strong>{" "}
            {cue.dialogue}
            <span className="block text-amber-200">{cue.direction}</span>
          </p>
        ))}
      <details className="rounded-xl border border-white/10 p-4" open={!available || undefined}>
        <summary className="cursor-pointer font-medium">Your scene, step by step</summary>
        {directions.map(({ character, moments }) => (
          <div key={character.id} className="mt-4 text-sm text-zinc-200">
            <strong className={character.id === roleId ? "text-amber-200" : ""}>
              {character.name}
              {character.id === roleId ? " · Your role" : ""}
            </strong>
            <ol className="mt-3 space-y-2">
              {moments.map(({ frame, end, text, action }) => (
                <li key={frame.time} className="rounded-lg bg-white/5 p-3">
                  <span className="font-medium text-amber-200">
                    {frame.time === 0 ? "At the start" : frame.time.toFixed(1) + "s"}
                    {end > frame.time ? " → " + end.toFixed(1) + "s" : ""}
                  </span>{" "}
                  · {studioActionLabels[action]} · {text.movement} · {text.gaze}
                </li>
              ))}
            </ol>
            {scene.cues
              .filter((cue) => cue.characterId === character.id)
              .map((cue, index) => (
                <div key={index} className="mt-3 rounded-lg bg-amber-300/5 p-3">
                  <p className="text-xs text-amber-200">
                    {cue.start.toFixed(1)}–{cue.end.toFixed(1)}s
                  </p>
                  <p className="mt-1">{cue.dialogue}</p>
                  <p className="mt-1 text-zinc-300">{cue.direction}</p>
                </div>
              ))}
          </div>
        ))}
      </details>
      <p className="text-xs leading-5 text-zinc-300">
        {productionPreview
          ? "Choose a camera card to edit its framing. These staged paths guide the requested shot; the video provider interprets them approximately."
          : "Preview camera cuts describe the intended film. Record your role in one uninterrupted take with a fixed camera."}
      </p>
    </div>
  );
}
