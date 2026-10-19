import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, type VirtualDirectorJob } from "@actbyme/database";
import { virtualJobInputSchema, virtualDirectorLimits, virtualShotError } from "@actbyme/shared";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { PrismaService } from "../database/prisma.service.js";
import { STORAGE_CLIENT, type StorageClient } from "../storage/storage.types.js";
import {
  VIDEO_PROVIDER,
  type VideoProvider,
  validatedProviderRequest,
  ProviderError,
} from "./video-provider.js";
import {
  downloadProviderVideo,
  inspectVideo,
  prepareReference,
  restoreReferenceAudio,
  runVideoCommand,
  writeBlenderScene,
} from "./video-processing.js";

const json = (value: unknown) => value as Prisma.InputJsonValue;
const active = ["QUEUED", "PROCESSING", "SUBMITTING", "WAITING_PROVIDER"];
@Injectable()
export class VirtualDirectorWorker {
  private blenderReady = false;
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_CLIENT) private readonly storage: StorageClient,
    private readonly config: ConfigService,
    @Inject(VIDEO_PROVIDER) private readonly provider: VideoProvider,
  ) {}
  private binary(name: string, fallback: string) {
    return this.config.get<string>(name)?.trim() || fallback;
  }
  async verifyRuntime() {
    const signal = AbortSignal.timeout(10000);
    await runVideoCommand(this.binary("FFMPEG_PATH", "ffmpeg"), ["-version"], signal, 10000);
    await runVideoCommand(this.binary("FFPROBE_PATH", "ffprobe"), ["-version"], signal, 10000);
    if (!this.storage.uploadObject || this.config.get("STORAGE_PROVIDER") !== "supabase")
      throw new Error("The video worker requires private Supabase Storage.");
    this.blenderReady = await runVideoCommand(
      this.binary("BLENDER_PATH", "blender"),
      ["--version"],
      AbortSignal.timeout(10000),
      10000,
    ).then(
      () => true,
      () => false,
    );
    await this.heartbeat();
  }
  async heartbeat() {
    await this.prisma.client.virtualDirectorWorker.upsert({
      where: { id: "video-worker" },
      create: { id: "video-worker", seenAt: new Date(), blender: this.blenderReady },
      update: { seenAt: new Date(), blender: this.blenderReady },
    });
  }
  private async claim() {
    const token = randomUUID();
    const rows = await this.prisma.client.$queryRaw<VirtualDirectorJob[]>`
      UPDATE "VirtualDirectorJob" SET "token"=${token}::uuid,"leaseUntil"=(NOW() AT TIME ZONE 'UTC')+INTERVAL '45 seconds'
      WHERE id=(SELECT id FROM "VirtualDirectorJob"
        WHERE status IN ('QUEUED','PROCESSING','SUBMITTING','WAITING_PROVIDER')
        AND "nextRunAt"<=(NOW() AT TIME ZONE 'UTC') AND ("leaseUntil" IS NULL OR "leaseUntil"<(NOW() AT TIME ZONE 'UTC'))
        ORDER BY "nextRunAt", "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1)
      RETURNING *`;
    return rows[0] ?? null;
  }
  private async change(
    job: VirtualDirectorJob,
    data: Prisma.VirtualDirectorJobUpdateManyMutationInput,
  ) {
    const changed = await this.prisma.client.virtualDirectorJob.updateMany({
      where: { id: job.id, token: job.token, status: { in: active } },
      data,
    });
    if (!changed.count) throw new Error("The task lease was revoked.");
  }
  async tick(parentSignal: AbortSignal = AbortSignal.timeout(15 * 60000)) {
    await this.cancelProviderRequests(parentSignal);
    await this.cleanup();
    const job = await this.claim();
    if (!job) return false;
    const control = new AbortController();
    const signal = AbortSignal.any([
      parentSignal,
      control.signal,
      AbortSignal.timeout(Math.max(1, Math.min(15 * 60000, job.deadlineAt.getTime() - Date.now()))),
    ]);
    let renewing = false;
    const timer = setInterval(() => {
      if (renewing) return;
      renewing = true;
      void this.prisma.client.virtualDirectorJob
        .updateMany({
          where: { id: job.id, token: job.token, status: { in: active } },
          data: { leaseUntil: new Date(Date.now() + 45000) },
        })
        .then(
          (result) => {
            if (!result.count) control.abort();
          },
          () => control.abort(),
        )
        .finally(() => {
          renewing = false;
        });
    }, 10000);
    const directory = await mkdtemp(join(tmpdir(), "actbyme-vd-"));
    try {
      if (job.deadlineAt.getTime() < Date.now())
        throw new Error(
          "Task deadline exceeded. A submitted provider request may still be billed; review its status before retrying.",
        );
      if (job.status === "SUBMITTING")
        throw new Error(
          "Provider submission was interrupted before its receipt was saved. Check the provider dashboard before manually generating again; the request may have been billed.",
        );
      await this.change(job, {
        status: job.providerRequest ? "WAITING_PROVIDER" : "PROCESSING",
        stage: job.providerRequest ? "PROVIDER" : "PREPARING",
      });
      if (job.kind === "INSPECT") await this.inspect(job, directory, signal);
      else if (job.kind === "PREVIEW") await this.preview(job, directory, signal);
      else if (job.kind === "GENERATE") await this.generate(job, directory, signal);
      else throw new Error("Unsupported video task type.");
    } catch (error) {
      const current = await this.prisma.client.virtualDirectorJob.findUnique({
        where: { id: job.id },
      });
      if (current?.token !== job.token || !active.includes(current.status)) return true;
      if (parentSignal.aborted && current.status !== "SUBMITTING") {
        await this.change(job, {
          token: null,
          leaseUntil: null,
          nextRunAt: new Date(Date.now() + 5000),
        });
      } else if (
        current.providerRequest &&
        current.failures < 6 &&
        ((error instanceof ProviderError && error.transient) ||
          error instanceof TypeError ||
          (error as Error).name === "TimeoutError")
      ) {
        await this.change(job, {
          status: "WAITING_PROVIDER",
          stage: "RETRYING_PROVIDER",
          failures: { increment: 1 },
          token: null,
          leaseUntil: null,
          nextRunAt: new Date(Date.now() + Math.min(120000, 5000 * 2 ** current.failures)),
        });
      } else {
        const message =
          current.status === "SUBMITTING"
            ? "Provider submission failed without a saved receipt. Check its dashboard before retrying: a request may have been billed."
            : error instanceof ProviderError
              ? error.message
              : error instanceof Error && error.message.length < 450
                ? error.message
                : "Video processing failed. Review the reference and worker configuration.";
        await this.change(job, {
          status: "FAILED",
          stage: current.status === "SUBMITTING" ? "SUBMISSION_UNCERTAIN" : "FAILED",
          error: message,
          token: null,
          leaseUntil: null,
          completedAt: new Date(),
        });
        if (job.kind === "INSPECT" && job.referenceId)
          await this.prisma.client.virtualDirectorReference.updateMany({
            where: { id: job.referenceId, status: "PROCESSING" },
            data: { status: "FAILED", error: message },
          });
      }
    } finally {
      clearInterval(timer);
      await rm(directory, { recursive: true, force: true });
    }
    return true;
  }
  private async writePrivate(key: string, bytes: Uint8Array, contentType: string) {
    if (!this.storage.uploadObject) throw new Error("Private worker uploads are unavailable.");
    await this.storage.uploadObject(key, bytes, contentType);
  }
  private async reference(job: VirtualDirectorJob) {
    const reference = await this.prisma.client.virtualDirectorReference.findFirst({
      where: { id: job.referenceId ?? "", projectId: job.projectId },
    });
    if (!reference) throw new Error("Reference video is no longer available.");
    if (reference.sourceTakeId) {
      const take = await this.prisma.client.performanceTake.findUnique({
        where: { id: reference.sourceTakeId },
      });
      if (!take || take.uploadAttemptId !== reference.sourceAttemptId)
        throw new Error(
          "The original performance was replaced. Import the current performance with its consent.",
        );
      const consentId = (reference.rights as { consentId?: string }).consentId;
      const consent = consentId
        ? await this.prisma.client.performanceConsent.findUnique({ where: { id: consentId } })
        : null;
      const project = await this.prisma.client.performanceProject.findUnique({
        where: { id: job.projectId },
        include: { brief: true },
      });
      if (
        !consent?.acceptedAt ||
        !consent.aiTransformationAllowed ||
        consent.approvedBriefVersion !== project?.brief?.approvedVersion
      )
        throw new Error("The performance consent no longer authorizes this transformation.");
    }
    return reference;
  }
  private async downloadReference(key: string, size: number) {
    if (size > virtualDirectorLimits.maxUploadBytes)
      throw new Error("Reference exceeds the upload size limit.");
    const info = await this.storage.getObjectInfo(key);
    if (info.sizeBytes !== size) throw new Error("Reference bytes changed after upload.");
    const bytes = await this.storage.downloadObject(key);
    if (bytes.byteLength !== size) throw new Error("The reference download is incomplete.");
    return bytes;
  }
  private async inspect(job: VirtualDirectorJob, directory: string, signal: AbortSignal) {
    const reference = await this.reference(job);
    const bytes = await this.downloadReference(reference.storageKey, reference.sizeBytes);
    const path = join(directory, "reference.mp4");
    await writeFile(path, bytes);
    const metadata = await inspectVideo(path, this.binary("FFPROBE_PATH", "ffprobe"), signal);
    if (metadata.duration < 4 || metadata.duration > virtualDirectorLimits.maxReferenceSeconds)
      throw new Error("Reference performance must last between 4 and 120 seconds.");
    // Copy imported takes to an immutable, independently owned production object.
    const key = `actor-private/virtual-director/${job.projectId}/references/${reference.id}.mp4`;
    await this.writePrivate(key, bytes, "video/mp4");
    await this.prisma.client.$transaction(async (transaction) => {
      const changed = await transaction.virtualDirectorJob.updateMany({
        where: { id: job.id, token: job.token, status: "PROCESSING" },
        data: {
          status: "COMPLETED",
          stage: "READY",
          completedAt: new Date(),
          token: null,
          leaseUntil: null,
        },
      });
      if (!changed.count) throw new Error("The task lease was revoked.");
      await transaction.virtualDirectorReference.update({
        where: { id: reference.id },
        data: { ...metadata, status: "READY", storageKey: key, error: null },
      });
    });
    if (
      reference.storageKey.startsWith("actor-private/virtual-director/") &&
      reference.storageKey !== key
    )
      await this.storage.deleteObject(reference.storageKey).catch(() => undefined);
  }
  private async preview(job: VirtualDirectorJob, directory: string, signal: AbortSignal) {
    if (!this.blenderReady) throw new Error("Blender is unavailable on the video worker.");
    const input = virtualJobInputSchema.parse(job.input);
    const scenePath = join(directory, "scene.json");
    const frames = join(directory, "frames");
    await mkdir(frames);
    await writeBlenderScene(input, scenePath);
    await this.change(job, { stage: "RENDERING_BLENDER" });
    const script =
      this.config.get<string>("BLENDER_PREVIEW_SCRIPT") ||
      resolve(process.cwd(), "workers/blender-preview.py");
    await runVideoCommand(
      this.binary("BLENDER_PATH", "blender"),
      [
        "--background",
        "--factory-startup",
        "--disable-autoexec",
        "--threads",
        "2",
        "--python",
        script,
        "--",
        scenePath,
        frames,
      ],
      signal,
      10 * 60000,
    );
    const output = join(directory, "preview.mp4");
    await runVideoCommand(
      this.binary("FFMPEG_PATH", "ffmpeg"),
      [
        "-nostdin",
        "-v",
        "error",
        "-framerate",
        "8",
        "-i",
        join(frames, "frame-%04d.png"),
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-y",
        output,
      ],
      signal,
    );
    await this.finish(
      job,
      `actor-private/virtual-director/${job.projectId}/previews/${job.id}-${job.token}.mp4`,
      await readFile(output),
    );
  }
  private async generate(job: VirtualDirectorJob, directory: string, signal: AbortSignal) {
    const input = virtualJobInputSchema.parse(job.input);
    const reference = await this.reference(job);
    if (reference.status !== "READY") throw new Error("Reference is not ready.");
    const shotError = virtualShotError(
      {
        ...input.shot,
        start: input.sourceStartSeconds,
        end: input.sourceStartSeconds + input.shot.end - input.shot.start,
      },
      reference.duration ?? undefined,
    );
    if (shotError) throw new Error(shotError);
    const source = join(directory, "source.mp4"),
      clip = join(directory, "clip.mp4");
    const clipKey = `actor-private/virtual-director/${job.projectId}/clips/${job.id}.mp4`;
    if (!job.providerRequest) {
      await writeFile(
        source,
        await this.downloadReference(reference.storageKey, reference.sizeBytes),
      );
      await prepareReference(
        source,
        clip,
        input.sourceStartSeconds,
        input.shot.end - input.shot.start,
        this.binary("FFMPEG_PATH", "ffmpeg"),
        signal,
      );
      const bytes = await readFile(clip);
      if (bytes.length >= 50 * 1024 * 1024)
        throw new Error("The normalized reference exceeds the provider's 50 MB limit.");
      await this.writePrivate(clipKey, bytes, "video/mp4");
      const address = await this.storage.createSignedReadUrl(clipKey, 3600);
      const project = await this.prisma.client.performanceProject.findUniqueOrThrow({
        where: { id: job.projectId },
        select: { ownerId: true },
      });
      // Durable SUBMITTING checkpoint prevents automatic repeat billing after an ambiguous POST.
      await this.change(job, { status: "SUBMITTING", stage: "SUBMITTING_PROVIDER" });
      const receipt = await this.provider.submit(input, address, project.ownerId, signal);
      const saved = await this.prisma.client.virtualDirectorJob.updateMany({
        where: { id: job.id, token: job.token, status: "SUBMITTING" },
        data: {
          providerRequest: json(receipt),
          status: "WAITING_PROVIDER",
          stage: "PROVIDER",
          token: null,
          leaseUntil: null,
          nextRunAt: new Date(Date.now() + 5000),
        },
      });
      if (!saved.count)
        await this.prisma.client.virtualDirectorJob.updateMany({
          where: {
            id: job.id,
            status: { in: ["CANCELLED", "FAILED"] },
            providerRequest: { equals: Prisma.DbNull },
          },
          data: { providerRequest: json(receipt), nextRunAt: new Date() },
        });
      return;
    }
    const result = await this.provider.poll(validatedProviderRequest(job.providerRequest), signal);
    if (result.status === "WAITING") {
      await this.change(job, {
        status: "WAITING_PROVIDER",
        stage: "PROVIDER",
        failures: 0,
        token: null,
        leaseUntil: null,
        nextRunAt: new Date(Date.now() + 8000),
      });
      return;
    }
    await this.change(job, { stage: "SAVING_VIDEO" });
    const generated = join(directory, "generated.mp4");
    await writeFile(generated, await downloadProviderVideo(result.url, signal));
    const metadata = await inspectVideo(generated, this.binary("FFPROBE_PATH", "ffprobe"), signal);
    const duration = input.shot.end - input.shot.start;
    if (Math.abs(metadata.duration - duration) > 0.6)
      throw new Error(
        "The provider changed the shot duration. Regenerate or use another provider; temporal continuity cannot be confirmed.",
      );
    const clipInfo = await this.storage.getObjectInfo(clipKey);
    if (!clipInfo.sizeBytes || clipInfo.sizeBytes > 50 * 1024 * 1024)
      throw new Error("The original reference clip is unavailable.");
    await writeFile(clip, await this.storage.downloadObject(clipKey));
    const output = join(directory, "final.mp4");
    await restoreReferenceAudio(
      generated,
      clip,
      output,
      reference.hasAudio ?? false,
      duration,
      this.binary("FFMPEG_PATH", "ffmpeg"),
      signal,
    );
    await this.finish(
      job,
      `actor-private/virtual-director/${job.projectId}/results/${job.id}-${job.token}.mp4`,
      await readFile(output),
    );
    await this.storage.deleteObject(clipKey).catch(() => undefined);
  }
  private async finish(job: VirtualDirectorJob, key: string, bytes: Uint8Array) {
    await this.writePrivate(key, bytes, "video/mp4");
    try {
      await this.change(job, {
        outputKey: key,
        status: "COMPLETED",
        stage: "READY_FOR_REVIEW",
        error: null,
        completedAt: new Date(),
        token: null,
        leaseUntil: null,
      });
    } catch (error) {
      await this.storage.deleteObject(key).catch(() => undefined);
      throw error;
    }
  }
  private async cleanup() {
    const jobs = await this.prisma.client.virtualDirectorJob.findMany({
      where: {
        status: { in: ["COMPLETED", "FAILED", "CANCELLED"] },
        cleanedAt: null,
        completedAt: { lt: new Date(Date.now() - 3600000) },
      },
      take: 5,
    });
    for (const job of jobs) {
      await this.storage
        .deleteObject(`actor-private/virtual-director/${job.projectId}/clips/${job.id}.mp4`)
        .catch(() => undefined);
      if (job.kind === "INSPECT" && job.referenceId) {
        const reference = await this.prisma.client.virtualDirectorReference.findUnique({
          where: { id: job.referenceId },
        });
        if (reference?.status === "FAILED")
          await this.storage
            .deleteObject(
              `actor-private/virtual-director/${job.projectId}/references/${reference.id}.mp4`,
            )
            .catch(() => undefined);
      }
      await this.prisma.client.virtualDirectorJob.update({
        where: { id: job.id },
        data: { cleanedAt: new Date() },
      });
    }
  }
  private async cancelProviderRequests(signal: AbortSignal) {
    const jobs = await this.prisma.client.virtualDirectorJob.findMany({
      where: {
        status: { in: ["CANCELLED", "FAILED"] },
        stage: { notIn: ["PROVIDER_CANCELLED", "PROVIDER_CANCEL_FAILED"] },
        providerRequest: { not: Prisma.DbNull },
        nextRunAt: { lte: new Date() },
      },
      take: 5,
    });
    for (const job of jobs) {
      try {
        await this.provider.cancel(validatedProviderRequest(job.providerRequest), signal);
        await this.prisma.client.virtualDirectorJob.update({
          where: { id: job.id },
          data: { stage: "PROVIDER_CANCELLED" },
        });
      } catch {
        await this.prisma.client.virtualDirectorJob.update({
          where: { id: job.id },
          data: {
            stage: job.failures >= 6 ? "PROVIDER_CANCEL_FAILED" : job.stage,
            failures: { increment: 1 },
            nextRunAt: new Date(Date.now() + 60000),
          },
        });
      }
    }
  }
}
