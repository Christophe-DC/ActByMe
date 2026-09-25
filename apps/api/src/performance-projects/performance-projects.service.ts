import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma } from "@actbyme/database";
import {
  ActorProfileStatus,
  PerformanceAssignmentStatus,
  PerformanceBriefAttachmentStatus,
  PerformancePath,
  PerformanceQaResultStatus,
  PerformanceQaRunStatus,
  PerformanceTakeStatus,
  PerformanceTakeUploadStatus,
  PerformanceWorkflowStatus,
} from "@actbyme/shared";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { PrismaService } from "../database/prisma.service.js";
import { STORAGE_CLIENT, type StorageClient } from "../storage/storage.types.js";
import type {
  SavePerformanceConsentDto,
  SavePerformanceProjectDto,
} from "./dto/performance-project.dto.js";
import type {
  CompletePerformanceBriefAttachmentUploadDto,
  CreatePerformanceBriefAttachmentUploadDto,
  FailPerformanceBriefAttachmentUploadDto,
} from "./dto/performance-brief-attachment.dto.js";
import { MAX_BRIEF_ATTACHMENT_BYTES } from "./dto/performance-brief-attachment.dto.js";
import type {
  CompletePerformanceTakeUploadDto,
  CreatePerformanceTakeUploadDto,
  FailPerformanceTakeUploadDto,
} from "./dto/performance-take.dto.js";
import { AiDirectorService } from "./ai-director.service.js";
import { BriefContentExtractorService } from "./brief-content-extractor.service.js";
import { PerformanceTechnicalQaService } from "./performance-technical-qa.service.js";
import {
  assignmentStatusForQaResult,
  assignmentStatusForReplacement,
  canAccessAssignedProject,
  recommendActors,
} from "./actor-matching.js";

const projectInclude = {
  assignment: {
    include: {
      actorProfile: {
        include: { accents: true, languages: true, skills: true },
      },
    },
  },
  brief: true,
  briefAttachment: true,
  consents: {
    orderBy: { version: "desc" as const },
    take: 1,
  },
  scenes: {
    include: {
      take: {
        include: {
          qaRuns: {
            include: {
              checks: {
                orderBy: { createdAt: "asc" as const },
              },
            },
            orderBy: { createdAt: "desc" as const },
          },
        },
      },
    },
    orderBy: {
      position: "asc" as const,
    },
  },
};

type PerformanceProjectWithDetails = Prisma.PerformanceProjectGetPayload<{
  include: typeof projectInclude;
}>;

