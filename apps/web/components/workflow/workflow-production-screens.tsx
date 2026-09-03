"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  Gauge,
  Hand,
  MonitorPlay,
  Pencil,
  RefreshCw,
  Sparkles,
  Upload,
  UserPlus,
  UserRound,
  UsersRound,
  Video,
  XCircle,
} from "lucide-react";
import { performanceTakesApi } from "@/lib/api/client";
import type {
  PerformancePath,
  PerformanceQaCheckResult,
  PerformanceQaRun,
  PerformanceTake,
} from "@/lib/api/types";
import type { WorkflowController } from "./workflow-app";
import {
  PageHeading,
  Panel,
  PrimaryButton,
  ScreenBack,
  SecondaryButton,
  WorkflowContainer,
} from "./workflow-app";
import type { SceneDraft } from "./workflow-data";

export function ProductionStep({ controller }: { controller: WorkflowController }) {
  const { step } = controller.state;

  if (step === "brief") return <DirectorBrief controller={controller} />;
  if (step === "source") return <PerformanceSource controller={controller} />;
  if (step === "progress") return <PerformanceUploads controller={controller} />;
  if (step === "qa") return <TechnicalQaReview controller={controller} />;

  return null;
}

function DirectorBrief({ controller }: { controller: WorkflowController }) {
  const { brief, briefApproval, project, scenes } = controller.state;
  const approved = Boolean(briefApproval);

  if (!brief) {
    return (
      <WorkflowContainer size="small">
        <Panel className="p-6 text-center">
          <p className="text-sm text-[#a3a3b8]">No Director Brief has been generated yet.</p>
          <div className="mt-5 flex justify-center">
            <PrimaryButton onClick={() => controller.goTo("review")}>
              Return to review
            </PrimaryButton>
          </div>
        </Panel>
      </WorkflowContainer>
    );
  }

  return (
    <WorkflowContainer>
      <ScreenBack
        onClick={() => controller.goTo(approved ? "source" : "review")}
        label={approved ? "Back to Performer Selection" : "Back to Setup Review"}
      />
      <div className="mb-8">
        <StatusPill>
          {briefApproval
            ? `Director Brief Approved · v${briefApproval.approvedVersion}`
            : "Director Brief Ready"}
        </StatusPill>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Director Brief Review</h1>
        <p className="mt-2 text-[#a3a3b8]">
          {approved
            ? "This approved brief version is locked and ready for performer selection."
            : "Review and edit the generated brief before choosing the performance source."}
        </p>
      </div>

      <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-[#6C4DFF]/20 bg-[#6C4DFF]/[0.06] px-4 py-3">
        <Sparkles className="size-4 shrink-0 text-[#a78bfa]" />
        <p className="text-sm font-medium text-white">
          {approved
            ? "Generated from your persisted project data and locked at approval."
            : "Generated from your persisted project data. Every generated field remains editable."}
        </p>
      </div>

      <Panel className="mb-6 p-5">
        <CardTitle icon={<FileText className="size-4 text-[#a78bfa]" />} title="Global Direction" />
        <EditableArea
          disabled={approved}
          label={project.title}
          onChange={(globalDirection) => controller.updateBrief({ globalDirection })}
          value={brief.globalDirection}
        />
      </Panel>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Panel className="p-5">
          <CardTitle
            icon={<UserRound className="size-4 text-[#66E0C2]" />}
            title="Casting Requirements"
          />
          <div className="space-y-3">
            {(
              [
                ["Performer profile", "performerProfile"],
                ["Apparent age", "apparentAge"],
                ["Gender presentation", "genderPresentation"],
                ["Language", "language"],
                ["Accent", "accent"],
                ["Wardrobe", "wardrobe"],
                ["Additional notes", "notes"],
              ] as const
            ).map(([label, key]) => (
              <EditableLine
                disabled={approved}
                key={key}
                label={label}
                onChange={(value) =>
                  controller.updateBrief({
                    talentRequirements: { ...brief.talentRequirements, [key]: value },
                  })
                }
                value={brief.talentRequirements[key]}
              />
            ))}
          </div>
        </Panel>

        <Panel className="p-5">
          <CardTitle
            icon={<Camera className="size-4 text-[#a78bfa]" />}
            title="Capture Requirements"
          />
          <div className="space-y-3">
            {(
              [
                ["Location", "location"],
                ["Camera", "camera"],
                ["Framing", "framing"],
                ["Lighting", "lighting"],
                ["Audio", "audio"],
                ["Background", "background"],
                ["Continuity", "continuity"],
                ["File format", "fileFormat"],
              ] as const
            ).map(([label, key]) => (
              <EditableLine
                disabled={approved}
                key={key}
                label={label}
                onChange={(value) =>
                  controller.updateBrief({
                    capturePlan: { ...brief.capturePlan, [key]: value },
                  })
                }
                value={brief.capturePlan[key]}
              />
            ))}
          </div>
        </Panel>
      </div>

      <Panel className="mb-6 p-5">
        <CardTitle icon={<CheckCircle2 className="size-4 text-[#66E0C2]" />} title="QA Criteria" />
        <div className="grid gap-3 sm:grid-cols-2">
          {brief.qaCriteria.map((criterion, index) => (
            <EditableLine
              disabled={approved}
              key={index}
              label={`Criterion ${index + 1}`}
              onChange={(value) => {
                const qaCriteria = [...brief.qaCriteria];
                qaCriteria[index] = value;
                controller.updateBrief({ qaCriteria });
              }}
              value={criterion}
            />
          ))}
        </div>
      </Panel>

      <h2 className="mb-4 text-lg font-bold text-white">
        {scenes.length} {scenes.length === 1 ? "Scene" : "Scenes"} —{" "}
        {approved ? "Approved" : "Editable"}
      </h2>
      <div className="grid gap-6 lg:grid-cols-3">
        {scenes.map((scene, index) => (
          <SceneBriefCard
            editable={!approved}
            key={scene.id}
            number={index + 1}
            onChange={(patch) => controller.updateScene(scene.id, patch)}
            scene={scene}
          />
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <SecondaryButton onClick={() => controller.goTo(approved ? "source" : "review")}>
          <ArrowLeft className="size-4" /> {approved ? "Performer Selection" : "Back"}
        </SecondaryButton>
        <PrimaryButton
          disabled={controller.approvingBrief}
          onClick={() => (approved ? controller.goTo("source") : void controller.approveBrief())}
        >
          {controller.approvingBrief ? (
            <RefreshCw className="size-4 animate-spin" />
          ) : approved ? (
            "Choose Performer"
          ) : (
            "Approve Director Brief"
          )}
          {!controller.approvingBrief ? <ArrowRight className="size-4" /> : null}
        </PrimaryButton>
      </div>
      {controller.approvalError ? (
        <p className="mt-3 text-right text-sm text-[#FF9A44]">{controller.approvalError}</p>
      ) : null}
    </WorkflowContainer>
  );
}

function SceneBriefCard({
  editable,
  number,
  onChange,
  scene,
}: {
  editable: boolean;
  number: number;
  onChange: (patch: Partial<SceneDraft>) => void;
  scene: SceneDraft;
}) {
  return (
    <Panel className="overflow-hidden">
      <div className="flex min-h-28 items-center justify-between bg-gradient-to-br from-[#6C4DFF]/25 to-[#0A0E1A] p-5">
        <span className="rounded-full bg-black/35 px-2.5 py-1 text-xs font-bold text-white">
          Scene {number}
        </span>
        <Camera className="size-7 text-[#a78bfa]" />
      </div>
      <div className="space-y-4 p-5">
        <EditableLine
          disabled={!editable}
          label="Scene title"
          onChange={(title) => onChange({ title })}
          value={scene.title}
        />
        <EditableLine
          disabled={!editable}
          label="Timing"
          onChange={(duration) => onChange({ duration })}
          value={scene.duration}
        />
        <EditableArea
          disabled={!editable}
          label="Script / Dialogue"
          onChange={(dialogue) => onChange({ dialogue })}
          tone="mint"
          value={scene.dialogue}
        />
        <EditableArea
          disabled={!editable}
          label="Acting Intent"
          onChange={(direction) => onChange({ direction })}
          value={scene.direction}
        />
        <EditableArea
          disabled={!editable}
          label="Body Movement"
          onChange={(bodyPosition) => onChange({ bodyPosition })}
          value={scene.bodyPosition}
        />
        <EditableLine
          disabled={!editable}
          icon={<Video className="size-3" />}
          label="Eye Direction"
          onChange={(eyeline) => onChange({ eyeline })}
          value={scene.eyeline}
        />
        <EditableLine
          disabled={!editable}
          icon={<Hand className="size-3" />}
          label="Gestures"
          onChange={(gestures) => onChange({ gestures })}
          value={scene.gestures}
        />
        <EditableArea
          disabled={!editable}
          label="Framing & Camera"
          onChange={(framing) => onChange({ framing })}
          value={scene.framing}
        />
        <EditableArea
          disabled={!editable}
          label="Scene Capture Requirements"
          onChange={(captureRequirements) => onChange({ captureRequirements })}
          value={scene.captureRequirements}
        />
      </div>
    </Panel>
  );
}

function EditableArea({
  disabled = false,
  label,
  onChange,
  tone = "default",
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  tone?: "default" | "mint";
  value: string;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <label
      className={`block rounded-lg border p-3 ${
        tone === "mint"
          ? "border-[#66E0C2]/15 bg-[#66E0C2]/[0.04]"
          : "border-white/[0.05] bg-white/[0.02]"
      }`}
    >
      <span className="mb-1 flex items-center justify-between text-xs font-medium text-[#a3a3b8]">
        {label}
        {!disabled ? (
          <button
            aria-label={`Edit ${label}`}
            className="text-[#5a5a72] hover:text-[#a78bfa]"
            onClick={() => setEditing((current) => !current)}
            type="button"
          >
            <Pencil className="size-3" />
          </button>
        ) : null}
      </span>
      {editing && !disabled ? (
        <textarea
          autoFocus
          className="min-h-24 w-full resize-none rounded-md border border-[#6C4DFF]/40 bg-[#070A12] p-2 text-sm leading-5 text-white outline-none"
          onBlur={() => setEditing(false)}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        />
      ) : (
        <span className="block whitespace-pre-wrap text-sm leading-6 text-white">{value}</span>
      )}
    </label>
  );
}

function EditableLine({
  disabled = false,
  icon,
  label,
  onChange,
  value,
}: {
  disabled?: boolean;
  icon?: React.ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-xs text-[#5a5a72]">
        {icon} {label}
      </span>
      <input
        className="w-full border-0 border-b border-transparent bg-transparent pb-1 text-sm text-white outline-none transition focus:border-[#6C4DFF]/50"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

function PerformanceSource({ controller }: { controller: WorkflowController }) {
  const sources: Array<{
    badge: string;
    description: string;
    icon: typeof UsersRound;
    path: PerformancePath;
    title: string;
  }> = [
    {
      path: "ACTBYME_PERFORMER",
      title: "ActByMe Performer",
      description:
        "Save this performer path. ActByMe matching is coming next and no performer will be simulated.",
      badge: "Coming next",
      icon: UsersRound,
    },
    {
      path: "TEAM_MEMBER",
      title: "My Team Member",
      description:
        "Save a team-member path. Invitations and team access are coming next and are not sent yet.",
      badge: "Coming next",
      icon: UserPlus,
    },
    {
      path: "SELF",
      title: "Perform It Myself",
      description: "Upload existing MP4 or MOV takes. In-browser camera recording is unavailable.",
      badge: "Available",
      icon: Upload,
    },
  ];
  const selectedPath = controller.state.performerPath;
  const selectedUnavailablePath = sources.find(
    (source) => source.path === selectedPath && source.path !== "SELF",
  );

  return (
    <WorkflowContainer size="small">
      <ScreenBack onClick={() => controller.goTo("brief")} label="Back to Director Brief" />
      <PageHeading
        intro="Select how this brief will be performed."
        title="Who will perform this brief?"
      />
      <div className="grid gap-5 sm:grid-cols-3">
        {sources.map((source) => {
          const Icon = source.icon;
          const selected = source.path === selectedPath;
          const available = source.path === "SELF";
          return (
            <Panel
              className={`flex flex-col p-5 ${
                selected || available
                  ? "border-[#6C4DFF]/40 bg-[#6C4DFF]/[0.06] shadow-xl shadow-[#6C4DFF]/10"
                  : "opacity-70"
              }`}
              key={source.path}
            >
              <div className="mb-4 flex items-center justify-between gap-2">
                <span
                  className={`flex size-10 items-center justify-center rounded-xl ${selected || available ? "bg-[#6C4DFF]/20" : "bg-white/5"}`}
                >
                  <Icon
                    className={`size-5 ${selected || available ? "text-[#a78bfa]" : "text-[#5a5a72]"}`}
                  />
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${selected || available ? "bg-[#6C4DFF] text-white" : "border border-white/10 text-[#a3a3b8]"}`}
                >
                  {selected ? "Selected" : source.badge}
                </span>
              </div>
              <h2 className="font-bold text-white">{source.title}</h2>
              <p className="mt-1 flex-1 text-sm leading-6 text-[#a3a3b8]">{source.description}</p>
              <button
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[#6C4DFF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#7a5eff] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={controller.performerSelectionBusy}
                onClick={() => void controller.selectPerformerPath(source.path)}
                type="button"
              >
                {controller.performerSelectionBusy ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : selected && !available ? (
                  "Selected · Coming next"
                ) : available ? (
                  "Continue"
                ) : (
                  "Select path"
                )}
                {!controller.performerSelectionBusy ? <ArrowRight className="size-4" /> : null}
              </button>
            </Panel>
          );
        })}
      </div>
      {selectedUnavailablePath ? (
        <Panel className="mt-5 border-[#FF9A44]/20 bg-[#FF9A44]/[0.05] p-4">
          <p className="text-sm font-semibold text-white">{selectedUnavailablePath.title} saved</p>
          <p className="mt-1 text-sm leading-6 text-[#a3a3b8]">
            This path is persisted, but its invitation or matching workflow is not available yet.
          </p>
        </Panel>
      ) : null}
      {controller.performerSelectionError ? (
        <p className="mt-4 text-sm text-[#FF9A44]">{controller.performerSelectionError}</p>
      ) : null}
    </WorkflowContainer>
  );
}

function PerformanceUploads({ controller }: { controller: WorkflowController }) {
  const uploadedCount = controller.state.scenes.filter(
    (scene) => scene.take?.uploadStatus === "UPLOADED",
  ).length;

  return (
    <WorkflowContainer>
      <ScreenBack onClick={() => controller.goTo("source")} label="Back to Performance Source" />
      <div className="mb-8">
        <StatusPill>Private uploads</StatusPill>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Performance Uploads</h1>
        <p className="mt-2 text-[#a3a3b8]">
          Upload one existing MP4 or MOV take for each scene. Files stay private and playback uses
          signed links.
        </p>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {controller.state.scenes.map((scene) => (
          <TakeUploadCard
            key={scene.id}
            onTakeChange={(take) => controller.updateScene(scene.id, { take })}
            projectId={controller.projectId}
            scene={scene}
          />
        ))}
      </div>
      <div className="mt-8 flex items-center justify-between rounded-2xl border border-white/[0.06] bg-[#0F1422]/60 p-5">
        <div>
          <p className="text-sm font-semibold text-white">
            {uploadedCount} of {controller.state.scenes.length} scene takes uploaded
          </p>
          <p className="mt-1 text-xs text-[#a3a3b8]">
            Technical QA runs separately for each real uploaded take.
          </p>
        </div>
        <PrimaryButton disabled={!uploadedCount} onClick={() => controller.goTo("qa")}>
          Review technical QA <ArrowRight className="size-4" />
        </PrimaryButton>
      </div>
    </WorkflowContainer>
  );
}

function TakeUploadCard({
  onTakeChange,
  projectId,
  scene,
}: {
  onTakeChange: (take?: PerformanceTake) => void;
  projectId?: string;
  scene: SceneDraft;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const retryFileRef = useRef<File | undefined>(undefined);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const take = scene.take;
  const persistedError = take?.uploadStatus === "FAILED" ? take.uploadError : null;

  async function upload(file: File) {
    const contentType = resolvePerformanceVideoContentType(file);

    if (!contentType) {
      setError("Only MP4 and MOV video files are supported.");
      return;
    }

    if (!projectId) {
      setError("The project is still loading. Please try again.");
      return;
    }

    retryFileRef.current = file;
    setError("");
    setProgress(1);
    setUploading(true);

    let reservation: Awaited<ReturnType<typeof performanceTakesApi.createUpload>> | undefined;

    try {
      reservation = await performanceTakesApi.createUpload(projectId, scene.id, {
        contentType,
        fileName: file.name,
        sizeBytes: file.size,
      });
      onTakeChange(reservation.take);
      await performanceTakesApi.uploadFile(reservation.upload, file, contentType, setProgress);
      const completedTake = await performanceTakesApi.completeUpload(
        projectId,
        scene.id,
        reservation.take.id,
        reservation.take.uploadAttemptId,
      );
      onTakeChange(completedTake);
    } catch (uploadError) {
      const message =
        uploadError instanceof Error ? uploadError.message : "The video upload failed.";
      setError(message);

      if (reservation) {
        try {
          const failedTake = await performanceTakesApi.failUpload(
            projectId,
            scene.id,
            reservation.take.id,
            reservation.take.uploadAttemptId,
            message,
          );
          onTakeChange(failedTake);
        } catch {
          onTakeChange({
            ...reservation.take,
            uploadError: message,
            uploadStatus: "FAILED",
          });
        }
      }
    } finally {
      setUploading(false);
    }
  }

  async function deleteTake() {
    if (!projectId || !take) return;
    setDeleting(true);
    setError("");

    try {
      await performanceTakesApi.delete(projectId, scene.id, take.id);
      retryFileRef.current = undefined;
      if (inputRef.current) inputRef.current.value = "";
      onTakeChange(undefined);
      setProgress(0);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete the take.");
    } finally {
      setDeleting(false);
    }
  }

  function retry() {
    if (retryFileRef.current) {
      void upload(retryFileRef.current);
      return;
    }
    inputRef.current?.click();
  }

  return (
    <Panel className="overflow-hidden">
      <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-[#6C4DFF]/20 to-[#0A0E1A]">
        {take?.uploadStatus === "UPLOADED" && take.readUrl ? (
          <video
            className="h-full w-full object-cover"
            controls
            playsInline
            preload="metadata"
            src={take.readUrl}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            {uploading ? (
              <RefreshCw className="size-8 animate-spin text-white" />
            ) : take?.uploadStatus === "UPLOADED" ? (
              <CheckCircle2 className="size-8 text-[#66E0C2]" />
            ) : take?.uploadStatus === "FAILED" ? (
              <XCircle className="size-8 text-[#FF9A44]" />
            ) : (
              <Upload className="size-8 text-white" />
            )}
          </div>
        )}
      </div>
      <div className="p-4">
        <p className="text-sm font-semibold text-white">{scene.title}</p>
        <p className="mt-1 truncate text-xs text-[#5a5a72]">
          {take?.originalFileName || "No take uploaded"}
        </p>
        {uploading ? (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[10px] text-[#a3a3b8]">
              <span>Uploading</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-[#6C4DFF] transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}
        {error || persistedError ? (
          <p className="mt-2 text-xs leading-5 text-[#FF9A44]">{error || persistedError}</p>
        ) : null}
        <div className="mt-3 flex gap-2">
          <button
            className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-[#a3a3b8] hover:border-[#6C4DFF]/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={uploading || deleting}
            onClick={take?.uploadStatus === "FAILED" ? retry : () => inputRef.current?.click()}
            type="button"
          >
            {take?.uploadStatus === "FAILED" ? (
              <RefreshCw className="mr-1 inline size-3.5" />
            ) : (
              <Upload className="mr-1 inline size-3.5" />
            )}
            {take?.uploadStatus === "FAILED"
              ? "Retry upload"
              : take?.uploadStatus === "UPLOADED"
                ? "Replace video"
                : "Choose video"}
          </button>
          {take ? (
            <button
              aria-label={`Delete ${scene.title} take`}
              className="rounded-lg border border-white/10 px-3 py-2 text-[#a3a3b8] hover:border-[#FF9A44]/50 hover:text-[#FF9A44] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={uploading || deleting}
              onClick={() => void deleteTake()}
              type="button"
            >
              {deleting ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : (
                <XCircle className="size-3.5" />
              )}
            </button>
          ) : null}
        </div>
        <input
          accept=".mp4,.mov,video/mp4,video/quicktime"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = "";
          }}
          ref={inputRef}
          type="file"
        />
      </div>
    </Panel>
  );
}

function resolvePerformanceVideoContentType(file: File) {
  const fileName = file.name.toLowerCase();
  const browserContentType = file.type.toLowerCase();

  if (fileName.endsWith(".mp4") && (!browserContentType || browserContentType === "video/mp4")) {
    return "video/mp4" as const;
  }

  if (
    fileName.endsWith(".mov") &&
    (!browserContentType ||
      ["video/quicktime", "video/mov", "video/x-quicktime"].includes(browserContentType))
  ) {
    return "video/quicktime" as const;
  }

  return undefined;
}

const QA_CHECK_PRESENTATION = {
  FILE_CODEC: {
    description:
      "The uploaded object is a readable MP4/MOV with the approved codec when specified.",
    label: "File & codec metadata",
  },
  DURATION: {
    description: "Measured media duration is compared with the approved scene timing.",
    label: "Duration",
  },
  RESOLUTION_ORIENTATION: {
    description:
      "Display dimensions and orientation are compared with explicit brief requirements.",
    label: "Resolution & orientation",
  },
  AUDIO_PRESENCE: {
    description: "The media contains or omits an audio stream as required by the approved brief.",
    label: "Audio presence",
  },
  DIALOGUE_ACCURACY: {
    description: "Server-side speech-to-text is compared with the approved scene dialogue.",
    label: "Dialogue accuracy",
  },
} satisfies Record<PerformanceQaCheckResult["type"], { description: string; label: string }>;

function TechnicalQaReview({ controller }: { controller: WorkflowController }) {
  const [expandedScene, setExpandedScene] = useState<string | null>(null);
  const sceneRuns = controller.state.scenes.map((scene) => ({
    run: currentQaRun(scene.take),
    scene,
  }));
  const passedCount = sceneRuns.filter(({ run }) => run?.result === "PASS").length;
  const failedCount = sceneRuns.filter(({ run }) => run?.result === "FAIL").length;
  const approvedCount = controller.state.scenes.filter(
    (scene) => scene.take?.takeStatus === "APPROVED",
  ).length;
  const uploadedCount = controller.state.scenes.filter(
    (scene) => scene.take?.uploadStatus === "UPLOADED",
  ).length;

  return (
    <WorkflowContainer>
      <ScreenBack onClick={() => controller.goTo("progress")} label="Back to Performance Uploads" />
      <div className="mb-8">
        <StatusPill>
          <Gauge className="size-3.5" /> Technical QA
        </StatusPill>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Automated QA Results</h1>
        <p className="mt-2 text-[#a3a3b8]">
          Each uploaded take is checked against its approved Director Brief scene requirements.
        </p>
      </div>

      <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-[#FF9A44]/20 bg-[#FF9A44]/[0.05] px-4 py-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#FF9A44]" />
        <p className="text-sm leading-6 text-[#a3a3b8]">
          This QA checks objective media metadata, audio presence, and dialogue accuracy only.
          Artistic acting quality, gaze, body detection, lighting, and camera stability are not
          evaluated.
        </p>
      </div>

      <Panel className="mb-6 p-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Uploaded", uploadedCount, "text-white"],
            ["QA passed", passedCount, "text-[#66E0C2]"],
            ["Needs correction", failedCount, "text-[#FF9A44]"],
            ["Approved", approvedCount, "text-[#a78bfa]"],
          ].map(([label, value, tone]) => (
            <div className="rounded-xl bg-white/[0.03] p-3" key={String(label)}>
              <p className="text-xs text-[#5a5a72]">{label}</p>
              <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
            </div>
          ))}
        </div>
      </Panel>

      {controller.qaError ? (
        <div className="mb-5 rounded-xl border border-[#FF9A44]/30 bg-[#FF9A44]/[0.06] px-4 py-3 text-sm text-[#FF9A44]">
          {controller.qaError}
        </div>
      ) : null}

      <div className="space-y-4">
        {sceneRuns.map(({ run, scene }, index) => {
          const take = scene.take;
          const expanded = expandedScene === scene.id;
          const busy = controller.qaSceneBusy === scene.id;
          const passedChecks = run?.checks.filter((check) => check.result === "PASS").length ?? 0;
          const status = qaSceneStatus(take, run, busy);

          return (
            <Panel
              className={`overflow-hidden ${
                run?.result === "FAIL" ? "border-[#FF9A44]/30 bg-[#FF9A44]/[0.03]" : ""
              }`}
              key={scene.id}
            >
              <div className="flex items-center gap-4 p-5">
                <div className="relative flex aspect-video w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#070A12]">
                  {take?.readUrl ? (
                    <video
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                      src={take.readUrl}
                    />
                  ) : (
                    <MonitorPlay className="size-6 text-[#5a5a72]" />
                  )}
                </div>
                <button
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  onClick={() => setExpandedScene(expanded ? null : scene.id)}
                  type="button"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-bold text-white">
                      Scene {index + 1}: {scene.title}
                    </span>
                    <span className="mt-1 block text-xs text-[#a3a3b8]">
                      {run?.status === "COMPLETED"
                        ? `${passedChecks}/${run.checks.length} checks passed · Brief v${run.approvedBriefVersion}`
                        : take?.originalFileName || "No take uploaded"}
                    </span>
                  </span>
                  <QaStatusBadge status={status} />
                  <ChevronDown
                    className={`size-4 shrink-0 text-[#5a5a72] transition-transform ${expanded ? "rotate-180" : ""}`}
                  />
                </button>
              </div>

              {expanded ? (
                <div className="border-t border-white/[0.06] p-5">
                  {run?.checks.length ? (
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {run.checks.map((check) => {
                        const presentation = QA_CHECK_PRESENTATION[check.type];
                        return (
                          <div
                            className={`rounded-lg p-3 ${
                              check.result === "FAIL" ? "bg-[#FF9A44]/[0.07]" : "bg-white/[0.02]"
                            }`}
                            key={check.id}
                          >
                            <div className="flex items-start gap-3">
                              {check.result === "PASS" ? (
                                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#66E0C2]" />
                              ) : (
                                <XCircle className="mt-0.5 size-4 shrink-0 text-[#FF9A44]" />
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-white">
                                  {presentation.label}
                                </p>
                                <p className="mt-0.5 text-xs leading-5 text-[#5a5a72]">
                                  {presentation.description}
                                </p>
                                <p className="mt-2 text-xs text-[#a3a3b8]">
                                  Measured: {formatQaMeasurement(check)}
                                </p>
                                <p className="mt-1 text-xs text-[#5a5a72]">
                                  Required: {formatQaRequirement(check)}
                                </p>
                              </div>
                            </div>
                            {check.correctionInstruction ? (
                              <p className="mt-3 border-t border-[#FF9A44]/15 pt-3 text-xs leading-5 text-[#FF9A44]">
                                {check.correctionInstruction}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : run?.status === "ERROR" ? (
                    <div className="rounded-xl border border-[#FF9A44]/20 bg-[#FF9A44]/[0.05] p-4">
                      <p className="text-sm font-semibold text-white">
                        QA processing did not finish
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[#a3a3b8]">
                        {run.processingError || "Retry this technical QA run."}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-white/[0.02] p-4 text-sm text-[#a3a3b8]">
                      {take?.uploadStatus === "UPLOADED"
                        ? "This real uploaded take is ready for technical QA."
                        : "Upload an MP4 or MOV take before running technical QA."}
                    </div>
                  )}

                  {run?.transcript ? (
                    <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#5a5a72]">
                        Speech-to-text transcript
                      </p>
                      <p className="mt-2 text-sm leading-6 text-white">{run.transcript}</p>
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {!take || take.uploadStatus !== "UPLOADED" ? (
                      <SecondaryButton onClick={() => controller.goTo("progress")}>
                        <Upload className="size-4" /> Upload take
                      </SecondaryButton>
                    ) : take.takeStatus === "APPROVED" ? (
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#66E0C2]">
                        <CheckCircle2 className="size-4" /> Take approved
                      </span>
                    ) : run?.result === "PASS" ? (
                      <PrimaryButton
                        disabled={Boolean(controller.qaSceneBusy)}
                        onClick={() => void controller.approveTake(scene.id, take.id)}
                      >
                        {busy ? (
                          <RefreshCw className="size-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="size-4" />
                        )}
                        Approve take
                      </PrimaryButton>
                    ) : (
                      <>
                        <PrimaryButton
                          disabled={Boolean(controller.qaSceneBusy)}
                          onClick={() => void controller.runTakeQa(scene.id, take.id)}
                        >
                          {busy ? (
                            <RefreshCw className="size-4 animate-spin" />
                          ) : (
                            <Gauge className="size-4" />
                          )}
                          {run ? "Run QA again" : "Run technical QA"}
                        </PrimaryButton>
                        {run?.result === "FAIL" ? (
                          <SecondaryButton onClick={() => controller.goTo("progress")}>
                            <RefreshCw className="size-4" /> Replace with corrected take
                          </SecondaryButton>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              ) : null}
            </Panel>
          );
        })}
      </div>

      {approvedCount === controller.state.scenes.length && approvedCount > 0 ? (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-[#66E0C2]/20 bg-[#66E0C2]/[0.06] p-4 text-sm font-semibold text-[#66E0C2]">
          <CheckCircle2 className="size-5" /> All scene takes have passed technical QA and are
          approved.
        </div>
      ) : null}
    </WorkflowContainer>
  );
}

function currentQaRun(take?: PerformanceTake): PerformanceQaRun | undefined {
  return take?.qaRuns?.find((run) => run.uploadAttemptId === take.uploadAttemptId);
}

function qaSceneStatus(
  take: PerformanceTake | undefined,
  run: PerformanceQaRun | undefined,
  busy: boolean,
) {
  if (busy || run?.status === "RUNNING") return "Running";
  if (take?.takeStatus === "APPROVED") return "Approved";
  if (run?.status === "ERROR") return "Retry QA";
  if (run?.result === "PASS") return "Passed";
  if (run?.result === "FAIL") return "Needs correction";
  if (take?.uploadStatus === "UPLOADED") return "Ready for QA";
  return "Awaiting upload";
}

function QaStatusBadge({ status }: { status: ReturnType<typeof qaSceneStatus> }) {
  const positive = status === "Passed" || status === "Approved";
  const warning = status === "Needs correction" || status === "Retry QA";
  return (
    <span
      className={`hidden shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold sm:inline-flex ${
        positive
          ? "bg-[#66E0C2]/15 text-[#66E0C2]"
          : warning
            ? "bg-[#FF9A44]/15 text-[#FF9A44]"
            : "bg-[#6C4DFF]/15 text-[#a78bfa]"
      }`}
    >
      {status === "Running" ? (
        <RefreshCw className="size-3.5 animate-spin" />
      ) : positive ? (
        <CheckCircle2 className="size-3.5" />
      ) : warning ? (
        <AlertTriangle className="size-3.5" />
      ) : (
        <Clock3 className="size-3.5" />
      )}
      {status}
    </span>
  );
}

function formatQaMeasurement(check: PerformanceQaCheckResult) {
  const measured = check.measuredValue;
  if (check.type === "FILE_CODEC") {
    return (
      [measured.extension, measured.codec, formatBytes(measured.sizeBytes)]
        .filter(Boolean)
        .join(" · ") || "Unreadable media"
    );
  }
  if (check.type === "DURATION") {
    return typeof measured.durationSeconds === "number"
      ? `${measured.durationSeconds.toFixed(2)} seconds`
      : "Unavailable";
  }
  if (check.type === "RESOLUTION_ORIENTATION") {
    return typeof measured.width === "number" && typeof measured.height === "number"
      ? `${measured.width}×${measured.height} · ${String(measured.orientation)}`
      : "Unavailable";
  }
  if (check.type === "AUDIO_PRESENCE") {
    return measured.hasAudio
      ? `Present${measured.codec ? ` · ${String(measured.codec)}` : ""}${
          measured.channels ? ` · ${String(measured.channels)} channel(s)` : ""
        }`
      : "No audio stream";
  }
  if (check.type === "DIALOGUE_ACCURACY") {
    return typeof measured.wordAccuracyPercent === "number"
      ? `${measured.wordAccuracyPercent}% word match`
      : "Unavailable";
  }
  return "Unavailable";
}

function formatQaRequirement(check: PerformanceQaCheckResult) {
  const required = check.requiredValue ?? {};
  if (check.type === "FILE_CODEC") {
    const containers = Array.isArray(required.allowedContainers)
      ? required.allowedContainers.join(" or ")
      : "MP4 or MOV";
    const codecs =
      Array.isArray(required.requiredCodecs) && required.requiredCodecs.length
        ? ` · ${required.requiredCodecs.join(" or ")}`
        : "";
    return `${containers}${codecs}`;
  }
  if (check.type === "DURATION") {
    return typeof required.minimumSeconds === "number" &&
      typeof required.maximumSeconds === "number"
      ? `${required.minimumSeconds}–${required.maximumSeconds} seconds`
      : "Readable positive duration";
  }
  if (check.type === "RESOLUTION_ORIENTATION") {
    const resolution =
      typeof required.minimumWidth === "number" && typeof required.minimumHeight === "number"
        ? `${required.minimumWidth}×${required.minimumHeight} minimum`
        : "Readable dimensions";
    return `${resolution}${required.orientation ? ` · ${String(required.orientation)}` : ""}`;
  }
  if (check.type === "AUDIO_PRESENCE") {
    return required.hasAudio ? "Audio stream present" : "No audio stream";
  }
  if (check.type === "DIALOGUE_ACCURACY") {
    return typeof required.minimumWordAccuracyPercent === "number"
      ? `${required.minimumWordAccuracyPercent}% minimum word match`
      : "Approved dialogue";
  }
  return "Approved scene requirement";
}

function formatBytes(value: unknown) {
  return typeof value === "number" ? `${(value / 1_000_000).toFixed(1)} MB` : null;
}

function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#66E0C2]/20 bg-[#66E0C2]/[0.06] px-3 py-1.5 text-xs font-semibold uppercase text-[#66E0C2]">
      {children}
    </span>
  );
}

function CardTitle({ icon, title }: { icon?: React.ReactNode; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      {icon}
      <h2 className="text-sm font-bold text-white">{title}</h2>
    </div>
  );
}
