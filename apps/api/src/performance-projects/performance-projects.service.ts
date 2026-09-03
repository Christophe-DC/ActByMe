import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma } from "@actbyme/database";
import {
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
import type { SavePerformanceProjectDto } from "./dto/performance-project.dto.js";
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

const projectInclude = {
  brief: true,
  briefAttachment: true,
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

@Injectable()
export class PerformanceProjectsService {
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

    if (!project.companyName.trim() || !project.title.trim() || !project.type.trim()) {
      throw new BadRequestException(
        "Company name, project title, and project type are required to build the Director Brief.",
      );
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
          targetAiTool: project.targetAiTool,
          title: project.title,
          type: project.type,
        },
      });

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
        this.prisma.client.performanceScene.createMany({
          data: generated.brief.scenes.map((scene, position) => ({
            bodyPosition: scene.bodyMovement,
            captureRequirements: scene.captureRequirements,
            dialogue: scene.dialogue,
            direction: scene.actingIntent,
            duration: scene.timing,
            eyeline: scene.eyeDirection,
            framing: scene.framingCamera,
            gestures: scene.gestures,
            position,
            projectId: project.id,
            title: scene.title,
          })),
        }),
        this.prisma.client.performanceProject.update({
          data: {
            currentStep: "brief",
            performerPath: null,
            workflowStatus: PerformanceWorkflowStatus.BriefReview,
          },
          where: { id: project.id },
        }),
      ]);

      await this.prisma.audit({
        action: "DIRECTOR_BRIEF_GENERATED",
        entityId: project.id,
        entityType: "PerformanceProject",
        metadata: { model: generated.model, responseId: generated.responseId },
        userId: user.id,
      });

      return this.projectResponse(await this.requireOwnedProject(user, project.id));
    } catch (error) {
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
      throw error;
    }
  }

  async approveBrief(user: AuthenticatedUser, id: string): Promise<unknown> {
    const project = await this.requireOwnedProject(user, id);

    if (!project.brief || project.scenes.length === 0) {
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
          currentStep: "source",
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
    const project = await this.requireOwnedProject(user, projectId);
    if (!project.brief?.approvedAt || project.performerPath !== PerformancePath.Self) {
      throw new ConflictException(
        "Approve the Director Brief and select Self before uploading performance takes.",
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
    const take = await this.requireOwnedTake(user, projectId, sceneId, takeId);
    this.assertCurrentAttempt(take.uploadAttemptId, dto.uploadAttemptId);

    const storageKey = this.storageKey(take.storageBucket, take.storagePath);
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
    const take = await this.requireOwnedTake(user, projectId, sceneId, takeId);
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
    const take = await this.requireOwnedTake(user, projectId, sceneId, takeId);

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

  async runTakeQa(user: AuthenticatedUser, projectId: string, sceneId: string, takeId: string) {
    const project = await this.requireOwnedProject(user, projectId);
    const scene = project.scenes.find((candidate) => candidate.id === sceneId);
    const take = scene?.take?.id === takeId ? scene.take : null;

    if (!scene || !take) {
      throw new NotFoundException("Performance take not found.");
    }
    if (
      project.performerPath !== PerformancePath.Self ||
      !project.brief?.approvedAt ||
      !project.brief.approvedVersion
    ) {
      throw new ConflictException(
        "Technical QA requires an approved Director Brief and the Self performer path.",
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
      });

      await this.prisma.audit({
        action: "PERFORMANCE_TAKE_QA_COMPLETED",
        entityId: qaRun.id,
        entityType: "PerformanceQaRun",
        metadata: { result, sceneId, takeId },
        userId: user.id,
      });
      return this.projectResponse(await this.requireOwnedProject(user, projectId));
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
    const take = await this.requireOwnedTake(user, projectId, sceneId, takeId);
    await this.storage.deleteObject(this.storageKey(take.storageBucket, take.storagePath));
    await this.prisma.client.performanceTake.delete({ where: { id: take.id } });
    await this.touchProject(projectId);
    return { deleted: true };
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
      duration: scene.duration,
      eyeline: scene.eyeline,
      framing: scene.framing,
      gestures: scene.gestures,
      captureRequirements: scene.captureRequirements,
      position,
      referenceUrl: scene.reference,
      title: scene.title,
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
    },
  >(project: T) {
    return {
      ...project,
      briefAttachment: project.briefAttachment
        ? this.attachmentResponse(project.briefAttachment)
        : null,
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
