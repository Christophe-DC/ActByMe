import console from "node:console";
import { createRequire } from "node:module";
import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const destination = resolve(dirname(fileURLToPath(import.meta.url)), "../public/director-media/v1");
await mkdir(destination, { recursive: true });
await cp(dirname(require.resolve("@ffmpeg/ffmpeg/worker")), resolve(destination, "wrapper"), {
  recursive: true,
});
await cp(
  resolve(dirname(require.resolve("@ffmpeg/core")), "../esm"),
  resolve(destination, "core"),
  { recursive: true },
);
console.log("Director: moteur vidéo local prêt (aucun CDN externe).");
