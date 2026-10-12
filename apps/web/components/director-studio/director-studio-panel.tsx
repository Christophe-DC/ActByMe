"use client";

import { useEffect, useState } from "react";
import {
  studioDemoScene,
  studioSceneSchema,
  type StudioScene,
  type StudioState,
} from "@actbyme/shared";
import { directorStudioApi } from "@/lib/api/client";
import { StudioPlayer } from "./studio-player";
import { StudioEditor } from "./studio-editor";

const button =
  "rounded-lg border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-40";
export function DirectorStudioPanel({
  projectId,
  briefApproved,
  onPrepare,
}: {
  projectId: string;
  briefApproved: boolean;
  onPrepare?: () => Promise<unknown>;
}) {
  const [state, setState] = useState<StudioState | null>(null);
  const [scene, setScene] = useState<StudioScene | null>(null);
  const [instructions, setInstructions] = useState("");
  const [roleId, setRoleId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [history, setHistory] = useState<StudioScene[]>([]);
  const [future, setFuture] = useState<StudioScene[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [demo, setDemo] = useState(false);
  function sync(next: StudioState) {
    setState(next);
    setScene(next.revision?.scene ?? null);
    setInstructions(
      next.job && next.job.status !== "COMPLETED"
        ? next.job.instructions
        : (next.revision?.instructions ?? ""),
    );
    setRoleId(next.revision?.roleId ?? "");
    setSelectedId(next.revision?.scene.characters[0]?.id ?? "");
    setHistory([]);
    setFuture([]);
    setDirty(false);
  }
  useEffect(() => {
    let cancelled = false;
    void directorStudioApi
      .get(projectId)
      .then((next) => {
        if (!cancelled) sync(next);
      })
      .catch((error: unknown) => {
        if (!cancelled) setError(message(error));
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);
  const generating = Boolean(state?.job && ["QUEUED", "RUNNING"].includes(state.job.status));
  useEffect(() => {
    if (!generating) return;
    let cancelled = false;
    let inFlight = false;
    const timer = window.setInterval(() => {
      if (inFlight) return;
      inFlight = true;
      void directorStudioApi
        .get(projectId)
        .then((next) => {
          if (cancelled) return;
          if (next.job && ["QUEUED", "RUNNING"].includes(next.job.status)) setState(next);
          else sync(next);
        })
        .catch((error: unknown) => {
          if (!cancelled) setError(message(error));
        })
        .finally(() => {
          inFlight = false;
        });
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [projectId, generating]);
  async function action(operation: () => Promise<StudioState>) {
    setBusy(true);
    setError("");
    try {
      const next = await operation();
      if (next.job && ["QUEUED", "RUNNING"].includes(next.job.status)) setState(next);
      else sync(next);
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  function change(next: StudioScene) {
    if (scene) setHistory((current) => [...current.slice(-49), scene]);
    setFuture([]);
    setScene(next);
    setDirty(true);
  }
  async function saveCurrent() {
    if (!state || !scene) throw new Error("Generate a scene first.");
    const result = studioSceneSchema.safeParse(scene);
    if (!result.success)
      throw new Error(result.error.issues.map((issue) => issue.message).join(" "));
    return directorStudioApi.save(
      projectId,
      state.version,
      result.data,
      instructions,
      roleId || null,
    );
  }
  const disabled = busy || generating || Boolean(state?.locked);
  return (
    <section
      className="rounded-2xl border border-amber-300/20 bg-[#111214] p-5 text-white sm:p-7"
      data-testid="director-studio"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Director Studio 3D</h2>
          <p className="mt-2 text-sm text-zinc-300">
            Direct the scene, preview it, then share a validated version with your actor.
          </p>
        </div>
        <button className={button} onClick={() => setDemo(!demo)}>
          {demo ? "Close demo" : "View demo"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-red-400/10 p-3 text-red-200">
          {error}
        </p>
      ) : null}
      {demo ? (
        <div className="mt-5 space-y-3">
          <p className="text-amber-200">
            Demo scene · fictional characters · three roles and four camera angles
          </p>
          <StudioPlayer scene={studioDemoScene} />
        </div>
      ) : null}
      {!state ? (
        <p className="mt-4">{error ? "Studio could not load." : "Loading studio…"}</p>
      ) : (
        <>
          <label className="mt-5 flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={state.enabled}
              disabled={disabled}
              onChange={(event) => {
                const enabled = event.target.checked;
                setState({ ...state, enabled });
                void action(async () => {
                  try {
                    await onPrepare?.();
                    return await directorStudioApi.activate(projectId, state.version, enabled);
                  } catch (error) {
                    setState(state);
                    throw error;
                  }
                });
              }}
            />{" "}
            Enable 3D preview for this project
          </label>
          {state.enabled ? (
            <div className="mt-5 space-y-5">
              {state.locked ? (
                <p className="text-amber-200">Request sent. The shared preview is locked.</p>
              ) : (
                <>
                  <label className="block text-sm">
                    Camera movements and acting instructions
                    <textarea
                      aria-label="Camera movements and acting instructions"
                      className="mt-2 min-h-28 w-full rounded-xl border border-white/20 bg-black/25 p-3 text-white"
                      value={instructions}
                      maxLength={12000}
                      disabled={disabled}
                      placeholder="Two characters face each other. Start wide, move closer as Léa approaches, then show Marc’s reaction…"
                      onChange={(event) => {
                        setInstructions(event.target.value);
                        setDirty(true);
                      }}
                    />
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <button
                      className={button}
                      disabled={disabled || !instructions.trim()}
                      onClick={() =>
                        void action(async () => {
                          await onPrepare?.();
                          let current = state;
                          if (dirty && scene) current = await saveCurrent();
                          return directorStudioApi.generate(
                            projectId,
                            current.version,
                            instructions,
                          );
                        })
                      }
                    >
                      {generating
                        ? "Generating…"
                        : scene
                          ? "Revise with AI"
                          : "Generate 3D preview"}
                    </button>
                    {generating ? (
                      <span role="status" className="text-sm text-amber-200">
                        {state.job?.status === "QUEUED" ? "Queued" : "AI generation in progress"} ·
                        You can leave and return.
                      </span>
                    ) : null}
                  </div>
                </>
              )}
              {state.job?.status === "FAILED" ? (
                <p role="alert" className="text-red-200">
                  {state.job.error}
                </p>
              ) : null}
              {state.stale ? (
                <p role="alert" className="text-amber-200">
                  The shooting plan changed. Regenerate the preview and validate it again.
                </p>
              ) : null}
              {scene ? (
                <>
                  <StudioPlayer
                    scene={scene}
                    roleId={roleId}
                    selectedId={selectedId}
                    onSelect={disabled ? undefined : setSelectedId}
                    onMove={
                      disabled
                        ? undefined
                        : (position, time) => {
                            const next = structuredClone(scene);
                            const character = next.characters.find(
                              (item) => item.id === selectedId,
                            );
                            if (!character) return;
                            let index = 0;
                            character.keyframes.forEach((frame, frameIndex) => {
                              if (frame.time <= time) index = frameIndex;
                            });
                            character.keyframes[index]!.position = position;
                            change(next);
                          }
                    }
                  />
                  {!state.locked ? (
                    <>
                      <div className="flex flex-wrap gap-3">
                        <button
                          className={button}
                          disabled={disabled || !history.length}
                          onClick={() => {
                            const previous = history.at(-1)!;
                            setHistory(history.slice(0, -1));
                            setFuture([...future, scene]);
                            setScene(previous);
                            setDirty(true);
                          }}
                        >
                          Undo
                        </button>
                        <button
                          className={button}
                          disabled={disabled || !future.length}
                          onClick={() => {
                            const next = future.at(-1)!;
                            setFuture(future.slice(0, -1));
                            setHistory([...history, scene]);
                            setScene(next);
                            setDirty(true);
                          }}
                        >
                          Redo
                        </button>
                        <button
                          className={button}
                          disabled={disabled || !dirty}
                          onClick={() =>
                            void action(async () => {
                              await onPrepare?.();
                              return saveCurrent();
                            })
                          }
                        >
                          Save preview
                        </button>
                        <button
                          className={button}
                          disabled={busy || generating}
                          onClick={() => void action(() => directorStudioApi.get(projectId))}
                        >
                          Reload saved preview
                        </button>
                        <span className="self-center text-sm text-zinc-300">
                          {dirty ? "Unsaved changes" : `Saved revision ${state.revision?.version}`}
                        </span>
                      </div>
                      <fieldset disabled={disabled}>
                        <StudioEditor
                          scene={scene}
                          selectedId={selectedId}
                          onSelect={setSelectedId}
                          onChange={change}
                        />
                      </fieldset>
                      <label className="block text-sm">
                        Actor’s role
                        <select
                          aria-label="Actor’s role"
                          className="ml-3 rounded-lg border border-white/20 bg-[#17171b] p-2"
                          value={roleId}
                          disabled={disabled}
                          onChange={(event) => {
                            setRoleId(event.target.value);
                            setDirty(true);
                          }}
                        >
                          <option value="">Select a character</option>
                          {scene.characters.map((character) => (
                            <option key={character.id} value={character.id}>
                              {character.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      {!briefApproved ? (
                        <p className="text-sm text-amber-200">
                          Approve the shooting plan to validate and send this preview.
                        </p>
                      ) : null}
                      <button
                        className="rounded-xl bg-amber-300 px-5 py-3 font-semibold text-black disabled:opacity-40"
                        disabled={disabled || !roleId || !briefApproved || state.stale}
                        onClick={() =>
                          void action(async () => {
                            const current = dirty ? await saveCurrent() : state;
                            return directorStudioApi.approve(projectId, current.version, roleId);
                          })
                        }
                      >
                        Validate preview for actor
                      </button>
                    </>
                  ) : null}
                  {state.revision?.approvedAt && !dirty && !state.stale ? (
                    <p role="status" className="text-emerald-200">
                      Preview validated ·{" "}
                      {scene.characters.find((character) => character.id === roleId)?.name}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-zinc-300">
                  Describe your intentions and generate your first preview.
                </p>
              )}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
function message(error: unknown) {
  return error instanceof Error ? error.message : "Studio action failed.";
}
