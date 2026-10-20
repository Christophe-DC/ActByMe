import * as THREE from "three";
import { directorShotAt, samplePerformanceCamera, type DirectorDocument } from "@actbyme/shared";

/** Shared by the interactive preview and every offline export frame. No motion capture. */
export function createPerformanceScene(canvas: HTMLCanvasElement, width: number, height: number) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    alpha: false,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#30353a");
  const camera = new THREE.PerspectiveCamera(35, width / height, 0.02, 80);
  scene.add(new THREE.HemisphereLight(0xe9edf4, 0x424048, 2.4));
  const key = new THREE.DirectionalLight(0xffffff, 3.4);
  key.position.set(-3, 5, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -3;
  key.shadow.camera.right = 3;
  key.shadow.camera.top = 3;
  key.shadow.camera.bottom = -3;
  key.shadow.normalBias = 0.015;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xc3d3ec, 2);
  rim.position.set(2, 3, -3);
  scene.add(rim);
  const material = new THREE.MeshStandardMaterial({ color: 0xa7aaae, roughness: 0.76 });
  const detail = new THREE.MeshStandardMaterial({ color: 0x676b70, roughness: 0.9 });
  const mannequin = new THREE.Group();
  const sphere = (
    position: [number, number, number],
    scale: [number, number, number],
    surface = material,
  ) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), surface);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mannequin.add(mesh);
    return mesh;
  };
  const limb = (from: [number, number, number], to: [number, number, number], radius: number) => {
    const start = new THREE.Vector3(...from),
      end = new THREE.Vector3(...to);
    const mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(radius, start.distanceTo(end), 8, 16),
      material,
    );
    mesh.position.copy(start.add(end).multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(...to).sub(new THREE.Vector3(...from)).normalize(),
    );
    mesh.castShadow = true;
    mannequin.add(mesh);
  };
  sphere([0, 1.12, 0], [0.255, 0.34, 0.15]);
  sphere([0, 0.83, 0], [0.205, 0.17, 0.14]);
  limb([0, 1.35, 0], [0, 1.48, 0], 0.075);
  sphere([0, 1.62, 0.015], [0.145, 0.195, 0.14]);
  sphere([0, 1.495, 0.055], [0.1, 0.085, 0.09]);
  sphere([0, 1.59, 0.149], [0.026, 0.048, 0.034]);
  sphere([0, 1.485, 0.14], [0.043, 0.005, 0.007], detail);
  for (const side of [-1, 1]) {
    sphere([side * 0.053, 1.645, 0.136], [0.027, 0.013, 0.009], detail);
    sphere([side * 0.142, 1.61, 0.01], [0.025, 0.052, 0.025]);
    sphere([side * 0.252, 1.3, 0], [0.105, 0.1, 0.11]);
    limb([side * 0.28, 1.26, 0], [side * 0.34, 1.03, 0.08], 0.065);
    limb([side * 0.34, 1.03, 0.08], [side * 0.25, 0.93, 0.25], 0.05);
    sphere([side * 0.25, 0.92, 0.29], [0.053, 0.03, 0.07]);
    for (let finger = 0; finger < 4; finger++)
      limb(
        [side * (0.213 + finger * 0.022), 0.92, 0.33],
        [side * (0.21 + finger * 0.024), 0.91, 0.39 - Math.abs(1.5 - finger) * 0.015],
        0.008,
      );
    limb([side * 0.2, 0.92, 0.28], [side * 0.17, 0.91, 0.325], 0.012);
    limb([side * 0.115, 0.76, 0], [side * 0.12, 0.43, 0.015], 0.087);
    limb([side * 0.12, 0.4, 0.015], [side * 0.12, 0.12, 0], 0.06);
    sphere([side * 0.12, 0.055, 0.065], [0.073, 0.055, 0.14]);
  }
  scene.add(mannequin);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x41464d, roughness: 1 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.004;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(20, 40, 0x515860, 0x454b52);
  grid.position.y = 0.001;
  scene.add(grid);
  let lost = false;
  const onLost = (event: Event) => {
    event.preventDefault();
    lost = true;
  };
  canvas.addEventListener("webglcontextlost", onLost);
  return {
    resize(width: number, height: number) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
    render(document: DirectorDocument, time: number) {
      if (lost) throw new Error("3D rendering was interrupted. Reload the page and try again.");
      const active = directorShotAt(document, time);
      if (!active.shot.performanceCamera) throw new Error("This shot has no performance camera.");
      const view = samplePerformanceCamera(
        active.shot.performanceCamera,
        active.localTime / active.shot.duration,
      );
      camera.position.set(view.position.x, view.position.y, view.position.z);
      camera.lookAt(view.target.x, view.target.y, view.target.z);
      camera.fov = (2 * Math.atan(24 / (2 * view.lens)) * 180) / Math.PI;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      return active;
    },
    dispose(destroyContext = false) {
      canvas.removeEventListener("webglcontextlost", onLost);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
      grid.geometry.dispose();
      for (const surface of Array.isArray(grid.material) ? grid.material : [grid.material])
        surface.dispose();
      material.dispose();
      detail.dispose();
      floorMaterial.dispose();
      key.shadow.dispose();
      renderer.dispose();
      if (destroyContext) renderer.forceContextLoss();
    },
  };
}
