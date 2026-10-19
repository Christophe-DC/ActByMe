import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@actbyme/database";
import {
  createDirectorDocument,
  directorActiveStatuses,
  directorDocumentSchema,
  directorUploadSchema,
  directorDuration,
  directorBrowserExportError,
  directorProductionPlan,
  directorProviderErrors,
  directorShotReferenceIds,
  type DirectorState,
  type DirectorDocument,
  type DirectorAsset,
  type DirectorProviderId,
} from "@actbyme/shared";
import { PrismaService } from "../database/prisma.service.js";
import { STORAGE_CLIENT, type StorageClient } from "../storage/storage.types.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import {
  configuredDirectorPrice,
  directorProviderModels,
  DirectorProviders,
} from "./director-providers.js";

export const directorJson = (value: unknown) => value as Prisma.InputJsonValue;
export const directorHash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function parseDirector<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new BadRequestException(
      result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
    );
  return result.data;
}
const versionSchema = z.number().int().positive();
export function directorConsentScope(document: DirectorDocument) {
  return directorHash({
    title: document.title,
    brief: document.brief,
    script: document.script,
    aspectRatio: document.aspectRatio,
    shots: document.shots.map(
      ({ clipAssetId: _clip, clipOffset: _offset, originalAudio: _audio, ...shot }) => shot,
    ),
    cast: document.cast,
    performances: document.tracks.filter((item) => item.track === "performance"),
  });
}
@Injectable()
export class DirectorService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_CLIENT) private readonly storage: StorageClient,
    private readonly config: ConfigService,
    private readonly providers: DirectorProviders,
  ) {}
  async owned(ownerId: string, id: string) {
    const project = await this.prisma.client.directorProject.findFirst({ where: { id, ownerId } });
    if (!project) throw new NotFoundException("Projet Director introuvable.");
    return project;
  }
  private async lock(transaction: Prisma.TransactionClient, id: string) {
    await transaction.$queryRaw`SELECT id FROM "DirectorProject" WHERE id = ${id}::uuid FOR UPDATE`;
  }
  async list(ownerId: string) {
    return this.prisma.client.directorProject.findMany({
      where: { ownerId },
      select: { id: true, title: true, version: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  }
  async create(user: AuthenticatedUser, input: unknown) {
    const data = parseDirector(
      z
        .object({ title: z.string().trim().min(1).max(140), demo: z.boolean().default(false) })
        .strict(),
      input,
    );
    const document = directorDocumentSchema.parse(createDirectorDocument(data.title, data.demo));
    const project = await this.prisma.client.$transaction(async (transaction) => {
      await transaction.user.upsert({
        where: { id: user.id },
        update: {},
        create: { id: user.id, email: user.email ?? `${user.id}@missing.invalid`, role: user.role },
      });
      // Serialize creation for per-owner capacity checks.
      await transaction.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id}::uuid FOR UPDATE`;
      if ((await transaction.directorProject.count({ where: { ownerId: user.id } })) >= 100)
        throw new ConflictException("La limite de 100 projets est atteinte.");
      return transaction.directorProject.create({
        data: {
          ownerId: user.id,
          title: data.title,
          document: directorJson(document),
          revisions: { create: { version: 1, document: directorJson(document) } },
        },
      });
    });
    return this.get(user.id, project.id);
  }
  async capabilities(ownerId: string) {
    const month = new Date();
    month.setUTCDate(1);
    month.setUTCHours(0, 0, 0, 0);
    const [runtime, usage] = await Promise.all([
      this.prisma.client.directorWorker.findMany({
        where: { seenAt: { gt: new Date(Date.now() - 30000) } },
      }),
      this.prisma.client.directorJob.aggregate({
        where: { ownerId, createdAt: { gte: month } },
        _sum: { estimatedCostCents: true },
      }),
    ]);
    const storageReady = this.config.get("STORAGE_PROVIDER") === "supabase";
    const budget = Number(this.config.get("DIRECTOR_MONTHLY_BUDGET_CENTS", "2500"));
    return {
      workerReady: runtime.length > 0,
      storageReady,
      browserExportReady: storageReady,
      budgetCents: Number.isFinite(budget) && budget > 0 ? Math.floor(budget) : 2500,
      reservedCents: usage._sum.estimatedCostCents ?? 0,
      providers: (["veo", "higgsfield"] as const).map((id) => {
        const centsPerSecond = configuredDirectorPrice(this.config, id);
        const reason =
          this.config.get("DIRECTOR_ENABLE_PAID_GENERATION") !== "true"
            ? "Génération payante désactivée : utilisez vos clips importés."
            : !storageReady
              ? "Configurer le stockage privé Supabase."
              : !this.providers.configured(id)
                ? "Identifiants fournisseur absents."
                : !centsPerSecond
                  ? "Tarif vérifié à configurer côté serveur."
                  : !runtime.some((worker) => (worker.providers as string[]).includes(id))
                    ? "Worker compatible hors ligne."
                    : null;
        return {
          id,
          name: id === "veo" ? "Google Veo 3.1" : "Seedance 2.0 · Higgsfield",
          model: directorProviderModels[id],
          ready: !reason,
          reason,
          centsPerSecond,
          documentationUrl:
            id === "veo"
              ? "https://ai.google.dev/gemini-api/docs/veo"
              : "https://open.higgsfield.ai/models/bytedance/seedance-2.0/reference-to-video/api-reference",
        };
      }),
    };
  }
  async get(ownerId: string, id: string): Promise<DirectorState> {
    const project = await this.owned(ownerId, id);
    const [assets, jobs, capabilities] = await Promise.all([
      this.prisma.client.directorAsset.findMany({
        where: { projectId: id },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      this.prisma.client.directorJob.findMany({
        where: { projectId: id },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      this.capabilities(ownerId),
    ]);
    return {
      id,
      version: project.version,
      document: directorDocumentSchema.parse(project.document),
      updatedAt: project.updatedAt.toISOString(),
      capabilities,
      assets: assets.map(
        ({
          storageKey: _key,
          rights: _rights,
          updatedAt: _updated,
          projectId: _project,
          createdAt,
          ...asset
        }) => ({
          ...asset,
          kind: asset.kind as DirectorAsset["kind"],
          createdAt: createdAt.toISOString(),
        }),
      ),
      jobs: jobs.map(
        ({
          id,
          kind,
          shotId,
          provider,
          status,
          stage,
          error,
          progress,
          estimatedCostCents,
          resultAssetId,
          createdAt,
          version,
        }) => ({
          id,
          kind,
          shotId,
          provider,
          status,
          stage,
          error,
          progress,
          estimatedCostCents,
          resultAssetId,
          createdAt: createdAt.toISOString(),
          version,
        }),
      ),
    };
  }
  async validateDocument(
    ownerId: string,
    id: string,
    document: DirectorDocument,
    database: Prisma.TransactionClient = this.prisma.client,
  ) {
    const assets = await database.directorAsset.findMany({ where: { projectId: id } });
    const requireAsset = (assetId: string | null, types?: string[]) => {
      if (!assetId) return;
      const asset = assets.find(
        (candidate) => candidate.id === assetId && candidate.status === "READY",
      );
      if (!asset || (types && !types.some((prefix) => asset.contentType.startsWith(prefix))))
        throw new BadRequestException(
          "Ressource absente, privée ou incompatible avec cette piste.",
        );
      return asset;
    };
    for (const shot of document.shots) {
      shot.referenceIds.forEach((assetId) => requireAsset(assetId));
      const clip = requireAsset(shot.clipAssetId, ["video/"]);
      if (clip?.duration && shot.clipOffset + shot.duration > clip.duration + 0.08)
        throw new BadRequestException(
          `Le clip de « ${shot.name} » est trop court pour cette durée.`,
        );
    }
    for (const item of document.tracks) {
      const asset = requireAsset(
        item.assetId,
        item.track === "performance" ? ["video/"] : ["audio/", "video/"],
      );
      if (asset && item.track !== "performance" && !asset.hasAudio)
        throw new BadRequestException("Cette ressource ne contient pas d’audio.");
      if (asset?.duration && item.offset + item.duration > asset.duration + 0.08)
        throw new BadRequestException("La piste dépasse la durée de sa ressource.");
    }
    for (const person of document.cast) {
      requireAsset(person.referenceAssetId, ["image/"]);
      if (person.kind === "actor") {
        const actor = await database.actorProfile.findFirst({
          where: {
            id: person.actorProfileId!,
            isDemo: false,
            status: "APPROVED",
            consent: { publicProfileConsent: true },
          },
        });
        if (!actor)
          throw new BadRequestException(
            "Cet acteur n’est pas disponible dans le catalogue public.",
          );
        if (person.name !== actor.stageName)
          throw new BadRequestException("Le nom doit correspondre au profil ACTBYME sélectionné.");
      }
      if (
        person.performanceProjectId &&
        !(await database.performanceProject.findFirst({
          where: {
            id: person.performanceProjectId,
            ownerId,
            ...(person.actorProfileId
              ? { assignment: { actorProfileId: person.actorProfileId } }
              : {}),
          },
        }))
      )
        throw new BadRequestException(
          "La performance liée n’appartient pas à ce projet ou à cet acteur.",
        );
    }
    return assets;
  }
  async save(ownerId: string, id: string, input: unknown) {
    await this.owned(ownerId, id);
    const data = parseDirector(
      z.object({ version: versionSchema, document: directorDocumentSchema }).strict(),
      input,
    );
    await this.prisma.client.$transaction(async (transaction) => {
      await this.lock(transaction, id);
      const project = await transaction.directorProject.findUniqueOrThrow({ where: { id } });
      if (project.version !== data.version)
        throw new ConflictException(
          "Ce projet a été modifié ailleurs. Votre brouillon est conservé ; rechargez la version du serveur pour résoudre le conflit.",
        );
      await this.validateDocument(ownerId, id, data.document, transaction);
      await transaction.directorProject.update({
        where: { id },
        data: {
          title: data.document.title,
          document: directorJson(data.document),
          version: { increment: 1 },
        },
      });
      await transaction.directorRevision.create({
        data: { projectId: id, version: data.version + 1, document: directorJson(data.document) },
      });
    });
    return this.get(ownerId, id);
  }
  async history(ownerId: string, id: string) {
    await this.owned(ownerId, id);
    return this.prisma.client.directorRevision.findMany({
      where: { projectId: id },
      select: { id: true, version: true, createdAt: true },
      orderBy: { version: "desc" },
      take: 40,
    });
  }
  async restore(ownerId: string, id: string, input: unknown) {
    await this.owned(ownerId, id);
    const { revisionId, version } = parseDirector(
      z.object({ revisionId: z.uuid(), version: versionSchema }).strict(),
      input,
    );
    const revision = await this.prisma.client.directorRevision.findFirst({
      where: { id: revisionId, projectId: id },
    });
    if (!revision) throw new NotFoundException("Version introuvable.");
    return this.save(ownerId, id, { version, document: revision.document });
  }
  async plan(ownerId: string, id: string) {
    const state = await this.get(ownerId, id);
    return directorProductionPlan(state.document, state.assets, state.version);
  }
  private async requireWorker(ownerId: string) {
    const capabilities = await this.capabilities(ownerId);
    if (!capabilities.storageReady || !capabilities.workerReady)
      throw new ServiceUnavailableException(
        "L’import et le rendu nécessitent le stockage privé et le worker Director. La préparation reste disponible.",
      );
    return capabilities;
  }
  private requireStorage() {
    if (this.config.get("STORAGE_PROVIDER") !== "supabase")
      throw new ServiceUnavailableException(
        "Configurez le stockage privé Supabase pour importer des ressources.",
      );
  }
  async reserve(ownerId: string, id: string, input: unknown) {
    await this.owned(ownerId, id);
    this.requireStorage();
    const data = parseDirector(directorUploadSchema, input);
    return this.prisma.client.$transaction(async (transaction) => {
      await this.lock(transaction, id);
      if ((await transaction.directorAsset.count({ where: { projectId: id } })) >= 200)
        throw new ConflictException("Limite de 200 ressources atteinte.");
      const bytes = await transaction.directorAsset.aggregate({
        where: { projectId: id },
        _sum: { sizeBytes: true },
      });
      if ((bytes._sum.sizeBytes ?? 0) + data.sizeBytes > 2 * 1024 ** 3)
        throw new ConflictException("Limite de stockage de 2 GiB par projet atteinte.");
      const upload = await this.storage.createPresignedUpload({
        namespace: "director",
        contentType: data.contentType,
        fileName: data.name,
        pathPrefix: `director/${ownerId}/${id}/uploads`,
      });
      const asset = await transaction.directorAsset.create({
        data: {
          projectId: id,
          name: data.name,
          kind: data.kind,
          contentType: data.contentType,
          sizeBytes: data.sizeBytes,
          storageKey: upload.key,
          aiTransferAllowed: data.aiTransferAllowed,
          rights: directorJson({
            ownerId,
            acceptedAt: new Date().toISOString(),
            basis: data.rightsBasis,
            ownsOrLicensed: true,
          }),
        },
      });
      return {
        assetId: asset.id,
        upload: { uploadUrl: upload.uploadUrl, method: upload.method, token: upload.token },
      };
    });
  }
  async completeUpload(ownerId: string, id: string, assetId: string) {
    const project = await this.owned(ownerId, id);
    this.requireStorage();
    await this.prisma.client.$transaction(async (transaction) => {
      await this.lock(transaction, id);
      const asset = await transaction.directorAsset.findFirst({
        where: { id: assetId, projectId: id },
      });
      if (!asset) throw new NotFoundException("Ressource introuvable.");
      if (asset.status !== "UPLOADING") return;
      const info = await this.storage.getObjectInfo(asset.storageKey);
      if (
        info.sizeBytes !== asset.sizeBytes ||
        info.contentType?.split(";")[0] !== asset.contentType
      )
        throw new BadRequestException(
          "Le fichier reçu ne correspond pas au format ou à la taille déclarés.",
        );
      await transaction.directorAsset.update({
        where: { id: assetId },
        data: { status: "INSPECTING" },
      });
      await transaction.directorJob.create({
        data: {
          projectId: id,
          ownerId,
          version: project.version,
          requestKey: randomUUID(),
          requestHash: assetId,
          kind: "INSPECT",
          input: { assetId },
        },
      });
    });
    return this.get(ownerId, id);
  }
  async media(ownerId: string, id: string, assetId: string, download = false) {
    await this.owned(ownerId, id);
    const asset = await this.prisma.client.directorAsset.findFirst({
      where: { id: assetId, projectId: id, status: "READY" },
    });
    if (!asset) throw new NotFoundException("Ressource indisponible.");
    return {
      url: await this.storage.createSignedReadUrl(
        asset.storageKey,
        300,
        download ? { downloadFileName: asset.name } : undefined,
      ),
      expiresInSeconds: 300,
    };
  }
  async removeAsset(ownerId: string, id: string, assetId: string) {
    await this.owned(ownerId, id);
    await this.prisma.client.$transaction(async (transaction) => {
      await this.lock(transaction, id);
      const project = await transaction.directorProject.findUniqueOrThrow({ where: { id } });
      const revisions = await transaction.directorRevision.findMany({
        where: { projectId: id },
        select: { document: true },
      });
      const jobs = await transaction.directorJob.findMany({
        where: { projectId: id },
        select: { input: true, resultAssetId: true },
      });
      if (
        [
          project.document,
          ...revisions.map((revision) => revision.document),
          ...jobs
            .filter(
              (job) => !(job.input && typeof job.input === "object" && "assetId" in job.input),
            )
            .map((job) => job.input),
        ].some((value) => JSON.stringify(value).includes(assetId)) ||
        jobs.some((job) => job.resultAssetId === assetId)
      )
        throw new ConflictException(
          "Cette ressource est conservée par une version ou une production. Détachez-la du projet ; la conservation protège son historique.",
        );
      const asset = await transaction.directorAsset.findFirst({
        where: { id: assetId, projectId: id },
      });
      if (!asset) throw new NotFoundException("Ressource introuvable.");
      await this.storage.deleteObject(asset.storageKey);
      await transaction.directorAsset.delete({ where: { id: assetId } });
    });
    return this.get(ownerId, id);
  }
  async actors(ownerId: string) {
    const [actors, performances] = await Promise.all([
      this.prisma.client.actorProfile.findMany({
        where: { status: "APPROVED", isDemo: false, consent: { publicProfileConsent: true } },
        select: { id: true, stageName: true, slug: true, city: true },
        take: 100,
        orderBy: { stageName: "asc" },
      }),
      this.prisma.client.performanceProject.findMany({
        where: { ownerId },
        select: {
          id: true,
          title: true,
          assignment: { select: { actorProfileId: true, status: true } },
          takes: {
            where: { uploadStatus: "UPLOADED", takeStatus: { in: ["APPROVED", "QA_PASSED"] } },
            select: { id: true, originalFileName: true },
          },
        },
        take: 100,
        orderBy: { updatedAt: "desc" },
      }),
    ]);
    return { actors, performances };
  }
  async importTake(ownerId: string, id: string, input: unknown) {
    await this.owned(ownerId, id);
    this.requireStorage();
    const data = parseDirector(
      z
        .object({
          takeId: z.uuid(),
          rightsBasis: z.string().trim().min(10).max(2000),
          rightsConfirmed: z.literal(true),
          aiTransferAllowed: z.boolean(),
        })
        .strict(),
      input,
    );
    const take = await this.prisma.client.performanceTake.findFirst({
      where: {
        id: data.takeId,
        project: { ownerId },
        uploadStatus: "UPLOADED",
        takeStatus: { in: ["QA_PASSED", "APPROVED"] },
      },
    });
    if (!take) throw new NotFoundException("Prise validée introuvable.");
    const reservation = await this.reserve(ownerId, id, {
      name: take.originalFileName,
      kind: "performance",
      contentType: take.contentType,
      sizeBytes: take.sizeBytes,
      rightsBasis: data.rightsBasis,
      rightsConfirmed: true,
      aiTransferAllowed: data.aiTransferAllowed,
    });
    const asset = await this.prisma.client.directorAsset.findUniqueOrThrow({
      where: { id: reservation.assetId },
    });
    if (!this.storage.uploadObject)
      throw new ServiceUnavailableException("Stockage privé non configuré.");
    const bytes = await this.storage.downloadObject(`${take.storageBucket}/${take.storagePath}`);
    await this.storage.uploadObject(asset.storageKey, bytes, take.contentType);
    await this.completeUpload(ownerId, id, asset.id);
    return this.get(ownerId, id);
  }
  async grants(ownerId: string, id: string) {
    const project = await this.owned(ownerId, id);
    return this.prisma.client.directorActorGrant.findMany({
      where: {
        projectId: id,
        scopeHash: directorConsentScope(directorDocumentSchema.parse(project.document)),
      },
      select: { id: true, actorProfileId: true, acceptedAt: true, revokedAt: true, terms: true },
    });
  }
  async requestGrant(ownerId: string, id: string, input: unknown) {
    const project = await this.owned(ownerId, id);
    const data = parseDirector(
      z.object({ actorProfileId: z.uuid(), terms: z.string().trim().min(30).max(4000) }).strict(),
      input,
    );
    const document = directorDocumentSchema.parse(project.document);
    if (!document.cast.some((person) => person.actorProfileId === data.actorProfileId))
      throw new BadRequestException(
        "Ajoutez cet acteur au casting avant de demander son autorisation.",
      );
    await this.prisma.client.directorActorGrant.upsert({
      where: {
        projectId_actorProfileId_scopeHash: {
          projectId: id,
          actorProfileId: data.actorProfileId,
          scopeHash: directorConsentScope(document),
        },
      },
      create: {
        projectId: id,
        actorProfileId: data.actorProfileId,
        scopeHash: directorConsentScope(document),
        terms: data.terms,
      },
      update: {},
    });
    return this.grants(ownerId, id);
  }
  async actorRequests(userId: string) {
    const grants = await this.prisma.client.directorActorGrant.findMany({
      where: { actorProfile: { userId } },
      include: { project: { select: { title: true, document: true, version: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return grants.map(({ project, ...grant }) => ({
      id: grant.id,
      title: project.title,
      terms: grant.terms,
      acceptedAt: grant.acceptedAt,
      revokedAt: grant.revokedAt,
      current:
        grant.scopeHash === directorConsentScope(directorDocumentSchema.parse(project.document)),
      plan: directorProductionPlan(
        directorDocumentSchema.parse(project.document),
        [],
        project.version,
      ),
    }));
  }
  async acceptGrant(userId: string, grantId: string, input: unknown) {
    const data = parseDirector(
      z
        .object({
          accept: z.boolean(),
          commercialUse: z.literal(true),
          aiTransformation: z.literal(true),
          providerTransfer: z.literal(true),
        })
        .strict(),
      input,
    );
    await this.prisma.client.$transaction(async (transaction) => {
      const grant = await transaction.directorActorGrant.findFirst({
        where: { id: grantId, actorProfile: { userId } },
      });
      if (!grant) throw new NotFoundException("Autorisation introuvable.");
      await this.lock(transaction, grant.projectId);
      const project = await transaction.directorProject.findUniqueOrThrow({
        where: { id: grant.projectId },
      });
      if (
        data.accept &&
        grant.scopeHash !== directorConsentScope(directorDocumentSchema.parse(project.document))
      )
        throw new ConflictException("Le projet a changé. Demandez une autorisation à jour.");
      if (data.accept && grant.revokedAt)
        throw new ConflictException("Cette autorisation révoquée ne peut pas être réactivée.");
      await transaction.directorActorGrant.update({
        where: { id: grantId },
        data: data.accept
          ? { acceptedAt: grant.acceptedAt ?? new Date() }
          : { revokedAt: new Date() },
      });
    });
    return this.actorRequests(userId);
  }
  async assertGenerationRights(
    database: Prisma.TransactionClient,
    projectId: string,
    document: DirectorDocument,
  ) {
    for (const person of document.cast) {
      if (person.kind === "placeholder")
        throw new ConflictException(
          "Remplacez ou retirez les mannequins de prévisualisation avant une génération IA.",
        );
      if (person.kind === "actor") {
        const grant = await database.directorActorGrant.findFirst({
          where: {
            projectId,
            actorProfileId: person.actorProfileId!,
            scopeHash: directorConsentScope(document),
            acceptedAt: { not: null },
            revokedAt: null,
          },
        });
        if (!grant)
          throw new ConflictException(
            `L’acteur ${person.name} doit accepter l’autorisation de ce projet dans son espace Director.`,
          );
      }
    }
  }
  async enqueue(ownerId: string, id: string, input: unknown) {
    await this.owned(ownerId, id);
    const data = parseDirector(
      z
        .object({
          version: versionSchema,
          requestKey: z.uuid(),
          kind: z.enum(["GENERATE", "EXPORT"]),
          execution: z.enum(["server", "browser"]).default("server"),
          shotId: z.string().max(80).optional(),
          provider: z.enum(["veo", "higgsfield"]).optional(),
          maxCostCents: z.number().int().min(0).max(100000),
          confirmBillable: z.boolean().default(false),
          confirmRights: z.literal(true),
        })
        .strict(),
      input,
    );
    const requestHash = directorHash(data);
    const duplicate = await this.prisma.client.directorJob.findUnique({
      where: { ownerId_requestKey: { ownerId, requestKey: data.requestKey } },
    });
    if (duplicate) {
      if (duplicate.projectId !== id || duplicate.requestHash !== requestHash)
        throw new ConflictException("Clé de demande déjà utilisée pour une autre opération.");
      return this.get(ownerId, id);
    }
    if (data.execution === "browser" && data.kind !== "EXPORT")
      throw new BadRequestException("Seul l’export MP4 peut s’exécuter dans le navigateur.");
    this.requireStorage();
    const capabilities =
      data.execution === "browser"
        ? await this.capabilities(ownerId)
        : await this.requireWorker(ownerId);
    await this.prisma.client.$transaction(
      async (transaction) => {
        await transaction.$queryRaw`SELECT id FROM "User" WHERE id = ${ownerId}::uuid FOR UPDATE`;
        await this.lock(transaction, id);
        const existing = await transaction.directorJob.findUnique({
          where: { ownerId_requestKey: { ownerId, requestKey: data.requestKey } },
        });
        if (existing) {
          if (existing.requestHash !== requestHash || existing.projectId !== id)
            throw new ConflictException("Clé de demande déjà utilisée.");
          return;
        }
        const project = await transaction.directorProject.findUniqueOrThrow({ where: { id } });
        if (project.version !== data.version)
          throw new ConflictException("Enregistrez la dernière version avant de produire.");
        const document = directorDocumentSchema.parse(project.document);
        const assets = await this.validateDocument(ownerId, id, document, transaction);
        const active = await transaction.directorJob.count({
          where: { ownerId, status: { in: directorActiveStatuses } },
        });
        if (active >= 3)
          throw new ConflictException("Trois tâches sont déjà actives. Attendez leur fin.");
        if (
          await transaction.directorJob.findFirst({
            where: {
              projectId: id,
              version: project.version,
              kind: data.kind,
              ...(data.kind === "GENERATE" ? { shotId: data.shotId } : {}),
              status: { in: directorActiveStatuses },
            },
          })
        )
          throw new ConflictException(
            "Un traitement de cette version est déjà actif pour ce plan ou cet export.",
          );
        if (
          (await transaction.directorJob.count({
            where: { ownerId, createdAt: { gt: new Date(Date.now() - 86400000) } },
          })) >= 100
        )
          throw new ConflictException("La limite quotidienne de 100 traitements est atteinte.");
        let cost = 0;
        if (data.kind === "GENERATE") {
          if (!data.confirmBillable || !data.provider)
            throw new BadRequestException(
              "Confirmez explicitement le fournisseur et le coût de cette génération payante.",
            );
          const provider = capabilities.providers.find(
            (candidate) => candidate.id === data.provider,
          )!;
          if (!provider.ready)
            throw new ServiceUnavailableException(provider.reason ?? "Fournisseur indisponible.");
          const shot = document.shots.find((candidate) => candidate.id === data.shotId);
          if (!shot) throw new BadRequestException("Plan introuvable.");
          const errors = directorProviderErrors(
            document,
            shot,
            data.provider,
            assets as unknown as DirectorAsset[],
          );
          if (errors.length) throw new BadRequestException(errors.join(" "));
          await this.assertGenerationRights(transaction, id, document);
          cost = Math.ceil(shot.duration * provider.centsPerSecond);
          if (cost > data.maxCostCents)
            throw new ConflictException("Le coût dépasse le plafond confirmé.");
          // Recompute under the owner lock to serialize budgets across projects.
          const usage = await this.capabilities(ownerId);
          if (usage.reservedCents + cost > usage.budgetCents)
            throw new ConflictException(
              "Le budget mensuel est atteint. Les tentatives échouées restent réservées par prudence.",
            );
        } else {
          const exportError =
            data.execution === "browser" ? directorBrowserExportError(document, assets) : null;
          if (exportError) throw new BadRequestException(exportError);
          if (document.shots.some((shot) => !shot.clipAssetId))
            throw new BadRequestException(
              "Associez un clip vérifié à chaque plan avant l’export MP4.",
            );
          if (document.tracks.some((item) => !item.assetId && item.track !== "performance"))
            throw new BadRequestException("Une piste audio n’a pas de fichier associé.");
        }
        const usedAssetIds = [
          ...new Set([
            ...document.shots.flatMap((shot) => [
              ...directorShotReferenceIds(document, shot),
              ...(shot.clipAssetId ? [shot.clipAssetId] : []),
            ]),
            ...document.tracks.flatMap((item) => (item.assetId ? [item.assetId] : [])),
          ]),
        ];
        await transaction.directorJob.create({
          data: {
            projectId: id,
            ownerId,
            requestKey: data.requestKey,
            requestHash,
            version: project.version,
            kind: data.kind,
            ...(data.execution === "browser"
              ? {
                  status: "PROCESSING",
                  stage: "Assemblage dans le navigateur · gardez cet onglet ouvert",
                }
              : {}),
            shotId: data.shotId,
            provider: data.provider,
            estimatedCostCents: cost,
            input: directorJson({
              document,
              assetIds: usedAssetIds,
              duration: directorDuration(document),
              ...(data.execution === "browser" ? { execution: "browser" } : {}),
            }),
          },
        });
      },
      { timeout: 15000 },
    );
    return this.get(ownerId, id);
  }
  async completeBrowserExport(ownerId: string, id: string, jobId: string, input: unknown) {
    await this.owned(ownerId, id);
    const { assetId } = parseDirector(z.object({ assetId: z.uuid() }).strict(), input);
    await this.prisma.client.$transaction(async (transaction) => {
      await this.lock(transaction, id);
      const job = await transaction.directorJob.findFirst({
        where: { id: jobId, projectId: id, ownerId, kind: "EXPORT" },
      });
      if (!job || (job.input as { execution?: string }).execution !== "browser")
        throw new NotFoundException("Export navigateur introuvable.");
      if (job.status === "SUCCEEDED" && job.resultAssetId === assetId) return;
      if (job.status !== "PROCESSING")
        throw new ConflictException("Cet export est terminé ou annulé.");
      const asset = await transaction.directorAsset.findFirst({
        where: {
          id: assetId,
          projectId: id,
          kind: "clip",
          contentType: "video/mp4",
          status: "READY",
        },
      });
      const snapshot = job.input as { duration: number; document: DirectorDocument };
      const width = snapshot.document.aspectRatio === "16:9" ? 1280 : 720;
      const height = snapshot.document.aspectRatio === "9:16" ? 1280 : 720;
      if (
        !asset ||
        asset.createdAt < job.createdAt ||
        !asset.duration ||
        Math.abs(asset.duration - snapshot.duration) > 0.2 ||
        asset.width !== width ||
        asset.height !== height ||
        !asset.hasAudio
      )
        throw new BadRequestException(
          "Le MP4 doit être vérifié et correspondre à la durée et au format de cet export.",
        );
      const published = await transaction.directorJob.updateMany({
        where: { id: job.id, status: "PROCESSING" },
        data: {
          resultAssetId: assetId,
          status: "SUCCEEDED",
          progress: 100,
          stage: "Publicité MP4 disponible",
        },
      });
      if (!published.count) throw new ConflictException("Cet export a été annulé ou a expiré.");
    });
    return this.get(ownerId, id);
  }
  async cancel(ownerId: string, id: string, jobId: string) {
    await this.owned(ownerId, id);
    const job = await this.prisma.client.directorJob.findFirst({
      where: { id: jobId, projectId: id },
    });
    if (!job) throw new NotFoundException("Traitement introuvable.");
    const changed = await this.prisma.client.directorJob.updateMany({
      where: { id: jobId, status: { in: directorActiveStatuses } },
      data: {
        status: "CANCELLED",
        claimToken: null,
        leaseUntil: null,
        stage:
          job.kind === "GENERATE"
            ? "Annulation locale ; le fournisseur peut encore facturer."
            : "Traitement annulé",
      },
    });
    if (changed.count && job.providerRequest && job.provider)
      await this.providers
        .cancel(job.provider as DirectorProviderId, job.providerRequest, AbortSignal.timeout(10000))
        .catch(() => false);
    if (changed.count && job.kind === "INSPECT") {
      const assetId = z.object({ assetId: z.uuid() }).parse(job.input).assetId;
      await this.prisma.client.directorAsset.updateMany({
        where: { id: assetId, projectId: id, status: "INSPECTING" },
        data: {
          status: "FAILED",
          error: "Vérification annulée. Retirez ce fichier et importez-le à nouveau.",
        },
      });
    }
    return this.get(ownerId, id);
  }
}
