"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CircleHelp,
  Clapperboard,
  Download,
  Layers3,
  Loader2,
  Maximize2,
  Pause,
  Play,
  Redo2,
  Save,
  SkipBack,
  SkipForward,
  Undo2,
  Film,
  X,
} from "lucide-react";
import {
  createDirectorShot,
  directorDuration,
  directorProductionPlan,
  directorShotAt,
  splitDirectorShot,
  type DirectorAsset,
  type DirectorDocument,
  type DirectorTemplate,
  type DirectorTrack,
  type DirectorShot,
  type DirectorTimelineItem,
} from "@actbyme/shared";
import { directorApi } from "@/lib/api/client";
import { supabase } from "@/lib/supabase/client";
import { AuthModal } from "@/components/auth/auth-modal";
import { useDirectorBrowserExport } from "./use-director-browser-export";
import { useDirectorProject } from "./use-director-project";
import { useDirectorDialog } from "./use-director-dialog";
import { DirectorPreview } from "./director-preview";
import { DirectorMap } from "./director-map";
import { AssetLibrary, TemplateLibrary } from "./director-library";
import { CameraInspector, TrackInspector } from "./director-inspector";
import { DirectorTimeline, type DirectorSelection } from "./director-timeline";
import { DirectorPerform } from "./director-perform";
import { DirectorGenerate, downloadDirectorJson } from "./director-generate";
import { DirectorLoading } from "./director-loading";
import "./director.css";

