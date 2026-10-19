import { createRequire } from "node:module";
import { Worker } from "node:worker_threads";
import { z } from "zod";

const require = createRequire(import.meta.url);
const resultSchema = z.object({
  media: z.object({
    track: z.array(
      z
        .object({
          "@type": z.string(),
          Format: z.string().optional(),
          Duration: z.coerce.number().optional(),
          Width: z.coerce.number().optional(),
          Height: z.coerce.number().optional(),
        })
        .passthrough(),
    ),
  }),
});

// Parse untrusted bytes outside the API event loop. No network, native binary or paid service.
export async function inspectDirectorBytes(
  bytes: Uint8Array,
  contentType: string,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  if (!bytes.length || bytes.length > 50 * 1024 * 1024) throw new Error("Fichier limité à 50 MiB.");
  const result = await new Promise<unknown>((resolve, reject) => {
    const worker = new Worker(
      `
      const { parentPort, workerData } = require('node:worker_threads');
      (async () => {
        const factory = require(workerData.modulePath).default;
        const info = await factory({ format: 'object', coverData: false, locateFile: () => workerData.wasmPath });
        try {
          const bytes = new Uint8Array(workerData.bytes);
          parentPort.postMessage(await info.analyzeData(bytes.length, (size, offset) => bytes.subarray(offset, offset + size)));
        } finally { info.close(); }
      })().catch(() => { throw new Error('Fichier média illisible.'); });
    `,
      {
        eval: true,
        workerData: {
          bytes,
          modulePath: require.resolve("mediainfo.js"),
          wasmPath: require.resolve("mediainfo.js/MediaInfoModule.wasm"),
        },
        resourceLimits: { maxOldGenerationSizeMb: 96 },
      },
    );
    let settled = false;
    const finish = (error?: Error, value?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal.removeEventListener("abort", stop);
      void worker.terminate();
      if (error) reject(error);
      else resolve(value);
    };
    const stop = () => finish(new Error("Vérification interrompue."));
    const timeout = setTimeout(
      () => finish(new Error("Vérification trop longue (30 secondes).")),
      30000,
    );
    signal.addEventListener("abort", stop, { once: true });
    worker.once("message", (value: unknown) => finish(undefined, value));
    worker.once("error", (error: unknown) =>
      finish(error instanceof Error ? error : new Error("Fichier média illisible.")),
    );
    worker.once("exit", () => finish(new Error("Inspection média interrompue.")));
    if (signal.aborted) stop();
  });
  const tracks = resultSchema.parse(result).media.track;
  const general = tracks.find((track) => track["@type"] === "General");
  const video = tracks.find((track) => track["@type"] === "Video");
  const image = tracks.find((track) => track["@type"] === "Image");
  const audio = tracks.find((track) => track["@type"] === "Audio");
  const containers: Record<string, string[]> = {
    "image/jpeg": ["JPEG"],
    "image/png": ["PNG"],
    "image/webp": ["WebP"],
    "video/mp4": ["MPEG-4"],
    "video/quicktime": ["MPEG-4"],
    "audio/mp4": ["MPEG-4"],
    "audio/mpeg": ["MPEG Audio"],
    "audio/wav": ["Wave"],
    "audio/x-wav": ["Wave"],
    "audio/ogg": ["Ogg"],
  };
  if (!general?.Format || !containers[contentType]?.includes(general.Format))
    throw new Error("Le format réel ne correspond pas au type déclaré.");
  const isImage = contentType.startsWith("image/");
  if (
    (isImage && !image) ||
    (contentType.startsWith("video/") && !video) ||
    (contentType.startsWith("audio/") && !audio)
  )
    throw new Error("Le fichier ne contient pas le média attendu.");
  const duration = general.Duration ?? video?.Duration ?? audio?.Duration;
  if (!isImage && (!duration || duration > 600))
    throw new Error("La ressource doit durer entre 0 et 600 secondes.");
  const picture = isImage ? image : video;
  if (
    picture &&
    (!picture.Width ||
      !picture.Height ||
      picture.Width < 32 ||
      picture.Height < 32 ||
      picture.Width > 7680 ||
      picture.Height > 7680)
  )
    throw new Error("La résolution doit être comprise entre 32 et 7680 pixels par côté.");
  return {
    duration: isImage ? null : duration!,
    width: picture?.Width ?? null,
    height: picture?.Height ?? null,
    hasAudio: Boolean(audio),
  };
}
