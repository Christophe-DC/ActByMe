import {
  renderDirectorPlan,
  directorDuration,
  directorBrowserExportError,
  type DirectorState,
} from "@actbyme/shared";
import { directorApi } from "@/lib/api/client";

export async function renderDirectorInBrowser(
  projectId: string,
  state: DirectorState,
  signal: AbortSignal,
  progress: (value: number, stage: string) => void,
) {
  const deadline = new AbortController();
  signal = AbortSignal.any([signal, deadline.signal]);
  const error = directorBrowserExportError(state.document, state.assets);
  if (error) throw new Error(error);
  signal.throwIfAborted();
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  signal.throwIfAborted();
  const ffmpeg = new FFmpeg();
  const terminate = () => ffmpeg.terminate();
  signal.addEventListener("abort", terminate, { once: true });
  // A hard deadline also covers loading, storage fetches and a stuck WebAssembly call.
  const timeout = setTimeout(() => {
    deadline.abort();
    terminate();
  }, 110 * 60000);
  let stage = "Chargement du moteur vidéo local",
    currentProgress = 1;
  const notify = (value: number, text: string) => {
    currentProgress = value;
    stage = text;
    progress(value, text);
  };
  let encoding: { start: number; end: number; duration: number } | null = null;
  let shotIndex = 0;
  ffmpeg.on("progress", ({ time }) => {
    if (!encoding || !Number.isFinite(time)) return;
    // FFmpeg reports output time in microseconds. Use the actual trimmed output
    // duration, since its generic fraction assumes equal input/output lengths.
    const fraction = Math.min(1, Math.max(0, time / (encoding.duration * 1000000)));
    notify(
      Math.max(currentProgress, encoding.start + fraction * (encoding.end - encoding.start)),
      stage,
    );
  });
  try {
    notify(1, stage);
    const base = new URL("/director-media/v1/", window.location.origin);
    await ffmpeg.load({
      classWorkerURL: new URL("wrapper/worker.js", base).href,
      coreURL: new URL("core/ffmpeg-core.js", base).href,
      wasmURL: new URL("core/ffmpeg-core.wasm", base).href,
    });
    signal.throwIfAborted();
    const used = new Set([
      ...state.document.shots.flatMap((shot) => (shot.clipAssetId ? [shot.clipAssetId] : [])),
      ...state.document.tracks.flatMap((item) =>
        item.assetId && item.volume ? [item.assetId] : [],
      ),
    ]);
    const sources = state.assets.filter((asset) => used.has(asset.id));
    if (sources.length !== used.size || sources.some((asset) => asset.status !== "READY"))
      throw new Error("Une ressource est absente ou n’a pas été vérifiée.");
    const assets = [];
    let totalBytes = 0;
    for (const [index, asset] of sources.entries()) {
      notify(
        3 + Math.round((index / sources.length) * 10),
        `Chargement du fichier ${index + 1}/${sources.length}`,
      );
      const { url } = await directorApi.media(projectId, asset.id);
      const response = await fetch(url, {
        signal,
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      if (!response.ok) throw new Error(`Impossible de lire ${asset.name}. Réessayez l’export.`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      totalBytes += bytes.byteLength;
      if (bytes.length !== asset.sizeBytes || totalBytes > 128 * 1024 * 1024)
        throw new Error("La taille des fichiers a changé ou dépasse 128 MiB.");
      const localPath = `source-${index}.media`;
      await ffmpeg.writeFile(localPath, bytes);
      assets.push({ id: asset.id, localPath, hasAudio: asset.hasAudio, duration: asset.duration });
    }
    const output = await renderDirectorPlan(state.document, assets, {
      path: (name) => name,
      writeText: (path, content) => ffmpeg.writeFile(path, content),
      run: async (args) => {
        signal.throwIfAborted();
        if (args.at(-1)?.startsWith("normalized-")) {
          const shot = state.document.shots[shotIndex]!;
          encoding = {
            start: 15 + (shotIndex / state.document.shots.length) * 50,
            end: 15 + ((shotIndex + 1) / state.document.shots.length) * 50,
            duration: shot.duration,
          };
          notify(
            encoding.start,
            `Encodage du plan ${shotIndex + 1}/${state.document.shots.length}`,
          );
          shotIndex++;
        } else {
          const mixing = args.at(-1) === "advertisement.mp4";
          encoding = {
            start: mixing ? 75 : 65,
            end: mixing ? 84 : 74,
            duration: directorDuration(state.document),
          };
          notify(encoding.start, mixing ? "Mixage audio et finalisation" : "Assemblage des plans");
        }
        // Single thread: no SharedArrayBuffer, cross-origin isolation or hosted compute.
        const result = await ffmpeg.exec(
          args.map((arg, index) =>
            args[index - 1] === "-threads" || args[index - 1] === "-filter_complex_threads"
              ? "1"
              : args[index - 1] === "-preset"
                ? "ultrafast"
                : arg,
          ),
          20 * 60000,
          { signal },
        );
        encoding = null;
        if (result !== 0)
          throw new Error(
            "L’encodage a échoué ou dépassé 20 minutes pour une étape. Vérifiez les clips, fermez les autres onglets et réessayez.",
          );
      },
      progress: async (value, text) => {
        notify(value, text);
      },
    });
    notify(85, "Lecture du MP4 terminé");
    const result = await ffmpeg.readFile(output);
    if (typeof result === "string" || !result.length)
      throw new Error("Le moteur n’a pas produit de MP4.");
    if (result.length > 50 * 1024 * 1024)
      throw new Error("Le résultat dépasse 50 MiB. Réduisez la durée ou le nombre de plans.");
    return new File(
      [Uint8Array.from(result)],
      `${state.document.title.slice(0, 100)}-v${state.version}.mp4`,
      { type: "video/mp4" },
    );
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", terminate);
    ffmpeg.terminate();
  }
}