@Injectable()
export class PerformanceProjectsService {
  private readonly logger = new Logger(PerformanceProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_CLIENT) private readonly storage: StorageClient,
    private readonly aiDirector: AiDirectorService,
    private readonly briefContentExtractor: BriefContentExtractorService,
    private readonly technicalQa: PerformanceTechnicalQaService,
  ) {}

  findCurrent(user: AuthenticatedUser): Promise<unknown> {
    return this.prisma.client.performanceProject
      .findFirst({
        include: projectInclude,
        orderBy: { updatedAt: "desc" },
        where: { ownerId: user.id },
      })
      .then((project) => {
        if (!project) {
          throw new NotFoundException("Performance project not found.");
        }
        return this.projectResponse(project);
      });
  }

  async create(user: AuthenticatedUser, dto: SavePerformanceProjectDto): Promise<unknown> {
    if (dto.workflowStatus !== PerformanceWorkflowStatus.Draft) {
      throw new BadRequestException("A new performance project must start as a draft.");
    }

    await this.ensureUser(user);

    const project = await this.prisma.client.performanceProject.create({
      data: this.toCreateData(user.id, dto),
      include: projectInclude,
    });

    await this.prisma.audit({
      action: "PERFORMANCE_PROJECT_CREATED",
      entityId: project.id,
      entityType: "PerformanceProject",
      metadata: { workflowStatus: project.workflowStatus },
      userId: user.id,
    });

    return this.projectResponse(project);
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: SavePerformanceProjectDto,
  ): Promise<unknown> {
    const ownedProject = await this.requireOwnedProject(user, id);
    const ownedSceneIds = new Set(ownedProject.scenes.map((scene) => scene.id));

    if (dto.scenes.some((scene) => scene.id && !ownedSceneIds.has(scene.id))) {
      throw new BadRequestException("A scene does not belong to this performance project.");
    }

    if (
      [
        PerformanceWorkflowStatus.GeneratingBrief,
        PerformanceWorkflowStatus.BriefReview,
        PerformanceWorkflowStatus.BriefApproved,
        PerformanceWorkflowStatus.PerformerSelection,
      ].includes(dto.workflowStatus) &&
      dto.workflowStatus !== ownedProject.workflowStatus
    ) {
      throw new BadRequestException("AI Director workflow states are managed by the server.");
    }

    if (ownedProject.workflowStatus === PerformanceWorkflowStatus.GeneratingBrief) {
      throw new ConflictException("The Director Brief is currently being generated.");
    }

    if (dto.brief && !ownedProject.brief) {
      throw new BadRequestException("Generate the Director Brief before editing it.");
    }

    if (ownedProject.brief?.approvedAt && dto.workflowStatus !== ownedProject.workflowStatus) {
      throw new ConflictException("Approved brief workflow states are managed by the server.");
    }

    const briefIsEditable = Boolean(ownedProject.brief && !ownedProject.brief.approvedAt);

    await this.prisma.client.$transaction([
      this.prisma.client.performanceProject.update({
        data: {
          ...this.toUpdateData(dto, briefIsEditable),
          ...(ownedProject.brief?.approvedAt ? { performerPath: ownedProject.performerPath } : {}),
        },
        where: { id: ownedProject.id, workflowStatus: ownedProject.workflowStatus },
      }),
      ...(briefIsEditable
        ? dto.scenes.map((scene, position) =>
            scene.id
              ? this.prisma.client.performanceScene.update({
                  data: this.sceneFields(scene, position),
                  where: { id: scene.id },
                })
              : this.prisma.client.performanceScene.create({
                  data: {
                    ...this.sceneFields(scene, position),
                    projectId: ownedProject.id,
                  },
                }),
          )
        : []),
    ]);

    return this.projectResponse(await this.requireOwnedProject(user, ownedProject.id));
  }

  async generateBrief(user: AuthenticatedUser, id: string): Promise<unknown> {
    const project = await this.requireOwnedProject(user, id);

    if (
      project.workflowStatus !== PerformanceWorkflowStatus.ReadyForBrief &&
      project.workflowStatus !== PerformanceWorkflowStatus.BriefReview &&
      project.workflowStatus !== PerformanceWorkflowStatus.GeneratingBrief
    ) {
      throw new ConflictException("Review the project details before building the Director Brief.");
    }

    if (
      project.workflowStatus === PerformanceWorkflowStatus.GeneratingBrief &&
      Date.now() - project.updatedAt.getTime() < 5 * 60 * 1000
    ) {
      throw new ConflictException("The Director Brief is already being generated.");
    }

    const suppliedScript = project.script?.trim() || project.briefAttachment?.extractedText?.trim();
    if (!project.title.trim() || !suppliedScript) {
      throw new BadRequestException("A project title and pasted or uploaded script are required.");
    }

    if (project.scenes.some((scene) => scene.take)) {
      throw new ConflictException(
        "The Director Brief cannot be regenerated after performance takes have been uploaded.",
      );
    }

    if (
      project.briefAttachment &&
      (project.briefAttachment.status !== PerformanceBriefAttachmentStatus.Ready ||
        !project.briefAttachment.extractedText)
    ) {
      throw new ConflictException(
        "Wait for the production brief to finish parsing, or remove and replace it.",
      );
    }

    await this.prisma.client.performanceProject.update({
      data: {
        currentStep: "director",
        workflowStatus: PerformanceWorkflowStatus.GeneratingBrief,
      },
      where: { id: project.id },
    });

    let failureStage = "provider";
    let generatedModel = "unknown";
    let generatedProvider = "unknown";

    try {
      const generated = await this.aiDirector.generate({
        company: {
          contactName: project.contactName,
          contactRole: project.contactRole,
          name: project.companyName,
          organizationType: project.organizationType,
          website: project.companyWebsite,
        },
        project: {
          language: project.language,
          location: project.locationData ?? {
            isRemote: project.location?.toLowerCase() === "remote",
            label: project.location,
            provider: "manual",
          },
          notes: project.notes,
          objective: project.objective,
          productionBriefText: project.briefAttachment?.extractedText ?? null,
          script: suppliedScript,
          targetAiTool: project.targetAiTool,
          title: project.title,
          type: project.type,
        },
      });
      generatedModel = generated.model;
      generatedProvider = generated.provider;
      failureStage = "persistence-and-workflow-transition";

      await this.prisma.client.$transaction([
        this.prisma.client.performanceBrief.upsert({
          create: {
            capturePlan: generated.brief.captureRequirements,
            globalDirection: generated.brief.globalDirection,
            model: generated.model,
            openaiResponseId: generated.responseId,
            projectId: project.id,
            qaCriteria: generated.brief.qaCriteria,
            talentRequirements: generated.brief.castingRequirements,
          },
          update: {
            approvedAt: null,
            approvedVersion: null,
            capturePlan: generated.brief.captureRequirements,
            generatedAt: new Date(),
            globalDirection: generated.brief.globalDirection,
            model: generated.model,
            openaiResponseId: generated.responseId,
            qaCriteria: generated.brief.qaCriteria,
            talentRequirements: generated.brief.castingRequirements,
            version: { increment: 1 },
          },
          where: { projectId: project.id },
        }),
        this.prisma.client.performanceScene.deleteMany({ where: { projectId: project.id } }),
        this.prisma.client.performanceAssignment.deleteMany({ where: { projectId: project.id } }),
        this.prisma.client.performanceScene.createMany({
          data: generated.brief.scenes.map((scene, position) => ({
            bodyPosition: scene.bodyMovement,
            captureRequirements: scene.captureRequirements,
            dialogue: scene.dialogue,
            direction: scene.actingIntent,
            emotionalProgression: scene.emotionalProgression,
            duration: scene.timing,
            eyeline: scene.eyeDirection,
            framing: scene.framingCamera,
            gestures: scene.gestures,
            position,
            projectId: project.id,
            startingPosition: scene.startingPosition,
            title: scene.title,
          })),
        }),
        this.prisma.client.performanceProject.update({
          data: {
            actorGuide: Prisma.DbNull,
            aiEnginePrompt: null,
            currentStep: "plan",
            outputsBriefVersion: null,
            outputsGeneratedAt: null,
            outputsModel: null,
            outputsProvider: null,
            outputsResponseId: null,
            performerPath: null,
            workflowStatus: PerformanceWorkflowStatus.BriefReview,
          },
          where: { id: project.id },
        }),
      ]);

      failureStage = "audit";
      await this.prisma.audit({
        action: "DIRECTOR_BRIEF_GENERATED",
        entityId: project.id,
        entityType: "PerformanceProject",
        metadata: {
          model: generated.model,
          provider: generated.provider,
          responseId: generated.responseId,
        },
        userId: user.id,
      });

      failureStage = "reload";
      return this.projectResponse(await this.requireOwnedProject(user, project.id));
    } catch (error) {
      this.logger.error(
        `AI Director failed stage=${failureStage} projectId=${project.id} provider=${generatedProvider} model=${generatedModel} errorName=${errorName(error)} errorCode=${errorCode(error)}`,
        stackFrames(error),
      );
      try {
        await this.prisma.client.performanceProject.updateMany({
          data: {
            currentStep: "review",
            workflowStatus: PerformanceWorkflowStatus.ReadyForBrief,
          },
          where: {
            id: project.id,
            ownerId: user.id,
            workflowStatus: PerformanceWorkflowStatus.GeneratingBrief,
          },
        });
      } catch (resetError) {
        this.logger.error(
          `AI Director workflow recovery failed projectId=${project.id} errorName=${errorName(resetError)} errorCode=${errorCode(resetError)}`,
          stackFrames(resetError),
        );
      }
      throw error;
    }
  }

  async approveBrief(user: AuthenticatedUser, id: string): Promise<unknown> {
    const project = await this.requireOwnedProject(user, id);

    if (!project.brief || project.scenes.length !== 1) {
      throw new ConflictException("Generate the Director Brief before approving it.");
    }

    if (
      project.workflowStatus === PerformanceWorkflowStatus.BriefApproved &&
      project.brief.approvedAt
    ) {
      return this.projectResponse(project);
    }

    if (project.workflowStatus !== PerformanceWorkflowStatus.BriefReview) {
      throw new ConflictException("The Director Brief is not ready for approval.");
    }

    const approvedAt = new Date();
    await this.prisma.client.$transaction([
      this.prisma.client.performanceBrief.update({
        data: {
          approvedAt,
          approvedVersion: project.brief.version,
        },
        where: { projectId: project.id },
      }),
      this.prisma.client.performanceProject.update({
        data: {
          currentStep: "actor",
          performerPath: null,
          workflowStatus: PerformanceWorkflowStatus.BriefApproved,
        },
        where: { id: project.id, workflowStatus: PerformanceWorkflowStatus.BriefReview },
      }),
    ]);

    await this.prisma.audit({
      action: "DIRECTOR_BRIEF_APPROVED",
      entityId: project.id,
      entityType: "PerformanceProject",
      metadata: { approvedAt: approvedAt.toISOString(), version: project.brief.version },
      userId: user.id,
    });

    return this.projectResponse(await this.requireOwnedProject(user, project.id));
  }

  async generateOutputs(user: AuthenticatedUser, id: string, force = false): Promise<unknown> {
    const project = await this.requireOwnedProject(user, id);
    if (
      !project.brief?.approvedAt ||
      !project.brief.approvedVersion ||
      project.brief.approvedVersion !== project.brief.version ||
      project.scenes.length !== 1
    ) {
      throw new ConflictException("Approve the current one-scene shooting plan first.");
    }
    if (
      project.actorGuide &&
      project.aiEnginePrompt &&
      project.outputsBriefVersion === project.brief.approvedVersion &&
      !force
    ) {
      return this.projectResponse(project);
    }

    if (force && project.assignment) {
      throw new ConflictException(
        "Outputs cannot be regenerated after an actor has been assigned.",
      );
    }

    const scene = project.scenes[0]!;
    const generated = await this.aiDirector.generateOutputs({
      approvedBriefVersion: project.brief.approvedVersion,
      captureRequirements: asRecord(project.brief.capturePlan),
      castingRequirements: asRecord(project.brief.talentRequirements),
      globalDirection: project.brief.globalDirection,
      project: {
        language: project.language,
        targetAiTool: project.targetAiTool,
        title: project.title,
      },
      qaCriteria: stringArray(project.brief.qaCriteria),
      scene: {
        bodyMovement: scene.bodyPosition,
        captureRequirements: scene.captureRequirements,
        dialogue: scene.dialogue,
        direction: scene.direction,
        duration: scene.duration,
        emotionalProgression: scene.emotionalProgression,
        eyeDirection: scene.eyeline,
        framing: scene.framing,
        gestures: scene.gestures,
        startingPosition: scene.startingPosition,
        title: scene.title,
      },
    });
    const generatedAt = new Date();
    await this.prisma.client.performanceProject.update({
      data: {
        actorGuide: generated.outputs.actorGuide as unknown as Prisma.InputJsonObject,
        aiEnginePrompt: generated.outputs.aiEnginePrompt,
        currentStep: "actor",
        outputsBriefVersion: project.brief.approvedVersion,
        outputsGeneratedAt: generatedAt,
        outputsModel: generated.model,
        outputsProvider: generated.provider,
        outputsResponseId: generated.responseId,
        performerPath: PerformancePath.ActByMePerformer,
        workflowStatus: PerformanceWorkflowStatus.ActorSelection,
      },
      where: { id: project.id },
    });
    await this.prisma.audit({
      action: "PERFORMANCE_OUTPUTS_GENERATED",
      entityId: project.id,
      entityType: "PerformanceProject",
      metadata: {
        approvedBriefVersion: project.brief.approvedVersion,
        force,
        generatedAt: generatedAt.toISOString(),
        model: generated.model,
        provider: generated.provider,
        responseId: generated.responseId,
      },
      userId: user.id,
    });
    return this.projectResponse(await this.requireOwnedProject(user, project.id));
  }

  async recommendActors(user: AuthenticatedUser, id: string) {
    const project = await this.requireOwnedProject(user, id);
    if (!project.brief?.approvedAt || !project.actorGuide || !project.aiEnginePrompt) {
      throw new ConflictException("Generate outputs from the approved shooting plan first.");
    }
    const actors = await this.prisma.client.actorProfile.findMany({
      include: { accents: true, languages: true, skills: true },
      where: { isDemo: false, status: ActorProfileStatus.Approved },
    });
    const casting = asRecord(project.brief.talentRequirements);
    const requirementText = [casting.performerProfile, casting.notes]
      .filter((value): value is string => typeof value === "string")
      .join(" ")
      .toLowerCase();
    const skills = [
      "acting",
      "voice",
      "comedy",
      "drama",
      "ugc ads",
      "corporate",
      "body movement",
      "emotional performance",
    ].filter((skill) => requirementText.includes(skill));
    const ranked = recommendActors(actors, {
      accent: stringValue(casting.accent),
      language: project.language || stringValue(casting.language),
      skills,
    });
    const byId = new Map(actors.map((actor) => [actor.id, actor]));
    return ranked.map((recommendation) => ({
      ...recommendation,
      actor: byId.get(recommendation.actorId),
    }));
  }

  async assignActor(user: AuthenticatedUser, id: string, actorProfileId: string) {
    const project = await this.requireOwnedProject(user, id);
    if (!project.actorGuide || !project.aiEnginePrompt || project.scenes.length !== 1) {
      throw new ConflictException(
        "Generate approved shooting-plan outputs before assigning an actor.",
      );
    }
    if (project.scenes[0]?.take) {
      throw new ConflictException("The actor cannot be changed after a performance upload starts.");
    }
    const actor = await this.prisma.client.actorProfile.findFirst({
      where: {
        id: actorProfileId,
        isDemo: false,
        status: ActorProfileStatus.Approved,
      },
    });
    if (!actor) throw new NotFoundException("Approved actor profile not found.");

    await this.prisma.client.$transaction([
      this.prisma.client.performanceAssignment.upsert({
        create: { actorProfileId, projectId: id },
        update: {
          acceptedAt: null,
          actorProfileId,
          status: PerformanceAssignmentStatus.Selected,
          submittedAt: null,
        },
        where: { projectId: id },
      }),
      this.prisma.client.performanceProject.update({
        data: {
          currentStep: "performance",
          performerPath: PerformancePath.ActByMePerformer,
          workflowStatus: PerformanceWorkflowStatus.PerformanceProgress,
        },
        where: { id },
      }),
    ]);
    await this.prisma.audit({
      action: "PERFORMANCE_ACTOR_ASSIGNED",
      actorProfileId,
      entityId: id,
      entityType: "PerformanceProject",
      metadata: { actorProfileId },
      userId: user.id,
    });
    return this.projectResponse(await this.requireOwnedProject(user, id));
  }

  async findActorRequests(user: AuthenticatedUser) {
    const assignments = await this.prisma.client.performanceAssignment.findMany({
      include: { project: { include: projectInclude } },
      orderBy: { updatedAt: "desc" },
      where: { actorProfile: { userId: user.id } },
    });
    return assignments.map((assignment) => this.actorRequestResponse(assignment));
  }

  async findActorRequest(user: AuthenticatedUser, assignmentId: string) {
    return this.actorRequestResponse(await this.requireActorAssignment(user, assignmentId));
  }

  async acceptActorRequest(user: AuthenticatedUser, assignmentId: string) {
    const assignment = await this.requireActorAssignment(user, assignmentId);
    if (assignment.status === PerformanceAssignmentStatus.Selected) {
      await this.prisma.client.performanceAssignment.update({
        data: { acceptedAt: new Date(), status: PerformanceAssignmentStatus.Accepted },
        where: { id: assignment.id },
      });
    }
    return this.findActorRequest(user, assignmentId);
  }

  async submitActorPerformance(user: AuthenticatedUser, assignmentId: string) {
    const assignment = await this.requireActorAssignment(user, assignmentId);
    const scene = assignment.project.scenes[0];
    const take = scene?.take;
    if (!scene || !take || take.uploadStatus !== PerformanceTakeUploadStatus.Uploaded) {
      throw new ConflictException("Upload the performance before submitting it.");
    }
    if (
      assignment.status !== PerformanceAssignmentStatus.Accepted &&
      assignment.status !== PerformanceAssignmentStatus.QaFailed
    ) {
      throw new ConflictException("Accept the request before submitting the performance.");
    }
    await this.prisma.client.performanceAssignment.update({
      data: {
        status: PerformanceAssignmentStatus.Submitted,
        submittedAt: new Date(),
      },
      where: { id: assignment.id },
    });
    try {
      await this.runTakeQa(user, assignment.projectId, scene.id, take.id);
    } catch (error) {
      await this.prisma.client.performanceAssignment.update({
        data: { status: PerformanceAssignmentStatus.QaFailed },
        where: { id: assignment.id },
      });
      throw error;
    }
    return this.findActorRequest(user, assignmentId);
  }

  async selectPerformerPath(
    user: AuthenticatedUser,
    id: string,
    performerPath: PerformancePath,
  ): Promise<unknown> {
    const project = await this.requireOwnedProject(user, id);

    if (!project.brief?.approvedAt || !project.brief.approvedVersion) {
      throw new ConflictException("Approve the Director Brief before selecting a performer path.");
    }

    if (
      !(
        [
          PerformanceWorkflowStatus.BriefApproved,
          PerformanceWorkflowStatus.PerformerSelection,
          PerformanceWorkflowStatus.PerformanceSource,
          PerformanceWorkflowStatus.ActorSelection,
          PerformanceWorkflowStatus.PerformanceProgress,
          PerformanceWorkflowStatus.QaPending,
        ] as string[]
      ).includes(project.workflowStatus)
    ) {
      throw new ConflictException("The project is not ready for performer selection.");
    }

    if (
      performerPath !== PerformancePath.Self &&
      project.scenes.some((scene) => Boolean(scene.take))
    ) {
      throw new ConflictException(
        "Delete the existing self-performance takes before changing performer path.",
      );
    }

    await this.prisma.client.performanceProject.update({
      data: {
        currentStep: performerPath === PerformancePath.Self ? "progress" : "source",
        performerPath,
        workflowStatus: PerformanceWorkflowStatus.PerformerSelection,
      },
      where: { id: project.id, workflowStatus: project.workflowStatus },
    });

    await this.prisma.audit({
      action: "PERFORMER_PATH_SELECTED",
      entityId: project.id,
      entityType: "PerformanceProject",
      metadata: { performerPath },
      userId: user.id,
    });

    return this.projectResponse(await this.requireOwnedProject(user, project.id));
  }

  async createBriefAttachmentUpload(
    user: AuthenticatedUser,
    projectId: string,
    dto: CreatePerformanceBriefAttachmentUploadDto,
  ) {
    this.assertSupportedBrief(dto.fileName, dto.contentType);
    const project = await this.requireOwnedProject(user, projectId);
    const uploadAttemptId = randomUUID();
    const upload = await this.storage.createPresignedUpload({
      contentType: dto.contentType,
      fileName: dto.fileName,
      namespace: "performance-brief",
      pathPrefix: `performance-brief/${user.id}/${projectId}`,
    });

    if (!upload.token) {
      throw new ServiceUnavailableException(
        "Production briefs require the configured Supabase Storage provider.",
      );
    }

    const previousStorageKey = project.briefAttachment
      ? this.storageKey(project.briefAttachment.storageBucket, project.briefAttachment.storagePath)
      : undefined;

    if (previousStorageKey && previousStorageKey !== upload.key) {
      await this.storage.deleteObject(previousStorageKey).catch(() => undefined);
    }

    const attachment = await this.prisma.client.performanceBriefAttachment.upsert({
      create: {
        contentType: dto.contentType,
        originalFileName: dto.fileName,
        projectId,
        sizeBytes: dto.sizeBytes,
        status: PerformanceBriefAttachmentStatus.Uploading,
        storageBucket: upload.bucket,
        storagePath: upload.path,
        uploadAttemptId,
      },
      update: {
        contentType: dto.contentType,
        extractedText: null,
        extractionError: null,
        originalFileName: dto.fileName,
        parsedAt: null,
        sizeBytes: dto.sizeBytes,
        status: PerformanceBriefAttachmentStatus.Uploading,
        storageBucket: upload.bucket,
        storagePath: upload.path,
        uploadedAt: null,
        uploadAttemptId,
      },
      where: { projectId },
    });

    await this.prisma.client.performanceProject.update({
      data: { sourceFileName: dto.fileName },
      where: { id: projectId },
    });

    return {
      attachment: this.attachmentResponse(attachment),
      upload: {
        bucket: upload.bucket,
        path: upload.path,
        token: upload.token,
        uploadUrl: upload.uploadUrl,
      },
    };
  }

  async completeBriefAttachmentUpload(
    user: AuthenticatedUser,
    projectId: string,
    attachmentId: string,
    dto: CompletePerformanceBriefAttachmentUploadDto,
  ) {
    const attachment = await this.requireOwnedBriefAttachment(user, projectId, attachmentId);
    this.assertCurrentAttempt(attachment.uploadAttemptId, dto.uploadAttemptId);
    const storageKey = this.storageKey(attachment.storageBucket, attachment.storagePath);

    try {
      const objectInfo = await this.storage.getObjectInfo(storageKey);
      if (
        !objectInfo.contentType ||
        objectInfo.contentType !== attachment.contentType ||
        !objectInfo.sizeBytes ||
        objectInfo.sizeBytes > MAX_BRIEF_ATTACHMENT_BYTES
      ) {
        throw new BadRequestException(
          "The uploaded object must be a PDF, DOCX, or TXT file under 20 MB.",
        );
      }

      const parsingUpdate = await this.prisma.client.performanceBriefAttachment.updateMany({
        data: {
          extractionError: null,
          sizeBytes: objectInfo.sizeBytes,
          status: PerformanceBriefAttachmentStatus.Parsing,
          uploadedAt: new Date(),
        },
        where: { id: attachment.id, uploadAttemptId: dto.uploadAttemptId },
      });

      if (parsingUpdate.count !== 1) {
        throw new ConflictException("This upload attempt is no longer current.");
      }

      const bytes = await this.storage.downloadObject(storageKey);
      if (!bytes.length || bytes.length > MAX_BRIEF_ATTACHMENT_BYTES) {
        throw new BadRequestException("The uploaded production brief is empty or too large.");
      }

      const extractedText = await this.briefContentExtractor.extract(attachment.contentType, bytes);
      const completedUpdate = await this.prisma.client.performanceBriefAttachment.updateMany({
        data: {
          extractedText,
          extractionError: null,
          parsedAt: new Date(),
          status: PerformanceBriefAttachmentStatus.Ready,
        },
        where: { id: attachment.id, uploadAttemptId: dto.uploadAttemptId },
      });

      if (completedUpdate.count !== 1) {
        throw new ConflictException("This upload attempt is no longer current.");
      }

      const completed = await this.prisma.client.performanceBriefAttachment.findUniqueOrThrow({
        where: { id: attachment.id },
      });

      await this.touchProject(projectId);
      return this.attachmentResponse(completed);
    } catch (error) {
      const message = this.attachmentErrorMessage(error);
      await this.prisma.client.performanceBriefAttachment.updateMany({
        data: {
          extractedText: null,
          extractionError: message,
          parsedAt: null,
          status: PerformanceBriefAttachmentStatus.Failed,
        },
        where: { id: attachment.id, uploadAttemptId: dto.uploadAttemptId },
      });

      if (error instanceof BadRequestException || error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException(message);
    }
  }

  async failBriefAttachmentUpload(
    user: AuthenticatedUser,
    projectId: string,
    attachmentId: string,
    dto: FailPerformanceBriefAttachmentUploadDto,
  ) {
    const attachment = await this.requireOwnedBriefAttachment(user, projectId, attachmentId);
    this.assertCurrentAttempt(attachment.uploadAttemptId, dto.uploadAttemptId);

    if (attachment.status === PerformanceBriefAttachmentStatus.Ready) {
      return this.attachmentResponse(attachment);
    }

    const failedUpdate = await this.prisma.client.performanceBriefAttachment.updateMany({
      data: {
        extractedText: null,
        extractionError: dto.message ?? "Upload failed.",
        parsedAt: null,
        status: PerformanceBriefAttachmentStatus.Failed,
      },
      where: { id: attachment.id, uploadAttemptId: dto.uploadAttemptId },
    });
    if (failedUpdate.count !== 1) {
      throw new ConflictException("This upload attempt is no longer current.");
    }

    const failed = await this.prisma.client.performanceBriefAttachment.findUniqueOrThrow({
      where: { id: attachment.id },
    });
    await this.storage
      .deleteObject(this.storageKey(attachment.storageBucket, attachment.storagePath))
      .catch(() => undefined);
    await this.touchProject(projectId);
    return this.attachmentResponse(failed);
  }

  async deleteBriefAttachment(user: AuthenticatedUser, projectId: string, attachmentId: string) {
    const attachment = await this.requireOwnedBriefAttachment(user, projectId, attachmentId);
    await this.storage
      .deleteObject(this.storageKey(attachment.storageBucket, attachment.storagePath))
      .catch(() => undefined);
    await this.prisma.client.$transaction(async (transaction) => {
      const deleted = await transaction.performanceBriefAttachment.deleteMany({
        where: { id: attachment.id, uploadAttemptId: attachment.uploadAttemptId },
      });
      if (deleted.count !== 1) {
        throw new ConflictException("This attachment has already been replaced.");
      }
      await transaction.performanceProject.update({
        data: { sourceFileName: null },
        where: { id: projectId },
      });
    });
    return { deleted: true };
  }

  async createTakeUpload(
    user: AuthenticatedUser,
    projectId: string,
    sceneId: string,
    dto: CreatePerformanceTakeUploadDto,
  ) {
    this.assertSupportedVideo(dto.fileName, dto.contentType);
    const project = await this.requireAccessibleProject(user, projectId);
    if (
      project.workflowStatus === PerformanceWorkflowStatus.ApprovedDelivery ||
      project.deliveryCompletedAt
    ) {
      throw new ConflictException("Completed delivery takes cannot be replaced.");
    }
    const ownerUpload =
      project.ownerId === user.id && project.performerPath === PerformancePath.Self;
    const actorUpload =
      project.assignment?.actorProfile.userId === user.id &&
      project.performerPath === PerformancePath.ActByMePerformer &&
      [PerformanceAssignmentStatus.Accepted, PerformanceAssignmentStatus.QaFailed].includes(
        project.assignment.status as PerformanceAssignmentStatus,
      );
    if (!project.brief?.approvedAt || (!ownerUpload && !actorUpload)) {
      throw new ConflictException(
        "Only the project owner using Self, or the assigned actor after acceptance, can upload this performance.",
      );
    }
    const scene = project.scenes.find((candidate) => candidate.id === sceneId);
    if (!scene) {
      throw new NotFoundException("Performance scene not found.");
    }
    const uploadAttemptId = randomUUID();
    const upload = await this.storage.createPresignedUpload({
      contentType: dto.contentType,
      fileName: dto.fileName,
      namespace: "performance-take",
      pathPrefix: `performance-take/${user.id}/${projectId}/${sceneId}`,
    });

    if (!upload.token) {
      throw new ServiceUnavailableException(
        "Performance takes require the configured Supabase Storage provider.",
      );
    }

    const previousStorageKey = scene.take
      ? this.storageKey(scene.take.storageBucket, scene.take.storagePath)
      : undefined;

    if (previousStorageKey && previousStorageKey !== upload.key) {
      await this.storage.deleteObject(previousStorageKey);
    }

    const take = await this.prisma.client.performanceTake.upsert({
      create: {
        contentType: dto.contentType,
        originalFileName: dto.fileName,
        projectId,
        sceneId,
        sizeBytes: dto.sizeBytes,
        storageBucket: upload.bucket,
        storagePath: upload.path,
        takeStatus: PerformanceTakeStatus.Draft,
        uploadAttemptId,
        uploadStatus: PerformanceTakeUploadStatus.Uploading,
      },
      update: {
        contentType: dto.contentType,
        originalFileName: dto.fileName,
        sizeBytes: dto.sizeBytes,
        storageBucket: upload.bucket,
        storagePath: upload.path,
        takeStatus: PerformanceTakeStatus.Draft,
        uploadAttemptId,
        uploadError: null,
        uploadedAt: null,
        uploadStatus: PerformanceTakeUploadStatus.Uploading,
      },
      where: { sceneId },
    });

    if (actorUpload && project.assignment) {
      await this.prisma.client.performanceAssignment.update({
        data: {
          status: assignmentStatusForReplacement(
            project.assignment.status,
          ) as PerformanceAssignmentStatus,
          submittedAt: null,
        },
        where: { id: project.assignment.id },
      });
    }

    await this.touchProject(projectId);

    return {
      take,
      upload: {
        bucket: upload.bucket,
        path: upload.path,
        token: upload.token,
        uploadUrl: upload.uploadUrl,
      },
    };
  }

  async completeTakeUpload(
    user: AuthenticatedUser,
    projectId: string,
    sceneId: string,
    takeId: string,
    dto: CompletePerformanceTakeUploadDto,
  ) {
    const take = await this.requireAccessibleTake(user, projectId, sceneId, takeId);
    this.assertCurrentAttempt(take.uploadAttemptId, dto.uploadAttemptId);

    const storageKey = this.storageKey(take.storageBucket, take.storagePath);
    if (take.uploadStatus === PerformanceTakeUploadStatus.Uploaded) {
      try {
        const readUrl = await this.storage.createSignedReadUrl(storageKey, 3600);
        return { ...take, readUrl };
      } catch {
        return take;
      }
    }
    if (take.uploadStatus !== PerformanceTakeUploadStatus.Uploading) {
      throw new ConflictException("This performance upload is not active.");
    }

    const objectInfo = await this.storage.getObjectInfo(storageKey);

    if (
      !objectInfo.contentType ||
      !["video/mp4", "video/quicktime"].includes(objectInfo.contentType) ||
      !objectInfo.sizeBytes ||
      objectInfo.sizeBytes > 2_000_000_000
    ) {
      await this.markTakeFailed(take.id, dto.uploadAttemptId, "Unsupported uploaded video.");
      void this.storage.deleteObject(storageKey).catch(() => undefined);
      throw new BadRequestException("The uploaded object must be an MP4 or MOV video.");
    }

    const update = await this.prisma.client.performanceTake.updateMany({
      data: {
        contentType: objectInfo.contentType,
        sizeBytes: objectInfo.sizeBytes,
        takeStatus: PerformanceTakeStatus.Submitted,
        uploadError: null,
        uploadedAt: new Date(),
        uploadStatus: PerformanceTakeUploadStatus.Uploaded,
      },
      where: {
        id: take.id,
        uploadAttemptId: dto.uploadAttemptId,
      },
    });

    if (update.count !== 1) {
      throw new ConflictException("This upload attempt is no longer current.");
    }

    await this.touchProject(projectId);
    const completedTake = await this.prisma.client.performanceTake.findUniqueOrThrow({
      where: { id: take.id },
    });
    try {
      const readUrl = await this.storage.createSignedReadUrl(storageKey, 3600);
      return { ...completedTake, readUrl };
    } catch {
      return completedTake;
    }
  }

  async failTakeUpload(
    user: AuthenticatedUser,
    projectId: string,
    sceneId: string,
    takeId: string,
    dto: FailPerformanceTakeUploadDto,
  ) {
    const take = await this.requireAccessibleTake(user, projectId, sceneId, takeId);
    this.assertCurrentAttempt(take.uploadAttemptId, dto.uploadAttemptId);

    if (take.uploadStatus === PerformanceTakeUploadStatus.Uploaded) {
      return take;
    }

    await this.markTakeFailed(take.id, dto.uploadAttemptId, dto.message ?? "Upload failed.");
    void this.storage
      .deleteObject(this.storageKey(take.storageBucket, take.storagePath))
      .catch(() => undefined);

    return this.prisma.client.performanceTake.findUniqueOrThrow({ where: { id: take.id } });
  }

  async getTakeReadUrl(
    user: AuthenticatedUser,
    projectId: string,
    sceneId: string,
    takeId: string,
  ) {
    const take = await this.requireAccessibleTake(user, projectId, sceneId, takeId);

    if (take.uploadStatus !== PerformanceTakeUploadStatus.Uploaded) {
      throw new ConflictException("The performance take has not finished uploading.");
    }

    return {
      expiresInSeconds: 3600,
      readUrl: await this.storage.createSignedReadUrl(
        this.storageKey(take.storageBucket, take.storagePath),
        3600,
      ),
    };
  }

  async completeDelivery(user: AuthenticatedUser, projectId: string) {
    const project = await this.requireOwnedProject(user, projectId);
    this.assertDeliveryReady(project);
    if (
      project.workflowStatus === PerformanceWorkflowStatus.ApprovedDelivery &&
      project.deliveryCompletedAt
    ) {
      return this.projectResponse(project);
    }

    const deliveryFiles = await Promise.all(
      project.scenes.map(async (scene) => {
        const take = scene.take!;
        return this.storage
          .getObjectInfo(this.storageKey(take.storageBucket, take.storagePath))
          .then((object) => Boolean(object.contentType && object.sizeBytes))
          .catch(() => false);
      }),
    );
    if (deliveryFiles.some((available) => !available)) {
      throw new ConflictException(
        "Every approved take must still be available in private storage before delivery.",
      );
    }
    const completedAt = new Date();
    const completed = await this.prisma.client.performanceProject.updateMany({
      data: {
        currentStep: "delivery",
        deliveryCompletedAt: completedAt,
        workflowStatus: PerformanceWorkflowStatus.ApprovedDelivery,
      },
      where: {
        deliveryCompletedAt: null,
        id: project.id,
        ownerId: user.id,
      },
    });
    if (completed.count !== 1) {
      const current = await this.requireOwnedProject(user, projectId);
      if (
        current.workflowStatus === PerformanceWorkflowStatus.ApprovedDelivery &&
        current.deliveryCompletedAt
      ) {
        return this.projectResponse(current);
      }
      throw new ConflictException("The delivery state changed before completion.");
    }

    await this.prisma.audit({
      action: "PERFORMANCE_DELIVERY_COMPLETED",
      entityId: project.id,
      entityType: "PerformanceProject",
      metadata: {
        approvedBriefVersion: project.brief!.approvedVersion,
        completedAt: completedAt.toISOString(),
        consentVersion: project.consents[0]!.version,
        sceneCount: project.scenes.length,
      },
      userId: user.id,
    });

    return this.projectResponse(await this.requireOwnedProject(user, projectId));
  }

  async saveConsent(user: AuthenticatedUser, projectId: string, dto: SavePerformanceConsentDto) {
    const project = await this.requireOwnedProject(user, projectId);
    this.assertConsentCanBeDocumented(project);
    const currentConsent = project.consents[0];

    if (currentConsent?.acceptedAt) {
      throw new ConflictException("The accepted consent version is immutable.");
    }

    const consentData = {
      aiTransformationAllowed: dto.aiTransformationAllowed ?? null,
      commercialUse: dto.commercialUse ?? null,
      modelTrainingAllowed: dto.modelTrainingAllowed ?? null,
      performerEmail: dto.performerEmail?.trim() || null,
      performerName: dto.performerName?.trim() || null,
      restrictions: dto.restrictions?.trim() || null,
      territory: dto.territory?.trim() || null,
      usageDuration: dto.usageDuration?.trim() || null,
      usagePurpose: dto.usagePurpose?.trim() || null,
    };
    const approvedBriefVersion = project.brief!.approvedVersion!;

    if (currentConsent && currentConsent.approvedBriefVersion === approvedBriefVersion) {
      await this.prisma.client.performanceConsent.update({
        data: consentData,
        where: { id: currentConsent.id },
      });
    } else {
      await this.prisma.client.performanceConsent.create({
        data: {
          ...consentData,
          approvedBriefVersion,
          projectId: project.id,
          version: (currentConsent?.version ?? 0) + 1,
        },
      });
    }

    await this.prisma.client.performanceProject.update({
      data: { currentStep: "consent" },
      where: { id: project.id },
    });
    await this.prisma.audit({
      action: "PERFORMANCE_CONSENT_DRAFT_SAVED",
      entityId: project.id,
      entityType: "PerformanceProject",
      metadata: { approvedBriefVersion },
      userId: user.id,
    });

    return this.projectResponse(await this.requireOwnedProject(user, projectId));
  }

  async acceptConsent(user: AuthenticatedUser, projectId: string) {
    const project = await this.requireOwnedProject(user, projectId);
    this.assertConsentCanBeDocumented(project);
    const consent = project.consents[0];

    if (!consent || consent.approvedBriefVersion !== project.brief!.approvedVersion) {
      throw new ConflictException("Review and save the consent details before acceptance.");
    }
    if (consent.acceptedAt) {
      return this.projectResponse(project);
    }
    if (
      !consent.performerName?.trim() ||
      !consent.performerEmail?.trim() ||
      !consent.usagePurpose?.trim() ||
      typeof consent.commercialUse !== "boolean" ||
      typeof consent.aiTransformationAllowed !== "boolean" ||
      typeof consent.modelTrainingAllowed !== "boolean" ||
      !consent.territory?.trim() ||
      !consent.usageDuration?.trim()
    ) {
      throw new BadRequestException(
        "Complete every required consent field and explicitly select each permission.",
      );
    }

    const acceptedAt = new Date();
    const accepted = await this.prisma.client.$transaction(async (transaction) => {
      const update = await transaction.performanceConsent.updateMany({
        data: { acceptedAt },
        where: { acceptedAt: null, id: consent.id },
      });
      if (update.count !== 1) {
        throw new ConflictException("The consent version changed before acceptance.");
      }
      await transaction.performanceProject.update({
        data: { currentStep: "consent" },
        where: { id: project.id },
      });
      return transaction.performanceConsent.findUniqueOrThrow({ where: { id: consent.id } });
    });

    await this.prisma.audit({
      action: "PERFORMANCE_CONSENT_ACCEPTED",
      entityId: accepted.id,
      entityType: "PerformanceConsent",
      metadata: {
        acceptedAt: acceptedAt.toISOString(),
        approvedBriefVersion: accepted.approvedBriefVersion,
        version: accepted.version,
      },
      userId: user.id,
    });

    return this.projectResponse(await this.requireOwnedProject(user, projectId));
  }

  async getApprovedTakeDeliveryUrls(
    user: AuthenticatedUser,
    projectId: string,
    sceneId: string,
    takeId: string,
  ) {
    const project = await this.requireOwnedProject(user, projectId);
    const scene = project.scenes.find((candidate) => candidate.id === sceneId);
    const take = scene?.take?.id === takeId ? scene.take : null;
    const assignedPerformancePassed =
      project.assignment?.status === PerformanceAssignmentStatus.QaPassed &&
      take?.takeStatus === PerformanceTakeStatus.QaPassed;
    const legacyDeliveryReady =
      project.workflowStatus === PerformanceWorkflowStatus.ApprovedDelivery &&
      Boolean(project.deliveryCompletedAt) &&
      take?.takeStatus === PerformanceTakeStatus.Approved;
    if (!scene || !take || (!assignedPerformancePassed && !legacyDeliveryReady)) {
      throw new NotFoundException("Approved delivery take not found.");
    }
    if (!assignedPerformancePassed) this.assertDeliveryReady(project);

    const storageKey = this.storageKey(take.storageBucket, take.storagePath);
    const expiresInSeconds = 600;
    const [playbackUrl, downloadUrl] = await Promise.all([
      this.storage.createSignedReadUrl(storageKey, expiresInSeconds),
      this.storage.createSignedReadUrl(storageKey, expiresInSeconds, {
        downloadFileName: take.originalFileName.replace(/[\r\n"]/g, "_").slice(0, 200),
      }),
    ]);

    return { downloadUrl, expiresInSeconds, playbackUrl };
  }

  async runTakeQa(user: AuthenticatedUser, projectId: string, sceneId: string, takeId: string) {
    const project = await this.requireAccessibleProject(user, projectId);
    if (
      project.workflowStatus === PerformanceWorkflowStatus.ApprovedDelivery ||
      project.deliveryCompletedAt
    ) {
      throw new ConflictException("Completed delivery QA results are locked.");
    }
    const scene = project.scenes.find((candidate) => candidate.id === sceneId);
    const take = scene?.take?.id === takeId ? scene.take : null;

    if (!scene || !take) {
      throw new NotFoundException("Performance take not found.");
    }
    if (
      ![PerformancePath.Self, PerformancePath.ActByMePerformer].includes(
        project.performerPath as PerformancePath,
      ) ||
      !project.brief?.approvedAt ||
      !project.brief.approvedVersion
    ) {
      throw new ConflictException(
        "Technical QA requires an approved shooting plan and an authorized performer.",
      );
    }
    if (take.uploadStatus !== PerformanceTakeUploadStatus.Uploaded || !take.uploadedAt) {
      throw new ConflictException("Upload a real performance video before running technical QA.");
    }
    if (take.takeStatus === PerformanceTakeStatus.Approved) {
      throw new ConflictException("This performance take is already approved.");
    }

    const activeRun = take.qaRuns.find(
      (run) =>
        run.uploadAttemptId === take.uploadAttemptId &&
        run.status === PerformanceQaRunStatus.Running,
    );
    if (activeRun) {
      if (Date.now() - activeRun.startedAt.getTime() < 15 * 60 * 1000) {
        throw new ConflictException("Technical QA is already running for this take.");
      }
      await this.prisma.client.$transaction([
        this.prisma.client.performanceQaRun.update({
          data: {
            completedAt: new Date(),
            processingError: "The previous technical QA run was interrupted. Retry the run.",
            status: PerformanceQaRunStatus.Error,
          },
          where: { id: activeRun.id },
        }),
        this.prisma.client.performanceTake.updateMany({
          data: { takeStatus: PerformanceTakeStatus.Submitted },
          where: {
            id: takeId,
            takeStatus: PerformanceTakeStatus.QaRunning,
            uploadAttemptId: take.uploadAttemptId,
          },
        }),
      ]);
    }

    const storageKey = this.storageKey(take.storageBucket, take.storagePath);
    const objectInfo = await this.storage.getObjectInfo(storageKey).catch(() => null);
    if (
      !objectInfo?.contentType ||
      !["video/mp4", "video/quicktime"].includes(objectInfo.contentType) ||
      !objectInfo.sizeBytes ||
      objectInfo.sizeBytes > 2_000_000_000
    ) {
      throw new ConflictException("The uploaded performance video is no longer available.");
    }

    const qaRun = await this.prisma.client.$transaction(async (transaction) => {
      const claimed = await transaction.performanceTake.updateMany({
        data: { takeStatus: PerformanceTakeStatus.QaRunning },
        where: {
          id: takeId,
          takeStatus: {
            in: [
              PerformanceTakeStatus.Submitted,
              PerformanceTakeStatus.QaFailed,
              PerformanceTakeStatus.QaPassed,
            ],
          },
          uploadAttemptId: take.uploadAttemptId,
          uploadStatus: PerformanceTakeUploadStatus.Uploaded,
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException("Technical QA is already running for this take.");
      }
      const run = await transaction.performanceQaRun.create({
        data: {
          approvedBriefVersion: project.brief!.approvedVersion!,
          projectId,
          sceneId,
          takeId,
          uploadAttemptId: take.uploadAttemptId,
        },
      });
      await transaction.performanceProject.update({
        data: {
          currentStep: "qa",
          workflowStatus: PerformanceWorkflowStatus.QaPending,
        },
        where: { id: projectId },
      });
      if (project.assignment) {
        await transaction.performanceAssignment.update({
          data: { status: PerformanceAssignmentStatus.QaRunning },
          where: { id: project.assignment.id },
        });
      }
      return run;
    });

    try {
      const signedUrl = await this.storage.createSignedReadUrl(storageKey, 1800);
      const evaluated = await this.technicalQa.evaluate({
        capturePlan: project.brief.capturePlan,
        file: {
          contentType: objectInfo.contentType,
          originalFileName: take.originalFileName,
          signedUrl,
          sizeBytes: objectInfo.sizeBytes,
        },
        language: project.language,
        scene: {
          captureRequirements: scene.captureRequirements,
          dialogue: scene.dialogue,
          duration: scene.duration,
          framing: scene.framing,
        },
      });
      const result = evaluated.checks.some(
        (check) => check.result === PerformanceQaResultStatus.Fail,
      )
        ? PerformanceQaResultStatus.Fail
        : PerformanceQaResultStatus.Pass;

      await this.prisma.client.$transaction(async (transaction) => {
        const currentTake = await transaction.performanceTake.findUnique({
          where: { id: takeId },
        });
        if (!currentTake || currentTake.uploadAttemptId !== take.uploadAttemptId) {
          throw new ConflictException("The take was replaced while technical QA was running.");
        }

        await transaction.performanceQaCheckResult.createMany({
          data: evaluated.checks.map((check) => ({
            correctionInstruction: check.correctionInstruction,
            measuredValue: check.measuredValue as Prisma.InputJsonObject,
            qaRunId: qaRun.id,
            requiredValue: check.requiredValue
              ? (check.requiredValue as Prisma.InputJsonObject)
              : Prisma.JsonNull,
            result: check.result,
            type: check.type,
          })),
        });
        await transaction.performanceQaRun.update({
          data: {
            completedAt: new Date(),
            result,
            status: PerformanceQaRunStatus.Completed,
            transcript: evaluated.transcript,
            transcriptionModel: evaluated.transcriptionModel,
          },
          where: { id: qaRun.id },
        });
        const completed = await transaction.performanceTake.updateMany({
          data: {
            takeStatus:
              result === PerformanceQaResultStatus.Pass
                ? PerformanceTakeStatus.QaPassed
                : PerformanceTakeStatus.QaFailed,
          },
          where: {
            id: takeId,
            takeStatus: PerformanceTakeStatus.QaRunning,
            uploadAttemptId: take.uploadAttemptId,
          },
        });
        if (completed.count !== 1) {
          throw new ConflictException("The take was replaced while technical QA was running.");
        }
        if (project.assignment) {
          await transaction.performanceAssignment.update({
            data: {
              status: assignmentStatusForQaResult(result) as PerformanceAssignmentStatus,
            },
            where: { id: project.assignment.id },
          });
        }
        await transaction.performanceProject.update({
          data: {
            currentStep: "performance",
            deliveryCompletedAt: result === PerformanceQaResultStatus.Pass ? new Date() : null,
            workflowStatus:
              result === PerformanceQaResultStatus.Pass
                ? PerformanceWorkflowStatus.ApprovedDelivery
                : PerformanceWorkflowStatus.PerformanceProgress,
          },
          where: { id: projectId },
        });
      });

      await this.prisma.audit({
        action: "PERFORMANCE_TAKE_QA_COMPLETED",
        entityId: qaRun.id,
        entityType: "PerformanceQaRun",
        metadata: { result, sceneId, takeId },
        userId: user.id,
      });
      if (project.ownerId === user.id) {
        return this.projectResponse(await this.requireOwnedProject(user, projectId));
      }
      return this.findActorRequest(user, project.assignment!.id);
    } catch (error) {
      const message = this.qaProcessingErrorMessage(error);
      await this.prisma.client.$transaction([
        this.prisma.client.performanceQaRun.updateMany({
          data: {
            completedAt: new Date(),
            processingError: message,
            status: PerformanceQaRunStatus.Error,
          },
          where: { id: qaRun.id, status: PerformanceQaRunStatus.Running },
        }),
        this.prisma.client.performanceTake.updateMany({
          data: { takeStatus: PerformanceTakeStatus.Submitted },
          where: {
            id: takeId,
            takeStatus: PerformanceTakeStatus.QaRunning,
            uploadAttemptId: take.uploadAttemptId,
          },
        }),
        ...(project.assignment
          ? [
              this.prisma.client.performanceAssignment.update({
                data: { status: PerformanceAssignmentStatus.QaFailed },
                where: { id: project.assignment.id },
              }),
            ]
          : []),
      ]);
      if (error instanceof ConflictException) throw error;
      throw new ServiceUnavailableException(message);
    }
  }

  async approveTake(user: AuthenticatedUser, projectId: string, sceneId: string, takeId: string) {
    const take = await this.requireOwnedTake(user, projectId, sceneId, takeId);
    if (take.uploadStatus !== PerformanceTakeUploadStatus.Uploaded) {
      throw new ConflictException("Only an uploaded performance take can be approved.");
    }
    if (take.takeStatus === PerformanceTakeStatus.Approved) {
      return this.projectResponse(await this.requireOwnedProject(user, projectId));
    }
    if (take.takeStatus !== PerformanceTakeStatus.QaPassed) {
      throw new ConflictException("The current take must pass technical QA before approval.");
    }

    const latestRun = await this.prisma.client.performanceQaRun.findFirst({
      orderBy: { createdAt: "desc" },
      where: {
        projectId,
        result: PerformanceQaResultStatus.Pass,
        sceneId,
        status: PerformanceQaRunStatus.Completed,
        takeId,
        uploadAttemptId: take.uploadAttemptId,
      },
    });
    if (!latestRun) {
      throw new ConflictException("The passing QA result does not belong to the current upload.");
    }

    const approved = await this.prisma.client.performanceTake.updateMany({
      data: { takeStatus: PerformanceTakeStatus.Approved },
      where: {
        id: takeId,
        takeStatus: PerformanceTakeStatus.QaPassed,
        uploadAttemptId: take.uploadAttemptId,
        uploadStatus: PerformanceTakeUploadStatus.Uploaded,
      },
    });
    if (approved.count !== 1) {
      throw new ConflictException(
        "The take changed before approval. Review its current QA result.",
      );
    }
    await this.prisma.audit({
      action: "PERFORMANCE_TAKE_APPROVED",
      entityId: takeId,
      entityType: "PerformanceTake",
      metadata: { qaRunId: latestRun.id, sceneId },
      userId: user.id,
    });
    await this.touchProject(projectId);
    return this.projectResponse(await this.requireOwnedProject(user, projectId));
  }

  async deleteTake(user: AuthenticatedUser, projectId: string, sceneId: string, takeId: string) {
    const project = await this.requireAccessibleProject(user, projectId);
    if (
      project.workflowStatus === PerformanceWorkflowStatus.ApprovedDelivery ||
      project.deliveryCompletedAt
    ) {
      throw new ConflictException("Completed delivery takes cannot be deleted.");
    }
    const scene = project.scenes.find((candidate) => candidate.id === sceneId);
    const take = scene?.take?.id === takeId ? scene.take : null;
    if (!take) {
      throw new NotFoundException("Performance take not found.");
    }
    await this.storage.deleteObject(this.storageKey(take.storageBucket, take.storagePath));
    await this.prisma.client.performanceTake.delete({ where: { id: take.id } });
    await this.touchProject(projectId);
    return { deleted: true };
  }

  private async requireAccessibleProject(user: AuthenticatedUser, id: string) {
    const project = await this.prisma.client.performanceProject.findUnique({
      include: projectInclude,
      where: { id },
    });
    if (
      !project ||
      !canAccessAssignedProject({
        assignedActorUserId: project.assignment?.actorProfile.userId,
        ownerId: project.ownerId,
        userId: user.id,
      })
    ) {
      throw new NotFoundException("Performance project not found.");
    }
    return project;
  }

  private async requireActorAssignment(user: AuthenticatedUser, assignmentId: string) {
    const assignment = await this.prisma.client.performanceAssignment.findFirst({
      include: { project: { include: projectInclude } },
      where: { actorProfile: { userId: user.id }, id: assignmentId },
    });
    if (!assignment) throw new NotFoundException("Performance request not found.");
    return assignment;
  }

  private actorRequestResponse<
    T extends {
      acceptedAt: Date | null;
      createdAt: Date;
      id: string;
      status: string;
      submittedAt: Date | null;
      updatedAt: Date;
      project: PerformanceProjectWithDetails;
    },
  >(assignment: T) {
    const scene = assignment.project.scenes[0] ?? null;
    const take = scene?.take;
    return {
      acceptedAt: assignment.acceptedAt,
      actorGuide: assignment.project.actorGuide,
      createdAt: assignment.createdAt,
      id: assignment.id,
      project: {
        id: assignment.project.id,
        language: assignment.project.language,
        title: assignment.project.title,
      },
      scene: scene
        ? {
            dialogue: scene.dialogue,
            duration: scene.duration,
            id: scene.id,
            take: take
              ? {
                  contentType: take.contentType,
                  id: take.id,
                  originalFileName: take.originalFileName,
                  qaRuns: take.qaRuns,
                  takeStatus: take.takeStatus,
                  uploadedAt: take.uploadedAt,
                  uploadAttemptId: take.uploadAttemptId,
                  uploadError: take.uploadError,
                  uploadStatus: take.uploadStatus,
                }
              : null,
          }
        : null,
      status: assignment.status,
      submittedAt: assignment.submittedAt,
      updatedAt: assignment.updatedAt,
    };
  }

  private async requireOwnedProject(user: AuthenticatedUser, id: string) {
    const project = await this.prisma.client.performanceProject.findFirst({
      include: projectInclude,
      where: {
        id,
        ownerId: user.id,
      },
    });

    if (!project) {
      throw new NotFoundException("Performance project not found.");
    }

    return project;
  }

  private assertDeliveryReady(project: PerformanceProjectWithDetails) {
    if (
      project.performerPath !== PerformancePath.Self ||
      !project.brief?.approvedAt ||
      !project.brief.approvedVersion ||
      project.brief.approvedVersion !== project.brief.version
    ) {
      throw new ConflictException(
        "Delivery requires the currently approved Director Brief and the Self performer path.",
      );
    }
    if (project.scenes.length === 0) {
      throw new ConflictException("Delivery requires at least one approved scene take.");
    }
    const consent = project.consents[0];
    if (!consent?.acceptedAt || consent.approvedBriefVersion !== project.brief.approvedVersion) {
      throw new ConflictException("Review and accept the current consent version before delivery.");
    }

    const incompleteScene = project.scenes.find((scene) => {
      const take = scene.take;
      if (
        !take ||
        take.uploadStatus !== PerformanceTakeUploadStatus.Uploaded ||
        take.takeStatus !== PerformanceTakeStatus.Approved
      ) {
        return true;
      }
      return !take.qaRuns.some(
        (run) =>
          run.approvedBriefVersion === project.brief!.approvedVersion &&
          run.result === PerformanceQaResultStatus.Pass &&
          run.status === PerformanceQaRunStatus.Completed &&
          run.uploadAttemptId === take.uploadAttemptId,
      );
    });
    if (incompleteScene) {
      throw new ConflictException(
        `Scene "${incompleteScene.title}" needs a QA-passed, approved take before delivery.`,
      );
    }
  }

  private assertConsentCanBeDocumented(project: PerformanceProjectWithDetails) {
    if (
      project.performerPath !== PerformancePath.Self ||
      !project.brief?.approvedAt ||
      !project.brief.approvedVersion ||
      project.brief.approvedVersion !== project.brief.version
    ) {
      throw new ConflictException(
        "Consent documentation requires the current approved Director Brief and SELF performer path.",
      );
    }
    if (
      project.workflowStatus === PerformanceWorkflowStatus.ApprovedDelivery ||
      project.deliveryCompletedAt
    ) {
      throw new ConflictException("Completed delivery consent is locked.");
    }
  }

  private async requireOwnedScene(user: AuthenticatedUser, projectId: string, sceneId: string) {
    const scene = await this.prisma.client.performanceScene.findFirst({
      include: { take: true },
      where: {
        id: sceneId,
        project: { ownerId: user.id },
        projectId,
      },
    });

    if (!scene) {
      throw new NotFoundException("Performance scene not found.");
    }

    return scene;
  }

  private async requireOwnedTake(
    user: AuthenticatedUser,
    projectId: string,
    sceneId: string,
    takeId: string,
  ) {
    const take = await this.prisma.client.performanceTake.findFirst({
      where: {
        id: takeId,
        project: { ownerId: user.id },
        projectId,
        sceneId,
      },
    });

    if (!take) {
      throw new NotFoundException("Performance take not found.");
    }

    return take;
  }

  private async requireAccessibleTake(
    user: AuthenticatedUser,
    projectId: string,
    sceneId: string,
    takeId: string,
  ) {
    await this.requireAccessibleProject(user, projectId);
    const take = await this.prisma.client.performanceTake.findFirst({
      where: {
        id: takeId,
        projectId,
        sceneId,
      },
    });
    if (!take) throw new NotFoundException("Performance take not found.");
    return take;
  }

  private async requireOwnedBriefAttachment(
    user: AuthenticatedUser,
    projectId: string,
    attachmentId: string,
  ) {
    const attachment = await this.prisma.client.performanceBriefAttachment.findFirst({
      where: {
        id: attachmentId,
        project: { ownerId: user.id },
        projectId,
      },
    });

    if (!attachment) {
      throw new NotFoundException("Production brief attachment not found.");
    }

    return attachment;
  }

  private ensureUser(user: AuthenticatedUser) {
    return this.prisma.client.user.upsert({
      create: {
        email: user.email ?? `${user.id}@mock.actbyme.test`,
        id: user.id,
        role: user.role,
      },
      update: {
        ...(user.email ? { email: user.email } : {}),
      },
      where: { id: user.id },
    });
  }

  private toCreateData(
    ownerId: string,
    dto: SavePerformanceProjectDto,
  ): Prisma.PerformanceProjectCreateInput {
    return {
      ...this.projectFields(dto),
      owner: {
        connect: { id: ownerId },
      },
      scenes: {
        create: dto.scenes.map((scene, position) => this.sceneFields(scene, position)),
      },
    };
  }

  private toUpdateData(
    dto: SavePerformanceProjectDto,
    briefIsEditable: boolean,
  ): Prisma.PerformanceProjectUpdateInput {
    return {
      ...this.projectFields(dto),
      ...(dto.brief && briefIsEditable
        ? {
            brief: {
              update: this.briefFields(dto.brief),
            },
          }
        : {}),
    };
  }

  private projectFields(dto: SavePerformanceProjectDto) {
    return {
      companyName: dto.company.name,
      companyWebsite: dto.company.website,
      contactName: dto.company.contactName,
      contactRole: dto.company.contactRole,
      currentStep: dto.currentStep,
      language: dto.project.language,
      location: dto.project.location.label,
      locationData: dto.project.location as unknown as Prisma.InputJsonObject,
      notes: dto.project.notes,
      script: dto.project.script ?? null,
      objective: dto.project.objective,
      organizationType: dto.company.type,
      performerPath: dto.performerPath ?? null,
      targetAiTool: dto.project.targetAiTool,
      title: dto.project.title,
      type: dto.project.type,
      workflowStatus: dto.workflowStatus,
    };
  }

  private briefFields(brief: NonNullable<SavePerformanceProjectDto["brief"]>) {
    return {
      capturePlan: brief.capturePlan as Prisma.InputJsonValue,
      globalDirection: brief.globalDirection,
      qaCriteria: brief.qaCriteria as Prisma.InputJsonValue,
      talentRequirements: brief.talentRequirements as Prisma.InputJsonValue,
    };
  }

  private sceneFields(scene: SavePerformanceProjectDto["scenes"][number], position: number) {
    return {
      bodyPosition: scene.bodyPosition,
      dialogue: scene.dialogue,
      direction: scene.direction,
      emotionalProgression: scene.emotionalProgression,
      duration: scene.duration,
      eyeline: scene.eyeline,
      framing: scene.framing,
      gestures: scene.gestures,
      captureRequirements: scene.captureRequirements,
      position,
      referenceUrl: scene.reference,
      title: scene.title,
      startingPosition: scene.startingPosition,
    };
  }

  private assertSupportedVideo(fileName: string, contentType: string) {
    const normalizedFileName = fileName.toLowerCase();
    const validPair =
      (normalizedFileName.endsWith(".mp4") && contentType === "video/mp4") ||
      (normalizedFileName.endsWith(".mov") && contentType === "video/quicktime");

    if (!validPair) {
      throw new BadRequestException("Only MP4 and MOV video files are supported.");
    }
  }

  private assertSupportedBrief(fileName: string, contentType: string) {
    const normalizedFileName = fileName.toLowerCase();
    const validPair =
      (normalizedFileName.endsWith(".pdf") && contentType === "application/pdf") ||
      (normalizedFileName.endsWith(".docx") &&
        contentType ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document") ||
      (normalizedFileName.endsWith(".txt") && contentType === "text/plain");

    if (!validPair) {
      throw new BadRequestException("Only PDF, DOCX, and TXT production briefs are supported.");
    }
  }

  private attachmentErrorMessage(error: unknown) {
    if (error instanceof BadRequestException || error instanceof ConflictException) {
      const response = error.getResponse();
      if (typeof response === "string") return response;
      if (typeof response === "object" && response && "message" in response) {
        const message = (response as { message?: string | string[] }).message;
        return Array.isArray(message) ? message.join(", ") : (message ?? "Parsing failed.");
      }
    }

    return "The production brief could not be parsed. Remove it or upload a replacement.";
  }

  private qaProcessingErrorMessage(error: unknown) {
    if (
      error instanceof BadRequestException ||
      error instanceof ConflictException ||
      error instanceof ServiceUnavailableException
    ) {
      const response = error.getResponse();
      if (typeof response === "string") return response;
      if (typeof response === "object" && response && "message" in response) {
        const message = (response as { message?: string | string[] }).message;
        return Array.isArray(message) ? message.join(", ") : (message ?? "Technical QA failed.");
      }
    }
    return "Technical QA could not complete. Retry the run after checking the media tools and speech-to-text configuration.";
  }

  private attachmentResponse<
    T extends {
      extractedText: string | null;
    },
  >(attachment: T) {
    const { extractedText: _extractedText, ...response } = attachment;
    return response;
  }

  private projectResponse<
    T extends {
      briefAttachment: { extractedText: string | null } | null;
      consents: unknown[];
    },
  >(project: T) {
    const { consents, ...projectFields } = project;
    return {
      ...projectFields,
      briefAttachment: project.briefAttachment
        ? this.attachmentResponse(project.briefAttachment)
        : null,
      consent: consents[0] ?? null,
    };
  }

  private assertCurrentAttempt(currentAttemptId: string, suppliedAttemptId: string) {
    if (currentAttemptId !== suppliedAttemptId) {
      throw new ConflictException("This upload attempt is no longer current.");
    }
  }

  private async markTakeFailed(takeId: string, uploadAttemptId: string, uploadError: string) {
    const update = await this.prisma.client.performanceTake.updateMany({
      data: {
        takeStatus: PerformanceTakeStatus.Draft,
        uploadError,
        uploadStatus: PerformanceTakeUploadStatus.Failed,
      },
      where: { id: takeId, uploadAttemptId },
    });

    if (update.count !== 1) {
      throw new ConflictException("This upload attempt is no longer current.");
    }
  }

  private touchProject(projectId: string) {
    return this.prisma.client.performanceProject.update({
      data: { updatedAt: new Date() },
      where: { id: projectId },
    });
  }

  private storageKey(bucket: string, path: string) {
    return `${bucket}/${path}`;
  }
}

function errorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = error.code;
    if (typeof code === "string" || typeof code === "number") return String(code);
  }
  return "unknown";
}

function errorName(error: unknown) {
  return error instanceof Error ? error.name : typeof error;
}

function stackFrames(error: unknown) {
  return error instanceof Error ? error.stack?.split("\n").slice(1).join("\n") : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
