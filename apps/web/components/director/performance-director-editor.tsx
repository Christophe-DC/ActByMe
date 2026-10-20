"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Download,
  FileJson,
  Film,
  Loader2,
  Pause,
  Play,
  Plus,
  Redo2,
  Save,
  Trash2,
  Undo2,
  Upload,
  Volume2,
} from "lucide-react";
import {
  addPerformanceShot,
  createPerformanceShot,
  directorDuration,
  directorShotAt,
  fitPerformanceDuration,
  performancePresets,
  performanceProductionPlan,
  removePerformanceShot,
  resizePerformanceShot,
  syncPerformanceWaypoints,
  type PerformanceCamera,
  type DirectorDocument,
} from "@actbyme/shared";
import { directorApi } from "@/lib/api/client";
import { supabase } from "@/lib/supabase/client";
import { AuthModal } from "@/components/auth/auth-modal";
import type { useDirectorProject } from "./use-director-project";
import { PerformanceTimeline } from "./performance-timeline";
import { PerformancePresetArt } from "./performance-preset-art";
import { usePerformanceExport } from "./use-performance-export";
import { uploadPerformanceAsset } from "./performance-media";
import { downloadDirectorJson } from "./director-generate";
import "./performance-director.css";
const Preview = dynamic(
  () => import("./performance-preview").then((module) => module.PerformancePreview),
  {
    ssr: false,
    loading: () => <div className="performance-preview-loading">Loading camera preview…</div>,
  },
);
const steps = ["Import", "Camera angles", "Preview", "Export"] as const;
const clock = (time: number) =>
  `${Math.floor(time / 60)
    .toString()
    .padStart(2, "0")}:${(time % 60).toFixed(2).padStart(5, "0")}`;
