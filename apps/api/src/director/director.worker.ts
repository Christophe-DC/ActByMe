import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import {
  directorDocumentSchema,
  directorActiveStatuses,
  directorShotReferenceIds,
  directorPerformanceSegments,
} from "@actbyme/shared";
import type { DirectorJob, Prisma } from "@actbyme/database";
import { PrismaService } from "../database/prisma.service.js";
import { STORAGE_CLIENT, type StorageClient } from "../storage/storage.types.js";
import { runVideoCommand, prepareReference } from "../virtual-director/video-processing.js";
import { DirectorProviders, DirectorProviderError } from "./director-providers.js";
import { directorJson, DirectorService } from "./director.service.js";
import {
  inspectDirectorAsset,
  renderDirector,
  type DirectorRenderAsset,
} from "./director-render.js";

const snapshotSchema = z
  .object({
    document: directorDocumentSchema,
    assetIds: z.array(z.uuid()),
    duration: z.number().finite().positive(),
    inputsCleaned: z.boolean().optional(),
  })
  .strict();
@Injectable()
export class DirectorWorker {
  private readonly workerId = randomUUID();
  private lastCleanup = 0;
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_CLIENT) private readonly storage: StorageClient,
    private readonly config: ConfigService,
    private readonly providers: DirectorProviders,
    private readonly service: DirectorService,
  ) {}
  async heartbeat() {
    const enabledProviders =
      this.config.get("DIRECTOR_ENABLE_PAID_GENERATION") === "true"
        ? (["veo", "higgsfield"] as const).filter((id) => this.providers.configured(id))
        : [];
    await this.prisma.client.directorWorker.upsert({
      where: { id: this.workerId },
      create: {
        id: this.workerId,
        providers: enabledProviders,
      },
      update: {
        seenAt: new Date(),
        providers: enabledProviders,
      },
    });
    if (Date.now() - this.lastCleanup > 60000) {
      this.lastCleanup = Date.now();
      const completed = await this.prisma.client.$queryRaw<
        DirectorJob[]
      >`SELECT * FROM "DirectorJob" WHERE kind = 'GENERATE' AND status IN ('SUCCEEDED', 'FAILED', 'CANCELLED') AND "updatedAt" < (now() AT TIME ZONE 'UTC') - interval '1 hour' AND COALESCE(input->>'inputsCleaned', 'false') <> 'true' ORDER BY "createdAt" LIMIT 100`;
      for (const job of completed) await this.cleanupInputs(job).catch(() => undefined);
    }
  }
  private inputKey(job: DirectorJob, assetId: string) {
    return `actor-private/director/${job.ownerId}/${job.projectId}/provider-inputs/${job.id}/${assetId}.mp4`;
  }
  private async cleanupInputs(job: DirectorJob) {
    const { document } = snapshotSchema.parse(job.input),
      shot = document.shots.find((candidate) => candidate.id === job.shotId);
    if (!shot) return;
    for (const segment of directorPerformanceSegments(document, shot))
      await this.storage.deleteObject(this.inputKey(job, segment.assetId));
    await this.prisma.client.directorJob.updateMany({
      where: { id: job.id, status: { in: ["SUCCEEDED", "FAILED", "CANCELLED"] } },
      data: { input: directorJson({ ...(job.input as object), inputsCleaned: true }) },
    });
  }
  async verifyRuntime() {
    if (this.config.get("STORAGE_PROVIDER") !== "supabase" || !this.storage.uploadObject)
      throw new Error("Director worker requires private Supabase Storage.");
    for (const variable of ["FFMPEG_PATH", "FFPROBE_PATH"])
      await runVideoCommand(
        this.config.get(variable, variable === "FFMPEG_PATH" ? "ffmpeg" : "ffprobe"),
        ["-version"],
        AbortSignal.timeout(10000),
      );
    await this.heartbeat();
  }
  private guard(job: DirectorJob) {
    return { id: job.id, claimToken: job.claimToken, status: { in: directorActiveStatuses } };
  }
  private async update(job: DirectorJob, data: Prisma.DirectorJobUpdateManyMutationInput) {
    const result = await this.prisma.client.directorJob.updateMany({
      where: this.guard(job),
      data,
    });
    if (!result.count) throw new Error("Le traitement a été annulé ou repris par un autre worker.");
  }
  private async claim() {
    return this.prisma.client.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "DirectorJob" WHERE COALESCE(input->>'execution', 'server') <> 'browser' AND status IN ('QUEUED', 'PROCESSING', 'SUBMITTING', 'WAITING_PROVIDER') AND "nextRunAt" <= (now() AT TIME ZONE 'UTC') AND ("leaseUntil" IS NULL OR "leaseUntil" < (now() AT TIME ZONE 'UTC')) ORDER BY "createdAt" LIMIT 1 FOR UPDATE SKIP LOCKED`;
      if (!rows[0]) return null;
      return transaction.directorJob.update({
        where: { id: rows[0].id },
        data: { claimToken: randomUUID(), leaseUntil: new Date(Date.now() + 45000) },
      });
    });
  }
  async tick(signal: AbortSignal): Promise<boolean> {
    const job = await this.claim();
    if (!job) return false;
    const controller = new AbortController();
    const combined = AbortSignal.any([signal, controller.signal]);
    let renewing = false;
    const renewal = setInterval(() => {
      if (renewing) return;
      renewing = true;
      this.prisma.client.directorJob
        .updateMany({ where: this.guard(job), data: { leaseUntil: new Date(Date.now() + 45000) } })
        .then((result) => {
          if (!result.count) controller.abort();
        })
        .catch(() => controller.abort())
        .finally(() => {
          renewing = false;
        });
    }, 5000);
    let directory: string | undefined;
    try {
      if (job.status === "SUBMITTING" && !job.providerRequest)
        throw new Error(
          "Soumission fournisseur ambiguë après interruption. Vérifiez la facturation et le tableau de bord fournisseur avant une nouvelle demande ; aucun renvoi automatique.",
        );
      if (Date.now() - job.createdAt.getTime() > 2 * 3600000)
        throw new Error(
          "Le traitement a dépassé deux heures. Vérifiez le fournisseur avant de relancer.",
        );
      directory = await mkdtemp(join(tmpdir(), "actbyme-director-"));
      if (job.kind === "INSPECT") await this.inspect(job, directory, combined);
      else if (job.kind === "EXPORT") await this.export(job, directory, combined);
      else if (job.kind === "GENERATE") await this.generate(job, directory, combined);
      else throw new Error("Type de traitement inconnu.");
    } catch (error) {
      if (signal.aborted) {
        // Preserve checkpoints. A submitted request is never posted again after restart.
        await this.prisma.client.directorJob.updateMany({
          where: this.guard(job),
          data: { claimToken: null, leaseUntil: null },
        });
      } else if (
        error instanceof DirectorProviderError &&
        error.transient &&
        job.providerRequest &&
        job.attempts < 6
      ) {
        await this.prisma.client.directorJob.updateMany({
          where: this.guard(job),
          data: {
            attempts: { increment: 1 },
            stage: "Suivi fournisseur temporairement indisponible ; reprise programmée",
            nextRunAt: new Date(Date.now() + Math.min(60000, 2000 * 2 ** job.attempts)),
            claimToken: null,
            leaseUntil: null,
          },
        });
      } else {
        const message =
          error instanceof Error ? error.message.slice(0, 1500) : "Échec du traitement vidéo.";
        await this.prisma.client.$transaction(async (transaction) => {
          const changed = await transaction.directorJob.updateMany({
            where: this.guard(job),
            data: {
              status: "FAILED",
              error: message,
              stage: "Échec",
              claimToken: null,
              leaseUntil: null,
            },
          });
          if (changed.count && job.kind === "INSPECT") {
            const assetId = z.object({ assetId: z.uuid() }).parse(job.input).assetId;
            await transaction.directorAsset.updateMany({
              where: { id: assetId, projectId: job.projectId, status: "INSPECTING" },
              data: { status: "FAILED", error: message },
            });
          }
        });
      }
    } finally {
      clearInterval(renewal);
      if (directory) await rm(directory, { recursive: true, force: true });
    }
    return true;
  }
  private async localAsset(projectId: string, id: string, directory: string, status = "READY") {
    const asset = await this.prisma.client.directorAsset.findFirst({
      where: { id, projectId, status },
    });
    if (!asset) throw new Error("Ressource privée introuvable ou non vérifiée.");
    const info = await this.storage.getObjectInfo(asset.storageKey);
    if (!info.sizeBytes || info.sizeBytes > 200 * 1024 * 1024 || info.sizeBytes !== asset.sizeBytes)
      throw new Error("La ressource stockée ne correspond plus à sa version vérifiée.");
    const bytes = await this.storage.downloadObject(asset.storageKey);
    if (bytes.byteLength !== asset.sizeBytes) throw new Error("Téléchargement incomplet.");
    const localPath = join(directory, `${asset.id}.media`);
    await writeFile(localPath, bytes);
    return { ...asset, localPath };
  }
  private async inspect(job: DirectorJob, directory: string, signal: AbortSignal) {
    const { assetId } = z.object({ assetId: z.uuid() }).parse(job.input);
    await this.update(job, {
      status: "PROCESSING",
      stage: "Vérification réelle du fichier",
      progress: 20,
    });
    const asset = await this.localAsset(job.projectId, assetId, directory, "INSPECTING");
    const metadata = await inspectDirectorAsset(
      asset.localPath,
      asset.contentType,
      this.config.get("FFPROBE_PATH", "ffprobe"),
      signal,
    );
    await this.prisma.client.$transaction(async (transaction) => {
      const changed = await transaction.directorJob.updateMany({
        where: this.guard(job),
        data: {
          status: "SUCCEEDED",
          progress: 100,
          stage: "Ressource vérifiée",
          claimToken: null,
          leaseUntil: null,
        },
      });
      if (!changed.count) throw new Error("Inspection annulée.");
      await transaction.directorAsset.update({
        where: { id: asset.id },
        data: { ...metadata, status: "READY" },
      });
    });
  }
  private async persistResult(
    job: DirectorJob,
    path: string,
    name: string,
    metadata: Awaited<ReturnType<typeof inspectDirectorAsset>>,
  ) {
    const assetId = randomUUID(),
      key = `actor-private/director/${job.ownerId}/${job.projectId}/results/${assetId}.mp4`;
    const bytes = await readFile(path);
    if (bytes.byteLength > 200 * 1024 * 1024)
      throw new Error("L’export dépasse la limite de 200 MiB. Réduisez la durée du projet.");
    await this.storage.uploadObject!(key, bytes, "video/mp4");
    try {
      await this.prisma.client.$transaction(async (transaction) => {
        if (job.kind === "GENERATE") {
          await transaction.$queryRaw`SELECT id FROM "DirectorProject" WHERE id = ${job.projectId}::uuid FOR UPDATE`;
          const { document } = snapshotSchema.parse(job.input);
          await this.service.assertGenerationRights(transaction, job.projectId, document);
        }
        const changed = await transaction.directorJob.updateMany({
          where: this.guard(job),
          data: {
            status: "SUCCEEDED",
            progress: 100,
            stage:
              job.kind === "EXPORT"
                ? "Publicité MP4 disponible"
                : "Plan disponible ; vérifiez-le avant de l’utiliser",
            resultAssetId: assetId,
            claimToken: null,
            leaseUntil: null,
          },
        });
        if (!changed.count) throw new Error("Le résultat a été annulé avant publication.");
        await transaction.directorAsset.create({
          data: {
            id: assetId,
            projectId: job.projectId,
            name,
            kind: "clip",
            contentType: "video/mp4",
            sizeBytes: bytes.byteLength,
            storageKey: key,
            status: "READY",
            ...metadata,
            rights: directorJson({
              sourceJobId: job.id,
              version: job.version,
              provider: job.provider,
              ownerId: job.ownerId,
            }),
            aiTransferAllowed: false,
          },
        });
      });
    } catch (error) {
      await this.storage.deleteObject(key).catch(() => undefined);
      throw error;
    }
  }
  private async export(job: DirectorJob, directory: string, signal: AbortSignal) {
    const { document } = snapshotSchema.parse(job.input);
    await this.update(job, {
      status: "PROCESSING",
      stage: "Chargement des clips privés",
      progress: 5,
    });
    const ids = new Set(
      [
        ...document.shots.map((shot) => shot.clipAssetId),
        ...document.tracks.map((item) => item.assetId),
      ].filter((id): id is string => Boolean(id)),
    );
    const assets: DirectorRenderAsset[] = [];
    for (const id of ids) assets.push(await this.localAsset(job.projectId, id, directory));
    const output = await renderDirector(
      document,
      assets,
      directory,
      this.config.get("FFMPEG_PATH", "ffmpeg"),
      signal,
      (progress, stage) => this.update(job, { progress, stage }),
    );
    const metadata = await inspectDirectorAsset(
      output,
      "video/mp4",
      this.config.get("FFPROBE_PATH", "ffprobe"),
      signal,
    );
    if (
      Math.abs(
        metadata.duration! - document.shots.reduce((total, shot) => total + shot.duration, 0),
      ) > 0.15
    )
      throw new Error("La durée de l’export ne correspond pas à la timeline.");
    await this.persistResult(
      job,
      output,
      `${document.title.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 100)}-v${job.version}.mp4`,
      metadata,
    );
  }
  private async generate(job: DirectorJob, directory: string, signal: AbortSignal) {
    if (this.config.get("DIRECTOR_ENABLE_PAID_GENERATION") !== "true")
      throw new Error("Génération payante désactivée sur ce processus.");
    const { document } = snapshotSchema.parse(job.input);
    const shot = document.shots.find((candidate) => candidate.id === job.shotId);
    const provider = z.enum(["veo", "higgsfield"]).parse(job.provider);
    if (!shot) throw new Error("Plan absent du snapshot de production.");
    await this.service.assertGenerationRights(this.prisma.client, job.projectId, document);
    if (!this.providers.configured(provider))
      throw new Error("Identifiants fournisseur absents sur le worker.");
    const request = job.providerRequest;
    if (!request) {
      await this.update(job, {
        status: "PROCESSING",
        stage: "Préparation des références autorisées",
        progress: 10,
      });
      const references = [];
      for (const id of directorShotReferenceIds(document, shot)) {
        const asset = await this.localAsset(job.projectId, id, directory);
        if (!asset.aiTransferAllowed)
          throw new Error("Le transfert IA d’une référence n’est pas autorisé.");
        const segment = directorPerformanceSegments(document, shot).find(
          (segment) => segment.assetId === id,
        );
        let referenceKey = asset.storageKey;
        if (provider === "higgsfield" && segment) {
          const excerpt = join(directory, `${id}-excerpt.mp4`);
          await prepareReference(
            asset.localPath,
            excerpt,
            segment.sourceStart,
            segment.duration,
            this.config.get("FFMPEG_PATH", "ffmpeg"),
            signal,
          );
          referenceKey = this.inputKey(job, asset.id);
          await this.storage.uploadObject!(referenceKey, await readFile(excerpt), "video/mp4");
        }
        references.push({
          contentType: asset.contentType,
          url: await this.storage.createSignedReadUrl(referenceKey, 3600),
          ...(provider === "veo" ? { bytes: await readFile(asset.localPath) } : {}),
        });
      }
      await this.update(job, {
        status: "SUBMITTING",
        stage: "Soumission payante au fournisseur",
        progress: 20,
      });
      const submitted = await this.providers.submit(provider, document, shot, references, signal);
      const changed = await this.prisma.client.directorJob.updateMany({
        where: this.guard(job),
        data: {
          providerRequest: directorJson(submitted),
          status: "WAITING_PROVIDER",
          stage: "Génération fournisseur en cours",
          progress: 35,
          claimToken: null,
          leaseUntil: null,
          nextRunAt: new Date(Date.now() + 10000),
        },
      });
      if (!changed.count)
        await this.providers
          .cancel(provider, submitted, AbortSignal.timeout(10000))
          .catch(() => false);
      return;
    }
    const result = await this.providers.poll(provider, request, signal);
    if (!result.done) {
      await this.update(job, {
        status: "WAITING_PROVIDER",
        stage: "Génération fournisseur en cours",
        claimToken: null,
        leaseUntil: null,
        nextRunAt: new Date(Date.now() + 10000),
      });
      return;
    }
    await this.update(job, { stage: "Vérification du clip généré", progress: 80 });
    const output = join(directory, "generated.mp4");
    await writeFile(output, await this.providers.download(provider, result.url, signal));
    const metadata = await inspectDirectorAsset(
      output,
      "video/mp4",
      this.config.get("FFPROBE_PATH", "ffprobe"),
      signal,
    );
    if (metadata.duration! < shot.duration - 0.08)
      throw new Error("Le fournisseur a produit un clip plus court que le plan demandé.");
    await this.persistResult(
      job,
      output,
      `${shot.name.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 90)}-${job.id.slice(0, 8)}.mp4`,
      metadata,
    );
    await this.cleanupInputs(job).catch(() => undefined);
  }
}
