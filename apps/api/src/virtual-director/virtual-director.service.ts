import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@actbyme/database";
import {
  defaultVirtualScene,
  studioSceneSchema,
  virtualActiveStatuses,
  virtualGenerateSchema,
  virtualJobInputSchema,
  virtualRightsSchema,
  virtualSaveSchema,
  virtualShotError,
  virtualUploadSchema,
  type VirtualDirectorState,
} from "@actbyme/shared";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { PrismaService } from "../database/prisma.service.js";
import { STORAGE_CLIENT, type StorageClient } from "../storage/storage.types.js";

const model = "bytedance/seedance-2.0/reference-to-video";
const json = (input: unknown) => input as Prisma.InputJsonValue;
export function parseVirtual<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new BadRequestException(
      result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
    );
  return result.data;
}
export function virtualPrice(config: ConfigService) {
  const value = Number(config.get("VIRTUAL_DIRECTOR_CENTS_PER_SECOND", "0"));
  return Number.isFinite(value) && value > 0 && value <= 10000 ? value : 0;
}
@Injectable()
export class VirtualDirectorService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_CLIENT) private readonly storage: StorageClient,
    private readonly config: ConfigService,
  ) {}

  private async owned(ownerId: string, projectId: string) {
    const project = await this.prisma.client.performanceProject.findFirst({
      where: { id: projectId, ownerId },
      include: {
        brief: true,
        scenes: { orderBy: { position: "asc" }, include: { take: true } },
        consents: { orderBy: { version: "desc" }, take: 1 },
        directorStudio: { include: { revisions: { orderBy: { version: "desc" }, take: 1 } } },
      },
    });
    if (!project) throw new NotFoundException("Project not found.");
    return project;
  }
  private async worker() {
    const runtime = await this.prisma.client.virtualDirectorWorker.findUnique({
      where: { id: "video-worker" },
    });
    return {
      ready: Boolean(runtime && runtime.seenAt.getTime() > Date.now() - 30000),
      blender: runtime?.blender ?? false,
    };
  }
  async get(ownerId: string, projectId: string): Promise<VirtualDirectorState> {
    const project = await this.owned(ownerId, projectId);
    const [workspace, references, jobs, runtime, usage] = await Promise.all([
      this.prisma.client.virtualDirector.findUnique({ where: { projectId } }),
      this.prisma.client.virtualDirectorReference.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      this.prisma.client.virtualDirectorJob.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      this.worker(),
      this.usage(ownerId),
    ]);
    const price = virtualPrice(this.config);
    const reason =
      this.config.get("STORAGE_PROVIDER") !== "supabase"
        ? "Configure private Supabase Storage for production assets."
        : !runtime.ready
          ? "The video worker is offline. Start the dedicated worker to inspect videos, render Blender previews and generate shots."
          : !this.config.get("FAL_KEY")
            ? "Add FAL_KEY to the API and video worker to enable generation."
            : !price
              ? "Configure the verified provider price before enabling paid generation."
              : null;
    return {
      projectId,
      title: project.title,
      version: workspace?.version ?? 0,
      scene: workspace ? studioSceneSchema.parse(workspace.scene) : null,
      references: references.map((reference) => ({
        id: reference.id,
        name: reference.name,
        status: reference.status,
        duration: reference.duration,
        width: reference.width,
        height: reference.height,
        hasAudio: reference.hasAudio,
        error: reference.error,
        rights: parseVirtual(
          virtualRightsSchema,
          (reference.rights as { declaration: unknown }).declaration,
        ),
        createdAt: reference.createdAt.toISOString(),
      })),
      jobs: jobs.map((job) => ({
        id: job.id,
        kind: job.kind,
        shotId: job.shotId,
        shotName: (job.input as { shot?: { name?: string } }).shot?.name ?? "Reference inspection",
        status: job.status,
        stage: job.stage,
        error: job.error,
        estimatedCostCents: job.estimatedCostCents,
        approvedAt: job.approvedAt?.toISOString() ?? null,
        createdAt: job.createdAt.toISOString(),
        completedAt: job.completedAt?.toISOString() ?? null,
      })),
      takes: project.scenes
        .filter(
          (scene) =>
            scene.take?.uploadStatus === "UPLOADED" &&
            ["QA_PASSED", "APPROVED"].includes(scene.take.takeStatus),
        )
        .map((scene) => ({ id: scene.take!.id, name: scene.take!.originalFileName })),
      capabilities: {
        workerReady: runtime.ready,
        blenderReady: runtime.ready && runtime.blender,
        generationReady: !reason,
        pricePerSecondCents: price,
        monthlyBudgetCents: this.budget(),
        reservedCents: usage,
        reason,
        model,
      },
    };
  }
  async initialize(ownerId: string, projectId: string, input: unknown) {
    const { version, fromStudio } = parseVirtual(
      z
        .object({ version: z.number().int().nonnegative(), fromStudio: z.boolean().default(false) })
        .strict(),
      input,
    );
    const project = await this.owned(ownerId, projectId);
    const studioScene = project.directorStudio?.revisions[0]?.scene;
    if (fromStudio && !studioScene)
      throw new ConflictException("Create a Director Studio scene from the shooting plan first.");
    const scene = studioScene
      ? studioSceneSchema.parse(studioScene)
      : defaultVirtualScene(project.title, project.scenes[0]?.framing);
    await this.prisma.client.$transaction(async (transaction) => {
      await this.lockProject(transaction, projectId);
      const current = await transaction.virtualDirector.findUnique({ where: { projectId } });
      if ((current?.version ?? 0) !== version)
        throw new ConflictException("The scene changed. Reload before replacing it.");
      if (current && !fromStudio) return;
      await transaction.virtualDirector.upsert({
        where: { projectId },
        create: { projectId, scene: json(scene), version: 1 },
        update: { scene: json(scene), version: { increment: 1 } },
      });
    });
    return this.get(ownerId, projectId);
  }
  async save(ownerId: string, projectId: string, input: unknown) {
    await this.owned(ownerId, projectId);
    const data = parseVirtual(virtualSaveSchema, input);
    const changed = await this.prisma.client.virtualDirector.updateMany({
      where: { projectId, version: data.version },
      data: { scene: json(data.scene), version: { increment: 1 } },
    });
    if (!changed.count)
      throw new ConflictException(
        "The scene changed in another tab. Reload to use the latest version.",
      );
    return this.get(ownerId, projectId);
  }
  private async requireWorker(blender = false) {
    const runtime = await this.worker();
    if (!runtime.ready || (blender && !runtime.blender))
      throw new ServiceUnavailableException(
        blender ? "Blender is unavailable on the video worker." : "The video worker is offline.",
      );
    if (this.config.get("STORAGE_PROVIDER") !== "supabase")
      throw new ServiceUnavailableException("Configure private Supabase Storage first.");
  }
  private async lockProject(transaction: Prisma.TransactionClient, projectId: string) {
    await transaction.$queryRaw`SELECT id FROM "PerformanceProject" WHERE id = ${projectId}::uuid FOR UPDATE`;
  }
  private async referenceCapacity(transaction: Prisma.TransactionClient, projectId: string) {
    await this.lockProject(transaction, projectId);
    if ((await transaction.virtualDirectorReference.count({ where: { projectId } })) >= 20)
      throw new ConflictException(
        "A project can contain up to 20 references. Remove an unused reference first.",
      );
  }
  private async taskCapacity(transaction: Prisma.TransactionClient, ownerId: string) {
    const active = await transaction.virtualDirectorJob.count({
      where: { project: { ownerId }, status: { in: virtualActiveStatuses } },
    });
    if (active >= 3)
      throw new ConflictException("Three tasks are already active. Wait for one to finish.");
    const daily = await transaction.virtualDirectorJob.count({
      where: { project: { ownerId }, createdAt: { gte: new Date(Date.now() - 86400000) } },
    });
    if (daily >= 100)
      throw new ConflictException("Daily production task limit reached. Try again tomorrow.");
  }
  async reserve(ownerId: string, projectId: string, input: unknown) {
    await this.owned(ownerId, projectId);
    await this.requireWorker();
    const data = parseVirtual(virtualUploadSchema, input);
    const upload = await this.storage.createPresignedUpload({
      namespace: "virtual-director",
      pathPrefix: `virtual-director/${ownerId}/${projectId}/references`,
      fileName: data.name,
      contentType: data.contentType,
    });
    if (upload.bucket !== "actor-private")
      throw new ServiceUnavailableException("A private production bucket is required.");
    const reference = await this.prisma.client.$transaction(async (transaction) => {
      await this.referenceCapacity(transaction, projectId);
      return transaction.virtualDirectorReference.create({
        data: {
          projectId,
          name: data.name,
          storageKey: upload.key,
          sizeBytes: data.sizeBytes,
          rights: json({
            declaration: data.rights,
            acceptedBy: ownerId,
            acceptedAt: new Date().toISOString(),
          }),
        },
      });
    });
    // Public asset URLs and raw storage keys are deliberately excluded.
    return {
      referenceId: reference.id,
      upload: { uploadUrl: upload.uploadUrl, method: upload.method, token: upload.token },
    };
  }
  async completeUpload(ownerId: string, projectId: string, referenceId: string) {
    await this.owned(ownerId, projectId);
    await this.requireWorker();
    const reference = await this.prisma.client.virtualDirectorReference.findFirst({
      where: { id: referenceId, projectId },
    });
    if (!reference) throw new NotFoundException("Reference not found.");
    if (reference.status !== "UPLOADING") return this.get(ownerId, projectId);
    const info = await this.storage.getObjectInfo(reference.storageKey).catch(() => {
      throw new ConflictException("Upload the video before confirming it.");
    });
    if (
      info.sizeBytes !== reference.sizeBytes ||
      !["video/mp4", "video/quicktime"].includes(info.contentType ?? "")
    )
      throw new BadRequestException("The uploaded video does not match the reservation.");
    await this.prisma.client.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM "User" WHERE id = ${ownerId}::uuid FOR UPDATE`;
      await this.lockProject(transaction, projectId);
      await this.taskCapacity(transaction, ownerId);
      const changed = await transaction.virtualDirectorReference.updateMany({
        where: { id: referenceId, status: "UPLOADING" },
        data: { status: "PROCESSING" },
      });
      if (changed.count)
        await transaction.virtualDirectorJob.create({
          data: {
            projectId,
            referenceId,
            kind: "INSPECT",
            requestKey: randomUUID(),
            input: {},
            deadlineAt: new Date(Date.now() + 15 * 60000),
          },
        });
    });
    return this.get(ownerId, projectId);
  }
  async importTake(ownerId: string, projectId: string, input: unknown) {
    const data = parseVirtual(
      z.object({ takeId: z.uuid(), rights: virtualRightsSchema }).strict(),
      input,
    );
    const project = await this.owned(ownerId, projectId);
    await this.requireWorker();
    const take = project.scenes.find((scene) => scene.take?.id === data.takeId)?.take;
    const consent = project.consents[0];
    if (
      !take ||
      take.uploadStatus !== "UPLOADED" ||
      !["QA_PASSED", "APPROVED"].includes(take.takeStatus)
    )
      throw new ConflictException("Only an approved or QA-passed project performance can be used.");
    if (
      !consent?.acceptedAt ||
      !consent.aiTransformationAllowed ||
      consent.approvedBriefVersion !== project.brief?.approvedVersion
    )
      throw new ConflictException(
        "An accepted consent allowing AI transformation of the current performance is required.",
      );
    await this.prisma.client.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM "User" WHERE id = ${ownerId}::uuid FOR UPDATE`;
      await this.referenceCapacity(transaction, projectId);
      await this.taskCapacity(transaction, ownerId);
      const reference = await transaction.virtualDirectorReference.create({
        data: {
          projectId,
          name: take.originalFileName,
          storageKey: `${take.storageBucket}/${take.storagePath}`,
          sizeBytes: take.sizeBytes,
          status: "PROCESSING",
          sourceTakeId: take.id,
          sourceAttemptId: take.uploadAttemptId,
          rights: json({
            declaration: data.rights,
            acceptedBy: ownerId,
            acceptedAt: new Date().toISOString(),
            consentId: consent.id,
          }),
        },
      });
      await transaction.virtualDirectorJob.create({
        data: {
          projectId,
          referenceId: reference.id,
          kind: "INSPECT",
          requestKey: randomUUID(),
          input: {},
          deadlineAt: new Date(Date.now() + 15 * 60000),
        },
      });
    });
    return this.get(ownerId, projectId);
  }
  private budget() {
    const value = Number(this.config.get("VIRTUAL_DIRECTOR_MONTHLY_BUDGET_CENTS", "2500"));
    return Number.isSafeInteger(value) && value > 0 ? value : 2500;
  }
  private month() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
  private async usage(
    ownerId: string,
    transaction: Pick<Prisma.TransactionClient, "virtualDirectorJob"> = this.prisma.client,
  ) {
    const result = await transaction.virtualDirectorJob.aggregate({
      where: { project: { ownerId }, kind: "GENERATE", createdAt: { gte: this.month() } },
      _sum: { estimatedCostCents: true },
    });
    return result._sum.estimatedCostCents ?? 0;
  }
  async enqueue(ownerId: string, projectId: string, input: unknown) {
    const project = await this.owned(ownerId, projectId);
    const data = parseVirtual(virtualGenerateSchema, input);
    await this.requireWorker(data.kind === "PREVIEW");
    if (data.kind === "GENERATE" && (!this.config.get("FAL_KEY") || !virtualPrice(this.config)))
      throw new ServiceUnavailableException(
        "Configure FAL_KEY and a verified provider price first.",
      );
    await this.prisma.client.$transaction(async (transaction) => {
      // The owner lock serializes quotas across all their projects.
      await transaction.$queryRaw`SELECT id FROM "User" WHERE id = ${ownerId}::uuid FOR UPDATE`;
      await this.lockProject(transaction, projectId);
      const duplicate = await transaction.virtualDirectorJob.findUnique({
        where: { projectId_requestKey: { projectId, requestKey: data.requestKey } },
      });
      if (duplicate) return;
      const workspace = await transaction.virtualDirector.findUnique({ where: { projectId } });
      if (!workspace || workspace.version !== data.version)
        throw new ConflictException("Save or reload the current camera scene before generating.");
      const scene = studioSceneSchema.parse(workspace.scene);
      const shot = scene.shots.find((item) => item.id === data.shotId);
      if (!shot) throw new NotFoundException("Shot not found.");
      const reference = data.referenceId
        ? await transaction.virtualDirectorReference.findFirst({
            where: { id: data.referenceId, projectId, status: "READY" },
          })
        : null;
      if (data.kind === "GENERATE" && !reference)
        throw new ConflictException("Select a validated reference video first.");
      let sourceConsentId: string | null = null;
      if (reference?.sourceTakeId) {
        const consent = project.consents[0];
        if (
          !consent?.acceptedAt ||
          !consent.aiTransformationAllowed ||
          consent.approvedBriefVersion !== project.brief?.approvedVersion ||
          (reference.rights as { consentId?: string }).consentId !== consent.id
        )
          throw new ConflictException("The reference consent no longer matches the project.");
        sourceConsentId = consent.id;
      }
      if (data.kind === "GENERATE") {
        const error = virtualShotError(
          {
            ...shot,
            start: data.sourceStartSeconds ?? shot.start,
            end: (data.sourceStartSeconds ?? shot.start) + shot.end - shot.start,
          },
          reference?.duration ?? undefined,
        );
        if (error) throw new BadRequestException(error);
      }
      await this.taskCapacity(transaction, ownerId);
      if (
        await transaction.virtualDirectorJob.count({
          where: {
            projectId,
            shotId: shot.id,
            kind: data.kind,
            status: { in: virtualActiveStatuses },
          },
        })
      )
        throw new ConflictException("This shot already has an active task.");
      const cost =
        data.kind === "GENERATE"
          ? Math.ceil((shot.end - shot.start) * virtualPrice(this.config))
          : 0;
      if (cost > data.maxCostCents)
        throw new ConflictException(
          "The provider estimate changed. Review the new cost before generating.",
        );
      if (cost + (await this.usage(ownerId, transaction)) > this.budget())
        throw new ConflictException(
          "Monthly video generation budget reached. Failed or cancelled requests remain reserved because the provider may charge them.",
        );
      const snapshot = virtualJobInputSchema.parse({
        scene,
        shot,
        instructions: data.instructions,
        sourceStartSeconds: data.sourceStartSeconds ?? shot.start,
        model,
        sourceConsentId,
      });
      await transaction.virtualDirectorJob.create({
        data: {
          projectId,
          referenceId: data.kind === "GENERATE" ? reference!.id : null,
          requestKey: data.requestKey,
          kind: data.kind,
          shotId: shot.id,
          input: json(snapshot),
          estimatedCostCents: cost,
          deadlineAt: new Date(Date.now() + 60 * 60000),
        },
      });
    });
    return this.get(ownerId, projectId);
  }
  async cancel(ownerId: string, projectId: string, jobId: string) {
    await this.owned(ownerId, projectId);
    const changed = await this.prisma.client.virtualDirectorJob.updateMany({
      where: { id: jobId, projectId, status: { in: virtualActiveStatuses } },
      data: {
        status: "CANCELLED",
        stage: "CANCEL_REQUESTED",
        token: null,
        leaseUntil: null,
        completedAt: new Date(),
        error: "Cancelled locally. A provider request already running may still be billed.",
      },
    });
    if (
      !changed.count &&
      !(await this.prisma.client.virtualDirectorJob.findFirst({ where: { id: jobId, projectId } }))
    )
      throw new NotFoundException("Task not found.");
    const job = await this.prisma.client.virtualDirectorJob.findFirst({
      where: { id: jobId, projectId },
    });
    if (job?.kind === "INSPECT" && job.referenceId)
      await this.prisma.client.virtualDirectorReference.updateMany({
        where: { id: job.referenceId, status: "PROCESSING" },
        data: {
          status: "FAILED",
          error: "Reference inspection was cancelled. Upload the reference again.",
        },
      });
    return this.get(ownerId, projectId);
  }
  async approve(ownerId: string, projectId: string, jobId: string) {
    await this.owned(ownerId, projectId);
    const result = await this.prisma.client.virtualDirectorJob.updateMany({
      where: {
        id: jobId,
        projectId,
        kind: "GENERATE",
        status: "COMPLETED",
        outputKey: { not: null },
      },
      data: { approvedAt: new Date() },
    });
    if (!result.count)
      throw new ConflictException("Review a completed generated shot before approving it.");
    return this.get(ownerId, projectId);
  }
  async media(
    ownerId: string,
    projectId: string,
    id: string,
    kind: "reference" | "job",
    download = false,
  ) {
    await this.owned(ownerId, projectId);
    let key: string | null;
    if (kind === "reference") {
      const reference = await this.prisma.client.virtualDirectorReference.findFirst({
        where: { id, projectId, status: "READY" },
      });
      key = reference?.storageKey ?? null;
    } else {
      const job = await this.prisma.client.virtualDirectorJob.findFirst({
        where: { id, projectId, status: "COMPLETED" },
      });
      if (download && job?.kind === "GENERATE" && !job.approvedAt)
        throw new ConflictException(
          "Approve the generated shot before downloading the final video.",
        );
      key = job?.outputKey ?? null;
    }
    if (!key) throw new NotFoundException("Media not available.");
    return {
      url: await this.storage.createSignedReadUrl(
        key,
        300,
        download ? { downloadFileName: `actbyme-${id}.mp4` } : undefined,
      ),
      expiresInSeconds: 300,
    };
  }
  async removeReference(ownerId: string, projectId: string, referenceId: string) {
    await this.owned(ownerId, projectId);
    const reference = await this.prisma.client.$transaction(async (transaction) => {
      await this.lockProject(transaction, projectId);
      const reference = await transaction.virtualDirectorReference.findFirst({
        where: { id: referenceId, projectId },
      });
      if (!reference) throw new NotFoundException("Reference not found.");
      const used = await transaction.virtualDirectorJob.count({
        where: { referenceId, kind: "GENERATE" },
      });
      const active = await transaction.virtualDirectorJob.count({
        where: { referenceId, status: { in: virtualActiveStatuses } },
      });
      if (used || active)
        throw new ConflictException(
          "Keep references used by generation tasks or active inspections.",
        );
      await transaction.virtualDirectorJob.deleteMany({ where: { referenceId } });
      await transaction.virtualDirectorReference.delete({ where: { id: referenceId } });
      return reference;
    });
    if (reference.storageKey.startsWith("actor-private/virtual-director/"))
      await this.storage.deleteObject(reference.storageKey);
    return this.get(ownerId, projectId);
  }
}
