import {
  Inject,
  Injectable,
  Logger,
  type OnModuleInit,
  type OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { PrismaService } from "../database/prisma.service.js";
import { STORAGE_CLIENT, type StorageClient } from "../storage/storage.types.js";
import { inspectDirectorBytes } from "./director-inspection.js";

@Injectable()
export class DirectorInspectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DirectorInspectionService.name);
  private readonly shutdown = new AbortController();
  private timer?: ReturnType<typeof setTimeout>;
  private running?: Promise<void>;
  private lastExpiry = 0;
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_CLIENT) private readonly storage: StorageClient,
    private readonly config: ConfigService,
  ) {}
  onModuleInit() {
    if (this.config.get("STORAGE_PROVIDER") !== "supabase") return;
    const run = () => {
      this.running = this.tick()
        .catch(() => {
          this.logger.warn("Inspection Director indisponible ; reprise automatique.");
        })
        .finally(() => {
          if (!this.shutdown.signal.aborted) {
            this.timer = setTimeout(run, 3000);
            this.timer.unref();
          }
        });
    };
    run();
  }
  async onModuleDestroy() {
    this.shutdown.abort();
    clearTimeout(this.timer);
    await this.running;
  }
  async tick() {
    if (this.shutdown.signal.aborted) return;
    if (Date.now() - this.lastExpiry > 60000) {
      this.lastExpiry = Date.now();
      // A closed tab cannot keep a free browser export active forever.
      await this.prisma.client.directorJob.updateMany({
        where: {
          kind: "EXPORT",
          status: "PROCESSING",
          createdAt: { lt: new Date(Date.now() - 2 * 3600000) },
          input: { path: ["execution"], equals: "browser" },
        },
        data: {
          status: "FAILED",
          stage: "Export navigateur expiré",
          error: "L’onglet a été fermé ou l’export a dépassé deux heures. Relancez l’export.",
        },
      });
    }
    const job = await this.prisma.client.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "DirectorJob" WHERE kind = 'INSPECT' AND status IN ('QUEUED', 'PROCESSING') AND ("leaseUntil" IS NULL OR "leaseUntil" < (now() AT TIME ZONE 'UTC')) ORDER BY "createdAt" LIMIT 1 FOR UPDATE SKIP LOCKED`;
      if (!rows[0]) return null;
      return transaction.directorJob.update({
        where: { id: rows[0].id },
        data: {
          claimToken: randomUUID(),
          leaseUntil: new Date(Date.now() + 90000),
          status: "PROCESSING",
          stage: "Vérification du fichier dans l’API",
          progress: 20,
        },
      });
    });
    if (!job) return;
    const guard = { id: job.id, claimToken: job.claimToken, status: "PROCESSING" };
    const signal = AbortSignal.any([this.shutdown.signal, AbortSignal.timeout(60000)]);
    let assetId: string | undefined;
    try {
      assetId = z.object({ assetId: z.uuid() }).parse(job.input).assetId;
      const asset = await this.prisma.client.directorAsset.findFirstOrThrow({
        where: { id: assetId, projectId: job.projectId, status: "INSPECTING" },
      });
      if (asset.sizeBytes > 50 * 1024 * 1024)
        throw new Error("Import limité à 50 MiB sans worker dédié.");
      // The timeout releases this queue even if the storage transport stalls.
      const bytes = await new Promise<Uint8Array>((resolve, reject) => {
        const stop = () => reject(new Error("Le téléchargement a dépassé le délai autorisé."));
        signal.addEventListener("abort", stop, { once: true });
        this.storage
          .getObjectInfo(asset.storageKey)
          .then(async (info) => {
            if (
              info.sizeBytes !== asset.sizeBytes ||
              info.contentType?.split(";")[0] !== asset.contentType
            )
              throw new Error("La ressource stockée a changé.");
            signal.throwIfAborted();
            return this.storage.downloadObject(asset.storageKey);
          })
          .then(resolve, reject)
          .finally(() => signal.removeEventListener("abort", stop));
      });
      if (bytes.length !== asset.sizeBytes) throw new Error("Fichier incomplet.");
      const metadata = await inspectDirectorBytes(bytes, asset.contentType, signal);
      await this.prisma.client.$transaction(async (transaction) => {
        const changed = await transaction.directorJob.updateMany({
          where: guard,
          data: {
            status: "SUCCEEDED",
            stage: "Ressource vérifiée",
            progress: 100,
            claimToken: null,
            leaseUntil: null,
          },
        });
        if (changed.count)
          await transaction.directorAsset.updateMany({
            where: { id: asset.id, status: "INSPECTING" },
            data: { ...metadata, status: "READY" },
          });
      });
    } catch (error) {
      if (this.shutdown.signal.aborted) {
        await this.prisma.client.directorJob.updateMany({
          where: guard,
          data: { status: "QUEUED", claimToken: null, leaseUntil: null },
        });
        return;
      }
      const message = error instanceof Error ? error.message.slice(0, 1000) : "Fichier illisible.";
      await this.prisma.client.$transaction(async (transaction) => {
        const changed = await transaction.directorJob.updateMany({
          where: guard,
          data: {
            status: "FAILED",
            error: message,
            stage: "Échec de la vérification",
            claimToken: null,
            leaseUntil: null,
          },
        });
        if (changed.count && assetId)
          await transaction.directorAsset.updateMany({
            where: { id: assetId, projectId: job.projectId, status: "INSPECTING" },
            data: { status: "FAILED", error: message },
          });
      });
    }
  }
}
