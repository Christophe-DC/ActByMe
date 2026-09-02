"use client";

import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  FileText,
  Hand,
  Lock,
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
import type { PerformanceTake } from "@/lib/api/types";
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

  return null;
}

function DirectorBrief({ controller }: { controller: WorkflowController }) {
  const { brief, project, scenes } = controller.state;

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
      <ScreenBack onClick={() => controller.goTo("review")} label="Back to Setup Review" />
      <div className="mb-8">
        <StatusPill>Director Brief Ready</StatusPill>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Director Brief Review</h1>
        <p className="mt-2 text-[#a3a3b8]">
          Review and edit the generated brief before choosing the performance source.
        </p>
      </div>

      <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-[#6C4DFF]/20 bg-[#6C4DFF]/[0.06] px-4 py-3">
        <Sparkles className="size-4 shrink-0 text-[#a78bfa]" />
        <p className="text-sm font-medium text-white">
          Generated from your persisted project data. Every generated field remains editable.
        </p>
      </div>

      <Panel className="mb-6 p-5">
        <CardTitle icon={<FileText className="size-4 text-[#a78bfa]" />} title="Global Direction" />
        <EditableArea
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
        {scenes.length} {scenes.length === 1 ? "Scene" : "Scenes"} — Editable
      </h2>
      <div className="grid gap-6 lg:grid-cols-3">
        {scenes.map((scene, index) => (
          <SceneBriefCard
            key={scene.id}
            number={index + 1}
            onChange={(patch) => controller.updateScene(scene.id, patch)}
            scene={scene}
          />
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <SecondaryButton onClick={() => controller.goTo("review")}>
          <ArrowLeft className="size-4" /> Back
        </SecondaryButton>
        <PrimaryButton onClick={() => controller.goTo("source")}>
          Choose Performance Source <ArrowRight className="size-4" />
        </PrimaryButton>
      </div>
    </WorkflowContainer>
  );
}

function SceneBriefCard({
  number,
  onChange,
  scene,
}: {
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
          label="Scene title"
          onChange={(title) => onChange({ title })}
          value={scene.title}
        />
        <EditableLine
          label="Timing"
          onChange={(duration) => onChange({ duration })}
          value={scene.duration}
        />
        <EditableArea
          label="Script / Dialogue"
          onChange={(dialogue) => onChange({ dialogue })}
          tone="mint"
          value={scene.dialogue}
        />
        <EditableArea
          label="Acting Intent"
          onChange={(direction) => onChange({ direction })}
          value={scene.direction}
        />
        <EditableArea
          label="Body Movement"
          onChange={(bodyPosition) => onChange({ bodyPosition })}
          value={scene.bodyPosition}
        />
        <EditableLine
          icon={<Video className="size-3" />}
          label="Eye Direction"
          onChange={(eyeline) => onChange({ eyeline })}
          value={scene.eyeline}
        />
        <EditableLine
          icon={<Hand className="size-3" />}
          label="Gestures"
          onChange={(gestures) => onChange({ gestures })}
          value={scene.gestures}
        />
        <EditableArea
          label="Framing & Camera"
          onChange={(framing) => onChange({ framing })}
          value={scene.framing}
        />
        <EditableArea
          label="Scene Capture Requirements"
          onChange={(captureRequirements) => onChange({ captureRequirements })}
          value={scene.captureRequirements}
        />
      </div>
    </Panel>
  );
}

function EditableArea({
  label,
  onChange,
  tone = "default",
  value,
}: {
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
        <button
          aria-label={`Edit ${label}`}
          className="text-[#5a5a72] hover:text-[#a78bfa]"
          onClick={() => setEditing((current) => !current)}
          type="button"
        >
          <Pencil className="size-3" />
        </button>
      </span>
      {editing ? (
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
  icon,
  label,
  onChange,
  value,
}: {
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
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

function PerformanceSource({ controller }: { controller: WorkflowController }) {
  const sources = [
    {
      id: "matched",
      title: "Find a Matched Actor",
      description: "Choose a rights-cleared performer matched to the role, language and accent.",
      badge: "Not implemented",
      icon: UsersRound,
      active: false,
    },
    {
      id: "invite",
      title: "Invite My Actor",
      description: "Use ActByMe direction with a performer you already know.",
      badge: "Not implemented",
      icon: UserPlus,
      active: false,
    },
    {
      id: "self",
      title: "Upload My Performance",
      description: "Upload existing MP4 or MOV takes. In-browser camera recording is unavailable.",
      badge: "Available",
      icon: Upload,
      active: true,
    },
  ];

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
          return (
            <Panel
              className={`flex flex-col p-5 ${
                source.active
                  ? "border-[#6C4DFF]/40 bg-[#6C4DFF]/[0.06] shadow-xl shadow-[#6C4DFF]/10"
                  : "opacity-70"
              }`}
              key={source.id}
            >
              <div className="mb-4 flex items-center justify-between gap-2">
                <span
                  className={`flex size-10 items-center justify-center rounded-xl ${source.active ? "bg-[#6C4DFF]/20" : "bg-white/5"}`}
                >
                  <Icon
                    className={`size-5 ${source.active ? "text-[#a78bfa]" : "text-[#5a5a72]"}`}
                  />
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${source.active ? "bg-[#6C4DFF] text-white" : "border border-white/10 text-[#a3a3b8]"}`}
                >
                  {source.badge}
                </span>
              </div>
              <h2 className="font-bold text-white">{source.title}</h2>
              <p className="mt-1 flex-1 text-sm leading-6 text-[#a3a3b8]">{source.description}</p>
              <button
                className={`mt-4 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${
                  source.active
                    ? "bg-[#6C4DFF] text-white hover:bg-[#7a5eff]"
                    : "cursor-not-allowed border border-white/10 text-[#5a5a72]"
                }`}
                disabled={!source.active}
                onClick={() => {
                  controller.setPerformerPath("SELF_UPLOAD");
                  controller.goTo("progress");
                }}
                type="button"
              >
                {source.active ? "Continue" : <Lock className="size-4" />}
                {source.active ? <ArrowRight className="size-4" /> : "Unavailable"}
              </button>
            </Panel>
          );
        })}
      </div>
    </WorkflowContainer>
  );
}

function PerformanceUploads({ controller }: { controller: WorkflowController }) {
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