export function PerformanceDirectorEditor({
  id,
  project,
}: {
  id?: string;
  project: ReturnType<typeof useDirectorProject>;
}) {
  const { document, state, edit, setError } = project;
  const [step, setStep] = useState(id && !document.performance?.sourceAssetId ? 0 : 1),
    [selected, setSelected] = useState(document.shots[0]!.id),
    [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false),
    [sourceUrl, setSourceUrl] = useState<string | null>(null),
    [localFile, setLocalFile] = useState<File | null>(null),
    [busy, setBusy] = useState<string | null>(null),
    [rights, setRights] = useState(false),
    [exportRights, setExportRights] = useState(false),
    [authOpen, setAuthOpen] = useState(false);
  const video = useRef<HTMLVideoElement>(null),
    input = useRef<HTMLInputElement>(null),
    importTask = useRef<AbortController | null>(null);
  const duration = directorDuration(document),
    sourceId = document.performance?.sourceAssetId;
  const source = state?.assets.find((asset) => asset.id === sourceId);
  const shot = document.shots.find((shot) => shot.id === selected) ?? document.shots[0]!;
  const camera = shot.performanceCamera!;
  const exporter = usePerformanceExport(
    id,
    document,
    localFile,
    project.save,
    project.refresh,
    setError,
  );
  const locked = Boolean(busy || exporter.status);
  const stop = useCallback(() => {
    setPlaying(false);
    video.current?.pause();
  }, []);
  const seek = useCallback(
    (at: number, angleId?: string) => {
      stop();
      setTime(at);
      setSelected(angleId ?? directorShotAt(document, at).shot.id);
      if (video.current && video.current.readyState >= 1) video.current.currentTime = at;
    },
    [stop, document],
  );
  const change = useCallback(
    (mutate: (draft: DirectorDocument) => void) => {
      stop();
      edit(mutate);
    },
    [edit, stop],
  );
  useEffect(() => () => importTask.current?.abort(), []);
  useEffect(() => {
    if (localFile) {
      const url = URL.createObjectURL(localFile);
      setSourceUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    if (!id || !sourceId) {
      setSourceUrl(null);
      return;
    }
    let active = true;
    const load = () => {
      void directorApi
        .media(id, sourceId)
        .then(({ url }) => {
          if (active) setSourceUrl(url);
        })
        .catch((error: Error) => {
          if (active) setError(error.message);
        });
    };
    load();
    const timer = setInterval(load, 240000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id, sourceId, localFile, setError]);
  useEffect(() => {
    if (!playing) return;
    let frame = 0,
      previous = performance.now();
    const advance = (now: number) => {
      const elapsed = (now - previous) / 1000;
      previous = now;
      if (sourceUrl && video.current) {
        setTime(Math.min(duration, video.current.currentTime));
        if (video.current.ended) {
          setPlaying(false);
          return;
        }
      } else
        setTime((before) => {
          const next = Math.min(duration, before + elapsed);
          if (next >= duration) setPlaying(false);
          return next;
        });
      frame = requestAnimationFrame(advance);
    };
    frame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(frame);
  }, [playing, sourceUrl, duration]);
  useEffect(() => {
    if (time > duration) seek(duration);
  }, [duration, time, seek]);
  const toggle = async () => {
    if (playing) {
      stop();
      return;
    }
    if (time >= duration - 0.01) {
      if (video.current) video.current.currentTime = 0;
      setTime(0);
    }
    try {
      if (sourceUrl) await video.current?.play();
      setPlaying(true);
    } catch {
      setError("The performance cannot play. Try importing a browser-compatible MP4.");
    }
  };
  const importPerformance = async (file: File) => {
    if (!rights || locked) return;
    const task = new AbortController();
    importTask.current = task;
    stop();
    setError(null);
    setBusy("Checking the performance…");
    try {
      if (
        !["video/mp4", "video/quicktime"].includes(file.type) ||
        file.size > 50 * 1024 * 1024 ||
        !file.size
      )
        throw new Error("Choose an MP4 or MOV performance up to 50 MiB.");
      const url = URL.createObjectURL(file),
        element = window.document.createElement("video");
      let seconds: number;
      try {
        element.preload = "metadata";
        element.src = url;
        seconds = await new Promise<number>((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error("This video could not be opened. Try an H.264 MP4.")),
            15000,
          );
          element.onloadedmetadata = () => {
            clearTimeout(timer);
            resolve(element.duration);
          };
          element.onerror = () => {
            clearTimeout(timer);
            reject(
              new Error(
                "This browser cannot read the video. Convert it to H.264 MP4 and try again.",
              ),
            );
          };
        });
      } finally {
        element.removeAttribute("src");
        element.load();
        URL.revokeObjectURL(url);
      }
      if (!Number.isFinite(seconds) || seconds < 0.5 || seconds > 120)
        throw new Error("Use a performance between 0.5 seconds and 2 minutes.");
      task.signal.throwIfAborted();
      let assetId: string | null = null;
      if (id) {
        const asset = await uploadPerformanceAsset(id, file, task.signal, setBusy);
        assetId = asset.id;
        seconds = asset.duration!;
        await project.refresh();
      }
      task.signal.throwIfAborted();
      change((draft) => fitPerformanceDuration(draft, seconds, assetId));
      setLocalFile(id ? null : file);
      setTime(0);
      setStep(1);
      setExportRights(false);
    } catch (error) {
      if (!task.signal.aborted) setError((error as Error).message);
    } finally {
      setBusy(null);
      importTask.current = null;
      if (input.current) input.current.value = "";
    }
  };
  const setCamera = (values: Partial<PerformanceCamera>) =>
    change((draft) => {
      const current = draft.shots.find((item) => item.id === shot.id)!;
      current.performanceCamera = { ...current.performanceCamera!, ...values };
      syncPerformanceWaypoints(current);
    });
  const addAngle = () => {
    const angleId = `angle_${crypto.randomUUID()}`;
    change((draft) => {
      addPerformanceShot(draft, shot.id, angleId);
    });
    const before = document.shots
      .slice(
        0,
        document.shots.findIndex((item) => item.id === shot.id),
      )
      .reduce((sum, item) => sum + item.duration, 0);
    seek(before + shot.duration / 2, angleId);
  };
  const moveAngle = (direction: number) =>
    change((draft) => {
      const before = draft.shots.findIndex((item) => item.id === shot.id),
        after = before + direction;
      if (after >= 0 && after < draft.shots.length)
        draft.shots.splice(after, 0, draft.shots.splice(before, 1)[0]!);
    });
  const saveToAccount = async () => {
    const session = await supabase.auth.getSession();
    if (!session.data.session) {
      setAuthOpen(true);
      return;
    }
    setBusy("Saving the camera plan…");
    try {
      const created = await directorApi.create(document.title, false, "performance");
      const snapshot = structuredClone(document);
      if (localFile) {
        const task = new AbortController();
        importTask.current = task;
        const asset = await uploadPerformanceAsset(created.id, localFile, task.signal, setBusy);
        fitPerformanceDuration(snapshot, asset.duration!, asset.id);
      }
      await directorApi.save(created.id, created.version, snapshot);
      window.location.assign(`/director/${created.id}`);
    } catch (error) {
      setError((error as Error).message);
      setBusy(null);
    }
  };
  const activeShot = directorShotAt(document, time).shot;
  return (
    <main className="performance-director director-editor">
      <header className="performance-header">
        <Link href="/director" className="performance-brand">
          <Camera size={21} />
          <strong>
            ACTBYME <span>Director</span>
          </strong>
        </Link>
        <input
          aria-label="Performance project title"
          value={document.title}
          maxLength={140}
          disabled={locked}
          onChange={(event) => {
            if (event.target.value.trim())
              change((draft) => {
                draft.title = event.target.value;
              });
          }}
        />
        <nav aria-label="Director workflow">
          {steps.map((label, index) => (
            <button
              key={label}
              aria-label={label}
              aria-current={step === index ? "step" : undefined}
              onClick={() => setStep(index)}
            >
              <span>{index + 1}</span>
              {label}
            </button>
          ))}
        </nav>
        <div className="performance-header-tools">
          <button
            aria-label="Undo change"
            title="Undo"
            disabled={!project.canUndo || locked}
            onClick={() => {
              stop();
              project.undo();
            }}
          >
            <Undo2 size={16} />
          </button>
          <button
            aria-label="Redo change"
            title="Redo"
            disabled={!project.canRedo || locked}
            onClick={() => {
              stop();
              project.redo();
            }}
          >
            <Redo2 size={16} />
          </button>
          {!id ? (
            <button onClick={() => void saveToAccount()} disabled={locked}>
              <Save size={15} />
              Save project
            </button>
          ) : (
            <span className="performance-save-state" role="status">
              {project.saveStatus}
            </span>
          )}
          <button className="director-primary" onClick={() => setStep(3)}>
            <Download size={15} />
            Export reference
          </button>
        </div>
      </header>
      {!id ? (
        <div className="performance-demo-note">
          <span className="director-badge">LOCAL CAMERA PLAN</span>Local mode · files stay in this
          tab. Save your project to keep the performance and camera plan privately.
        </div>
      ) : null}
      {project.error ? (
        <div className="performance-error" role="alert">
          {project.error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      ) : null}
      {project.conflict || project.recovered ? (
        <div className="performance-error">
          <span>
            {project.conflict
              ? "Conflict detected. Automatic saving is paused; your draft is still on this device."
              : "An unsaved camera plan was recovered on this device."}
          </span>
          <button
            onClick={() =>
              downloadDirectorJson(
                performanceProductionPlan(
                  document,
                  state?.assets,
                  project.version,
                  localFile?.name,
                ),
                "camera-plan-recovered-draft.json",
              )
            }
          >
            Export draft
          </button>
          <button onClick={() => void project.discardLocal()}>Reload server version</button>
        </div>
      ) : null}
      <div className="performance-workspace">
        <section className="performance-original" aria-label="Original performance">
          <header>
            <strong>Original performance</strong>
            <span>{source?.name ?? localFile?.name ?? "Your acting reference"}</span>
          </header>
          <div className="performance-original-frame">
            {sourceUrl ? (
              <video
                ref={video}
                src={sourceUrl}
                crossOrigin="anonymous"
                playsInline
                preload="auto"
                muted={!document.performance?.originalAudio}
                onLoadedMetadata={() => {
                  if (video.current) video.current.currentTime = Math.min(time, duration);
                }}
                onEnded={stop}
                onPause={() => setPlaying(false)}
                onError={() => {
                  stop();
                  setError(
                    "The original video is unavailable. Reopen the project to refresh its private link, or import a browser-compatible MP4.",
                  );
                }}
                aria-label="Original actor performance"
              />
            ) : (
              <div className="performance-empty">
                <Film size={42} />
                <h1>One performance. Your camera plan.</h1>
                <p>Import an actor's video, choose angles and export a free camera reference.</p>
                <button onClick={() => setStep(0)}>
                  <Upload size={15} />
                  Import performance
                </button>
              </div>
            )}
          </div>
          <p>The original video is the reference for acting, gestures and dialogue.</p>
        </section>
        <section className="performance-preview-panel" aria-label="Planned camera preview">
          <header>
            <strong>Camera preview</strong>
            <span>
              {activeShot.name} · {clock(time)}
            </span>
          </header>
          <Preview document={document} time={time} />
          <p>Framing and timing only. No reconstruction, motion capture or lip sync.</p>
        </section>
        <aside className="performance-inspector" aria-label="Camera plan controls">
          {step === 0 ? (
            <>
              <span className="performance-eyebrow">01 / IMPORT</span>
              <h2>Your original performance</h2>
              <p>
                MP4 or MOV · up to 2 minutes · 50 MiB. An H.264 MP4 works in the widest range of
                browsers.
              </p>
              <label className="performance-check">
                <input
                  type="checkbox"
                  checked={rights}
                  disabled={locked}
                  onChange={(event) => setRights(event.target.checked)}
                />
                I have permission to use this performance and its audio for camera planning and
                reference export.
              </label>
              <input
                ref={input}
                className="performance-file-input"
                type="file"
                accept="video/mp4,video/quicktime"
                aria-label="Import performance video"
                disabled={!rights || locked}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importPerformance(file);
                }}
              />
              <button
                className="director-primary"
                disabled={!rights || locked}
                onClick={() => input.current?.click()}
              >
                <Upload size={16} />
                {sourceUrl ? "Replace performance" : "Choose performance video"}
              </button>
              <p>
                {id
                  ? "Stored privately in your project. No AI transfer."
                  : "Local mode: no upload, account or external service is needed."}
              </p>
              <p>
                Replacing a performance adjusts your angles to its duration. Very short videos may
                keep fewer angles (at least 0.5 seconds per angle).
              </p>
              {sourceUrl ? (
                <button onClick={() => setStep(1)}>
                  Choose camera angles
                  <ArrowRight size={15} />
                </button>
              ) : null}
            </>
          ) : step === 3 ? (
            <>
              <span className="performance-eyebrow">04 / EXPORT</span>
              <h2>Your camera reference</h2>
              <p>
                A real MP4 of the neutral stand-in, following this camera plan. Include it with the
                original performance, your images and your prompt in your usual AI tool.
              </p>
              <label>
                Video format
                <select
                  aria-label="Reference video format"
                  value={document.aspectRatio}
                  disabled={locked}
                  onChange={(event) =>
                    change((draft) => {
                      draft.aspectRatio = event.target.value as DirectorDocument["aspectRatio"];
                    })
                  }
                >
                  <option value="16:9">16:9 · landscape</option>
                  <option value="9:16">9:16 · portrait</option>
                  <option value="1:1">1:1 · square</option>
                </select>
              </label>
              <label className="performance-check">
                <input
                  aria-label="Include original audio"
                  type="checkbox"
                  checked={document.performance!.originalAudio}
                  disabled={locked}
                  onChange={(event) =>
                    change((draft) => {
                      draft.performance!.originalAudio = event.target.checked;
                    })
                  }
                />
                <Volume2 size={14} />
                Include original audio
              </label>
              <label className="performance-check">
                <input
                  type="checkbox"
                  aria-label="Confirm reference export rights"
                  checked={exportRights}
                  disabled={locked}
                  onChange={(event) => setExportRights(event.target.checked)}
                />
                I have reviewed this camera plan and have permission to export the included
                performance audio.
              </label>
              <button
                className="director-primary"
                disabled={!exportRights || locked || (Boolean(id) && !sourceId)}
                onClick={() => {
                  stop();
                  void exporter.start();
                }}
              >
                <Film size={16} />
                Render reference MP4<small>Free · 720p · 24 fps</small>
              </button>
              {!sourceUrl ? (
                <p>
                  Without an imported performance, this exports the sample camera plan with silence.
                </p>
              ) : null}
              <button
                disabled={locked}
                onClick={() =>
                  downloadDirectorJson(
                    performanceProductionPlan(
                      document,
                      state?.assets,
                      project.version,
                      localFile?.name,
                    ),
                    `${document.title}-camera-plan.json`,
                  )
                }
              >
                <FileJson size={15} />
                Download detailed shot plan
              </button>
              {exporter.file ? (
                <a
                  className="director-button"
                  href={exporter.file.url}
                  download={exporter.file.name}
                >
                  <Download size={15} />
                  Download camera reference MP4
                </a>
              ) : null}
              <p>
                Keep this tab open. Frames are calculated individually; rendering can take several
                minutes. No paid AI or render server is used.
              </p>
              {state?.jobs
                .filter((job) => job.kind === "EXPORT" && job.resultAssetId)
                .map((job) => (
                  <button
                    key={job.id}
                    onClick={() => {
                      void directorApi
                        .media(id!, job.resultAssetId!, true)
                        .then(({ url }) => {
                          const anchor = window.document.createElement("a");
                          anchor.href = url;
                          anchor.rel = "noopener noreferrer";
                          anchor.click();
                        })
                        .catch((error: Error) => setError(error.message));
                    }}
                  >
                    <Download size={14} />
                    Saved reference · v{job.version}
                  </button>
                ))}
            </>
          ) : step === 2 ? (
            <>
              <span className="performance-eyebrow">03 / PREVIEW</span>
              <h2>Compare your direction</h2>
              <p>
                Play both views together, or scrub the timeline to check a moment. The original
                performance keeps its timing while the planned camera changes angles.
              </p>
              <button className="director-primary" disabled={locked} onClick={() => void toggle()}>
                {playing ? <Pause size={16} /> : <Play size={16} />}
                {playing ? "Pause comparison" : "Play both views"}
              </button>
              <p>
                {document.shots.length} angles · {duration.toFixed(2)} seconds
              </p>
              <p>
                The neutral figure only shows framing. Gestures, expressions, identity and lip sync
                come from your original performance, not this preview.
              </p>
              <button onClick={() => setStep(1)}>Adjust camera angles</button>
              <button onClick={() => setStep(3)}>
                Export this direction
                <ArrowRight size={15} />
              </button>
            </>
          ) : (
            <>
              <span className="performance-eyebrow">02 / CAMERA ANGLES</span>
              <h2>{shot.name}</h2>
              <p>{performancePresets.find((preset) => preset.id === camera.preset)?.description}</p>
              <label>
                Duration
                <input
                  type="number"
                  aria-label="Angle duration"
                  value={Number(shot.duration.toFixed(3))}
                  min={0.5}
                  max={duration - (document.shots.length - 1) * 0.5}
                  step={0.1}
                  disabled={locked || document.shots.length === 1}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (value >= 0.5) {
                      const next = structuredClone(document);
                      resizePerformanceShot(next, shot.id, value);
                      stop();
                      edit(next);
                      seek(
                        next.shots
                          .slice(
                            0,
                            next.shots.findIndex((item) => item.id === shot.id),
                          )
                          .reduce((sum, item) => sum + item.duration, 0),
                        shot.id,
                      );
                    }
                  }}
                />
              </label>
              <label>
                Framing
                <span>{camera.lens < 35 ? "Wide" : camera.lens > 65 ? "Tight" : "Medium"}</span>
                <input
                  type="range"
                  aria-label="Framing"
                  min={20}
                  max={100}
                  step={1}
                  value={camera.lens}
                  disabled={locked}
                  onChange={(event) => setCamera({ lens: Number(event.target.value) })}
                />
              </label>
              <label>
                Movement
                <select
                  aria-label="Camera movement"
                  value={camera.movement}
                  disabled={locked}
                  onChange={(event) =>
                    setCamera({ movement: event.target.value as PerformanceCamera["movement"] })
                  }
                >
                  <option value="static">Hold camera</option>
                  <option value="push-in">Move closer</option>
                  <option value="pull-out">Move away</option>
                  <option value="orbit">Orbit around figure</option>
                </select>
              </label>
              {camera.movement === "orbit" ? (
                <label>
                  Orbit arc<span>{camera.arc}°</span>
                  <input
                    type="range"
                    aria-label="Orbit arc"
                    min={-180}
                    max={180}
                    step={5}
                    value={camera.arc}
                    disabled={locked}
                    onChange={(event) => setCamera({ arc: Number(event.target.value) })}
                  />
                  <small>Positive: clockwise · negative: counterclockwise</small>
                </label>
              ) : null}
              <details className="performance-advanced">
                <summary>Fine-tune camera</summary>
                <label>
                  Shot name
                  <input
                    aria-label="Angle name"
                    value={shot.name}
                    maxLength={120}
                    disabled={locked}
                    onChange={(event) => {
                      if (event.target.value.trim())
                        change((draft) => {
                          draft.shots.find((item) => item.id === shot.id)!.name =
                            event.target.value;
                        });
                    }}
                  />
                </label>
                <label>
                  Focus
                  <select
                    aria-label="Camera focus"
                    value={camera.focus}
                    disabled={locked}
                    onChange={(event) =>
                      setCamera({ focus: event.target.value as PerformanceCamera["focus"] })
                    }
                  >
                    <option value="body">Whole figure</option>
                    <option value="face">Face</option>
                    <option value="mouth">Mouth</option>
                    <option value="hands">Hands</option>
                  </select>
                </label>
                {(
                  [
                    {
                      field: "azimuth",
                      label: "Camera angle",
                      min: -180,
                      max: 180,
                      step: 1,
                      unit: "°",
                    },
                    {
                      field: "elevation",
                      label: "Camera height",
                      min: -30,
                      max: 85,
                      step: 1,
                      unit: "°",
                    },
                    {
                      field: "distance",
                      label: "Distance",
                      min: 0.2,
                      max: 10,
                      step: 0.05,
                      unit: "m",
                    },
                    { field: "lens", label: "Framing", min: 20, max: 100, step: 1, unit: "mm" },
                  ] as const
                )
                  .filter((control) => control.field !== "lens")
                  .map((control) => (
                    <label key={control.field}>
                      {control.label}
                      <span>
                        {camera[control.field]} {control.unit}
                      </span>
                      <input
                        type="range"
                        aria-label={control.label}
                        min={control.min}
                        max={control.max}
                        step={control.step}
                        value={camera[control.field]}
                        disabled={locked}
                        onChange={(event) =>
                          setCamera({ [control.field]: Number(event.target.value) })
                        }
                      />
                    </label>
                  ))}
              </details>
              <div className="performance-angle-actions">
                <button
                  aria-label="Move angle earlier"
                  disabled={locked || shot.id === document.shots[0]!.id}
                  onClick={() => moveAngle(-1)}
                >
                  <ArrowLeft size={15} />
                </button>
                <button
                  aria-label="Move angle later"
                  disabled={locked || shot.id === document.shots.at(-1)!.id}
                  onClick={() => moveAngle(1)}
                >
                  <ArrowRight size={15} />
                </button>
                <button
                  aria-label="Delete angle"
                  disabled={locked || document.shots.length === 1}
                  onClick={() => change((draft) => removePerformanceShot(draft, shot.id))}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <p>
                Changing an angle's duration adjusts its neighbour. The original performance always
                stays continuous.
              </p>
            </>
          )}
        </aside>
      </div>
      {busy || exporter.status ? (
        <div className="performance-progress" role="status">
          <Loader2 size={16} className="animate-spin" />
          <span>{busy ?? exporter.status?.stage}</span>
          {exporter.status ? (
            <progress
              aria-label="Reference export progress"
              max={100}
              value={exporter.status.progress}
            />
          ) : null}
          <button
            onClick={() => {
              importTask.current?.abort();
              exporter.cancel();
            }}
          >
            Cancel
          </button>
        </div>
      ) : null}
      <div className="performance-transport">
        <button
          aria-label={playing ? "Pause performance preview" : "Play performance preview"}
          disabled={locked}
          onClick={() => void toggle()}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <output data-testid="performance-current-time">
          {clock(time)} / {clock(duration)}
        </output>
        <input
          type="range"
          aria-label="Performance playback position"
          min={0}
          max={duration}
          step={1 / 24}
          value={time}
          disabled={locked}
          onChange={(event) => seek(Number(event.target.value))}
        />
        <span>Free camera preview</span>
      </div>
      <section className="performance-presets" aria-label="Camera angle presets">
        <header>
          <strong>Choose an angle</strong>
          <span>Apply to the selected shot</span>
          <button
            disabled={locked || shot.duration < 1 || document.shots.length >= 30}
            onClick={addAngle}
          >
            <Plus size={15} />
            Add angle
          </button>
        </header>
        <div>
          {performancePresets.map((preset) => (
            <button
              key={preset.id}
              disabled={locked}
              aria-label={`Apply ${preset.name} angle`}
              aria-pressed={camera.preset === preset.id}
              title={preset.description}
              onClick={() => {
                change((draft) => {
                  const index = draft.shots.findIndex((item) => item.id === shot.id);
                  draft.shots[index] = createPerformanceShot(preset.id, shot.id, shot.duration);
                });
                seek(
                  document.shots
                    .slice(
                      0,
                      document.shots.findIndex((item) => item.id === shot.id),
                    )
                    .reduce((sum, item) => sum + item.duration, 0),
                  shot.id,
                );
                setStep(1);
              }}
            >
              <PerformancePresetArt preset={preset.id} />
              <strong>{preset.name}</strong>
              <small>
                {preset.camera.movement === "orbit"
                  ? "Moving camera"
                  : preset.camera.focus === "body"
                    ? "Whole figure"
                    : preset.camera.focus}
              </small>
            </button>
          ))}
        </div>
      </section>
      <fieldset disabled={locked} className="performance-timeline-fieldset">
        <PerformanceTimeline
          document={document}
          time={time}
          selected={shot.id}
          onSelect={setSelected}
          onSeek={seek}
          onEdit={locked ? () => undefined : change}
          sourceName={source?.name ?? localFile?.name}
        />
      </fieldset>
      <footer className="performance-footer">
        <span>
          {id
            ? "Private project · auto-saved"
            : "Local plan · save a project for cloud persistence"}
        </span>
        <span>The stand-in does not reproduce the actor's gestures.</span>
        <Link href="/studio">
          Record with Director Studio
          <ArrowRight size={12} />
        </Link>
      </footer>
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        initialMode="login"
        returnTo="/director/demo"
      />
    </main>
  );
}
