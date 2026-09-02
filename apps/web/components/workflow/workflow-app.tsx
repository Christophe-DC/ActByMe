"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Check,
  CheckCircle2,
  FileText,
  Globe2,
  Loader2,
  MapPin,
  Sparkles,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import {
  WORKFLOW_STEPS,
  createEmptyCompanyDraft,
  createEmptyProjectDraft,
  type BriefDraft,
  type CompanyDraft,
  type ProjectDraft,
  type SceneDraft,
  type WorkflowStep,
} from "./workflow-data";
import { ProductionStep } from "./workflow-production-screens";
import { APIError, performanceProjectsApi, performanceTakesApi } from "@/lib/api/client";
import type {
  PerformancePath,
  PerformanceProjectResponse,
  PerformanceProjectSaveRequest,
  PerformanceWorkflowStatus,
} from "@/lib/api/types";

export type WorkflowState = {
  step: WorkflowStep;
  company: CompanyDraft;
  project: ProjectDraft;
  brief: BriefDraft | null;
  scenes: SceneDraft[];
  performerPath: PerformancePath | null;
};

export type WorkflowController = {
  projectId?: string;
  state: WorkflowState;
  generatingBrief: boolean;
  generationError: string;
  generateBrief: () => Promise<void>;
  goTo: (step: WorkflowStep) => void;
  updateCompany: (patch: Partial<CompanyDraft>) => void;
  updateProject: (patch: Partial<ProjectDraft>) => void;
  updateBrief: (patch: Partial<BriefDraft>) => void;
  updateScene: (sceneId: string, patch: Partial<SceneDraft>) => void;
  setPerformerPath: (performerPath: PerformancePath) => void;
  createNewProject: () => void;
};

const STEP_TO_STATUS: Record<WorkflowStep, PerformanceWorkflowStatus> = {
  company: "DRAFT",
  project: "DRAFT",
  review: "READY_FOR_BRIEF",
  director: "GENERATING_BRIEF",
  brief: "BRIEF_REVIEW",
  source: "PERFORMANCE_SOURCE",
  progress: "PERFORMANCE_PROGRESS",
};

function persistedStep(project: PerformanceProjectResponse): WorkflowStep {
  const currentStep = project.currentStep as WorkflowStep;
  if (
    project.workflowStatus === "DRAFT" &&
    ["company", "project"].includes(currentStep)
  ) {
    return currentStep;
  }

  const legacySteps: Partial<Record<PerformanceWorkflowStatus, WorkflowStep>> = {
    READY_FOR_BRIEF: "review",
    GENERATING_BRIEF: "director",
    BRIEF_REVIEW: "brief",
    COMPANY_DETAILS: "company",
    PROJECT_DETAILS: "project",
    SETUP_REVIEW: "review",
    BRIEF_PROCESSING: "director",
    BRIEF_READY: "brief",
    PERFORMANCE_SOURCE: "source",
    PERFORMANCE_PROGRESS: "progress",
  };
  return legacySteps[project.workflowStatus] ?? "company";
}

function createInitialState(): WorkflowState {
  return {
    step: "company",
    company: createEmptyCompanyDraft(),
    project: createEmptyProjectDraft(),
    brief: null,
    scenes: [],
    performerPath: null,
  };
}

function toSaveRequest(state: WorkflowState): PerformanceProjectSaveRequest {
  return {
    ...(state.brief ? { brief: state.brief } : {}),
    company: state.company,
    performerPath: state.performerPath,
    project: state.project,
    scenes: state.scenes.map((scene) => ({
      bodyPosition: scene.bodyPosition,
      dialogue: scene.dialogue,
      direction: scene.direction,
      duration: scene.duration,
      eyeline: scene.eyeline,
      framing: scene.framing,
      gestures: scene.gestures,
      captureRequirements: scene.captureRequirements,
      ...(isUuid(scene.id) ? { id: scene.id } : {}),
      reference: scene.reference,
      title: scene.title,
    })),
    currentStep: state.step,
    workflowStatus: STEP_TO_STATUS[state.step],
  };
}

