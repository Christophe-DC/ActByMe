import {
  isPerformanceMotion,
  motionStride,
  motionOffsets,
  performanceMotionVersion,
  smoothPerformanceMotion,
  type PerformanceMotion,
} from "@actbyme/shared";
type WorkerResult = { type: "ready" } | { type: "frame"; sample: Float32Array };

export async function analyzePerformanceMotion(
  source: Blob,
  signal: AbortSignal,
  progress: (percent: number, stage: string) => void,
  refresh = false,
): Promise<PerformanceMotion> {
  if (source.size > 50 * 1024 * 1024) throw new Error("Use a performance up to 50 MiB.");
  signal.throwIfAborted();
  progress(0, "Preparing movement analysis");
  const sourceHash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", await source.arrayBuffer())),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  const cached = refresh ? null : await motionCache("read", sourceHash).catch(() => null);
  signal.throwIfAborted();
  if (isPerformanceMotion(cached)) {
    progress(100, "Movement ready on this device");
    return cached;
  }
  const video = document.createElement("video"),
    url = URL.createObjectURL(source);
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  const worker = new Worker(new URL("./performance-motion.worker.ts", import.meta.url), {
    type: "module",
  });
  const stop = () => worker.terminate();
  signal.addEventListener("abort", stop, { once: true });
  let waiting: {
    resolve: (message: WorkerResult) => void;
    reject: (error: unknown) => void;
  } | null = null;
  const abort = () => waiting?.reject(signal.reason);
  signal.addEventListener("abort", abort, { once: true });
  worker.onmessage = (event) => {
    if (event.data.type === "progress") {
      progress(1, event.data.stage);
      return;
    }
    const current = waiting;
    waiting = null;
    if (event.data.type === "error") current?.reject(new Error(event.data.message));
    else current?.resolve(event.data);
  };
  worker.onerror = () => {
    waiting?.reject(
      new Error("Movement analysis could not start. Reload and try a recent desktop browser."),
    );
    waiting = null;
  };
  const call = (message: unknown, transfer: Transferable[] = [], timeout = 90000) =>
    new Promise<WorkerResult>((resolve, reject) => {
      signal.throwIfAborted();
      const timer = setTimeout(() => {
        waiting = null;
        reject(new Error("Movement analysis stopped responding. Retry or use camera-only mode."));
      }, timeout);
      waiting = {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      };
      worker.postMessage(message, transfer);
    });
  const event = async (name: "loadedmetadata" | "seeked") =>
    new Promise<void>((resolve, reject) => {
      const finish = (error?: unknown) => {
        clearTimeout(timer);
        video.removeEventListener(name, ready);
        video.removeEventListener("error", failed);
        signal.removeEventListener("abort", cancel);
        if (error) reject(error);
        else resolve();
      };
      const ready = () => finish(),
        failed = () => finish(new Error("The video could not be decoded for movement analysis.")),
        cancel = () => finish(signal.reason);
      const timer = setTimeout(
        () => finish(new Error("Video decoding timed out. Try an H.264 MP4.")),
        20000,
      );
      video.addEventListener(name, ready, { once: true });
      video.addEventListener("error", failed, { once: true });
      signal.addEventListener("abort", cancel, { once: true });
    });
  try {
    if (video.readyState < 1) await event("loadedmetadata");
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration < 0.5 || duration > 120)
      throw new Error("Movement analysis supports 0.5 seconds to 2 minutes.");
    await call({ type: "init", origin: window.location.origin }, [], 180000);
    const count = Math.ceil(duration * 24) + 1,
      times = new Float32Array(count),
      samples = new Float32Array(count * motionStride);
    const coverage = { body: 0, hands: 0, face: 0, legs: 0 };
    for (let frame = 0; frame < count; frame++) {
      signal.throwIfAborted();
      const time = Math.min(frame / 24, duration - 0.0001);
      if (Math.abs(video.currentTime - time) > 0.00001 || video.readyState < 2) {
        const ready = event("seeked");
        video.currentTime = time;
        await ready;
      }
      const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
      const image = await createImageBitmap(video, {
        resizeWidth: Math.max(1, Math.round(video.videoWidth * scale)),
        resizeHeight: Math.max(1, Math.round(video.videoHeight * scale)),
      });
      const response = await call({ type: "frame", image, time: time * 1000 }, [image]);
      if (response.type !== "frame") throw new Error("Unexpected movement analysis response.");
      const sample = response.sample;
      if (
        !(sample instanceof Float32Array) ||
        sample.length !== motionStride ||
        !sample.every(Number.isFinite)
      )
        throw new Error("Movement analysis returned invalid coordinates. Retry the analysis.");
      samples.set(sample, frame * motionStride);
      times[frame] = time;
      if ([11, 12].every((index) => sample[index * 4 + 3]! > 0.5)) coverage.body++;
      if (sample[201]! > 0.5 || sample[285]! > 0.5) coverage.hands++;
      if (sample[motionOffsets.face]! > 0.5) coverage.face++;
      if ([23, 24, 25, 26, 27, 28].every((index) => sample[index * 4 + 3]! > 0.5)) coverage.legs++;
      progress(
        3 + ((frame + 1) / count) * 94,
        `Analyzing movement ${Math.round(time * 10) / 10}s / ${Math.round(duration * 10) / 10}s`,
      );
    }
    for (const part of ["body", "hands", "face", "legs"] as const) coverage[part] /= count;
    if (coverage.body < 0.15)
      throw new Error(
        "No reliable person movement was found. Use a well-lit video with one person and visible shoulders and arms.",
      );
    const motion = smoothPerformanceMotion({
      version: performanceMotionVersion,
      sourceHash,
      duration,
      fps: 24,
      width: video.videoWidth,
      height: video.videoHeight,
      times,
      samples,
      coverage,
    });
    if (!isPerformanceMotion(motion))
      throw new Error("Movement analysis is incomplete. Retry the analysis.");
    progress(99, "Saving movement on this device");
    signal.throwIfAborted();
    await motionCache("write", sourceHash, motion).catch(() => undefined);
    signal.throwIfAborted();
    progress(100, "Movement ready");
    return motion;
  } finally {
    worker.terminate();
    signal.removeEventListener("abort", stop);
    signal.removeEventListener("abort", abort);
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
/** Bounded device-only cache: five performances, seven days; no landmarks sent to the API. */
async function motionCache(
  action: "read" | "write" | "delete",
  key: string,
  value?: PerformanceMotion,
) {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open("actbyme-performance-motion", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("motion", { keyPath: "key" });
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  try {
    return await new Promise<unknown>((resolve, reject) => {
      const transaction = database.transaction(
          "motion",
          action === "read" ? "readonly" : "readwrite",
        ),
        store = transaction.objectStore("motion");
      let found: unknown = null;
      transaction.oncomplete = () => resolve(found);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
      if (action === "read") {
        const request = store.get(`${performanceMotionVersion}:${key}`);
        request.onsuccess = () => {
          if (request.result?.at > Date.now() - 7 * 86400000) found = request.result.data;
        };
      } else if (action === "delete") store.delete(`${performanceMotionVersion}:${key}`);
      else {
        store.put({ key: `${performanceMotionVersion}:${key}`, at: Date.now(), data: value });
        const request = store.getAll();
        request.onsuccess = () => {
          const rows = request.result.sort((first, second) => second.at - first.at);
          for (const row of rows.filter(
            (row, index) => index >= 5 || row.at < Date.now() - 7 * 86400000,
          ))
            store.delete(row.key);
        };
      }
    });
  } finally {
    database.close();
  }
}
export const clearPerformanceMotionCache = (hash: string) => motionCache("delete", hash);
