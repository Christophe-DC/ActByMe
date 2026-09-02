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
  PerformanceTakeStatus,
  PerformanceTakeUploadStatus,
  PerformanceWorkflowStatus,
} from "@actbyme/shared";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { PrismaService } from "../database/prisma.service.js";
import { STORAGE_CLIENT, type StorageClient } from "../storage/storage.types.js";
import type { SavePerformanceProjectDto } from "./dto/performance-project.dto.js";
import type {
  CompletePerformanceTakeUploadDto,
  CreatePerformanceTakeUploadDto,
  FailPerformanceTakeUploadDto,
} from "./dto/performance-take.dto.js";
import { OpenAiDirectorService } from "./openai-director.service.js";

const projectInclude = {
  brief: true,
  scenes: {
    include: {
      take: true,
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
    private readonly aiDirector: OpenAiDirectorService,
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
        return project;
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

    return project;
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
      [PerformanceWorkflowStatus.GeneratingBrief, PerformanceWorkflowStatus.BriefReview].includes(
        dto.workflowStatus,
      ) &&
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

    await this.prisma.client.$transaction([
      this.prisma.client.performanceProject.update({
        data: this.toUpdateData(dto),
        where: { id: ownedProject.id },
      }),
      ...dto.scenes.map((scene, position) =>
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
      ),
    ]);

    return this.requireOwnedProject(user, ownedProject.id);
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
          sourceFileName: project.sourceFileName,
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
            capturePlan: generated.brief.captureRequirements,
            generatedAt: new Date(),
            globalDirection: generated.brief.globalDirection,
            model: generated.model,
            openaiResponseId: generated.responseId,
            qaCriteria: generated.brief.qaCriteria,
            talentRequirements: generated.brief.castingRequirements,
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

      return this.requireOwnedProject(user, project.id);
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

  async createTakeUpload(
    user: AuthenticatedUser,
    projectId: string,
    sceneId: string,
    dto: CreatePerformanceTakeUploadDto,
  ) {
    this.assertSupportedVideo(dto.fileName, dto.contentType);
    const scene = await this.requireOwnedScene(user, projectId, sceneId);
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

  private toUpdateData(dto: SavePerformanceProjectDto): Prisma.PerformanceProjectUpdateInput {
    return {
      ...this.projectFields(dto),
      ...(dto.brief
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
      sourceFileName: dto.project.uploadFile,
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
