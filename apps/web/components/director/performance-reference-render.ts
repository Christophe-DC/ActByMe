import { directorDuration, type DirectorDocument } from "@actbyme/shared";
import { createPerformanceScene } from "./performance-scene";

/** Deterministic offline frames: export never depends on playback speed or a MediaRecorder clock. */
export async function renderPerformanceReference(
  document: DirectorDocument,
  source: Blob | null,
  signal: AbortSignal,
  progress: (value: number, stage: string) => void,
) {
  if (!document.performance) throw new Error("Open a performance camera plan first.");
  const duration = directorDuration(document);
  if (duration > 120 || document.shots.length > 30 || (source?.size ?? 0) > 50 * 1024 * 1024)
    throw new Error("Reference export supports 2 minutes, 30 angles and a 50 MiB performance.");
  const fps = 24,
    width = document.aspectRatio === "16:9" ? 1280 : 720,
    height = document.aspectRatio === "9:16" ? 1280 : 720;
  const frames = Math.ceil(duration * fps);
  const canvas = window.document.createElement("canvas");
  const drawing = window.document.createElement("canvas");
  drawing.width = width;
  drawing.height = height;
  const context = drawing.getContext("2d");
  if (!context) throw new Error("Your browser cannot create video frames.");
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  progress(0, "Loading the studio figure");
  const scene = await createPerformanceScene(canvas, width, height, signal);
  const ffmpeg = new FFmpeg();
  const deadline = new AbortController();
  signal = AbortSignal.any([signal, deadline.signal]);
  const stop = () => ffmpeg.terminate();
  signal.addEventListener("abort", stop, { once: true });
  const timer = setTimeout(() => deadline.abort(), 60 * 60000);
  const run = async (args: string[]) => {
    signal.throwIfAborted();
    if (
      (await ffmpeg.exec(["-v", "error", "-threads", "1", ...args, "-y"], 10 * 60000, {
        signal,
      })) !== 0
    )
      throw new Error("Video encoding failed. Try again in a recent desktop browser.");
  };
  try {
    signal.throwIfAborted();
    progress(1, "Loading the local video engine");
    const base = new URL("/director-media/v1/", window.location.origin);
    await ffmpeg.load({
      classWorkerURL: new URL("wrapper/worker.js", base).href,
      coreURL: new URL("core/ffmpeg-core.js", base).href,
      wasmURL: new URL("core/ffmpeg-core.wasm", base).href,
    });
    const chunks: string[] = [];
    // At most 48 JPEG frames in Wasm memory; never retain a whole uncompressed movie.
    for (let start = 0; start < frames; start += 48) {
      const count = Math.min(48, frames - start),
        chunk = `chunk-${chunks.length}.mp4`;
      for (let frame = 0; frame < count; frame++) {
        signal.throwIfAborted();
        const time = Math.min(duration - 0.000001, (start + frame) / fps);
        const active = scene.render(document, time);
        context.drawImage(canvas, 0, 0);
        context.fillStyle = "rgba(12,14,17,.83)";
        context.fillRect(0, 0, width, 52);
        context.fillRect(0, height - 34, width, 34);
        context.font = "bold 18px Arial";
        context.fillStyle = "#f0c27c";
        context.fillText(
          `ACTBYME Director  /  ${document.shots.indexOf(active.shot) + 1}. ${active.shot.name.slice(0, 60)}`,
          18,
          31,
        );
        context.font = "13px Arial";
        context.fillStyle = "#eeeeee";
        context.fillText(
          "Camera reference · neutral stand-in · gestures and lip sync not reproduced",
          18,
          height - 13,
        );
        context.textAlign = "right";
        context.fillText(`${time.toFixed(2)}s / ${duration.toFixed(2)}s`, width - 16, height - 13);
        context.textAlign = "left";
        const blob = await new Promise<Blob>((resolve, reject) =>
          drawing.toBlob(
            (value) =>
              value ? resolve(value) : reject(new Error("Unable to capture a camera frame.")),
            "image/jpeg",
            0.9,
          ),
        );
        await ffmpeg.writeFile(
          `frame-${String(frame).padStart(3, "0")}.jpg`,
          new Uint8Array(await blob.arrayBuffer()),
        );
        progress(
          5 + ((start + frame + 1) / frames) * 65,
          `Rendering frame ${start + frame + 1}/${frames}`,
        );
      }
      await run([
        "-framerate",
        String(fps),
        "-i",
        "frame-%03d.jpg",
        "-frames:v",
        String(count),
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "22",
        "-pix_fmt",
        "yuv420p",
        "-threads",
        "1",
        "-video_track_timescale",
        "24000",
        chunk,
      ]);
      for (let frame = 0; frame < count; frame++)
        await ffmpeg.deleteFile(`frame-${String(frame).padStart(3, "0")}.jpg`);
      chunks.push(chunk);
    }
    progress(73, "Assembling the camera reference");
    await ffmpeg.writeFile("concat.txt", chunks.map((chunk) => `file '${chunk}'`).join("\n"));
    await run(["-f", "concat", "-safe", "1", "-i", "concat.txt", "-c", "copy", "picture.mp4"]);
    for (const chunk of chunks) await ffmpeg.deleteFile(chunk);
    let audio = false;
    if (source && document.performance.originalAudio) {
      progress(77, "Preparing the original performance audio");
      await ffmpeg.writeFile("performance.media", new Uint8Array(await source.arrayBuffer()));
      // Read actual input stream metadata with the bundled FFmpeg executable;
      // no separate ffprobe binary or server is required.
      const inspect = ({ message }: { message: string }) => {
        if (/Stream #0:\d+.*: Audio:/.test(message)) audio = true;
      };
      ffmpeg.on("log", inspect);
      try {
        const probed = await ffmpeg.exec(
          ["-v", "info", "-i", "performance.media", "-t", "0", "-f", "null", "-"],
          30000,
          { signal },
        );
        if (probed !== 0) throw new Error("The original performance could not be decoded.");
      } finally {
        ffmpeg.off("log", inspect);
      }
    }
    progress(80, audio ? "Synchronizing the original audio" : "Finishing the reference MP4");
    await run([
      "-i",
      "picture.mp4",
      ...(audio
        ? ["-i", "performance.media"]
        : ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]),
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-c:v",
      "copy",
      "-af",
      "aresample=48000,apad",
      "-c:a",
      "aac",
      "-ac",
      "2",
      "-ar",
      "48000",
      "-t",
      String(duration),
      "-movflags",
      "+faststart",
      "camera-reference.mp4",
    ]);
    const bytes = await ffmpeg.readFile("camera-reference.mp4");
    if (typeof bytes === "string" || !bytes.length || bytes.length > 50 * 1024 * 1024)
      throw new Error("The MP4 is empty or exceeds 50 MiB. Shorten the performance and try again.");
    progress(85, "Camera reference ready");
    return new File(
      [Uint8Array.from(bytes)],
      `${document.title.slice(0, 100)}-camera-reference.mp4`,
      { type: "video/mp4" },
    );
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", stop);
    ffmpeg.terminate();
    scene.dispose(true);
    canvas.width = canvas.height = drawing.width = drawing.height = 1;
  }
}