function fromPersistedProject(project: PerformanceProjectResponse): WorkflowState {
  const initial = createInitialState();

  return {
    ...initial,
    brief: project.brief
      ? {
          capturePlan: {
            location: project.brief.capturePlan.location ?? "",
            camera: project.brief.capturePlan.camera ?? "",
            framing: project.brief.capturePlan.framing ?? "",
            lighting: project.brief.capturePlan.lighting ?? "",
            audio: project.brief.capturePlan.audio ?? "",
            background: project.brief.capturePlan.background ?? "",
            continuity: project.brief.capturePlan.continuity ?? "",
            fileFormat: project.brief.capturePlan.fileFormat ?? "",
          },
          globalDirection: project.brief.globalDirection ?? "",
          qaCriteria: Array.isArray(project.brief.qaCriteria) ? project.brief.qaCriteria : [],
          talentRequirements: {
            performerProfile: project.brief.talentRequirements.performerProfile ?? "",
            apparentAge: project.brief.talentRequirements.apparentAge ?? "",
            genderPresentation: project.brief.talentRequirements.genderPresentation ?? "",
            language: project.brief.talentRequirements.language ?? "",
            accent: project.brief.talentRequirements.accent ?? "",
            wardrobe: project.brief.talentRequirements.wardrobe ?? "",
            notes: project.brief.talentRequirements.notes ?? "",
          },
        }
      : null,
    company: {
      contactName: project.contactName ?? "",
      contactRole: project.contactRole ?? "",
      name: project.companyName,
      type: project.organizationType ?? "",
      website: project.companyWebsite ?? "",
    },
    performerPath: project.performerPath,
    project: {
      language: project.language ?? "",
      location:
        project.locationData ??
        (project.location
          ? {
              ...createEmptyProjectDraft().location,
              isRemote: project.location.toLowerCase() === "remote",
              label: project.location,
              provider: project.location.toLowerCase() === "remote" ? "remote" : "manual",
            }
          : createEmptyProjectDraft().location),
      notes: project.notes ?? "",
      objective: project.objective ?? "",
      targetAiTool: project.targetAiTool ?? "",
      title: project.title,
      type: project.type,
      uploadFile: project.sourceFileName ?? "",
    },
    scenes: project.scenes.map((scene) => ({
      bodyPosition: scene.bodyPosition ?? "",
      dialogue: scene.dialogue ?? "",
      direction: scene.direction ?? "",
      duration: scene.duration ?? "",
      eyeline: scene.eyeline ?? "",
      framing: scene.framing ?? "",
      gestures: scene.gestures ?? "",
      captureRequirements: scene.captureRequirements ?? "",
      id: scene.id,
      reference: scene.referenceUrl ?? "",
      ...(scene.take ? { take: scene.take } : {}),
      title: scene.title,
    })),
    step: persistedStep(project),
  };
}

