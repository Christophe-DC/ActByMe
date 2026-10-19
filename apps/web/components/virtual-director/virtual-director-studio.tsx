"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Clapperboard,
  Film,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import {
  studioSceneSchema,
  virtualActiveStatuses,
  virtualShotError,
  type StudioScene,
  type StudioShot,
  type VirtualDirectorState,
  type VirtualJob,
} from "@actbyme/shared";
import { virtualDirectorApi } from "@/lib/api/client";
import { StudioPlayer } from "@/components/director-studio/studio-player";
import {
  CameraControls,
  directorButton as button,
  directorControl as control,
} from "./camera-controls";
const panel = "rounded-2xl border border-white/10 bg-[#111214] p-5";
const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const message = (error: unknown) =>
  error instanceof Error ? error.message : "The operation could not be completed.";
const stageLabels: Record<string, string> = {
  QUEUED: "Queued",
  PREPARING: "Preparing video",
  RENDERING_BLENDER: "Rendering Blender preview",
  SUBMITTING_PROVIDER: "Submitting to video provider",
  PROVIDER: "Generating with Seedance",
  RETRYING_PROVIDER: "Provider unavailable · retrying status",
  SAVING_VIDEO: "Saving private result",
  READY: "Reference ready",
  READY_FOR_REVIEW: "Ready to review",
  SUBMISSION_UNCERTAIN: "Submission uncertain · check provider dashboard",
  CANCEL_REQUESTED: "Cancelled · provider cancellation pending",
  PROVIDER_CANCELLED: "Provider cancellation requested",
  PROVIDER_CANCEL_FAILED: "Check cancellation in provider dashboard",
};
export function VirtualDirectorStudio({ projectId }: { projectId: string }) {
  const [state, setState] = useState<VirtualDirectorState | null>(null);
  const [scene, setScene] = useState<StudioScene | null>(null);
  const [selected, setSelected] = useState("");
  const [checked, setChecked] = useState<string[]>([]);
  const [referenceId, setReferenceId] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [result, setResult] = useState<{ job: VirtualJob; url: string; download?: boolean } | null>(
    null,
  );
  const [instructions, setInstructions] = useState("");
  const [sourceStart, setSourceStart] = useState(0);
  const [performerName, setPerformerName] = useState("");
  const [rightsBasis, setRightsBasis] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [takeId, setTakeId] = useState("");
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const sceneRef = useRef<StudioScene | null>(null);
  const latestVersion = useRef(0);
  const mediaRequest = useRef(0);
  const apply = useCallback((next: VirtualDirectorState, replace = false) => {
    setState((current) => (!current || next.version >= current.version ? next : current));
    if (
      replace ||
      !sceneRef.current ||
      (!dirtyRef.current && next.version > latestVersion.current)
    ) {
      setScene(next.scene);
      sceneRef.current = next.scene;
      latestVersion.current = next.version;
      if (replace) {
        dirtyRef.current = false;
        setDirty(false);
      }
    }
    if (next.scene) {
      setSelected((current) =>
        next.scene!.shots.some((shot) => shot.id === current) ? current : next.scene!.shots[0]!.id,
      );
    }
    setReferenceId((current) =>
      next.references.some((reference) => reference.id === current)
        ? current
        : (next.references.find((reference) => reference.status === "READY")?.id ??
          next.references[0]?.id ??
          ""),
    );
  }, []);
  useEffect(() => {
    let stopped = false;
    async function poll() {
      try {
        const next = await virtualDirectorApi.get(projectId);
        if (!stopped) apply(next);
      } catch (error) {
        if (!stopped) setError(message(error));
      }
    }
    void poll();
    const interval = setInterval(() => {
      if (!document.hidden) void poll();
    }, 5000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [projectId, apply]);
  useEffect(() => {
    function protect(event: BeforeUnloadEvent) {
      if (dirtyRef.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, []);
  useEffect(() => {
    let stopped = false;
    setReferenceUrl("");
    if (
      referenceId &&
      state?.references.some(
        (reference) => reference.id === referenceId && reference.status === "READY",
      )
    )
      void virtualDirectorApi.media(projectId, "references", referenceId).then(
        (media) => {
          if (!stopped) setReferenceUrl(media.url);
        },
        (error) => {
          if (!stopped) setError(message(error));
        },
      );
    return () => {
      stopped = true;
    };
  }, [
    projectId,
    referenceId,
    state?.references.find((reference) => reference.id === referenceId)?.status,
  ]);
  function edit(next: StudioScene) {
    sceneRef.current = next;
    setScene(next);
    dirtyRef.current = true;
    setDirty(true);
  }
  async function perform(
    label: string,
    action: () => Promise<VirtualDirectorState>,
    replace = false,
  ) {
    setBusy(label);
    setError("");
    try {
      apply(await action(), replace);
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy("");
    }
  }
  const cameraSelection = useMemo(() => ({ kind: "shot" as const, id: selected }), [selected]);
  const shot = scene?.shots.find((item) => item.id === selected) ?? scene?.shots[0];
  const reference = state?.references.find((item) => item.id === referenceId);
  const rights = {
    performerName,
    rightsBasis,
    ownsOrLicensed: true,
    aiTransformation: true,
    providerTransfer: true,
  };
  const rightsReady =
    rightsConfirmed && performerName.trim().length >= 2 && rightsBasis.trim().length >= 10;
  const chosen = scene?.shots.filter((item) => checked.includes(item.id)) ?? [];
  const estimate = chosen.reduce(
    (cost, item) =>
      cost + Math.ceil((item.end - item.start) * (state?.capabilities.pricePerSecondCents ?? 0)),
    0,
  );
  function addShot() {
    if (!scene || !shot || scene.shots.length >= 24 || scene.duration > 115) return;
    const id = `camera_${crypto.randomUUID().slice(0, 8)}`;
    const next: StudioShot = {
      ...shot,
      id,
      name: `Angle ${scene.shots.length + 1}`,
      start: scene.duration,
      end: scene.duration + 5,
    };
    edit({ ...scene, duration: scene.duration + 5, shots: [...scene.shots, next] });
    setSelected(id);
  }
  function removeShot() {
    if (!scene || !shot || scene.shots.length <= 1) return;
    const index = scene.shots.indexOf(shot);
    const shots = scene.shots
      .filter((item) => item.id !== shot.id)
      .map((item, itemIndex) =>
        index === 0 && itemIndex === 0
          ? { ...item, start: 0 }
          : index > 0 && itemIndex === index - 1
            ? { ...item, end: shot.end }
            : item,
      );
    edit({ ...scene, shots });
    setSelected(shots[Math.max(0, index - 1)]!.id);
    setChecked((current) => current.filter((id) => id !== shot.id));
  }
  async function upload(file: File) {
    if (!rightsReady || busy) return;
    setBusy("Uploading reference");
    setProgress(0);
    setError("");
    try {
      const reservation = await virtualDirectorApi.reserve(projectId, {
        name: file.name,
        contentType: file.type || (/\.mov$/i.test(file.name) ? "video/quicktime" : "video/mp4"),
        sizeBytes: file.size,
        rights,
      });
      await virtualDirectorApi.upload(
        reservation.upload,
        file,
        file.type || (/\.mov$/i.test(file.name) ? "video/quicktime" : "video/mp4"),
        setProgress,
      );
      apply(
        await virtualDirectorApi.mutate(
          projectId,
          `references/${reservation.referenceId}/complete`,
        ),
      );
      setReferenceId(reservation.referenceId);
    } catch (error) {
      setError(message(error));
      await virtualDirectorApi
        .get(projectId)
        .then((next) => apply(next))
        .catch(() => undefined);
    } finally {
      setBusy("");
    }
  }
  async function openMedia(job: VirtualJob, download = false) {
    const sequence = ++mediaRequest.current;
    setBusy("Opening video");
    setError("");
    try {
      const media = await virtualDirectorApi.media(projectId, "jobs", job.id, download);
      if (sequence === mediaRequest.current) setResult({ job, url: media.url, download });
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy("");
    }
  }
  async function generate() {
    if (!state || !chosen.length || dirty) return;
    setBusy("Queueing selected shots");
    setError("");
    try {
      for (const item of chosen) {
        const next = await virtualDirectorApi.mutate(projectId, "jobs", {
          version: state.version,
          requestKey: crypto.randomUUID(),
          kind: "GENERATE",
          shotId: item.id,
          referenceId,
          instructions,
          sourceStartSeconds: sourceStart,
          maxCostCents: Math.ceil((item.end - item.start) * state.capabilities.pricePerSecondCents),
        });
        apply(next);
      }
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy("");
    }
  }
  const generationError = chosen
    .map((item) =>
      virtualShotError(
        { ...item, start: sourceStart, end: sourceStart + item.end - item.start },
        reference?.duration ?? undefined,
      ),
    )
    .find(Boolean);
  const currentJobs = state?.jobs.filter((job) => job.kind !== "INSPECT") ?? [];
  return (
    <main className="min-h-screen bg-[#0b0b0d] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/projects" className="text-sm text-amber-200">
              ← My projects
            </Link>
            <p className="mt-5 text-xs uppercase tracking-[.22em] text-amber-200">
              AI Virtual Director
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              One performance. Your camera angles.
            </h1>
            <p className="mt-3 text-zinc-300">{state?.title ?? "Loading project…"}</p>
          </div>
          <Link className={button} href={`/studio?project=${projectId}`}>
            Open scene & shooting plan
          </Link>
        </header>
        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100"
          >
            {error}
          </p>
        ) : null}
        {!state && !error ? (
          <p className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            Loading your private studio…
          </p>
        ) : null}
        {state ? (
          <>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="rounded-full border border-white/15 px-3 py-2">
                <ShieldCheck className="mr-2 inline size-4 text-amber-200" />
                Private production workspace
              </span>
              <span className="rounded-full border border-white/15 px-3 py-2">
                Worker {state.capabilities.workerReady ? "online" : "offline"}
              </span>
              <span className="rounded-full border border-white/15 px-3 py-2">
                Blender {state.capabilities.blenderReady ? "available" : "unavailable"}
              </span>
              <span className="rounded-full border border-white/15 px-3 py-2">
                Monthly reserved estimate: {money(state.capabilities.reservedCents)} /{" "}
                {money(state.capabilities.monthlyBudgetCents)}
              </span>
            </div>
            {state.capabilities.reason ? (
              <p
                role="status"
                className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm leading-6 text-amber-100"
              >
                {state.capabilities.reason} You can still prepare cameras and save your scene.
              </p>
            ) : null}
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(250px,.75fr)_minmax(0,1.7fr)_minmax(250px,.8fr)]">
              <aside className="space-y-5">
                <section className={panel}>
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <Upload className="size-5 text-amber-200" />
                    1. Performance reference
                  </h2>
                  <p className="mt-3 text-xs leading-5 text-zinc-300">
                    MP4 or MOV · 4–120 seconds · up to 200 MB. The worker verifies the actual video
                    before generation.
                  </p>
                  <details className="mt-4" open={!state.references.length}>
                    <summary className="cursor-pointer text-sm text-amber-200">
                      Import a performance
                    </summary>
                    <div className="mt-4 space-y-3">
                      <label className="block text-sm">
                        Performer / rights holder
                        <input
                          className={`${control} mt-2`}
                          maxLength={160}
                          value={performerName}
                          onChange={(event) => setPerformerName(event.target.value)}
                        />
                      </label>
                      <label className="block text-sm">
                        Authorization and usage scope
                        <textarea
                          className={`${control} mt-2`}
                          rows={3}
                          maxLength={2000}
                          placeholder="Describe the performer’s authorization and permitted usage."
                          value={rightsBasis}
                          onChange={(event) => setRightsBasis(event.target.value)}
                        />
                      </label>
                      <label className="flex items-start gap-2 text-xs leading-5 text-zinc-300">
                        <input
                          className="mt-1 accent-amber-300"
                          type="checkbox"
                          checked={rightsConfirmed}
                          onChange={(event) => setRightsConfirmed(event.target.checked)}
                        />
                        <span>
                          I hold the necessary rights and the performer’s permission for AI
                          transformation, use in this project and transfer of the video to fal /
                          ByteDance. I have checked the usage restrictions.
                        </span>
                      </label>
                      <label
                        className={`${button} flex cursor-pointer items-center justify-center gap-2 ${!rightsReady || busy || !state.capabilities.workerReady ? "pointer-events-none opacity-40" : ""}`}
                      >
                        <Upload className="size-4" />
                        Upload reference
                        <input
                          aria-label="Upload reference video"
                          type="file"
                          className="sr-only"
                          accept="video/mp4,video/quicktime,.mp4,.mov"
                          disabled={
                            !rightsReady || Boolean(busy) || !state.capabilities.workerReady
                          }
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            if (file) void upload(file);
                          }}
                        />
                      </label>
                      {state.takes.length ? (
                        <>
                          <label className="block text-sm">
                            Or use an approved project take
                            <select
                              className={`${control} mt-2`}
                              value={takeId}
                              onChange={(event) => setTakeId(event.target.value)}
                            >
                              <option value="">Select a performance</option>
                              {state.takes.map((take) => (
                                <option value={take.id} key={take.id}>
                                  {take.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            className={button}
                            disabled={
                              !rightsReady ||
                              !takeId ||
                              Boolean(busy) ||
                              !state.capabilities.workerReady
                            }
                            onClick={() =>
                              void perform("Importing take", () =>
                                virtualDirectorApi.mutate(projectId, "references/import", {
                                  takeId,
                                  rights,
                                }),
                              )
                            }
                          >
                            Use project performance
                          </button>
                        </>
                      ) : null}
                    </div>
                  </details>
                  {state.references.length ? (
                    <label className="mt-5 block text-sm">
                      Saved references
                      <select
                        className={`${control} mt-2`}
                        value={referenceId}
                        onChange={(event) => setReferenceId(event.target.value)}
                      >
                        {state.references.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} · {item.status.toLowerCase()}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {reference ? (
                    <div className="mt-3 space-y-3 text-xs text-zinc-300">
                      <p>
                        {reference.duration
                          ? `${reference.duration.toFixed(1)}s · ${reference.width} × ${reference.height} · ${reference.hasAudio ? "Original audio available" : "No audio"}`
                          : reference.status === "PROCESSING"
                            ? "Inspecting video in the worker…"
                            : "Upload has not been verified."}
                      </p>
                      <p>Performer: {reference.rights.performerName}</p>
                      {reference.error ? (
                        <p role="alert" className="text-red-200">
                          {reference.error}
                        </p>
                      ) : null}
                      {reference.status === "UPLOADING" ? (
                        <button
                          className={button}
                          disabled={Boolean(busy)}
                          onClick={() =>
                            void perform("Checking upload", () =>
                              virtualDirectorApi.mutate(
                                projectId,
                                `references/${reference.id}/complete`,
                              ),
                            )
                          }
                        >
                          Verify completed upload
                        </button>
                      ) : null}
                      <button
                        className={button}
                        disabled={Boolean(busy)}
                        onClick={() =>
                          void perform("Removing reference", () =>
                            virtualDirectorApi.mutate(
                              projectId,
                              `references/${reference.id}`,
                              undefined,
                              "DELETE",
                            ),
                          )
                        }
                      >
                        Remove unused reference
                      </button>
                    </div>
                  ) : null}
                </section>
                <section className={panel}>
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <Film className="size-5 text-amber-200" />
                    Reference performance
                  </h2>
                  {referenceUrl ? (
                    <video
                      aria-label="Reference performance"
                      className="mt-4 aspect-video w-full rounded-lg bg-black"
                      src={referenceUrl}
                      controls
                      preload="metadata"
                      onError={() => setReferenceUrl("")}
                    />
                  ) : (
                    <p className="mt-4 text-sm leading-6 text-zinc-400">
                      Choose a verified reference to compare the original performance.
                    </p>
                  )}
                  {reference?.status === "READY" ? (
                    <button
                      className={`${button} mt-3`}
                      onClick={() =>
                        void virtualDirectorApi.media(projectId, "references", reference.id).then(
                          (media) => setReferenceUrl(media.url),
                          (error) => setError(message(error)),
                        )
                      }
                    >
                      Refresh private playback
                    </button>
                  ) : null}
                </section>
              </aside>
              <section className="min-w-0 space-y-5">
                <div className={panel}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="flex items-center gap-2 text-lg font-semibold">
                      <Clapperboard className="size-5 text-amber-200" />
                      2. Direct your scene
                    </h2>
                    <span className="text-xs text-zinc-400">
                      {dirty ? "Unsaved camera changes" : `Saved version ${state.version}`}
                    </span>
                  </div>
                  <p className="my-4 text-xs leading-5 text-zinc-300">
                    Schematic staging, created from your studio scene or a neutral mannequin. This
                    is a framing aid; the reference video is not reconstructed in 3D.
                  </p>
                  {scene ? (
                    <StudioPlayer
                      scene={scene}
                      productionPreview
                      selection={cameraSelection}
                      onCameraChange={(id) => {
                        if (scene.shots.some((item) => item.id === id)) setSelected(id);
                      }}
                    />
                  ) : (
                    <div className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-white/15 bg-black/30 p-5 text-center">
                      <Camera className="size-10 text-amber-200" />
                      <p className="max-w-md text-sm leading-6 text-zinc-300">
                        Use the current Director Studio scene, including its cameras and movements.
                        If there is no scene yet, start with a neutral staging setup.
                      </p>
                      <button
                        className="rounded-lg bg-amber-300 px-5 py-3 font-semibold text-black disabled:opacity-40"
                        disabled={Boolean(busy)}
                        onClick={() =>
                          void perform(
                            "Preparing cameras",
                            () =>
                              virtualDirectorApi.mutate(projectId, "initialize", {
                                version: state.version,
                              }),
                            true,
                          )
                        }
                      >
                        Prepare camera scene
                      </button>
                    </div>
                  )}
                  {scene ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        className="rounded-lg bg-amber-300 px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
                        disabled={!dirty || Boolean(busy)}
                        onClick={() => {
                          const validated = studioSceneSchema.safeParse(scene);
                          if (!validated.success) {
                            setError(
                              validated.error.issues.map((issue) => issue.message).join(" "),
                            );
                            return;
                          }
                          void perform(
                            "Saving cameras",
                            () =>
                              virtualDirectorApi.mutate(
                                projectId,
                                "scene",
                                { version: latestVersion.current, scene: validated.data },
                                "PUT",
                              ),
                            true,
                          );
                        }}
                      >
                        Save cameras
                      </button>
                      <button
                        className={button}
                        disabled={Boolean(busy) || dirty}
                        onClick={() =>
                          void perform(
                            "Importing studio scene",
                            () =>
                              virtualDirectorApi.mutate(projectId, "initialize", {
                                version: state.version,
                                fromStudio: true,
                              }),
                            true,
                          )
                        }
                      >
                        Import current studio scene
                      </button>
                      {dirty ? (
                        <button
                          className={button}
                          disabled={Boolean(busy)}
                          onClick={() =>
                            void perform(
                              "Reloading saved scene",
                              () => virtualDirectorApi.get(projectId),
                              true,
                            )
                          }
                        >
                          Discard camera changes
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {scene ? (
                  <section className={panel}>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold">Camera shots</h3>
                      <button
                        className={button}
                        disabled={scene.shots.length >= 24 || scene.duration > 115 || Boolean(busy)}
                        onClick={addShot}
                      >
                        <Plus className="mr-1 inline size-4" />
                        Add angle
                      </button>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {scene.shots.map((item, index) => (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 rounded-xl border p-3 ${shot?.id === item.id ? "border-amber-300/70 bg-amber-300/5" : "border-white/10"}`}
                        >
                          <input
                            aria-label={`Select ${item.name} for generation`}
                            type="checkbox"
                            className="accent-amber-300"
                            checked={checked.includes(item.id)}
                            onChange={(event) =>
                              setChecked((current) =>
                                event.target.checked
                                  ? [...current, item.id]
                                  : current.filter((id) => id !== item.id),
                              )
                            }
                          />
                          <button
                            className="min-w-0 flex-1 text-left"
                            onClick={() => setSelected(item.id)}
                          >
                            <span className="block truncate text-sm">
                              {String(index + 1).padStart(2, "0")} · {item.name}
                            </span>
                            <span className="mt-1 block text-xs text-zinc-400">
                              {item.start}s – {item.end}s · {item.end - item.start}s
                            </span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
                <section className={panel}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">3. Generate selected angles</h2>
                    <span className="text-xs text-amber-200">Seedance 2 · 720p · 16:9</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-300">
                    Each selected camera uses the same reference start time below. Use 0 to create
                    alternative angles of the opening performance. Choose a later start to continue
                    the scene. Each shot must last 4–15 whole seconds.
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-[160px_1fr]">
                    <label className="text-sm">
                      Reference start (seconds)
                      <input
                        className={`${control} mt-2`}
                        type="number"
                        min={0}
                        max={120}
                        step={0.1}
                        value={sourceStart}
                        onChange={(event) => setSourceStart(Number(event.target.value))}
                      />
                    </label>
                    <label className="text-sm">
                      Director instructions
                      <textarea
                        className={`${control} mt-2`}
                        rows={2}
                        maxLength={3000}
                        placeholder="A restrained performance, a slow move towards the face…"
                        value={instructions}
                        onChange={(event) => setInstructions(event.target.value)}
                      />
                    </label>
                  </div>
                  {generationError ? (
                    <p className="mt-3 text-sm text-amber-100">{generationError}</p>
                  ) : null}
                  {dirty ? (
                    <p className="mt-3 text-sm text-amber-100">
                      Save the current cameras before rendering or generating.
                    </p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap items-center gap-4">
                    <button
                      className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-5 py-3 font-semibold text-black disabled:opacity-40"
                      disabled={
                        Boolean(busy) ||
                        dirty ||
                        !chosen.length ||
                        !state.capabilities.generationReady ||
                        reference?.status !== "READY" ||
                        Boolean(generationError)
                      }
                      onClick={() => void generate()}
                    >
                      <Film className="size-4" />
                      Generate {chosen.length || "selected"}{" "}
                      {chosen.length === 1 ? "shot" : "shots"} · {money(estimate)} estimated
                    </button>
                    <p className="max-w-md text-xs leading-5 text-zinc-400">
                      Paid requests reserve your monthly budget. The provider may charge failed or
                      cancelled tasks. Identity, lip sync and continuity require your review; new
                      viewpoints reveal inferred details.
                    </p>
                  </div>
                </section>
              </section>
              <aside className="space-y-5">
                <section className={panel}>
                  <h2 className="text-lg font-semibold">Camera direction</h2>
                  {scene && shot ? (
                    <>
                      <p className="mb-4 mt-2 text-xs text-zinc-400">
                        {shot.name} · {shot.end - shot.start}s
                      </p>
                      <fieldset disabled={Boolean(busy)}>
                        <CameraControls scene={scene} shot={shot} onChange={edit} />
                      </fieldset>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          className={button}
                          disabled={Boolean(busy) || dirty || !state.capabilities.blenderReady}
                          onClick={() =>
                            void perform("Queueing Blender preview", () =>
                              virtualDirectorApi.mutate(projectId, "jobs", {
                                version: state.version,
                                requestKey: crypto.randomUUID(),
                                kind: "PREVIEW",
                                shotId: shot.id,
                                instructions: "",
                                maxCostCents: 0,
                              }),
                            )
                          }
                        >
                          Render Blender preview
                        </button>
                        <button
                          className={button}
                          disabled={scene.shots.length <= 1 || Boolean(busy)}
                          onClick={removeShot}
                        >
                          Remove angle
                        </button>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-zinc-400">
                        Blender renders the same sampled camera and actor paths as this viewer.
                        Preview renders contain schematic figures.
                      </p>
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-zinc-400">
                      Prepare your camera scene to choose a viewpoint.
                    </p>
                  )}
                </section>
                {result ? (
                  <section className={panel}>
                    <h2 className="font-semibold">
                      {result.job.kind === "PREVIEW"
                        ? "Blender staging preview"
                        : "Generated shot · review required"}
                    </h2>
                    <p className="mt-2 text-sm text-zinc-300">{result.job.shotName}</p>
                    <video
                      aria-label="Shot result"
                      className="mt-4 aspect-video w-full rounded-lg bg-black"
                      src={result.url}
                      controls
                      preload="metadata"
                      onError={() =>
                        setError(
                          "This private playback link expired. Open the result again to refresh it.",
                        )
                      }
                    />
                    {result.download ? (
                      <a
                        className={`${button} mt-3 inline-block`}
                        href={result.url}
                        download
                        rel="noreferrer"
                      >
                        Download approved video
                      </a>
                    ) : null}
                    {result.job.kind === "GENERATE" ? (
                      <p className="mt-3 text-xs leading-5 text-zinc-300">
                        Check the face, hands, clothing, set, action timing and lip sync against the
                        reference before approval. Original reference audio is retained when
                        available.
                      </p>
                    ) : null}
                  </section>
                ) : null}
              </aside>
            </div>
            <section className={panel}>
              <h2 className="text-lg font-semibold">Production queue & results</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Every attempt is kept independently. You can review an earlier result while another
                version is generating.
              </p>
              <div aria-live="polite" className="mt-4 space-y-3">
                {!currentJobs.length ? (
                  <p className="py-5 text-sm text-zinc-400">
                    Your Blender previews and AI shots will appear here.
                  </p>
                ) : (
                  currentJobs.map((job) => (
                    <div
                      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 p-4"
                      key={job.id}
                    >
                      <div className="min-w-0">
                        <p className="font-medium">
                          {job.shotName}
                          <span className="ml-3 text-xs text-zinc-400">
                            {job.kind === "PREVIEW" ? "Blender preview" : "AI generated"}
                          </span>
                        </p>
                        <p className="mt-2 text-xs text-zinc-300">
                          {job.status.toLowerCase().replaceAll("_", " ")} ·{" "}
                          {stageLabels[job.stage] ?? job.stage.toLowerCase()} ·{" "}
                          {new Date(job.createdAt).toLocaleString()}{" "}
                          {job.kind === "GENERATE"
                            ? `· ${money(job.estimatedCostCents)} reserved`
                            : ""}
                        </p>
                        {job.error ? (
                          <p className="mt-2 max-w-3xl text-sm leading-6 text-red-200">
                            {job.error}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {virtualActiveStatuses.includes(job.status) ? (
                          <button
                            className={button}
                            disabled={Boolean(busy)}
                            onClick={() =>
                              void perform("Cancelling task", () =>
                                virtualDirectorApi.mutate(projectId, `jobs/${job.id}/cancel`),
                              )
                            }
                          >
                            Cancel
                          </button>
                        ) : null}
                        {job.status === "COMPLETED" ? (
                          <>
                            <button
                              className={button}
                              disabled={Boolean(busy)}
                              onClick={() => void openMedia(job)}
                            >
                              Review result
                            </button>
                            {job.kind === "GENERATE" && !job.approvedAt ? (
                              <button
                                className={button}
                                disabled={Boolean(busy) || result?.job.id !== job.id}
                                onClick={() =>
                                  void perform("Approving reviewed shot", () =>
                                    virtualDirectorApi.mutate(projectId, `jobs/${job.id}/approve`),
                                  )
                                }
                              >
                                Approve reviewed shot
                              </button>
                            ) : null}
                            {job.approvedAt ? (
                              <button
                                className={button}
                                disabled={Boolean(busy)}
                                onClick={() => void openMedia(job, true)}
                              >
                                Prepare download
                              </button>
                            ) : null}
                          </>
                        ) : null}
                        {job.kind === "GENERATE" && !virtualActiveStatuses.includes(job.status) ? (
                          <button
                            className={button}
                            disabled={Boolean(busy)}
                            onClick={() => {
                              if (scene?.shots.some((item) => item.id === job.shotId)) {
                                setChecked([job.shotId!]);
                                setSelected(job.shotId!);
                                document
                                  .querySelector("main")
                                  ?.scrollIntoView({ behavior: "smooth" });
                              } else
                                setError(
                                  "This camera was removed. Add or select a current camera to regenerate.",
                                );
                            }}
                          >
                            <RefreshCw className="mr-2 inline size-3" />
                            Select for new version
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
            {busy ? (
              <p
                role="status"
                className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-amber-300/30 bg-[#111214] px-5 py-3 text-sm shadow-xl"
              >
                <Loader2 className="size-4 animate-spin text-amber-200" />
                {busy}
                {busy === "Uploading reference" ? ` · ${progress}%` : ""}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
