import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, writeFile, rename, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import console from "node:console";
import { Buffer } from "node:buffer";
const { fetch, AbortSignal } = globalThis;
const require = createRequire(import.meta.url);
const destination = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../public/director-motion/v1",
);
await mkdir(destination, { recursive: true });
await cp(
  resolve(dirname(require.resolve("@mediapipe/tasks-vision")), "wasm"),
  resolve(destination, "wasm"),
  { recursive: true },
);
const models = [
  [
    "pose_landmarker_heavy",
    "pose_landmarker",
    "64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b",
  ],
  [
    "hand_landmarker",
    "hand_landmarker",
    "fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1",
  ],
  [
    "face_landmarker",
    "face_landmarker",
    "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff",
  ],
];
for (const [name, task, hash] of models) {
  const file = resolve(destination, `${name}.task`);
  const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
  if (
    await readFile(file)
      .then((bytes) => digest(bytes) === hash)
      .catch(() => false)
  )
    continue;
  const response = await fetch(
    `https://storage.googleapis.com/mediapipe-models/${task}/${name}/float16/1/${name}.task`,
    { signal: AbortSignal.timeout(180000) },
  );
  if (!response.ok)
    throw new Error(`Motion model download failed: ${name} HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (digest(bytes) !== hash) throw new Error(`Motion model checksum mismatch: ${name}`);
  await writeFile(`${file}.tmp`, bytes);
  try {
    await rename(`${file}.tmp`, file);
  } finally {
    await rm(`${file}.tmp`, { force: true });
  }
}
console.log("Director: pinned, same-origin MediaPipe engines and motion models ready.");