const steps = [
  { id: "plan", label: "Plan", subtitle: "Prepare" },
  { id: "direct", label: "Direct", subtitle: "Direct your scene" },
  { id: "perform", label: "Perform", subtitle: "Actors & audio" },
  { id: "generate", label: "Generate", subtitle: "Produce" },
] as const;
export function DirectorEditor({ id }: { id?: string }) {
  const project = useDirectorProject(id),
    router = useRouter();
  const { document, state, edit, setError } = project;
  const browserExport = useDirectorBrowserExport(id, project.save, project.refresh, setError);
  const [step, setStep] = useState<(typeof steps)[number]["id"]>("direct"),
    [library, setLibrary] = useState("templates"),
    [selection, setSelection] = useState<DirectorSelection>({ kind: "shot", id: "shot_arrival" }),
    [waypoint, setWaypoint] = useState("shot_arrival_wp_0"),
    [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false),
    [help, setHelp] = useState(false),
    [authOpen, setAuthOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [history, setHistory] = useState<{ id: string; version: number; createdAt: string }[]>([]);
  const clock = useRef(0);
  useDirectorDialog(help, () => setHelp(false));
  const [clipboard, setClipboard] = useState<
    { kind: "shot"; item: DirectorShot } | { kind: "track"; item: DirectorTimelineItem } | null
  >(null);
  const duration = directorDuration(document),
    selectedTrack =
      selection.kind === "track"
        ? document.tracks.find((item) => item.id === selection.id)
        : undefined;
  const shot =
    document.shots.find((item) => selection.kind === "shot" && item.id === selection.id) ??
    directorShotAt(document, time).shot;
  const assets = state?.assets ?? [];
  const seek = useCallback((at: number) => {
    setPlaying(false);
    clock.current = at;
    setTime(at);
  }, []);
  const select = useCallback((value: DirectorSelection) => {
    setPlaying(false);
    setSelection(value);
  }, []);
  useEffect(() => {
    if (time > duration) seek(duration);
  }, [duration, time, seek]);
  useEffect(() => {
    if (!playing) return;
    let frame = 0,
      previous = performance.now(),
      lastUi = 0;
    const tick = (now: number) => {
      clock.current = Math.min(duration, clock.current + Math.min(0.1, (now - previous) / 1000));
      previous = now;
      if (now - lastUi > 40 || clock.current >= duration) {
        setTime(clock.current);
        lastUi = now;
      }
      if (clock.current >= duration) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, duration]);
  useEffect(() => {
    const hidden = () => {
      if (window.document.hidden) setPlaying(false);
    };
    window.document.addEventListener("visibilitychange", hidden);
    return () => window.document.removeEventListener("visibilitychange", hidden);
  }, []);
  const toggle = () => {
    if (clock.current >= duration) {
      clock.current = 0;
      setTime(0);
    }
    setPlaying(!playing);
  };
  const addTemplate = (template: DirectorTemplate) => {
    const id = `shot_${crypto.randomUUID()}`;
    if (
      edit((draft) => {
        draft.shots.push(createDirectorShot(template.id, id));
      })
    ) {
      setSelection({ kind: "shot", id });
      setWaypoint(`${id}_wp_0`);
      seek(duration);
    }
  };
  const duplicate = () => {
    const newId = `${selection.kind}_${crypto.randomUUID()}`;
    edit((draft) => {
      if (selection.kind === "shot") {
        const index = draft.shots.findIndex((item) => item.id === selection.id);
        if (index < 0) return;
        const copy = structuredClone(draft.shots[index]!);
        copy.id = newId;
        copy.name = `${copy.name.slice(0, 110)} · copy`;
        copy.waypoints.forEach((point, index) => {
          point.id = `${newId}_wp_${index}`;
        });
        draft.shots.splice(index + 1, 0, copy);
      } else {
        const track = draft.tracks.find((item) => item.id === selection.id);
        if (track)
          draft.tracks.push({
            ...structuredClone(track),
            id: newId,
            label: `${track.label.slice(0, 110)} · copy`,
          });
      }
    });
    setSelection({ kind: selection.kind, id: newId });
  };
  const copy = () => {
    if (selection.kind === "shot") setClipboard({ kind: "shot", item: structuredClone(shot) });
    else if (selectedTrack) setClipboard({ kind: "track", item: structuredClone(selectedTrack) });
  };
  const paste = () => {
    if (!clipboard) return;
    const id = `${clipboard.kind}_${crypto.randomUUID()}`;
    edit((draft) => {
      if (clipboard.kind === "shot") {
        const copy = structuredClone(clipboard.item);
        copy.id = id;
        copy.waypoints.forEach((point, index) => {
          point.id = `${id}_wp_${index}`;
        });
        draft.shots.splice(draft.shots.findIndex((item) => item.id === shot.id) + 1, 0, copy);
      } else {
        const copy = structuredClone(clipboard.item);
        copy.id = id;
        copy.start = Math.min(time, duration - copy.duration);
        draft.tracks.push(copy);
      }
    });
    setSelection({ kind: clipboard.kind, id });
  };
  const remove = () => {
    if (selection.kind === "shot" && document.shots.length === 1) {
      setError("Keep at least one shot in the project.");
      return;
    }
    edit((draft) => {
      if (selection.kind === "track")
        draft.tracks = draft.tracks.filter((item) => item.id !== selection.id);
      else {
        draft.shots = draft.shots.filter((item) => item.id !== selection.id);
        const total = directorDuration(draft);
        draft.tracks = draft.tracks
          .filter((item) => item.start < total)
          .map((item) => ({
            ...item,
            duration: Math.min(item.duration, total - item.start),
            fadeIn: Math.min(item.fadeIn, (total - item.start) / 2),
            fadeOut: Math.min(item.fadeOut, (total - item.start) / 2),
          }));
      }
    });
    setSelection({
      kind: "shot",
      id: document.shots.find((item) => item.id !== selection.id)?.id ?? document.shots[0]!.id,
    });
  };
  const split = () => {
    if (selection.kind !== "shot") return;
    let start = 0;
    for (const item of document.shots) {
      if (item.id === shot.id) break;
      start += item.duration;
    }
    const local = time - start;
    if (local < 0.5 || local > shot.duration - 0.5) {
      setError("Place the playhead at least 0.5 seconds from either end of the selected shot.");
      return;
    }
    edit(splitDirectorShot(document, shot.id, local, `shot_${crypto.randomUUID()}`));
  };
  const keyboard = useRef({
    duplicate,
    copy,
    paste,
    remove,
    split,
    toggle,
    undo: project.undo,
    redo: project.redo,
  });
  keyboard.current = {
    duplicate,
    copy,
    paste,
    remove,
    split,
    toggle,
    undo: project.undo,
    redo: project.redo,
  };
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented || window.document.querySelector("dialog[open], [role=dialog]"))
        return;
      if (
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName))
      )
        return;
      if (event.code === "Space") {
        event.preventDefault();
        keyboard.current.toggle();
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) keyboard.current.redo();
        else keyboard.current.undo();
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        keyboard.current.duplicate();
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
        event.preventDefault();
        keyboard.current.copy();
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "v") {
        event.preventDefault();
        keyboard.current.paste();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        keyboard.current.remove();
      } else if (event.key.toLowerCase() === "s" && !event.metaKey && !event.ctrlKey)
        keyboard.current.split();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const addTrack = (
    asset: DirectorAsset,
    requestedTrack?: DirectorTrack,
    start = Math.min(time, duration - 0.1),
  ) => {
    const track =
      requestedTrack ??
      (asset.kind === "performance"
        ? "performance"
        : asset.kind === "voice"
          ? "voice"
          : asset.kind === "sfx"
            ? "sfx"
            : "music");
    if (track === "performance" ? !asset.contentType.startsWith("video/") : !asset.hasAudio) {
      setError("This asset is not compatible with the selected track.");
      return;
    }
    const id = `track_${crypto.randomUUID()}`,
      length = Math.min(asset.duration ?? 8, duration - start);
    if (
      edit((draft) => {
        draft.tracks.push({
          id,
          track,
          label: asset.name.slice(0, 120),
          start,
          duration: length,
          offset: 0,
          volume: track === "music" ? 0.35 : 1,
          fadeIn: Math.min(0.25, length / 4),
          fadeOut: Math.min(0.25, length / 4),
          assetId: asset.id,
          castId: null,
          instructions: "",
        });
      })
    )
      setSelection({ kind: "track", id });
  };
  const useClip = (shotId: string, assetId: string) => {
    if (assetId) {
      const asset = assets.find((asset) => asset.id === assetId),
        selected = document.shots.find((shot) => shot.id === shotId);
      if (!asset?.duration || !selected || asset.duration < selected.duration - 0.08) {
        setError("This clip is too short. Adjust the shot duration or choose a longer clip.");
        return;
      }
    }
    edit((draft) => {
      const selected = draft.shots.find((shot) => shot.id === shotId);
      if (selected) {
        selected.clipAssetId = assetId || null;
        selected.clipOffset = 0;
      }
    });
  };
  const attach = (asset: DirectorAsset) => {
    if (asset.kind === "clip") useClip(shot.id, asset.id);
    else if (asset.contentType.startsWith("audio/") || asset.kind === "performance")
      addTrack(asset);
    else
      edit((draft) => {
        const selected = draft.shots.find((item) => item.id === shot.id)!;
        if (!selected.referenceIds.includes(asset.id)) selected.referenceIds.push(asset.id);
      });
  };
  const createFromDemo = async () => {
    setBusy(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setPlaying(false);
        setAuthOpen(true);
        return;
      }
      const created = await directorApi.create(document.title, false);
      await directorApi.save(created.id, created.version, document);
      router.push(`/director/${created.id}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Sign in to save this project.");
    } finally {
      setBusy(false);
    }
  };
  const editDocument = useCallback(
    (change: (draft: DirectorDocument) => void) => {
      setPlaying(false);
      edit(change);
    },
    [edit],
  );
  const loadHistory = async () => {
    if (!id) return;
    try {
      setHistory(await directorApi.read(id, "history"));
    } catch (error) {
      setError((error as Error).message);
    }
  };
  if (project.loading)
    return (
      <main className="director-page director-loading">
        <DirectorLoading
          message="Opening your private project…"
          onRetry={() => void project.reload()}
        />
      </main>
    );
  if (id && !state)
    return (
      <main className="director-page director-load-error">
        <Clapperboard size={40} />
        <h1>Unable to open Director</h1>
        <p role="alert">{project.error}</p>
        <button onClick={() => void project.reload()}>Try loading again</button>
        <Link href={`/login?next=${encodeURIComponent(`/director/${id}`)}`}>
          Sign in to this project
        </Link>
        <Link href="/director">Back to projects and sign-in</Link>
      </main>
    );
  return (
    <main className="director-editor" data-testid="director-editor">
      <header className="director-topbar">
        <div className="director-brand-group">
          <Link href="/director" className="director-brand">
            <Clapperboard size={20} />
            <strong>ACTBYME</strong>
            <span>/ DIRECTOR</span>
          </Link>
          <span className="director-top-divider" />
          <span className="director-project-title">{document.title}</span>
          <button
            className="director-save-status"
            aria-label="Save project"
            title="Changes are saved automatically"
            onClick={() => void project.save()}
          >
            <span className={`director-live-dot ${project.conflict ? "is-offline" : ""}`} />
            {project.saveStatus}
          </button>
        </div>
        <nav className="director-workflow" aria-label="Director workspaces">
          {steps.map((item) => (
            <button
              key={item.id}
              aria-current={step === item.id ? "step" : undefined}
              onClick={() => {
                setStep(item.id);
                setPlaying(false);
                if (item.id === "generate") setLibrary("assets");
              }}
              title={item.subtitle}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="director-top-actions">
          {browserExport.status && step !== "generate" ? (
            <button onClick={() => setStep("generate")} title={browserExport.status.stage}>
              <Loader2 size={13} className="animate-spin" />
              Export {Math.round(browserExport.status.progress)}%
            </button>
          ) : null}
          <button
            title="Undo (⌘Z)"
            aria-label="Undo change"
            disabled={!project.canUndo}
            onClick={project.undo}
          >
            <Undo2 size={15} />
          </button>
          <button
            title="Redo (⌘⇧Z)"
            aria-label="Redo change"
            disabled={!project.canRedo}
            onClick={project.redo}
          >
            <Redo2 size={15} />
          </button>
          <button className="director-preview-button" onClick={toggle}>
            {playing ? <Pause size={13} /> : <Play size={13} />}
            <span>{playing ? "Pause" : "Preview"}</span>
          </button>
          <button
            className="director-primary"
            onClick={() => {
              setStep("generate");
              setLibrary("assets");
            }}
          >
            <Film size={13} />
            <span>Export MP4</span>
          </button>
          <button aria-label="Director help and shortcuts" onClick={() => setHelp(true)}>
            <CircleHelp size={16} />
          </button>
        </div>
      </header>
      {!id ? (
        <div className="director-demo-banner">
          <span>
            <span className="director-badge">DEMO PROJECT</span>The Coastal House · free preview ·
            no real actors or paid generation
          </span>
          <button disabled={busy} onClick={() => void createFromDemo()}>
            <Save size={13} />
            Save to my account
          </button>
        </div>
      ) : null}
      {project.error ? (
        <div className="director-error-banner" role="alert">
          <span>{project.error}</span>
          <button aria-label="Dismiss error" onClick={() => setError(null)}>
            <X size={15} />
          </button>
        </div>
      ) : null}
      {project.conflict || project.recovered ? (
        <div className="director-conflict-banner">
          <span>
            {project.conflict
              ? "Conflict detected. Your draft is still on this device; automatic saving is paused."
              : "An unsaved draft was recovered on this device."}
          </span>
          <button
            onClick={() =>
              downloadDirectorJson(
                directorProductionPlan(document, assets, project.version),
                "director-recovered-draft.json",
              )
            }
          >
            <Download size={13} />
            Export draft
          </button>
          <button onClick={() => void project.discardLocal()}>Reload server version</button>
        </div>
      ) : null}
      <div className="director-workspace">
        <section className="director-left-panel">
          {step === "plan" ? (
            <div className="director-plan-form">
              <div className="director-panel-heading">
                <strong>Your creative direction</strong>
                <span className="director-badge">01 / Plan</span>
              </div>
              <label>
                Project title
                <input
                  aria-label="Director project title"
                  value={document.title}
                  maxLength={140}
                  onChange={(event) => {
                    if (event.target.value.trim())
                      editDocument((draft) => {
                        draft.title = event.target.value;
                      });
                  }}
                />
              </label>
              <label>
                Ad category
                <select
                  aria-label="Ad category"
                  value={document.category}
                  onChange={(event) =>
                    editDocument((draft) => {
                      draft.category = event.target.value as DirectorDocument["category"];
                    })
                  }
                >
                  <option value="real-estate">Real estate</option>
                  <option value="product">Product</option>
                  <option value="brand">Brand</option>
                  <option value="social">Social media</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>
                Creative brief
                <textarea
                  aria-label="Creative brief"
                  value={document.brief}
                  maxLength={8000}
                  rows={5}
                  onChange={(event) =>
                    editDocument((draft) => {
                      draft.brief = event.target.value;
                    })
                  }
                  placeholder="Goal, audience, mood and key benefit…"
                />
              </label>
              <label>
                Script & narration
                <textarea
                  aria-label="Ad script"
                  value={document.script}
                  maxLength={16000}
                  rows={7}
                  onChange={(event) =>
                    editDocument((draft) => {
                      draft.script = event.target.value;
                    })
                  }
                />
              </label>
              <label>
                Format
                <select
                  aria-label="Project aspect ratio"
                  value={document.aspectRatio}
                  onChange={(event) =>
                    editDocument((draft) => {
                      draft.aspectRatio = event.target.value as DirectorDocument["aspectRatio"];
                    })
                  }
                >
                  <option value="16:9">16:9 · landscape</option>
                  <option value="9:16">9:16 · portrait</option>
                  <option value="1:1">1:1 · square</option>
                </select>
              </label>
              <label>
                Preview environment
                <select
                  aria-label="Preview environment"
                  value={document.environment}
                  onChange={(event) =>
                    editDocument((draft) => {
                      draft.environment = event.target.value as DirectorDocument["environment"];
                    })
                  }
                >
                  <option value="coastal">Schematic coastal house</option>
                  <option value="studio">Product studio</option>
                </select>
              </label>
              <p className="director-hint">
                Total duration follows your shots: {duration.toFixed(1)} seconds. Adjust each shot
                in Direct.
              </p>
            </div>
          ) : step === "perform" && library !== "assets" ? (
            <>
              <div className="director-library-switch">
                <button aria-pressed={true} onClick={() => setLibrary("templates")}>
                  Casting
                </button>
                <button onClick={() => setLibrary("assets")}>Assets & audio</button>
              </div>
              <DirectorPerform
                id={id}
                document={document}
                assets={assets}
                onEdit={editDocument}
                onError={setError}
                onSave={project.save}
                onRefresh={project.refresh}
              />
            </>
          ) : (
            <>
              <div className="director-library-switch">
                <button
                  aria-pressed={library === "templates"}
                  onClick={() => setLibrary("templates")}
                >
                  {step === "perform" ? "Casting" : "Templates"}
                </button>
                <button aria-pressed={library === "assets"} onClick={() => setLibrary("assets")}>
                  Assets
                </button>
              </div>
              {library === "templates" ? (
                <TemplateLibrary selected={shot.templateId} onAdd={addTemplate} />
              ) : (
                <AssetLibrary
                  id={id}
                  assets={assets}
                  storageReady={Boolean(state?.capabilities.storageReady)}
                  onChanged={project.refresh}
                  onError={setError}
                  onAttach={attach}
                  onAddTrack={addTrack}
                />
              )}
            </>
          )}
        </section>
        <section className="director-center-panel">
          <DirectorPreview
            id={id}
            document={document}
            assets={assets}
            time={time}
            playing={playing}
            onError={setError}
          />
          <div className="director-map-panel">
            <div className="director-panel-heading">
              <strong>
                <Layers3 size={14} />
                Top view
              </strong>
              <span>Drag waypoints · use arrow keys to fine-tune</span>
              <span className="director-badge">{shot.waypoints.length} points · 1 shot</span>
              <button
                aria-label="Expand top view"
                title="Expand the map; press Escape to return to the editor"
                onClick={(event) => {
                  const panel = event.currentTarget.closest(".director-map-panel");
                  if (!window.document.fullscreenElement)
                    void panel
                      ?.requestFullscreen()
                      .catch(() => setError("Full screen is unavailable."));
                  else void window.document.exitFullscreen();
                }}
              >
                <Maximize2 size={13} />
              </button>
            </div>
            <DirectorMap
              document={document}
              shot={shot}
              time={time}
              selectedWaypoint={waypoint}
              onSelect={setWaypoint}
              onSeek={seek}
              onMove={(id, position) =>
                editDocument((draft) => {
                  const point = draft.shots
                    .find((item) => item.id === shot.id)!
                    .waypoints.find((point) => point.id === id);
                  if (point) point.position = position;
                })
              }
            />
          </div>
        </section>
        {step === "generate" ? (
          <DirectorGenerate
            browserExport={browserExport}
            id={id}
            state={state}
            document={document}
            shot={shot}
            onError={setError}
            onSave={project.save}
            onRefresh={project.refresh}
            onUseClip={useClip}
            onImport={() => {
              setLibrary("assets");
              if (window.matchMedia("(max-width: 600px)").matches)
                requestAnimationFrame(() =>
                  window.document
                    .querySelector(".director-left-panel")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                );
            }}
          />
        ) : step === "plan" ? (
          <aside className="director-inspector">
            <div className="director-panel-heading">
              <strong>Before you produce</strong>
              <Check size={15} />
            </div>
            <ol className="director-onboarding">
              <li>
                <span>1</span>
                <div>
                  <strong>Set your direction</strong>
                  <p>A clear message, script and format.</p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>Direct your video</strong>
                  <p>Choose shots, adjust cameras and preview without credits.</p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>Add voices and talent</strong>
                  <p>Import your assets and record the permissions.</p>
                </div>
              </li>
              <li>
                <span>4</span>
                <div>
                  <strong>Review and produce</strong>
                  <p>Generate or import clips, review them and assemble your MP4.</p>
                </div>
              </li>
            </ol>
            <div className="director-project-stats">
              <span>
                <strong>{document.shots.length}</strong>shots
              </span>
              <span>
                <strong>{duration.toFixed(1)}s</strong>duration
              </span>
              <span>
                <strong>{assets.length}</strong>assets
              </span>
            </div>
            <details
              onToggle={(event) => {
                if (event.currentTarget.open) void loadHistory();
              }}
            >
              <summary>Saved history</summary>
              {history.map((revision) => (
                <button
                  key={revision.id}
                  disabled={busy || revision.version === project.version}
                  onClick={() => {
                    if (!id) return;
                    setBusy(true);
                    void project
                      .save()
                      .then((saved) => {
                        if (!saved) return;
                        return directorApi
                          .mutate(id, "restore", {
                            version: saved.version,
                            revisionId: revision.id,
                          })
                          .then(() => project.discardLocal());
                      })
                      .catch((error: Error) => setError(error.message))
                      .finally(() => setBusy(false));
                  }}
                >
                  Version {revision.version} ·{" "}
                  {new Date(revision.createdAt).toLocaleString("en-US")}
                </button>
              ))}
            </details>
            <p className="director-hint">
              Generations and exports use a fixed project snapshot. Editing the timeline never
              replaces an existing result.
            </p>
          </aside>
        ) : selectedTrack ? (
          <TrackInspector item={selectedTrack} document={document} onEdit={editDocument} />
        ) : (
          <CameraInspector
            document={document}
            shot={shot}
            waypointId={waypoint}
            onWaypoint={setWaypoint}
            onEdit={editDocument}
            onSeek={seek}
            assets={assets}
          />
        )}
      </div>
      <div className="director-transport">
        <div className="director-inline">
          <button aria-label="Go to start" onClick={() => seek(0)}>
            <SkipBack size={15} />
          </button>
          <button
            className="director-play-button"
            aria-label={playing ? "Pause preview" : "Play preview"}
            onClick={toggle}
          >
            {playing ? <Pause size={17} /> : <Play size={17} />}
          </button>
          <button
            aria-label="Next shot"
            onClick={() => {
              const active = directorShotAt(document, time);
              seek(Math.min(duration, active.start + active.shot.duration));
            }}
          >
            <SkipForward size={15} />
          </button>
          <span className="director-transport-time" data-testid="director-current-time">
            {time.toFixed(2)} <span>/ {duration.toFixed(1)}s</span>
          </span>
        </div>
        <input
          aria-label="Playback position"
          type="range"
          min="0"
          max={duration}
          step={1 / 24}
          value={time}
          onChange={(event) => seek(Number(event.target.value))}
        />
        <span className="director-free-label">
          <Check size={12} />
          Free preview
        </span>
      </div>
      <DirectorTimeline
        document={document}
        time={time}
        selection={selection}
        onSelect={select}
        onSeek={seek}
        onEdit={editDocument}
        onDuplicate={duplicate}
        onCopy={copy}
        onPaste={paste}
        canPaste={Boolean(clipboard)}
        onDelete={remove}
        onSplit={split}
        onAssetDrop={(id, track, start) => {
          const asset = assets.find((asset) => asset.id === id);
          if (asset) addTrack(asset, track, start);
        }}
      />
      <footer className="director-statusbar">
        <span>
          <span className="director-live-dot" />
          {id ? `Private project · version ${project.version}` : "Local demo · temporary changes"}
        </span>
        <span>Plan before you generate.</span>
        <Link href="/studio">
          Director Studio · actor recording <ArrowLeft size={12} />
        </Link>
      </footer>
      <AuthModal
        initialMode="login"
        onClose={() => setAuthOpen(false)}
        open={authOpen}
        returnTo={id ? `/director/${id}` : "/director/demo"}
      />
      {help ? (
        <div className="director-modal-backdrop">
          <div
            className="director-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="director-help-title"
          >
            <div className="director-panel-heading">
              <h2 id="director-help-title">Your first ad</h2>
              <button aria-label="Close help" onClick={() => setHelp(false)}>
                <X size={18} />
              </button>
            </div>
            <p>
              Prepare your brief in Plan. In Direct, add shot templates and move waypoints on the
              map. The 3D camera follows the path; each continuous move remains one shot.
            </p>
            <p>
              Import references in Assets and assign them to a shot. Add actors and sound in
              Perform. Music, dialogue and effects follow the timeline during playback.
            </p>
            <p>
              In Generate, import your clips or configure a video provider. Review each result,
              assign clips to shots and assemble your MP4.
            </p>
            <div className="director-shortcuts">
              <span>Space</span>
              <strong>Play / pause</strong>
              <span>⌘ / Ctrl Z</span>
              <strong>Undo</strong>
              <span>⌘ / Ctrl ⇧ Z</span>
              <strong>Redo</strong>
              <span>⌘ / Ctrl D</span>
              <strong>Duplicate</strong>
              <span>S</span>
              <strong>Split at playhead</strong>
              <span>Delete</span>
              <strong>Delete selection</strong>
            </div>
            <p>
              The preview uses a schematic scene, without reconstructing your photos or guaranteeing
              an AI result. Paid requests always require your confirmation.
            </p>
            <button className="director-primary" onClick={() => setHelp(false)}>
              Start directing
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
