import * as THREE from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// One same-origin, texture-free CC0 mesh. Each scene owns its cloned GPU geometry.
let pending: Promise<THREE.Group> | undefined;
export async function loadPerformanceModel(signal?: AbortSignal) {
  signal?.throwIfAborted();
  pending ??= (async () => {
    const response = await fetch("/director-models/neutral-performer-v2.glb", {
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw new Error("The neutral 3D figure could not be loaded. Reload and try again.");
    const loader = new GLTFLoader();
    const model = await loader.parseAsync(await response.arrayBuffer(), "");
    if (!model.scene.getObjectByProperty("type", "SkinnedMesh"))
      throw new Error("The neutral 3D figure is incomplete. Reload and try again.");
    return model.scene;
  })().catch((error: unknown) => {
    pending = undefined;
    throw error;
  });
  // A cancelled export must stop waiting without cancelling another preview's shared load.
  const model = await new Promise<THREE.Group>((resolve, reject) => {
    const abort = () => reject(signal?.reason);
    signal?.addEventListener("abort", abort, { once: true });
    pending!.then(resolve, reject).finally(() => signal?.removeEventListener("abort", abort));
  });
  signal?.throwIfAborted();
  return clone(model);
}
