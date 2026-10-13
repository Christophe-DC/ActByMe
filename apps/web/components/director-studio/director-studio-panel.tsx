"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, History, Share2, X, Download, MessageSquare, Undo2, Redo2 } from "lucide-react";
import {
  selectionExists,
  studioSelectionSchema,
  studioRecordingPlan,
  type StudioSelection,
  type StudioVector,
} from "@actbyme/shared";
import {
  directorStudioApi,
  studioWorkspaceApi,
  type StudioHistory,
  type StudioShare,
  type StudioFeedback,
} from "@/lib/api/client";
import { StudioPlayer } from "./studio-player";
import { StudioStageMap } from "./studio-stage-map";
import { StudioTimeline } from "./studio-timeline";
import { StudioStoryboard } from "./studio-storyboard";
import {
  downloadStudioFile,
  printStudioStoryboard,
  studioStoryboardHtml,
  studioSceneFile,
} from "./studio-exports";
import { useStudioDocument, message } from "./use-studio-document";
const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm text-zinc-100 hover:bg-white/10 disabled:opacity-40";
const primary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-semibold text-black hover:bg-amber-200 disabled:opacity-40";
const field = "mt-2 w-full rounded-xl border border-white/15 bg-black/20 p-3 text-base";
export function DirectorStudioPanel({
  projectId,
  onPrepare,
  onPrepared,
  onReadinessChange,
}: {
  projectId: string;
  briefApproved?: boolean;
  onPrepare?: () => Promise<unknown>;
  onPrepared?: () => void;
  onReadinessChange?: (ready: boolean) => void;
}) {
  const document = useStudioDocument(projectId);
  const { state, draft, generating } = document;
  const scene = draft.scene;
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"preview" | "room">("preview");
  const [time, setTime] = useState(0);
  const [selection, setSelection] = useState<StudioSelection>({ kind: "scene", id: "scene" });
  const [destination, setDestination] = useState<StudioVector | null>(null);
  const [prompt, setPrompt] = useState("");
  const [promptReady, setPromptReady] = useState(false);
  const [modal, setModal] = useState<
    "history" | "share" | "export" | "prepare" | "feedback" | null
  >(null);
  const dialogRef = useRef<HTMLElement>(null);
  const assistantRef = useRef<HTMLElement>(null);
  const [versions, setVersions] = useState<StudioHistory | null>(null);
  const [shares, setShares] = useState<StudioShare[]>([]);
  const [feedback, setFeedback] = useState<StudioFeedback[]>([]);
  const [shareLink, setShareLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [allowFeedback, setAllowFeedback] = useState(false);
  const disabled = busy || generating || Boolean(state?.locked || (state && !state.enabled));
  useEffect(() => {
    if (state)
      onReadinessChange?.(
        !state.enabled ||
          state.locked ||
          Boolean(
            state.revision?.approvedAt &&
            state.guideSynchronized &&
            !state.stale &&
            !document.pending &&
            !generating,
          ),
      );
  }, [state, document.pending, generating, onReadinessChange]);
  const selected =
    scene && selectionExists(scene, selection)
      ? selection
      : { kind: "scene" as const, id: "scene" };
  const select = useCallback((next: StudioSelection) => {
    setSelection(next);
    setDestination(null);
  }, []);
  const name =
    selected.kind === "character"
      ? scene?.characters.find((item) => item.id === selected.id)?.name
      : selected.kind === "shot"
        ? scene?.shots.find((item) => item.id === selected.id)?.name
        : selected.kind === "prop"
          ? scene?.props.find((item) => item.id === selected.id)?.kind
          : selected.kind === "cue"
            ? "Dialogue " + (Number(selected.id) + 1)
            : "Whole scene";
  const promptKey = state ? "actbyme:studio-assistant:" + state.ownerId + ":" + projectId : "";
  useEffect(() => {
    if (!promptKey) return;
    try {
      const raw = sessionStorage.getItem(promptKey);
      if (raw && raw.length < 20000) {
        const cached = JSON.parse(raw);
        if (typeof cached.prompt === "string" && cached.prompt.length <= 12000)
          setPrompt(cached.prompt);
        const target = studioSelectionSchema.safeParse(cached.selection);
        if (target.success) setSelection(target.data);
      } else if (state?.job?.status === "FAILED") setPrompt(state.job.instructions);
    } catch {
      /* Browser storage may be disabled; keep the server workflow available. */
    }
    setPromptReady(true);
  }, [promptKey]);
  useEffect(() => {
    if (!promptReady || !promptKey) return;
    try {
      sessionStorage.setItem(promptKey, JSON.stringify({ prompt, selection }));
    } catch {
      /* Browser storage may be disabled; keep the server workflow available. */
    }
  }, [promptReady, promptKey, prompt, selection]);
  useEffect(() => {
    if (!modal) return;
    const previous = window.document.activeElement as HTMLElement | null;
    const trap = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModal(null);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const nodes = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]",
        ),
      );
      const first = nodes[0],
        last = nodes.at(-1);
      if (event.shiftKey && window.document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && window.document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.document.addEventListener("keydown", trap);
    return () => {
      window.document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [modal]);
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
  async function openModal(kind: typeof modal) {
    setModal(kind);
    await run(async () => {
      if (!generating) await document.flush();
      if (kind === "history") setVersions(await studioWorkspaceApi.history(projectId));
      if (kind === "share") setShares(await studioWorkspaceApi.shares(projectId));
      if (kind === "feedback") setFeedback(await studioWorkspaceApi.feedback(projectId));
    });
  }
  async function askAI(text = prompt, target = selected, at = time) {
    await run(async () => {
      await onPrepare?.();
      const current = await document.flush();
      document.applyServer(
        scene
          ? await studioWorkspaceApi.edit(
              projectId,
              current.version,
              text,
              target,
              at,
              destination ?? undefined,
            )
          : await directorStudioApi.generate(
              projectId,
              current.version,
              draft.instructions || "Bring this script to life.",
            ),
      );
    });
  }
  const cue = selected.kind === "cue" ? scene?.cues[Number(selected.id)] : undefined;
  const suggestions =
    selected.kind === "character"
      ? [
          "Have " +
            name +
            (destination
              ? " walk to the marked destination and stop."
              : " walk towards the center and stop."),
          "Make " + name + " wave here, then wait.",
          "Make " +
            name +
            " look at " +
            (scene?.characters.find((item) => item.id !== selected.id)?.name ?? "the viewer") +
            " throughout the movement.",
        ]
      : selected.kind === "shot"
        ? [
            "Follow " +
              (scene?.characters[0]?.name ?? "the action") +
              " smoothly during this view.",
            "Move closer slowly, keeping the person visible.",
            "Extend this view by two seconds.",
          ]
        : selected.kind === "prop"
          ? ["Place this object at the marked destination.", "Make this object smaller."]
          : selected.kind === "cue"
            ? [
                "Have this line start two seconds later.",
                "Make the delivery quieter and more hesitant.",
              ]
            : [
                "Add a friend who enters, pauses, and waves.",
                "Slow the whole scene down to 30 seconds.",
                "Start with a wide view, then show the reactions.",
              ];
  const plan =
    scene && draft.roleId ? studioRecordingPlan(scene, draft.roleId, state?.capturePlan) : null;
  return (
    <section
      data-testid="director-studio"
      className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#111214] text-white"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4 sm:p-5">
        <div>
          <p className="text-xs uppercase tracking-[.15em] text-amber-200">Your story, in motion</p>
          <h2 className="mt-1 text-xl font-semibold">Director Studio 3D</h2>
          <p role="status" data-testid="studio-save-status" className="mt-1 text-xs text-zinc-300">
            {busy
              ? "Working…"
              : generating
                ? "The assistant is applying your request…"
                : document.phase}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className={button}
            aria-label="Undo dialogue"
            disabled={disabled || !document.canUndo}
            onClick={document.undo}
          >
            <Undo2 className="size-4" />
          </button>
          <button
            className={button}
            aria-label="Redo dialogue"
            disabled={disabled || !document.canRedo}
            onClick={document.redo}
          >
            <Redo2 className="size-4" />
          </button>
          {[
            ["history", History, "History"],
            ["feedback", MessageSquare, "Feedback"],
            ["export", Download, "Export"],
          ].map(([kind, Icon, label]) => {
            const Glyph = Icon as typeof History;
            return (
              <button
                key={String(kind)}
                className={button}
                disabled={busy || !scene}
                onClick={() => void openModal(kind as typeof modal)}
              >
                <Glyph className="size-4" />
                <span>{String(label)}</span>
              </button>
            );
          })}
          {state?.enabled && !state.locked ? (
            <button
              className={button}
              disabled={busy || generating}
              onClick={() =>
                void run(async () => {
                  const current = await document.flush();
                  document.applyServer(
                    await directorStudioApi.activate(projectId, current.version, false),
                  );
                })
              }
            >
              Pause 3D studio
            </button>
          ) : null}
          <button
            className={primary}
            disabled={busy || generating || !scene || !state?.enabled}
            onClick={() => void openModal("share")}
          >
            <Share2 className="size-4" />
            Share
          </button>
        </div>
      </header>
      {document.error ? (
        <div role="alert" className="m-4 rounded-xl bg-red-400/10 p-4 text-sm text-red-100">
          <p>{document.error}</p>
          <div className="mt-3 flex flex-wrap gap-2">
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
      {document.recovery ? (
        <div className="m-4 rounded-xl bg-amber-300/10 p-4 text-sm">
          <p>
            Unsaved text from this tab is available. Recover matching dialogue without replacing the
            newer scene.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={button} disabled={disabled} onClick={document.recover}>
              Recover my text
            </button>
            <button
              className={button}
              onClick={() =>
                downloadStudioFile(
                  "recovered-studio-text.txt",
                  document.recovery!.draft.scene?.cues.map((item) => item.dialogue).join("\n") +
                    "\n" +
                    document.recovery!.draft.instructions,
                  "text/plain",
                )
              }
            >
              Save my text as a file
            </button>
            <button className={button} onClick={document.discardRecovery}>
              Discard recovered copy
            </button>
          </div>
        </div>
      ) : null}
      {!state ? (
        <p className="p-8 text-zinc-300">Opening your workspace…</p>
      ) : !state.enabled ? (
        <div className="p-6 sm:p-10">
          <h3 className="text-2xl font-semibold">Make your story easy to see.</h3>
          <p className="mt-3 max-w-xl leading-7 text-zinc-300">
            Describe your scene. Then select people, objects or camera views and tell the assistant
            what you want to change.
          </p>
          <button
            className={primary + " mt-5"}
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
          <Link className={button + " ml-3"} href="/studio">
            Explore ready-made scenes
          </Link>
        </div>
      ) : !scene ? (
        <div className="p-6 sm:p-10">
          <h3 className="text-2xl font-semibold">What should happen in your scene?</h3>
          <p className="mt-2 text-sm text-zinc-300">
            Your script is attached. Describe the people, actions and views you have in mind.
          </p>
          <label className="mt-5 block text-sm">
            Your direction
            <textarea
              aria-label="Your direction"
              className={field}
              rows={4}
              maxLength={12000}
              disabled={disabled}
              value={draft.instructions}
              onChange={(event) =>
                document.change({ ...draft, instructions: event.target.value }, "direction")
              }
              placeholder="Two friends meet. One walks closer and waves. Start wide, then show their reactions."
            />
          </label>
          <button
            className={primary + " mt-4"}
            disabled={disabled || !draft.instructions.trim()}
            onClick={() => void askAI()}
          >
            {generating ? "Creating your scene…" : "Create my scene"}
          </button>
        </div>
      ) : (
        <>
          {state.stale ? (
            <div className="m-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-300/10 p-3 text-sm text-amber-100">
              <p>
                Your script or recording plan changed. Review this scene before preparing the actor
                guide.
              </p>
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
                I reviewed it · Keep this scene
              </button>
            </div>
          ) : null}
          {state.locked ? (
            <p className="m-4 rounded-lg bg-emerald-300/10 p-3 text-sm text-emerald-100">
              This recording version is locked. Your actor follows its saved scene and guide.
            </p>
          ) : null}
          <div className="grid min-w-0 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-5 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold">{scene.title}</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    aria-pressed={view === "preview"}
                    className={button}
                    onClick={() => setView("preview")}
                  >
                    Preview
                  </button>
                  <button
                    aria-pressed={view === "room"}
                    className={button}
                    onClick={() => setView("room")}
                  >
                    Room view
                  </button>
                </div>
              </div>
              {view === "preview" ? (
                <StudioPlayer
                  scene={scene}
                  roleId={draft.roleId}
                  selection={selected}
                  timelineTime={time}
                  onTimelineTimeChange={setTime}
                  onSelect={select}
                />
              ) : (
                <>
                  <StudioStageMap
                    scene={scene}
                    time={time}
                    selected={selected}
                    onSelect={select}
                    destination={destination}
                    onDestination={setDestination}
                  />
                  <label className="block text-sm">
                    Reference moment · {time.toFixed(1)}s
                    <input
                      aria-label="Reference time"
                      type="range"
                      min={0}
                      max={scene.duration}
                      step="0.1"
                      value={time}
                      onChange={(event) => setTime(Number(event.target.value))}
                      className="mt-3 w-full accent-amber-300"
                    />
                  </label>
                </>
              )}
              {!state.locked ? (
                <button
                  className={primary + " w-full xl:hidden"}
                  onClick={() =>
                    assistantRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                >
                  Ask the assistant about {name}
                </button>
              ) : null}
              <StudioTimeline scene={scene} time={time} onTime={setTime} onSelect={select} />
              <StudioStoryboard
                scene={scene}
                selected={selected}
                onSelect={select}
                onTime={setTime}
              />
            </div>
            <aside
              ref={assistantRef}
              className="min-w-0 scroll-mt-20 space-y-5 border-t border-white/10 bg-black/10 p-4 sm:p-5 xl:border-l xl:border-t-0"
            >
              <div>
                <h3 className="text-lg font-semibold">Your scene assistant</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  1. Select an element. 2. Choose a moment. 3. Describe your change. The assistant
                  changes only your selection.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className={button}
                  aria-pressed={selected.kind === "scene"}
                  onClick={() => select({ kind: "scene", id: "scene" })}
                >
                  Whole scene
                </button>
                {scene.characters.map((item) => (
                  <button
                    key={item.id}
                    className={button}
                    aria-pressed={selected.kind === "character" && selected.id === item.id}
                    onClick={() => select({ kind: "character", id: item.id })}
                  >
                    <span className="size-2 rounded-full" style={{ background: item.color }} />
                    {item.name}
                  </button>
                ))}
                {scene.props.map((item, index) => (
                  <button
                    key={item.id}
                    className={button}
                    onClick={() => select({ kind: "prop", id: item.id })}
                  >
                    {item.kind} {index + 1}
                  </button>
                ))}
              </div>
              <p className="rounded-lg bg-amber-300/10 p-3 text-sm text-amber-100">
                Selected: <strong>{name}</strong> · At {time.toFixed(1)}s
                {destination ? " · Destination marked in room view" : ""}
              </p>
              {cue ? (
                <label className="block text-sm">
                  Dialogue · {scene.characters.find((item) => item.id === cue.characterId)?.name}
                  <textarea
                    aria-label="Dialogue text"
                    className={field}
                    rows={4}
                    maxLength={4000}
                    disabled={disabled}
                    value={cue.dialogue}
                    onChange={(event) => {
                      const next = structuredClone(scene);
                      next.cues[Number(selected.id)]!.dialogue = event.target.value;
                      document.change({ ...draft, scene: next }, "dialogue:" + selected.id);
                    }}
                  />
                  <span className="mt-2 block text-xs text-zinc-300">
                    Text saves automatically. Ask the assistant to change the speaker, timing or
                    delivery.
                  </span>
                </label>
              ) : (
                <div className="space-y-2">
                  {scene.cues
                    .filter(
                      (item) => selected.kind !== "character" || item.characterId === selected.id,
                    )
                    .map((item) => (
                      <button
                        key={scene.cues.indexOf(item)}
                        className="block w-full truncate rounded-lg border border-white/10 p-2 text-left text-sm text-sky-100"
                        onClick={() => {
                          select({ kind: "cue", id: String(scene.cues.indexOf(item)) });
                          setTime(item.start);
                        }}
                      >
                        Edit dialogue: {item.dialogue || "Silent moment"}
                      </button>
                    ))}
                </div>
              )}
              {!state.locked ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void askAI();
                  }}
                >
                  <label className="block text-sm">
                    Describe your change
                    <textarea
                      aria-label="Describe your change"
                      className={field}
                      rows={4}
                      maxLength={12000}
                      disabled={disabled}
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      placeholder="At this moment, have Alex walk over to the chair, then look at Sam…"
                    />
                  </label>
                  <div className="mt-3 space-y-2">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className="block w-full rounded-lg border border-white/10 px-3 py-2 text-left text-xs leading-5 text-zinc-200 hover:border-amber-300/40"
                        disabled={disabled}
                        onClick={() => setPrompt(suggestion)}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                  <button
                    className={primary + " mt-4 w-full"}
                    disabled={disabled || !prompt.trim()}
                  >
                    <Sparkles className="size-4" />
                    {generating ? "Applying your change…" : "Apply change"}
                  </button>
                  <p className="mt-2 text-xs leading-5 text-zinc-300">
                    Your request stays in this tab. Scene changes save automatically; earlier
                    versions stay in History.
                  </p>
                </form>
              ) : null}
            </aside>
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 p-4 sm:p-5">
            <div>
              <p className="font-medium">Ready to prepare the shoot?</p>
              <p className="mt-1 text-xs leading-5 text-zinc-300">
                The actor guide uses this scene's role, dialogue and timings. Camera previews stay
                separate from recording.
              </p>
            </div>
            <label className="text-sm">
              Actor’s role
              <select
                aria-label="Actor’s role"
                className={field}
                disabled={disabled}
                value={draft.roleId ?? ""}
                onChange={(event) =>
                  document.change({ ...draft, roleId: event.target.value || null })
                }
              >
                <option value="">Choose a person</option>
                {scene.characters.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className={primary}
              disabled={disabled || !draft.roleId || state.stale}
              onClick={() => void openModal("prepare")}
            >
              Prepare actor guide
            </button>
            {state.revision?.approvedAt &&
            state.guideSynchronized &&
            !document.pending &&
            !state.stale &&
            !generating ? (
              <p className="w-full text-sm text-emerald-200">
                Scene and actor guide are synchronized and ready to send.{" "}
                <Link
                  className="underline underline-offset-4"
                  href={"/create-performance?project=" + projectId}
                >
                  Choose an actor →
                </Link>
              </p>
            ) : null}
          </footer>
        </>
      )}
      {generating ? (
        <div className="m-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-300/10 p-4 text-sm">
          <p>
            Your last preview remains available. You can leave and return while the assistant works.
          </p>
          <button
            className={button}
            disabled={busy}
            onClick={() =>
              void run(async () => {
                document.applyServer(await studioWorkspaceApi.cancel(projectId, state!.version));
              })
            }
          >
            Cancel request
          </button>
        </div>
      ) : state?.job?.status === "FAILED" ? (
        <div role="alert" className="m-4 rounded-lg bg-red-400/10 p-4 text-sm text-red-100">
          <p>
            {message(
              new Error(
                state.job.error ||
                  "The assistant couldn't apply the request. Your last scene is safe.",
              ),
            )}
          </p>
          <button
            className={button + " mt-3"}
            disabled={disabled}
            onClick={() =>
              void askAI(
                state.job!.instructions,
                state.job!.target ?? selected,
                state.job!.at ?? time,
              )
            }
          >
            Retry request
          </button>
        </div>
      ) : null}
      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={
              {
                history: "Scene history",
                share: "Share scene",
                export: "Export scene",
                prepare: "Prepare actor guide",
                feedback: "Scene feedback",
              }[modal]
            }
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/15 bg-[#111214] p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-semibold">
                {
                  {
                    history: "Your scene history",
                    share: "Share your scene",
                    export: "Take your scene with you",
                    prepare: "Scene → Shooting Plan → Actor",
                    feedback: "Feedback on shared versions",
                  }[modal]
                }
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
                <p className="text-sm text-zinc-300">
                  Restoring creates a new draft. Previously shared or sent versions stay unchanged.
                </p>
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
                {!versions ? <p>Loading versions…</p> : null}
              </div>
            ) : null}
            {modal === "share" ? (
              <div className="mt-5 space-y-4">
                <p className="text-sm leading-6 text-zinc-300">
                  Anyone with the link can watch this saved version for 30 days. Later edits won't
                  change it. Your source script and private assistant requests stay private.
                </p>
                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={allowFeedback}
                    onChange={(event) => setAllowFeedback(event.target.checked)}
                  />
                  Allow signed-in viewers to leave feedback
                </label>
                <button
                  className={primary}
                  disabled={busy || generating || state?.stale}
                  onClick={() =>
                    void run(async () => {
                      const current = await document.flush();
                      const shared = await studioWorkspaceApi.share(
                        projectId,
                        current.version,
                        allowFeedback,
                      );
                      setShareLink(window.location.origin + "/studio/shared/" + shared.token);
                      setCopied(false);
                      setShares(await studioWorkspaceApi.shares(projectId));
                    })
                  }
                >
                  Create a viewing link
                </button>
                {shareLink ? (
                  <div>
                    <label className="block text-sm">
                      Viewing link
                      <input
                        aria-label="Viewing link"
                        readOnly
                        value={shareLink}
                        className={field}
                        onFocus={(event) => event.target.select()}
                      />
                    </label>
                    <button
                      className={button + " mt-3"}
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
                      className={button + " ml-2"}
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
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white/5 p-3 text-sm"
                  >
                    <p>
                      Version {share.revision.version} ·{" "}
                      {share.revokedAt
                        ? "Link turned off"
                        : "Until " + new Date(share.expiresAt).toLocaleDateString()}
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
            ) : null}
            {modal === "export" && scene ? (
              <div className="mt-5 space-y-4">
                <p className="text-sm leading-6 text-zinc-300">
                  Export the saved storyboard with its dialogue and actor guide. These are planning
                  documents, not final performance videos.
                </p>
                <button
                  className={primary}
                  onClick={() =>
                    void run(async () => {
                      printStudioStoryboard(scene, draft.roleId, state?.capturePlan);
                    })
                  }
                >
                  Print / Save as PDF
                </button>
                <button
                  className={button + " block"}
                  onClick={() =>
                    downloadStudioFile(
                      "actbyme-storyboard.html",
                      studioStoryboardHtml(scene, draft.roleId, state?.capturePlan),
                      "text/html",
                    )
                  }
                >
                  Download offline storyboard
                </button>
                <button
                  className={button + " block"}
                  onClick={() =>
                    downloadStudioFile(
                      "actbyme-scene.json",
                      studioSceneFile(scene, draft.roleId),
                      "application/json",
                    )
                  }
                >
                  Download scene data
                </button>
              </div>
            ) : null}
            {modal === "prepare" && plan ? (
              <div className="mt-5 space-y-4">
                <p className="text-sm leading-6 text-zinc-200">{plan.actorGuide.overview}</p>
                <p className="text-sm text-amber-200">
                  {plan.actorGuide.duration} · One continuous take
                </p>
                {plan.actorGuide.steps.map((step) => (
                  <details key={step.order} className="rounded-xl bg-white/5 p-4">
                    <summary className="cursor-pointer text-sm font-medium">
                      {step.order}. {step.title}
                    </summary>
                    <p className="mt-3 whitespace-pre-line text-sm leading-6 text-zinc-300">
                      {step.instruction}
                    </p>
                  </details>
                ))}
                <p className="text-xs leading-5 text-zinc-300">
                  Validating replaces the recording plan with this role's directions and timings.
                  The same saved version drives the actor guide and quality checks.
                </p>
                <button
                  className={primary}
                  disabled={disabled}
                  onClick={() =>
                    void run(async () => {
                      await onPrepare?.();
                      const current = await document.flush();
                      document.applyServer(
                        await directorStudioApi.approve(projectId, current.version, draft.roleId!),
                      );
                      onPrepared?.();
                      window.dispatchEvent(
                        new CustomEvent("actbyme:studio-prepared", { detail: { projectId } }),
                      );
                      setModal(null);
                    })
                  }
                >
                  Validate scene and guide
                </button>
              </div>
            ) : null}
            {modal === "feedback" ? (
              <div className="mt-5 space-y-3">
                <p className="text-sm leading-6 text-zinc-300">
                  Feedback is attached to a shared snapshot. It changes no actor instructions.
                  Select a note and ask the assistant to apply it to the current scene.
                </p>
                {feedback.map((item) => (
                  <article key={item.id} className="rounded-xl bg-white/5 p-4">
                    <p className="text-xs text-amber-200">
                      {item.authorName} · Version {item.revision?.version} · {item.time.toFixed(1)}s
                      {item.resolved ? " · Resolved" : ""}
                    </p>
                    <p className="mt-2 whitespace-pre-line text-sm">{item.body}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className={button}
                        disabled={disabled}
                        onClick={() => {
                          if (scene && selectionExists(scene, item.target)) select(item.target);
                          else select({ kind: "scene", id: "scene" });
                          setTime(Math.min(scene?.duration ?? 0, item.time));
                          setPrompt(item.body);
                          setModal(null);
                        }}
                      >
                        Give to assistant
                      </button>
                      <button
                        className={button}
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await studioWorkspaceApi.resolveFeedback(
                              projectId,
                              item.id,
                              !item.resolved,
                            );
                            setFeedback(await studioWorkspaceApi.feedback(projectId));
                          })
                        }
                      >
                        {item.resolved ? "Reopen" : "Mark resolved"}
                      </button>
                    </div>
                  </article>
                ))}
                {!feedback.length ? (
                  <p className="text-sm text-zinc-300">
                    No feedback yet. Enable it when creating a viewing link.
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </section>
  );
}
