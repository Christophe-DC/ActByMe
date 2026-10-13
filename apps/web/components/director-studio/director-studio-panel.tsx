"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Sparkles,
  Undo2,
  Redo2,
  History,
  Share2,
  Check,
  LayoutGrid,
  Video,
  X,
  Loader2,
} from "lucide-react";
import {
  characterMoment,
  moveStudioCharacter,
  selectionExists,
  type StudioScene,
  type StudioSelection,
} from "@actbyme/shared";
import {
  directorStudioApi,
  studioWorkspaceApi,
  type StudioHistory,
  type StudioShare,
} from "@/lib/api/client";
import { StudioPlayer } from "./studio-player";
import { StudioStageMap } from "./studio-stage-map";
import { StudioInspector } from "./studio-inspector";
import { StudioTimeline } from "./studio-timeline";
import { StudioStoryboard } from "./studio-storyboard";
import { useStudioDocument, message } from "./use-studio-document";
const button =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm text-zinc-100 transition hover:bg-white/10 disabled:opacity-40";
const documentObject = typeof window !== "undefined" ? window.document : null!;
const primary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-semibold text-black hover:bg-amber-200 disabled:opacity-40";
export function DirectorStudioPanel({
  projectId,
  briefApproved,
  onPrepare,
}: {
  projectId: string;
  briefApproved: boolean;
  onPrepare?: () => Promise<unknown>;
}) {
  const document = useStudioDocument(projectId);
  const { state, draft, generating } = document;
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"preview" | "arrange">("preview");
  const [time, setTime] = useState(0);
  const [selection, setSelection] = useState<StudioSelection>({ kind: "scene", id: "scene" });
  const [prompt, setPrompt] = useState("");
  const [modal, setModal] = useState<"history" | "share" | null>(null);
  const [versions, setVersions] = useState<StudioHistory | null>(null);
  const [shares, setShares] = useState<StudioShare[]>([]);
  const [shareLink, setShareLink] = useState("");
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!modal) return;
    const previous = documentObject.activeElement as HTMLElement | null;
    const focus = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialogRef.current) return;
      const nodes = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input,textarea,a[href]",
        ),
      );
      const first = nodes[0],
        last = nodes.at(-1);
      if (event.shiftKey && documentObject.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && documentObject.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    documentObject.addEventListener("keydown", focus);
    return () => {
      documentObject.removeEventListener("keydown", focus);
      previous?.focus();
    };
  }, [modal]);
  const scene = draft.scene;
  const selected =
    scene && selectionExists(scene, selection)
      ? selection
      : { kind: "scene" as const, id: "scene" };
  const disabled = busy || generating || Boolean(state?.locked);
  const editScene = (next: StudioScene, group?: string) =>
    document.change(
      {
        ...draft,
        scene: next,
        roleId: next.characters.some((item) => item.id === draft.roleId) ? draft.roleId : null,
      },
      group,
    );
  const name =
    selected.kind === "character"
      ? scene?.characters.find((item) => item.id === selected.id)?.name
      : selected.kind === "shot"
        ? scene?.shots.find((item) => item.id === selected.id)?.name
        : selected.kind === "cue"
          ? "Dialogue"
          : selected.kind === "prop"
            ? "Object"
            : "Whole scene";
  async function run(operation: () => Promise<void>) {
    setBusy(true);
    document.setError("");
    try {
      await operation();
    } catch (error) {
      document.setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  async function openModal(kind: "history" | "share") {
    setModal(kind);
    await run(async () => {
      await document.flush();
      if (kind === "history") setVersions(await studioWorkspaceApi.history(projectId));
      else setShares(await studioWorkspaceApi.shares(projectId));
    });
  }
  async function askAI() {
    await run(async () => {
      await onPrepare?.();
      const current = await document.flush();
      document.applyServer(
        scene
          ? await studioWorkspaceApi.edit(projectId, current.version, prompt, selected)
          : await directorStudioApi.generate(
              projectId,
              current.version,
              draft.instructions || "Bring this script to life.",
            ),
      );
      setPrompt("");
    });
  }
  return (
    <section
      data-testid="director-studio"
      className="overflow-hidden rounded-2xl border border-white/10 bg-[#111214] text-white shadow-2xl shadow-black/20"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4 sm:p-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-amber-200">
            Your story, in motion
          </p>
          <h2 className="mt-1 text-xl font-semibold">Director Studio 3D</h2>
          <p role="status" className="mt-1 text-xs text-zinc-300" data-testid="studio-save-status">
            {busy ? "Working…" : generating ? "AI is working on your scene…" : document.phase}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className={button}
            aria-label="Undo"
            disabled={disabled || !document.canUndo}
            onClick={document.undo}
          >
            <Undo2 className="size-4" />
          </button>
          <button
            className={button}
            aria-label="Redo"
            disabled={disabled || !document.canRedo}
            onClick={document.redo}
          >
            <Redo2 className="size-4" />
          </button>
          <button
            className={button}
            onClick={() => void openModal("history")}
            disabled={busy || !scene}
          >
            <History className="size-4" />
            <span>History</span>
          </button>
          <button
            className={primary}
            onClick={() => void openModal("share")}
            disabled={busy || generating || !scene}
          >
            <Share2 className="size-4" />
            Share
          </button>
        </div>
      </header>
      {document.error || state?.job?.status === "FAILED" ? (
        <div
          role="alert"
          className="m-4 rounded-xl border border-red-300/20 bg-red-400/10 p-4 text-sm text-red-100"
        >
          <p>{document.error || (state?.job?.error ? message(new Error(state.job.error)) : "")}</p>
          <div className="mt-3 flex gap-3">
            <button
              className={button}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await document.flush();
                })
              }
            >
              Retry saving
            </button>
            <button
              className={button}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await document.reload();
                })
              }
            >
              Reload saved scene
            </button>
          </div>
        </div>
      ) : null}
      {!state ? (
        <div className="p-8 text-zinc-300">Opening your workspace…</div>
      ) : !state.enabled ? (
        <div className="p-6 sm:p-10">
          <h3 className="text-2xl font-semibold">Make your story easy to see.</h3>
          <p className="mt-3 max-w-xl leading-7 text-zinc-300">
            Bring your script to life, move people around, and shape the camera views. No 3D
            experience needed.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className={primary}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await onPrepare?.();
                  document.applyServer(
                    await directorStudioApi.activate(projectId, state.version, true),
                  );
                })
              }
            >
              <Sparkles className="size-4" />
              Start creating
            </button>
            <Link className={button} href="/studio">
              Explore ready-made scenes
            </Link>
          </div>
        </div>
      ) : !scene ? (
        <div className="p-6 sm:p-10">
          <h3 className="text-2xl font-semibold">What should happen in your scene?</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            Your script is already attached. Describe the people, actions and camera views you have
            in mind.
          </p>
          <label className="mt-5 block text-sm">
            Your direction
            <textarea
              aria-label="Your direction"
              rows={4}
              className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 p-4 text-base"
              value={draft.instructions}
              disabled={disabled}
              maxLength={12000}
              placeholder="Two friends meet. One walks closer and waves. Start wide, then show their reactions."
              onChange={(event) =>
                document.change({ ...draft, instructions: event.target.value }, "direction")
              }
            />
          </label>
          <button
            className={`${primary} mt-4`}
            disabled={disabled || !draft.instructions.trim()}
            onClick={() => void askAI()}
          >
            {generating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {generating ? "Creating your scene…" : "Create my scene"}
          </button>
          <p className="mt-3 text-xs text-zinc-300">You can leave and return while the AI works.</p>
        </div>
      ) : (
        <>
          {state.stale ? (
            <div className="m-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-300/10 p-3 text-sm text-amber-100">
              <p>Your script or recording guide changed. Review this scene before continuing.</p>
              <button
                className={button}
                disabled={disabled}
                onClick={() =>
                  void run(async () => {
                    const current = await document.flush();
                    document.applyServer(
                      await directorStudioApi.save(
                        projectId,
                        current.version,
                        draft.scene!,
                        draft.instructions,
                        draft.roleId,
                      ),
                    );
                  })
                }
              >
                Keep this scene
              </button>
            </div>
          ) : null}
          {state.locked ? (
            <p className="m-4 rounded-lg bg-emerald-300/10 p-3 text-sm text-emerald-100">
              Sent to your actor. This version is locked so everyone follows the same direction.
            </p>
          ) : null}
          <div className="grid min-w-0 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-5 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="truncate font-semibold">{scene.title}</h3>
                <div className="flex gap-1 rounded-xl bg-black/25 p-1">
                  <button
                    className={`${button} ${view === "preview" ? "border-amber-300/50 text-amber-200" : "border-transparent"}`}
                    onClick={() => setView("preview")}
                  >
                    <Video className="size-4" />
                    Preview
                  </button>
                  <button
                    className={`${button} ${view === "arrange" ? "border-amber-300/50 text-amber-200" : "border-transparent"}`}
                    onClick={() => setView("arrange")}
                  >
                    <LayoutGrid className="size-4" />
                    Arrange scene
                  </button>
                </div>
              </div>
              {view === "preview" ? (
                <StudioPlayer
                  scene={scene}
                  roleId={draft.roleId}
                  selectedId={selected.kind === "character" ? selected.id : undefined}
                  timelineTime={time}
                  onTimelineTimeChange={setTime}
                  onSelect={disabled ? undefined : (id) => setSelection({ kind: "character", id })}
                  onMove={
                    disabled
                      ? undefined
                      : (position, at) => {
                          if (selected.kind === "character")
                            editScene(
                              moveStudioCharacter(scene, selected.id, at, position),
                              `move:${selected.id}`,
                            );
                        }
                  }
                />
              ) : (
                <StudioStageMap
                  scene={scene}
                  time={time}
                  disabled={disabled}
                  selectedId={selected.kind === "character" ? selected.id : undefined}
                  onSelect={(id) => setSelection({ kind: "character", id })}
                  onMove={(id, position) =>
                    editScene(moveStudioCharacter(scene, id, time, position), `move:${id}`)
                  }
                  selectedPropId={selected.kind === "prop" ? selected.id : undefined}
                  onSelectProp={(id) => setSelection({ kind: "prop", id })}
                  onMoveProp={(id, position) => {
                    const next = structuredClone(scene);
                    const prop = next.props.find((item) => item.id === id)!;
                    prop.position = {
                      x: Math.max(-15, Math.min(15, position.x)),
                      y: prop.position.y,
                      z: Math.max(-15, Math.min(15, position.z)),
                    };
                    editScene(next, `object:${id}`);
                  }}
                />
              )}
              <StudioTimeline
                scene={scene}
                time={time}
                onTime={setTime}
                onSelect={setSelection}
                onChange={editScene}
                disabled={disabled}
              />
              <StudioStoryboard
                scene={scene}
                selected={selected}
                onSelect={setSelection}
                onTime={setTime}
                onChange={editScene}
                disabled={disabled}
              />
            </div>
            <aside className="min-w-0 space-y-5 border-t border-white/10 bg-black/10 p-4 sm:p-5 xl:border-l xl:border-t-0">
              <div>
                <h3 className="font-semibold">Make it yours</h3>
                <p className="mt-1 text-xs text-zinc-300">Select something to change it.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className={button}
                  aria-pressed={selected.kind === "scene"}
                  onClick={() => setSelection({ kind: "scene", id: "scene" })}
                >
                  Scene
                </button>
                {scene.characters.map((character) => (
                  <button
                    key={character.id}
                    className={`${button} ${selected.kind === "character" && selected.id === character.id ? "border-amber-300 text-amber-200" : ""}`}
                    onClick={() => setSelection({ kind: "character", id: character.id })}
                  >
                    <span className="size-2 rounded-full" style={{ background: character.color }} />
                    {character.name}
                  </button>
                ))}
                {scene.props.map((prop) => (
                  <button
                    key={prop.id}
                    className={button}
                    onClick={() => setSelection({ kind: "prop", id: prop.id })}
                  >
                    {prop.kind}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className={button}
                  disabled={disabled || scene.characters.length >= 6}
                  onClick={() => {
                    const next = structuredClone(scene);
                    const id = `person_${Date.now().toString(36)}`;
                    next.characters.push({
                      id,
                      name: `Person ${next.characters.length + 1}`,
                      color: "#80c5aa",
                      keyframes: [
                        {
                          time: 0,
                          position: { x: 0, y: 0, z: -1 },
                          rotation: 0,
                          gaze: { x: 0, y: 1.6, z: 4 },
                          action: "idle",
                        },
                      ],
                    });
                    editScene(next);
                    setSelection({ kind: "character", id });
                  }}
                >
                  <Plus className="size-4" />
                  Person
                </button>
                <button
                  className={button}
                  disabled={disabled || scene.props.length >= 20}
                  onClick={() => {
                    const next = structuredClone(scene);
                    const id = `object_${Date.now().toString(36)}`;
                    next.props.push({
                      id,
                      kind: "chair",
                      color: "#625d58",
                      position: { x: 0, y: 0.45, z: 1 },
                      size: { x: 0.6, y: 0.8, z: 0.6 },
                    });
                    editScene(next);
                    setSelection({ kind: "prop", id });
                  }}
                >
                  <Plus className="size-4" />
                  Chair
                </button>
                <button
                  className={button}
                  disabled={disabled || scene.shots.length >= 24}
                  onClick={() => {
                    const next = structuredClone(scene);
                    const last = next.shots.at(-1)!;
                    const split = (last.start + last.end) / 2;
                    const id = `view_${Date.now().toString(36)}`;
                    next.shots.push({
                      ...structuredClone(last),
                      id,
                      name: "New view",
                      start: split,
                    });
                    last.end = split;
                    editScene(next);
                    setSelection({ kind: "shot", id });
                    setTime(split);
                  }}
                >
                  <Plus className="size-4" />
                  View
                </button>
                <button
                  className={button}
                  disabled={disabled || scene.cues.length >= 120}
                  onClick={() => {
                    const next = structuredClone(scene);
                    const start = Math.min(time, scene.duration - 1);
                    next.cues.push({
                      characterId:
                        selected.kind === "character" ? selected.id : scene.characters[0]!.id,
                      start,
                      end: Math.min(scene.duration, start + 3),
                      dialogue: "",
                      direction: "",
                    });
                    editScene(next);
                    setSelection({ kind: "cue", id: String(next.cues.length - 1) });
                  }}
                >
                  <Plus className="size-4" />
                  Dialogue
                </button>
                {selected.kind === "character" ? (
                  <button
                    className={button}
                    disabled={
                      disabled ||
                      scene.characters.find((item) => item.id === selected.id)!.keyframes.length >=
                        120
                    }
                    onClick={() => editScene(characterMoment(scene, selected.id, time).scene)}
                  >
                    <Plus className="size-4" />
                    Moment
                  </button>
                ) : null}
              </div>
              <StudioInspector
                scene={scene}
                selected={selected}
                time={time}
                onChange={editScene}
                disabled={disabled}
              />
              {!state.locked ? (
                <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-amber-200">
                    <Sparkles className="size-4" />
                    Ask the AI
                  </div>
                  <p className="mt-2 text-xs text-zinc-300">
                    Editing: {name}. Other elements stay as they are.
                  </p>
                  <label className="sr-only" htmlFor={`studio-prompt-${projectId}`}>
                    Describe your change
                  </label>
                  <textarea
                    id={`studio-prompt-${projectId}`}
                    aria-label="Describe your change"
                    className="mt-3 w-full rounded-xl border border-white/15 bg-black/20 p-3 text-sm"
                    rows={3}
                    value={prompt}
                    maxLength={12000}
                    disabled={disabled}
                    placeholder={
                      selected.kind === "character"
                        ? `Make ${name} wave before sitting down…`
                        : selected.kind === "shot"
                          ? "Move closer slowly during this view…"
                          : "Tell us what you want to change…"
                    }
                    onChange={(event) => setPrompt(event.target.value)}
                  />
                  <button
                    className={`${primary} mt-2 w-full`}
                    disabled={disabled || !prompt.trim()}
                    onClick={() => void askAI()}
                  >
                    {generating ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    {generating ? "Applying your change…" : "Apply change"}
                  </button>
                </div>
              ) : null}
            </aside>
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 p-4 sm:p-5">
            <div>
              <p className="text-sm font-medium">Ready for your actor?</p>
              <p className="mt-1 text-xs text-zinc-300">
                Choose their role, then validate the version they will follow.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm">
                Actor’s role
                <select
                  aria-label="Actor’s role"
                  className="ml-2 max-w-[200px] rounded-lg border border-white/15 bg-[#17171b] p-2.5"
                  disabled={disabled}
                  value={draft.roleId ?? ""}
                  onChange={(event) =>
                    document.change({ ...draft, roleId: event.target.value || null })
                  }
                >
                  <option value="">Choose a person</option>
                  {scene.characters.map((character) => (
                    <option key={character.id} value={character.id}>
                      {character.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className={primary}
                disabled={
                  disabled ||
                  !draft.roleId ||
                  (!briefApproved && !state.briefApproved && !state.needsBrief)
                }
                onClick={() =>
                  void run(async () => {
                    await onPrepare?.();
                    const current = await document.flush();
                    document.applyServer(
                      await directorStudioApi.approve(projectId, current.version, draft.roleId!),
                    );
                  })
                }
              >
                <Check className="size-4" />
                Validate for actor
              </button>
            </div>
            {state.revision?.approvedAt && !document.pending && !state.stale ? (
              <p className="w-full text-sm text-emerald-200">
                This scene is validated and ready to send.
              </p>
            ) : null}
            {!briefApproved && !state.briefApproved ? (
              <Link
                className="w-full text-sm text-amber-200 underline underline-offset-4"
                onClick={(event) => {
                  if (document.pending) {
                    event.preventDefault();
                    void run(async () => {
                      await document.flush();
                      window.location.assign(`/create-performance?project=${projectId}`);
                    });
                  }
                }}
                href={`/create-performance?project=${projectId}`}
              >
                Prepare the recording guide and select an actor
              </Link>
            ) : null}
          </footer>
        </>
      )}
      {modal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onKeyDown={(event) => {
            if (event.key === "Escape") setModal(null);
          }}
        >
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={modal === "history" ? "Scene history" : "Share scene"}
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/15 bg-[#111214] p-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">
                {modal === "history" ? "Your scene history" : "Share your scene"}
              </h3>
              <button
                autoFocus
                aria-label="Close dialog"
                className={button}
                onClick={() => setModal(null)}
              >
                <X className="size-4" />
              </button>
            </div>
            {document.error ? (
              <p role="alert" className="mt-4 rounded-lg bg-red-400/10 p-3 text-sm text-red-100">
                {document.error}
              </p>
            ) : null}
            {modal === "history" ? (
              <div className="mt-5 space-y-3">
                {versions?.revisions.map((revision) => (
                  <div
                    key={revision.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white/5 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{revision.label}</p>
                      <p className="mt-1 text-xs text-zinc-300">
                        Version {revision.version} · {new Date(revision.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      className={button}
                      disabled={disabled}
                      onClick={() =>
                        void run(async () => {
                          const current = await document.flush();
                          document.applyServer(
                            await studioWorkspaceApi.restore(
                              projectId,
                              current.version,
                              revision.id,
                            ),
                          );
                          setModal(null);
                        })
                      }
                    >
                      Restore
                    </button>
                  </div>
                ))}
                {versions?.next ? (
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const older = await studioWorkspaceApi.history(projectId, versions.next!);
                        setVersions({
                          ...older,
                          revisions: [...versions.revisions, ...older.revisions],
                        });
                      })
                    }
                  >
                    Earlier versions
                  </button>
                ) : null}
                {!versions ? (
                  <p className="text-sm text-zinc-300">Loading saved versions…</p>
                ) : null}
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <p className="text-sm leading-6 text-zinc-300">
                  Anyone with the link can watch this saved version for 30 days. Your script and
                  private instructions stay private. Later edits will not change the shared version.
                </p>
                <button
                  className={primary}
                  disabled={busy || generating}
                  onClick={() =>
                    void run(async () => {
                      const current = await document.flush();
                      const shared = await studioWorkspaceApi.share(projectId, current.version);
                      setShareLink(`${window.location.origin}/studio/shared/${shared.token}`);
                      setCopied(false);
                      setShares(await studioWorkspaceApi.shares(projectId));
                    })
                  }
                >
                  Create a viewing link
                </button>
                {shareLink ? (
                  <div className="space-y-2">
                    <label className="block text-sm">
                      Viewing link
                      <input
                        aria-label="Viewing link"
                        readOnly
                        value={shareLink}
                        className="mt-2 w-full rounded-lg border border-white/15 bg-black/20 p-3 text-sm"
                        onFocus={(event) => event.target.select()}
                      />
                    </label>
                    <button
                      className={button}
                      onClick={() =>
                        void navigator.clipboard
                          .writeText(shareLink)
                          .then(() => setCopied(true))
                          .catch(() => document.setError("Select and copy the viewing link above."))
                      }
                    >
                      {copied ? "Copied" : "Copy link"}
                    </button>
                    <a
                      className={`${button} ml-2`}
                      href={shareLink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open preview
                    </a>
                  </div>
                ) : null}
                {shares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-white/5 p-3 text-sm"
                  >
                    <p>
                      Version {share.revision.version} ·{" "}
                      {share.revokedAt
                        ? "Link turned off"
                        : `Until ${new Date(share.expiresAt).toLocaleDateString()}`}
                    </p>
                    <button
                      className={button}
                      disabled={busy || Boolean(share.revokedAt)}
                      onClick={() =>
                        void run(async () => {
                          await studioWorkspaceApi.revoke(projectId, share.id);
                          setShares(await studioWorkspaceApi.shares(projectId));
                          setShareLink("");
                        })
                      }
                    >
                      Turn off link
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}
