"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  Clipboard,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
  UserRound,
  Video,
} from "lucide-react";
import {
  APIError,
  performanceBriefAttachmentsApi,
  performanceProjectsApi,
  performanceTakesApi,
} from "@/lib/api/client";
import type {
  ActorRecommendation,
  PerformanceProjectResponse,
  PerformanceProjectSaveRequest,
} from "@/lib/api/types";

const steps = ["Script", "Shooting Plan", "Actor", "Performance"] as const;
const engines = ["Seedance", "Runway", "Kling", "Luma", "Other"];

function toRequest(
  project: PerformanceProjectResponse | null,
  input: { title: string; script: string; language: string; targetAiTool: string },
  workflowStatus: PerformanceProjectSaveRequest["workflowStatus"],
): PerformanceProjectSaveRequest {
  return {
    brief: project?.brief
      ? {
          capturePlan: project.brief.capturePlan,
          globalDirection: project.brief.globalDirection,
          qaCriteria: project.brief.qaCriteria,
          talentRequirements: project.brief.talentRequirements,
        }
      : undefined,
    company: { contactName: "", contactRole: "", name: "", type: "", website: "" },
    currentStep: project?.brief ? "plan" : "script",
    performerPath: project?.performerPath ?? null,
    project: {
      language: input.language,
      location: {
        countryCode: null,
        isRemote: true,
        label: "Remote",
        latitude: null,
        longitude: null,
        placeId: null,
        provider: "remote",
      },
      notes: project?.notes ?? "",
      objective: project?.objective ?? "",
      script: input.script,
      targetAiTool: input.targetAiTool,
      title: input.title.trim() || "Untitled performance",
      type: "Short performance",
    },
    scenes: (project?.scenes ?? []).map((scene) => ({
      bodyPosition: scene.bodyPosition ?? "",
      captureRequirements: scene.captureRequirements ?? "",
      dialogue: scene.dialogue ?? "",
      direction: scene.direction ?? "",
      duration: scene.duration ?? "15–30 seconds",
      emotionalProgression: scene.emotionalProgression ?? "",
      eyeline: scene.eyeline ?? "",
      framing: scene.framing ?? "",
      gestures: scene.gestures ?? "",
      id: scene.id,
      reference: scene.referenceUrl ?? "",
      startingPosition: scene.startingPosition ?? "",
      title: scene.title,
    })),
    workflowStatus,
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export function SimplifiedPerformanceApp() {
  const [project, setProject] = useState<PerformanceProjectResponse | null>(null);
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [language, setLanguage] = useState("");
  const [targetAiTool, setTargetAiTool] = useState("");
  const [scriptFile, setScriptFile] = useState<File | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [recommendations, setRecommendations] = useState<ActorRecommendation[]>([]);
  const [showActorPicker, setShowActorPicker] = useState(false);

  const syncProject = useCallback((next: PerformanceProjectResponse) => {
    setProject(next);
    setTitle(next.title === "Untitled performance" ? "" : next.title);
    setScript(next.script ?? "");
    setLanguage(next.language ?? "");
    setTargetAiTool(next.targetAiTool ?? "");
  }, []);

  useEffect(() => {
    void performanceProjectsApi
      .getCurrent()
      .then(syncProject)
      .catch((loadError) => {
        if (!(loadError instanceof APIError) || loadError.status !== 404)
          setError(errorMessage(loadError));
      });
  }, [syncProject]);

  const activeStep = (() => {
    if (!project?.brief) return 0;
    if (!project.brief.approvedAt || !project.actorGuide || !project.aiEnginePrompt) return 1;
    if (!project.assignment) return 2;
    return 3;
  })();

  const loadRecommendations = useCallback(async () => {
    if (!project) return;
    setBusy("recommendations");
    setError("");
    try {
      setRecommendations(await performanceProjectsApi.recommendActors(project.id));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setBusy("");
    }
  }, [project]);

  useEffect(() => {
    if (activeStep !== 2 || !project) return;
    void loadRecommendations();
  }, [activeStep, project?.id, loadRecommendations]);

  useEffect(() => {
    if (
      activeStep !== 3 ||
      !project?.assignment ||
      ["QA_PASSED", "QA_FAILED"].includes(project.assignment.status)
    )
      return;
    const timer = window.setInterval(() => {
      void performanceProjectsApi
        .getCurrent()
        .then(syncProject)
        .catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [activeStep, project?.assignment, syncProject]);

  async function generatePlan() {
    if (!script.trim() && !scriptFile) {
      setError("Paste a script or upload a PDF, DOCX, or TXT file.");
      return;
    }
    setBusy("generate");
    setError("");
    try {
      let current = project;
      if (!current) {
        current = await performanceProjectsApi.create(
          toRequest(null, { language, script, targetAiTool, title }, "DRAFT"),
        );
      } else {
        current = await performanceProjectsApi.update(
          current.id,
          toRequest(current, { language, script, targetAiTool, title }, "READY_FOR_BRIEF"),
        );
      }

      if (scriptFile) {
        const contentType = (scriptFile.type ||
          (scriptFile.name.toLowerCase().endsWith(".pdf")
            ? "application/pdf"
            : scriptFile.name.toLowerCase().endsWith(".docx")
              ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              : "text/plain")) as
          | "application/pdf"
          | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          | "text/plain";
        const reservation = await performanceBriefAttachmentsApi.createUpload(current.id, {
          contentType,
          fileName: scriptFile.name,
          sizeBytes: scriptFile.size,
        });
        await performanceBriefAttachmentsApi.uploadFile(
          reservation.upload,
          scriptFile,
          contentType,
          setUploadProgress,
        );
        await performanceBriefAttachmentsApi.completeUpload(
          current.id,
          reservation.attachment.id,
          reservation.attachment.uploadAttemptId,
        );
      }

      if (current.workflowStatus === "DRAFT") {
        current = await performanceProjectsApi.update(
          current.id,
          toRequest(current, { language, script, targetAiTool, title }, "READY_FOR_BRIEF"),
        );
      }
      syncProject(await performanceProjectsApi.generateBrief(current.id));
      setScriptFile(null);
    } catch (generateError) {
      setError(errorMessage(generateError));
    } finally {
      setBusy("");
      setUploadProgress(0);
    }
  }

  async function savePlan() {
    if (!project) return null;
    const saved = await performanceProjectsApi.update(
      project.id,
      toRequest(project, { language, script, targetAiTool, title }, "BRIEF_REVIEW"),
    );
    syncProject(saved);
    return saved;
  }

  async function approvePlan() {
    if (!project) return;
    setBusy("approve");
    setError("");
    try {
      if (project.brief?.approvedAt) {
        syncProject(await performanceProjectsApi.generateOutputs(project.id));
        return;
      }
      const saved = await savePlan();
      const approved = await performanceProjectsApi.approveBrief(saved!.id);
      syncProject(await performanceProjectsApi.generateOutputs(approved.id));
    } catch (approvalError) {
      setError(errorMessage(approvalError));
    } finally {
      setBusy("");
    }
  }

  async function regeneratePlan() {
    if (!project) return;
    setBusy("regenerate");
    setError("");
    try {
      syncProject(await performanceProjectsApi.generateBrief(project.id));
    } catch (regenerateError) {
      setError(errorMessage(regenerateError));
    } finally {
      setBusy("");
    }
  }

  async function regenerateOutputs() {
    if (!project || project.assignment) return;
    setBusy("outputs");
    setError("");
    try {
      syncProject(await performanceProjectsApi.generateOutputs(project.id, true));
    } catch (regenerateError) {
      setError(errorMessage(regenerateError));
    } finally {
      setBusy("");
    }
  }

  async function assignActor(actorProfileId: string) {
    if (!project) return;
    setBusy(actorProfileId);
    setError("");
    try {
      syncProject(await performanceProjectsApi.assignActor(project.id, actorProfileId));
      setShowActorPicker(false);
    } catch (assignmentError) {
      setError(errorMessage(assignmentError));
    } finally {
      setBusy("");
    }
  }

  function updateBrief(
    path: "globalDirection" | keyof NonNullable<PerformanceProjectResponse["brief"]>["capturePlan"],
    value: string,
  ) {
    if (!project?.brief) return;
    setProject({
      ...project,
      brief:
        path === "globalDirection"
          ? { ...project.brief, globalDirection: value }
          : { ...project.brief, capturePlan: { ...project.brief.capturePlan, [path]: value } },
    });
  }

  function updateScene(field: keyof PerformanceProjectResponse["scenes"][number], value: string) {
    if (!project?.scenes[0]) return;
    setProject({ ...project, scenes: [{ ...project.scenes[0], [field]: value }] });
  }

  const qaRuns = project?.scenes[0]?.take?.qaRuns ?? [];
  const latestQa = qaRuns[0];
  const previousFailedQa = qaRuns.slice(1).filter((qa) => qa.result === "FAIL");

  return (
    <main className="min-h-screen bg-[#0b0b0d] px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">
            Create a performance
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            One script. One guided take.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            The AI Director turns your short script into a practical shooting plan, then ActByMe
            finds an actor and validates the recording.
          </p>
        </header>

        <ol className="mb-8 grid grid-cols-4 gap-2" aria-label="Performance progress">
          {steps.map((step, index) => (
            <li
              className={`rounded-xl border px-3 py-3 text-center text-xs sm:text-sm ${index <= activeStep ? "border-amber-300/40 bg-amber-300/10 text-amber-100" : "border-white/10 bg-white/[0.03] text-zinc-500"}`}
              key={step}
            >
              <span className="hidden sm:inline">{index + 1} </span>
              {step}
            </li>
          ))}
        </ol>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        {activeStep === 0 ? (
          <section className="rounded-2xl border border-white/10 bg-[#111214] p-5 sm:p-7">
            <div className="flex items-center gap-3">
              <FileText className="size-5 text-amber-300" />
              <h2 className="text-xl font-semibold">Your script</h2>
            </div>
            <p className="mt-2 text-sm text-zinc-400">
              Use one script for a single 15–30 second clip.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field
                label="Project title (optional)"
                value={title}
                onChange={setTitle}
                placeholder="Launch video"
              />
              <Field
                label="Language (optional)"
                value={language}
                onChange={setLanguage}
                placeholder="English"
              />
            </div>
            <label className="mt-4 block text-sm font-medium text-zinc-200">
              Target AI engine (optional)
              <select
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-amber-300/60"
                value={targetAiTool}
                onChange={(event) => setTargetAiTool(event.target.value)}
              >
                <option value="">Choose later</option>
                {engines.map((engine) => (
                  <option key={engine}>{engine}</option>
                ))}
              </select>
            </label>
            <label className="mt-4 block text-sm font-medium text-zinc-200">
              Paste script
              <textarea
                className="mt-2 min-h-48 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 leading-6 text-white outline-none placeholder:text-zinc-600 focus:border-amber-300/60"
                value={script}
                onChange={(event) => {
                  setScript(event.target.value);
                  if (event.target.value) setScriptFile(null);
                }}
                placeholder="Paste the exact words the actor should say…"
              />
            </label>
            <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-zinc-600">
              <span className="h-px flex-1 bg-white/10" />
              or upload
              <span className="h-px flex-1 bg-white/10" />
            </div>
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-white/20 bg-white/[0.02] px-4 py-4 text-sm text-zinc-300 hover:border-amber-300/40">
              <span>{scriptFile ? scriptFile.name : "PDF, DOCX, or TXT"}</span>
              <Upload className="size-4" />
              <input
                className="sr-only"
                type="file"
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] ?? null;
                  setScriptFile(nextFile);
                  if (nextFile) setScript("");
                }}
              />
            </label>
            {uploadProgress ? (
              <p className="mt-2 text-xs text-zinc-400">Uploading {uploadProgress}%</p>
            ) : null}
            <button
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 py-3 font-semibold text-black hover:bg-amber-200 disabled:opacity-50 sm:w-auto"
              disabled={Boolean(busy)}
              onClick={() => void generatePlan()}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{" "}
              Generate Shooting Plan
            </button>
          </section>
        ) : null}

        {activeStep === 1 && project?.brief && project.scenes[0] ? (
          <PlanEditor
            project={project}
            busy={busy}
            onApprove={approvePlan}
            onBriefChange={updateBrief}
            onRegenerate={regeneratePlan}
            onSceneChange={updateScene}
          />
        ) : null}

        {activeStep === 2 && project ? (
          <section className="space-y-6">
            <OutputPanel
              busy={busy === "outputs"}
              onRegenerate={regenerateOutputs}
              project={project}
            />
            <div className="rounded-2xl border border-white/10 bg-[#111214] p-5 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <UserRound className="size-5 text-amber-300" />
                  <h2 className="text-xl font-semibold">Recommended actors</h2>
                </div>
                <button
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-zinc-200 disabled:opacity-50"
                  disabled={Boolean(busy)}
                  onClick={() => void loadRecommendations()}
                >
                  <RefreshCw className={`size-3.5 ${busy === "recommendations" ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>
              <p className="mt-2 text-sm text-zinc-400">
                Only approved, real ActByMe profiles are considered.
              </p>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {recommendations.map((item) => (
                  <article
                    className="rounded-xl border border-white/10 bg-black/20 p-4"
                    key={item.actorId}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold">{item.actor.stageName}</h3>
                        <p className="mt-1 text-xs text-zinc-500">
                          {[item.actor.city, item.actor.country].filter(Boolean).join(", ")}
                        </p>
                      </div>
                      <span className="rounded-full bg-amber-300/10 px-2.5 py-1 text-xs font-semibold text-amber-200">
                        {item.score}% match
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.matches.map((match) => (
                        <span
                          className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-zinc-300"
                          key={match}
                        >
                          {match}
                        </span>
                      ))}
                    </div>
                    <button
                      className="mt-4 w-full rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
                      disabled={Boolean(busy)}
                      onClick={() => void assignActor(item.actorId)}
                    >
                      {busy === item.actorId ? "Assigning…" : "Select actor"}
                    </button>
                  </article>
                ))}
                {!recommendations.length ? (
                  <p className="text-sm text-zinc-400">
                    No approved real actor currently matches this performance.
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {activeStep === 3 && project ? (
          <section className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-[#111214] p-5 sm:p-7">
              <div className="flex items-center gap-3">
                <Video className="size-5 text-amber-300" />
                <h2 className="text-xl font-semibold">Performance</h2>
              </div>
              <p className="mt-3 text-zinc-300">
                Assigned to <strong>{project.assignment?.actorProfile.stageName}</strong>
              </p>
              <StatusBlock
                status={project.assignment?.status ?? "SELECTED"}
                takeUploaded={project.scenes[0]?.take?.uploadStatus === "UPLOADED"}
              />
              {project.assignment?.status === "SELECTED" && !project.scenes[0]?.take ? (
                <div className="mt-4">
                  <button
                    className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-zinc-200"
                    onClick={() => {
                      setShowActorPicker((current) => !current);
                      if (!showActorPicker) void loadRecommendations();
                    }}
                  >
                    {showActorPicker ? "Keep current actor" : "Change actor"}
                  </button>
                  {showActorPicker ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {recommendations
                        .filter((item) => item.actorId !== project.assignment?.actorProfileId)
                        .map((item) => (
                          <article
                            className="rounded-xl border border-white/10 bg-black/20 p-4"
                            key={item.actorId}
                          >
                            <h3 className="font-semibold">{item.actor.stageName}</h3>
                            <p className="mt-1 text-xs text-zinc-500">{item.score}% match</p>
                            <button
                              className="mt-3 w-full rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
                              disabled={Boolean(busy)}
                              onClick={() => void assignActor(item.actorId)}
                            >
                              {busy === item.actorId ? "Assigning…" : "Assign instead"}
                            </button>
                          </article>
                        ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {latestQa ? <QaResults qa={latestQa} /> : null}
              {previousFailedQa.length ? (
                <div className="mt-6 border-t border-white/10 pt-5">
                  <h3 className="text-sm font-semibold">Previous failed QA history</h3>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    Earlier submissions remain visible after a successful retake.
                  </p>
                  <div className="mt-4 space-y-5">
                    {previousFailedQa.map((qa, index) => (
                      <QaResults
                        key={qa.id}
                        qa={qa}
                        title={`Failed submission ${previousFailedQa.length - index}`}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
              {project.assignment?.status === "QA_PASSED" && project.scenes[0]?.take ? (
                <DeliveryButtons project={project} />
              ) : null}
            </div>
            <OutputPanel project={project} />
          </section>
        ) : null}
      </div>
    </main>
  );
}

function Field({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className="block text-sm font-medium text-zinc-200">
      {label}
      <input
        className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-amber-300/60"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function PlanEditor({
  project,
  busy,
  onApprove,
  onBriefChange,
  onRegenerate,
  onSceneChange,
}: {
  project: PerformanceProjectResponse;
  busy: string;
  onApprove: () => Promise<void>;
  onBriefChange: (
    path: "globalDirection" | keyof NonNullable<PerformanceProjectResponse["brief"]>["capturePlan"],
    value: string,
  ) => void;
  onRegenerate: () => Promise<void>;
  onSceneChange: (field: keyof PerformanceProjectResponse["scenes"][number], value: string) => void;
}) {
  const brief = project.brief!;
  const scene = project.scenes[0]!;
  const locked = Boolean(brief.approvedAt);
  const captureFields: Array<[string, keyof typeof brief.capturePlan]> = [
    ["Camera", "camera"],
    ["Camera position", "cameraPosition"],
    ["Camera height", "cameraHeight"],
    ["Framing", "framing"],
    ["Orientation", "orientation"],
    ["Lighting", "lighting"],
    ["Audio", "audio"],
    ["Background", "background"],
    ["Wardrobe & continuity", "continuity"],
    ["Recording requirements", "recordingRequirements"],
  ];
  return (
    <section className="rounded-2xl border border-white/10 bg-[#111214] p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Sparkles className="size-5 text-amber-300" />
            <h2 className="text-xl font-semibold">AI Shooting Plan</h2>
          </div>
          <p className="mt-2 text-sm text-zinc-400">
            One continuous take. Edit anything that needs changing, then approve the version.
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-zinc-200 disabled:opacity-50"
          disabled={Boolean(busy) || locked}
          onClick={() => void onRegenerate()}
        >
          <RefreshCw className="size-4" /> Regenerate
        </button>
      </div>
      <div className="mt-6 grid gap-4">
        <TextArea
          label="Performance summary"
          value={brief.globalDirection}
          disabled={locked}
          onChange={(value) => onBriefChange("globalDirection", value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldArea
            label="Duration"
            value={scene.duration ?? ""}
            disabled={locked}
            onChange={(value) => onSceneChange("duration", value)}
          />
          <FieldArea
            label="Starting position"
            value={scene.startingPosition ?? ""}
            disabled={locked}
            onChange={(value) => onSceneChange("startingPosition", value)}
          />
        </div>
        <TextArea
          label="Dialogue"
          value={scene.dialogue ?? ""}
          disabled={locked}
          onChange={(value) => onSceneChange("dialogue", value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextArea
            label="Acting direction"
            value={scene.direction ?? ""}
            disabled={locked}
            onChange={(value) => onSceneChange("direction", value)}
          />
          <TextArea
            label="Emotional progression"
            value={scene.emotionalProgression ?? ""}
            disabled={locked}
            onChange={(value) => onSceneChange("emotionalProgression", value)}
          />
          <TextArea
            label="Body movement"
            value={scene.bodyPosition ?? ""}
            disabled={locked}
            onChange={(value) => onSceneChange("bodyPosition", value)}
          />
          <TextArea
            label="Eyeline"
            value={scene.eyeline ?? ""}
            disabled={locked}
            onChange={(value) => onSceneChange("eyeline", value)}
          />
          <TextArea
            label="Gestures"
            value={scene.gestures ?? ""}
            disabled={locked}
            onChange={(value) => onSceneChange("gestures", value)}
          />
        </div>
        <h3 className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Capture setup
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {captureFields.map(([label, key]) => (
            <TextArea
              key={key}
              label={label}
              value={brief.capturePlan[key]}
              disabled={locked}
              onChange={(value) => onBriefChange(key, value)}
            />
          ))}
        </div>
      </div>
      <button
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-300 px-5 py-3 font-semibold text-black disabled:opacity-50"
        disabled={Boolean(busy)}
        onClick={() => void onApprove()}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}{" "}
        {locked ? "Generate Actor Guide & Prompt" : "Approve Shooting Plan"}
      </button>
    </section>
  );
}

function FieldArea({
  disabled,
  label,
  onChange,
  value,
}: {
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block text-sm font-medium text-zinc-300">
      {label}
      <input
        disabled={disabled}
        className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white disabled:opacity-70"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
function TextArea({
  disabled,
  label,
  onChange,
  value,
}: {
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block text-sm font-medium text-zinc-300">
      {label}
      <textarea
        disabled={disabled}
        className="mt-2 min-h-24 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 leading-6 text-white disabled:opacity-70"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function OutputPanel({
  busy = false,
  onRegenerate,
  project,
}: {
  busy?: boolean;
  onRegenerate?: () => Promise<void>;
  project: PerformanceProjectResponse;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111214] p-5 sm:p-7">
      <h2 className="text-lg font-semibold">Creator output</h2>
      <p className="mt-1 text-sm text-zinc-400">
        The actor receives the guide. The AI Engine Prompt stays private to you.
      </p>
      {project.outputsProvider && project.outputsModel ? (
        <p className="mt-2 text-xs text-zinc-500">
          Generated from approved plan v{project.outputsBriefVersion} by {project.outputsProvider} ·{" "}
          {project.outputsModel}
        </p>
      ) : null}
      {project.actorGuide ? (
        <div className="mt-5 rounded-xl bg-black/25 p-4">
          <p className="text-sm font-semibold text-amber-200">
            Actor Guide · {project.actorGuide.duration}
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-300">{project.actorGuide.overview}</p>
          <ol className="mt-4 space-y-3">
            {project.actorGuide.steps.map((step) => (
              <li className="flex gap-3 text-sm leading-6 text-zinc-300" key={step.order}>
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-300/10 text-xs font-semibold text-amber-200">
                  {step.order}
                </span>
                <span>
                  <strong className="text-white">{step.title}.</strong> {step.instruction}
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Final check
            </p>
            <ul className="mt-2 space-y-1 text-xs leading-5 text-zinc-400">
              {project.actorGuide.finalChecklist.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      {project.aiEnginePrompt ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">AI Engine Prompt</p>
            <button
              className="inline-flex items-center gap-2 text-xs text-amber-200"
              onClick={() =>
                void navigator.clipboard
                  .writeText(project.aiEnginePrompt!)
                  .then(() => setCopied(true))
              }
            >
              <Clipboard className="size-3.5" />
              {copied ? "Copied" : "Copy prompt"}
            </button>
          </div>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-4 text-xs leading-6 text-zinc-300">
            {project.aiEnginePrompt}
          </pre>
        </div>
      ) : null}
      {onRegenerate ? (
        <button
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-zinc-200 hover:border-amber-300/40 hover:text-amber-200 disabled:opacity-50"
          disabled={busy}
          onClick={() => void onRegenerate()}
        >
          <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} />
          {busy ? "Regenerating…" : "Regenerate guide and prompt"}
        </button>
      ) : null}
    </div>
  );
}

function StatusBlock({ status, takeUploaded = false }: { status: string; takeUploaded?: boolean }) {
  const label: Record<string, string> = {
    SELECTED: "Waiting for actor to accept",
    ACCEPTED: takeUploaded
      ? "Video uploaded — waiting for actor to submit"
      : "Actor is preparing the performance",
    SUBMITTED: "Performance submitted",
    QA_RUNNING: "Quality checks are running",
    QA_FAILED: "Retake required",
    QA_PASSED: "Performance Approved",
  };
  return (
    <div
      className={`mt-5 rounded-xl border p-4 ${status === "QA_PASSED" ? "border-emerald-400/30 bg-emerald-400/10" : status === "QA_FAILED" ? "border-red-400/30 bg-red-400/10" : "border-amber-300/20 bg-amber-300/[0.06]"}`}
    >
      <p className="flex items-center gap-2 font-semibold">
        {status === "QA_PASSED" ? (
          <CheckCircle2 className="size-5 text-emerald-300" />
        ) : (
          <Loader2
            className={`size-5 text-amber-300 ${status === "QA_RUNNING" ? "animate-spin" : ""}`}
          />
        )}
        {label[status] ?? status}
      </p>
    </div>
  );
}

function QaResults({
  qa,
  title = "QA results",
}: {
  qa: NonNullable<
    NonNullable<PerformanceProjectResponse["scenes"][number]["take"]>["qaRuns"]
  >[number];
  title?: string;
}) {
  return (
    <div className="mt-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      {qa.processingError ? (
        <p className="mt-3 rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm leading-6 text-red-100">
          {qa.processingError}
        </p>
      ) : null}
      <div className="mt-3 space-y-2">
        {qa.checks.map((check) => (
          <div
            className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
            key={check.id}
          >
            <div className="flex justify-between gap-3">
              <span>{check.type.replaceAll("_", " ").toLowerCase()}</span>
              <span className={check.result === "PASS" ? "text-emerald-300" : "text-red-300"}>
                {check.result}
              </span>
            </div>
            {check.type === "VISUAL_COMPLIANCE" ? (
              <VisualQaSummary value={check.measuredValue} />
            ) : null}
            {check.correctionInstruction ? (
              <p className="mt-2 text-xs leading-5 text-zinc-400">{check.correctionInstruction}</p>
            ) : null}
          </div>
        ))}
      </div>
      {qa.transcript ? (
        <div className="mt-4 rounded-lg bg-black/20 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Transcript</p>
          <p className="mt-2 text-sm text-zinc-300">{qa.transcript}</p>
        </div>
      ) : null}
    </div>
  );
}

function VisualQaSummary({ value }: { value: Record<string, unknown> }) {
  const summary = typeof value.summary === "string" ? value.summary : null;
  const items = [
    ["Framing", value.framing],
    ["Position", value.subjectPosition],
    ["Eyeline", value.eyeline],
    ["Background & lighting", value.backgroundLighting],
    ["Movement & gesture", value.movementGesture],
  ]
    .map(([label, raw]) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
      const criterion = raw as Record<string, unknown>;
      const result = typeof criterion.result === "string" ? criterion.result : null;
      const observation =
        typeof criterion.observation === "string" ? criterion.observation : null;
      if (!result || !observation) return null;
      return { label: String(label), observation, result };
    })
    .filter(
      (item): item is { label: string; observation: string; result: string } =>
        item !== null,
    );

  if (!summary && !items.length) return null;
  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
      {summary ? <p className="text-xs leading-5 text-zinc-300">{summary}</p> : null}
      {items.length ? (
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div className="flex items-start justify-between gap-3 text-xs" key={item.label}>
              <span className="text-zinc-400">
                <strong className="text-zinc-300">{item.label}:</strong> {item.observation}
              </span>
              <span
                className={
                  item.result === "FAIL"
                    ? "text-red-300"
                    : item.result === "PASS"
                      ? "text-emerald-300"
                      : "text-zinc-500"
                }
              >
                {item.result === "NOT_OBSERVABLE" ? "Not observable" : item.result}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DeliveryButtons({ project }: { project: PerformanceProjectResponse }) {
  const [busy, setBusy] = useState(false);
  const take = project.scenes[0]?.take;
  async function open(kind: "playbackUrl" | "downloadUrl") {
    if (!take) return;
    setBusy(true);
    try {
      const urls = await performanceTakesApi.getDeliveryUrls(
        project.id,
        project.scenes[0]!.id,
        take.id,
      );
      window.open(urls[kind], "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-4 flex flex-wrap gap-3">
      <button
        disabled={busy}
        className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black"
        onClick={() => void open("playbackUrl")}
      >
        Play performance
      </button>
      <button
        disabled={busy}
        className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold"
        onClick={() => void open("downloadUrl")}
      >
        Download
      </button>
    </div>
  );
}