async function addSignedTakeUrls(projectId: string, state: WorkflowState): Promise<WorkflowState> {
  const scenes = await Promise.all(
    state.scenes.map(async (scene) => {
      if (!scene.take || scene.take.uploadStatus !== "UPLOADED") return scene;

      try {
        const { readUrl } = await performanceTakesApi.getReadUrl(
          projectId,
          scene.id,
          scene.take.id,
        );
        return { ...scene, take: { ...scene.take, readUrl } };
      } catch {
        return scene;
      }
    }),
  );

  return { ...state, scenes };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function WorkflowApp() {
  const [state, setState] = useState<WorkflowState>(createInitialState);
  const [projectId, setProjectId] = useState<string>();
  const [ready, setReady] = useState(false);
  const [generatingBrief, setGeneratingBrief] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [persistenceError, setPersistenceError] = useState("");
  const initializationStarted = useRef(false);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  const queueSave = useCallback((id: string, snapshot: WorkflowState) => {
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(async () => {
        await performanceProjectsApi.update(id, toSaveRequest(snapshot));
        setPersistenceError("");
      })
      .catch((error: unknown) => {
        setPersistenceError(
          error instanceof Error ? error.message : "The project could not be saved.",
        );
      });
  }, []);

  useEffect(() => {
    if (initializationStarted.current) {
      return;
    }
    initializationStarted.current = true;

    async function initialize() {
      try {
        let project: PerformanceProjectResponse;
        try {
          project = await performanceProjectsApi.getCurrent();
        } catch (error) {
          if (!(error instanceof APIError) || error.status !== 404) {
            throw error;
          }
          project = await performanceProjectsApi.create(toSaveRequest(createInitialState()));
        }

        const persistedState = await addSignedTakeUrls(project.id, fromPersistedProject(project));
        setProjectId(project.id);
        setState(persistedState);
        if (project.workflowStatus === "GENERATING_BRIEF") {
          setGenerationError("Brief generation was interrupted. Retry to continue.");
        }
        setReady(true);
      } catch (error) {
        setPersistenceError(
          error instanceof Error ? error.message : "The project could not be loaded.",
        );
      }
    }

    void initialize();
  }, []);

  useEffect(() => {
    if (!ready || !projectId || state.step === "director") return;
    const timer = window.setTimeout(() => queueSave(projectId, state), 500);
    return () => window.clearTimeout(timer);
  }, [projectId, queueSave, ready, state]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [state.step]);

  const goTo = useCallback(
    (step: WorkflowStep) => {
      setState((current) => {
        const next = { ...current, step };
        if (projectId) queueSave(projectId, next);
        return next;
      });
    },
    [projectId, queueSave],
  );

  const createNewProject = useCallback(() => {
    const initial = createInitialState();
    setReady(false);
    setProjectId(undefined);
    setState(initial);
    window.scrollTo({ top: 0, behavior: "smooth" });

    void performanceProjectsApi
      .create(toSaveRequest(initial))
      .then((project) => {
        setProjectId(project.id);
        setState(fromPersistedProject(project));
        setReady(true);
        setPersistenceError("");
      })
      .catch((error: unknown) => {
        setPersistenceError(
          error instanceof Error ? error.message : "The project could not be created.",
        );
        setReady(true);
      });
  }, []);

  useEffect(() => {
    window.addEventListener("actbyme:new-performance-project", createNewProject);
    return () => window.removeEventListener("actbyme:new-performance-project", createNewProject);
  }, [createNewProject]);

  const generateBrief = useCallback(async () => {
    if (!projectId || generatingBrief) return;

    setGeneratingBrief(true);
    setGenerationError("");

    try {
      await saveQueue.current;
      if (state.step !== "director") {
        const reviewSnapshot: WorkflowState = { ...state, step: "review" };
        await performanceProjectsApi.update(projectId, toSaveRequest(reviewSnapshot));
      }
      setState((current) => ({ ...current, step: "director" }));

      const generatedProject = await performanceProjectsApi.generateBrief(projectId);
      const persistedState = await addSignedTakeUrls(
        generatedProject.id,
        fromPersistedProject(generatedProject),
      );
      setState(persistedState);
      setPersistenceError("");
    } catch (error) {
      setGenerationError(
        error instanceof Error ? error.message : "The Director Brief could not be generated.",
      );
    } finally {
      setGeneratingBrief(false);
    }
  }, [generatingBrief, projectId, state]);

  const controller: WorkflowController = useMemo(
    () => ({
      projectId,
      state,
      generatingBrief,
      generationError,
      generateBrief,
      goTo,
      updateCompany: (patch) =>
        setState((current) => ({
          ...current,
          company: { ...current.company, ...patch },
        })),
      updateProject: (patch) =>
        setState((current) => ({
          ...current,
          project: { ...current.project, ...patch },
        })),
      updateBrief: (patch) =>
        setState((current) => ({
          ...current,
          brief: current.brief ? { ...current.brief, ...patch } : null,
        })),
      updateScene: (sceneId, patch) =>
        setState((current) => ({
          ...current,
          scenes: current.scenes.map((scene) =>
            scene.id === sceneId ? { ...scene, ...patch } : scene,
          ),
        })),
      setPerformerPath: (performerPath) => setState((current) => ({ ...current, performerPath })),
      createNewProject,
    }),
    [createNewProject, generateBrief, generatingBrief, generationError, goTo, projectId, state],
  );

  return (
    <main className="min-h-[calc(100vh-65px)] bg-[#070A12] text-[#e8e8f0]">
      <WorkflowStepBar step={state.step} />
      {persistenceError ? (
        <div className="mx-auto mt-5 max-w-3xl rounded-xl border border-[#FF9A44]/30 bg-[#FF9A44]/[0.06] px-4 py-3 text-sm text-[#FF9A44]">
          {persistenceError}
        </div>
      ) : null}
      {state.step === "company" ? <CompanyScreen controller={controller} /> : null}
      {state.step === "project" ? <ProjectScreen controller={controller} /> : null}
      {state.step === "review" ? <ReviewScreen controller={controller} /> : null}
      {state.step === "director" ? <DirectorProcessing controller={controller} /> : null}
      {!(["company", "project", "review", "director"] as WorkflowStep[]).includes(state.step) ? (
        <ProductionStep controller={controller} />
      ) : null}
    </main>
  );
}

function WorkflowStepBar({ step }: { step: WorkflowStep }) {
  const currentIndex = WORKFLOW_STEPS.findIndex((item) => item.id === step);

  return (
    <div className="border-b border-white/[0.04] bg-[#0A0E1A]/70">
      <div className="mx-auto max-w-[1400px] overflow-x-auto px-4 py-4 md:px-8 lg:px-10">
        <div className="flex min-w-[900px] items-center gap-1">
          {WORKFLOW_STEPS.map((item, index) => {
            const done = index < currentIndex;
            const active = index === currentIndex;

            return (
              <div className="contents" key={item.id}>
                {index > 0 ? (
                  <span
                    className={`h-px min-w-3 flex-1 ${done ? "bg-[#6C4DFF]" : "bg-white/[0.08]"}`}
                  />
                ) : null}
                <div className="flex shrink-0 flex-col items-center gap-1.5">
                  <span
                    className={`flex size-7 items-center justify-center rounded-full text-xs font-bold transition ${
                      active
                        ? "scale-110 bg-[#6C4DFF] text-white shadow-lg shadow-[#6C4DFF]/30"
                        : done
                          ? "bg-[#6C4DFF]/20 text-[#a78bfa]"
                          : "bg-white/[0.04] text-[#5a5a72]"
                    }`}
                  >
                    {done ? <Check className="size-3.5" /> : index + 1}
                  </span>
                  <span
                    className={`whitespace-nowrap text-[10px] font-medium ${
                      active ? "text-white" : done ? "text-[#a3a3b8]" : "text-[#5a5a72]"
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CompanyScreen({ controller }: { controller: WorkflowController }) {
  const { company } = controller.state;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const organizationTypes = [
    "Creative / Marketing Agency",
    "Production Company",
    "AI Video Studio",
    "Brand / In-house",
    "Freelance Director",
  ];

  function continueToProject() {
    const nextErrors: Record<string, string> = {};
    if (!company.name.trim()) nextErrors.name = "Company name is required";
    if (!company.contactName.trim()) nextErrors.contactName = "Contact name is required";
    if (!company.contactRole.trim()) nextErrors.contactRole = "Role is required";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) controller.goTo("project");
  }

  return (
    <WorkflowContainer size="small">
      <BackButton href="/" label="Back to home" />
      <PageHeading
        eyebrow="Step 1 of 2"
        icon={<Building2 className="size-5" />}
        intro="Tell us about your organization so we can tailor the performance request."
        title="Company Details"
      />
      <Panel className="p-6 lg:p-8">
        <div className="grid gap-5">
          <Field
            error={errors.name}
            label="Company Name"
            onChange={(value) => controller.updateCompany({ name: value })}
            required
            value={company.name}
          />
          <Field
            icon={<Globe2 className="size-4" />}
            label="Website"
            onChange={(value) => controller.updateCompany({ website: value })}
            value={company.website}
          />
          <ChoiceGroup
            label="Organization Type"
            onChange={(type) => controller.updateCompany({ type })}
            options={organizationTypes}
            value={company.type}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              error={errors.contactName}
              icon={<UserRound className="size-4" />}
              label="Contact Name"
              onChange={(value) => controller.updateCompany({ contactName: value })}
              required
              value={company.contactName}
            />
            <Field
              error={errors.contactRole}
              icon={<BriefcaseBusiness className="size-4" />}
              label="Contact Role"
              onChange={(value) => controller.updateCompany({ contactRole: value })}
              required
              value={company.contactRole}
            />
          </div>
        </div>
        <div className="mt-8 flex justify-end border-t border-white/[0.06] pt-6">
          <PrimaryButton onClick={continueToProject}>
            Continue <ArrowRight className="size-4" />
          </PrimaryButton>
        </div>
      </Panel>
    </WorkflowContainer>
  );
}

function ProjectScreen({ controller }: { controller: WorkflowController }) {
  const { project } = controller.state;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectTypes = [
    "AI-generated commercial",
    "Product launch",
    "Brand story",
    "Social media campaign",
    "Internal communication",
  ];
  const aiTools = ["Not decided yet", "Luma", "Runway", "Kling", "Seedance", "Other"];

  function continueToReview() {
    const nextErrors: Record<string, string> = {};
    if (!project.title.trim()) nextErrors.title = "Project title is required";
    if (!project.type.trim()) nextErrors.type = "Project type is required";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) controller.goTo("review");
  }

  return (
    <WorkflowContainer size="small">
      <ScreenBack onClick={() => controller.goTo("company")} label="Back" />
      <PageHeading
        eyebrow="Step 2 of 2"
        icon={<FileText className="size-5" />}
        intro="Define your project scope and upload the production brief."
        title="Project Details & Brief Upload"
      />
      <Panel className="p-6 lg:p-8">
        <div className="grid gap-5">
          <Field
            error={errors.title}
            label="Project Title"
            onChange={(title) => controller.updateProject({ title })}
            required
            value={project.title}
          />
          <ChoiceGroup
            label="Project Type"
            onChange={(type) => controller.updateProject({ type })}
            options={projectTypes}
            value={project.type}
          />
          {errors.type ? <p className="text-xs text-[#FF9A44]">{errors.type}</p> : null}
          <TextAreaField
            hint="Describe the outcome, audience, and message the performance should deliver."
            label="Production Objective"
            onChange={(objective) => controller.updateProject({ objective })}
            value={project.objective}
          />
          <Field
            icon={<MapPin className="size-4" />}
            label="Location"
            onChange={(label) => {
              const isRemote = label.trim().toLowerCase() === "remote";
              controller.updateProject({
                location: {
                  countryCode: null,
                  isRemote,
                  label,
                  latitude: null,
                  longitude: null,
                  placeId: null,
                  provider: isRemote ? "remote" : "manual",
                },
              });
            }}
            value={project.location.label}
          />
          <ChoiceGroup
            hint="Used only to tailor capture guidance. You remain in control of the final AI workflow."
            label="Target AI tool"
            onChange={(targetAiTool) => controller.updateProject({ targetAiTool })}
            options={aiTools}
            value={project.targetAiTool}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Language"
              onChange={(language) => controller.updateProject({ language })}
              value={project.language}
            />
            <Field
              label="Additional Notes"
              onChange={(notes) => controller.updateProject({ notes })}
              value={project.notes}
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-white">Production Brief Upload</p>
            {project.uploadFile ? (
              <div className="flex items-center justify-between rounded-xl border border-[#66E0C2]/30 bg-[#66E0C2]/[0.06] p-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-[#66E0C2]/15">
                    <FileText className="size-5 text-[#66E0C2]" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{project.uploadFile}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[#66E0C2]">
                      <CheckCircle2 className="size-3.5" /> Ready
                    </p>
                  </div>
                </div>
                <button
                  aria-label="Remove uploaded brief"
                  className="rounded-lg p-2 text-[#a3a3b8] transition hover:bg-white/5 hover:text-white"
                  onClick={() => controller.updateProject({ uploadFile: "" })}
                  type="button"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <div>
                <button
                  className="w-full rounded-xl border-2 border-dashed border-white/10 bg-[#0A0E1A]/50 p-8 text-center transition hover:border-white/20"
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  <Upload className="mx-auto mb-3 size-8 text-[#5a5a72]" />
                  <span className="block text-sm font-medium text-white">
                    Choose a production brief
                  </span>
                  <span className="mt-1 block text-xs text-[#5a5a72]">
                    PDF, DOCX, PNG, JPG, or MP4
                  </span>
                </button>
                <input
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.mp4"
                  className="hidden"
                  onChange={(event) =>
                    controller.updateProject({ uploadFile: event.target.files?.[0]?.name ?? "" })
                  }
                  ref={fileInputRef}
                  type="file"
                />
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-white/[0.06] pt-6">
          <SecondaryButton onClick={() => controller.goTo("company")}>
            <ArrowLeft className="size-4" /> Back
          </SecondaryButton>
          <PrimaryButton onClick={continueToReview}>
            Continue <ArrowRight className="size-4" />
          </PrimaryButton>
        </div>
      </Panel>
    </WorkflowContainer>
  );
}

function ReviewScreen({ controller }: { controller: WorkflowController }) {
  const { company, project } = controller.state;

  return (
    <WorkflowContainer size="small">
      <ScreenBack onClick={() => controller.goTo("project")} label="Back" />
      <PageHeading
        intro="Confirm your company and project details before the AI Director builds your brief."
        title="Setup Review"
      />
      <div className="space-y-5">
        <ReviewCard
          icon={<Building2 className="size-[18px] text-[#a78bfa]" />}
          onEdit={() => controller.goTo("company")}
          rows={[
            ["Company Name", company.name],
            ["Website", company.website],
            ["Organization Type", company.type],
            ["Contact", company.contactName],
            ["Role", company.contactRole],
          ]}
          title="Company"
        />
        <ReviewCard
          icon={<FileText className="size-[18px] text-[#66E0C2]" />}
          onEdit={() => controller.goTo("project")}
          rows={[
            ["Project Title", project.title],
            ["Project Type", project.type],
            ["Location", project.location.label],
            ["Target AI Tool", project.targetAiTool],
            ["Production Objective", project.objective],
            ["Uploaded Brief", project.uploadFile || "No file uploaded"],
          ]}
          title="Project"
        />
        <Panel className="border-[#6C4DFF]/20 bg-gradient-to-br from-[#6C4DFF]/[0.08] to-transparent p-6">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#6C4DFF]/20 shadow-lg shadow-[#6C4DFF]/20">
              <Sparkles className="size-6 text-[#a78bfa]" />
            </span>
            <div>
              <h2 className="font-bold text-white">AI Director is ready</h2>
              <p className="mt-1 text-sm leading-6 text-[#a3a3b8]">
                Your persisted project details will become an editable Director Brief with
                scene-by-scene performance direction, casting requirements, and a capture plan.
              </p>
            </div>
          </div>
        </Panel>
        <div className="flex items-center justify-between">
          <SecondaryButton onClick={() => controller.goTo("project")}>
            <ArrowLeft className="size-4" /> Back
          </SecondaryButton>
          <PrimaryButton
            disabled={controller.generatingBrief}
            onClick={() => void controller.generateBrief()}
          >
            {controller.generatingBrief ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {controller.generatingBrief ? "Starting..." : "Build Director Brief"}
          </PrimaryButton>
        </div>
        {controller.generationError ? (
          <p className="text-right text-sm text-[#FF9A44]">{controller.generationError}</p>
        ) : null}
      </div>
    </WorkflowContainer>
  );
}

function DirectorProcessing({ controller }: { controller: WorkflowController }) {
  return (
    <div className="relative flex min-h-[calc(100vh-150px)] items-center justify-center overflow-hidden px-5 py-12">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#6C4DFF]/[0.08] blur-[120px]" />
      <div className="relative w-full max-w-2xl">
        <div className="mb-10 text-center">
          <span className="mx-auto mb-6 flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-[#6C4DFF] to-[#4a2fb8] shadow-2xl shadow-[#6C4DFF]/40">
            <Sparkles className="size-10 text-white" />
          </span>
          <h1 className="text-2xl font-bold text-white">AI Director Processing</h1>
          <p className="mt-2 text-sm text-[#a3a3b8]">
            Building a structured brief for{" "}
            <span className="font-semibold text-[#a78bfa]">{controller.state.project.title}</span>
          </p>
        </div>
        {controller.generationError ? (
          <Panel className="border-[#FF9A44]/30 bg-[#FF9A44]/[0.05] p-6 text-center">
            <p className="text-sm leading-6 text-[#FF9A44]">{controller.generationError}</p>
            <div className="mt-5 flex justify-center gap-3">
              <SecondaryButton onClick={() => controller.goTo("review")}>Back</SecondaryButton>
              <PrimaryButton onClick={() => void controller.generateBrief()}>
                <Sparkles className="size-4" /> Retry
              </PrimaryButton>
            </div>
          </Panel>
        ) : (
          <Panel className="border-[#6C4DFF]/30 bg-[#6C4DFF]/[0.05] p-6">
            <div className="flex items-center gap-4">
              <Loader2 className="size-6 shrink-0 animate-spin text-[#a78bfa]" />
              <div>
                <p className="font-semibold text-white">Generating your Director Brief</p>
                <p className="mt-1 text-sm leading-6 text-[#a3a3b8]">
                  The AI Director is creating casting, scene, performance, camera, capture, and QA
                  guidance. The result is saved before this screen advances.
                </p>
              </div>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-[#6C4DFF] to-[#a78bfa]" />
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

function ReviewCard({
  icon,
  onEdit,
  rows,
  title,
}: {
  icon: React.ReactNode;
  onEdit: () => void;
  rows: string[][];
  title: string;
}) {
  return (
    <Panel className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-white/[0.04]">
            {icon}
          </span>
          <h2 className="text-lg font-bold text-white">{title}</h2>
        </div>
        <button
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-[#a3a3b8] hover:border-white/20 hover:text-white"
          onClick={onEdit}
          type="button"
        >
          Edit
        </button>
      </div>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map(([label, value], index) => (
          <div
            className={index === rows.length - 1 && rows.length > 5 ? "sm:col-span-2" : ""}
            key={label}
          >
            <dt className="text-xs text-[#5a5a72]">{label}</dt>
            <dd className="text-sm font-medium text-white">{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

export function WorkflowContainer({
  children,
  size = "wide",
}: {
  children: React.ReactNode;
  size?: "small" | "wide";
}) {
  return (
    <div
      className={`mx-auto px-5 py-10 md:px-6 lg:py-12 ${size === "small" ? "max-w-3xl" : "max-w-[1200px]"}`}
    >
      {children}
    </div>
  );
}

export function PageHeading({
  eyebrow,
  icon,
  intro,
  title,
}: {
  eyebrow?: string;
  icon?: React.ReactNode;
  intro?: string;
  title: string;
}) {
  return (
    <div className="mb-8">
      {eyebrow ? (
        <div className="mb-2 flex items-center gap-2 text-[#a78bfa]">
          {icon}
          <span className="text-sm font-semibold uppercase tracking-wide">{eyebrow}</span>
        </div>
      ) : null}
      <h1 className="text-3xl font-bold tracking-tight text-white">{title}</h1>
      {intro ? <p className="mt-2 leading-7 text-[#a3a3b8]">{intro}</p> : null}
    </div>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-white/[0.06] bg-[#0F1422]/60 ${className}`}>
      {children}
    </section>
  );
}

export function PrimaryButton({
  children,
  disabled = false,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#6C4DFF] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#6C4DFF]/25 transition hover:bg-[#7a5eff] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-2.5 text-sm font-medium text-[#a3a3b8] transition hover:border-white/20 hover:text-white"
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

export function ScreenBack({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      className="mb-6 flex items-center gap-2 text-sm font-medium text-[#a3a3b8] transition hover:text-white"
      onClick={onClick}
      type="button"
    >
      <ArrowLeft className="size-4" /> {label}
    </button>
  );
}

function BackButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      className="mb-6 flex items-center gap-2 text-sm font-medium text-[#a3a3b8] transition hover:text-white"
      href={href}
    >
      <ArrowLeft className="size-4" /> {label}
    </a>
  );
}

function Field({
  error,
  icon,
  label,
  onChange,
  required = false,
  value,
}: {
  error?: string;
  icon?: React.ReactNode;
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-white">
        {label} {required ? <span className="text-[#FF9A44]">*</span> : null}
      </span>
      <span className="relative block">
        {icon ? (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5a5a72]">{icon}</span>
        ) : null}
        <input
          className={`h-12 w-full rounded-xl border border-white/10 bg-[#0A0E1A] px-4 text-sm text-white outline-none transition placeholder:text-[#5a5a72] focus:border-[#6C4DFF]/60 ${icon ? "pl-11" : ""}`}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        />
      </span>
      {error ? <span className="mt-1 block text-xs text-[#FF9A44]">{error}</span> : null}
    </label>
  );
}

function TextAreaField({
  hint,
  label,
  onChange,
  value,
}: {
  hint?: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-white">{label}</span>
      <textarea
        className="min-h-28 w-full resize-none rounded-xl border border-white/10 bg-[#0A0E1A] px-4 py-3 text-sm leading-6 text-white outline-none transition focus:border-[#6C4DFF]/60"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
      {hint ? <span className="mt-1.5 block text-xs text-[#5a5a72]">{hint}</span> : null}
    </label>
  );
}

function ChoiceGroup({
  hint,
  label,
  onChange,
  options,
  value,
}: {
  hint?: string;
  label: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-white">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition ${
              value === option
                ? "border-[#6C4DFF] bg-[#6C4DFF]/15 text-white"
                : "border-white/10 bg-white/[0.02] text-[#a3a3b8] hover:border-white/20 hover:text-white"
            }`}
            key={option}
            onClick={() => onChange(option)}
            type="button"
          >
            {option}
          </button>
        ))}
      </div>
      {hint ? <p className="mt-1.5 text-xs text-[#5a5a72]">{hint}</p> : null}
    </div>
  );
}
