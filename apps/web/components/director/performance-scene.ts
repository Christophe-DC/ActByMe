import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { directorShotAt, samplePerformanceCamera, type DirectorDocument } from "@actbyme/shared";
import { loadPerformanceModel } from "./performance-model";

/** One studio, neutral fixed pose and camera sampler for preview, thumbnails and every MP4 frame. */
export async function createPerformanceScene(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  signal?: AbortSignal,
) {
  const mannequin = await loadPerformanceModel(signal);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    alpha: false,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  // The subject and lights are static: the map is shared by every camera frame.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#252c35");
  scene.fog = new THREE.Fog("#252c35", 3, 14);
  const camera = new THREE.PerspectiveCamera(35, width / height, 0.02, 80);
  const environmentSource = new RoomEnvironment();
  const environmentGenerator = new THREE.PMREMGenerator(renderer);
  const environment = environmentGenerator.fromScene(environmentSource, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.22;
  environmentSource.dispose();
  environmentGenerator.dispose();
  scene.add(new THREE.HemisphereLight(0xd7e6f7, 0x30333a, 0.4));
  const key = new THREE.DirectionalLight(0xffedda, 2.5);
  key.position.set(-3, 4.5, 4);
  key.target.position.set(0, 0.9, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -1.8;
  key.shadow.camera.right = 1.8;
  key.shadow.camera.top = 2;
  key.shadow.camera.bottom = -2;
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 12;
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.008;
  key.shadow.radius = 4;
  key.shadow.blurSamples = 8;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xc1d8f5, 0.5);
  fill.position.set(3, 2, 2);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xd7e7ff, 2);
  rim.position.set(1, 3.5, -3);
  scene.add(rim);
  const clay = new THREE.MeshStandardMaterial({
    color: 0x8b92a0,
    roughness: 0.64,
    metalness: 0.025,
  });
  const eyes = new THREE.MeshStandardMaterial({ color: 0x919aa6, roughness: 0.48 });
  mannequin.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry = object.geometry.clone();
    object.material = object.name.includes("eye") ? eyes : clay;
    object.castShadow = true;
    object.receiveShadow = true;
  });
  scene.add(mannequin);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x343c47, roughness: 0.93 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.005;
  floor.receiveShadow = true;
  scene.add(floor);
  // Soft contact shading anchors the feet even at thumbnail resolution.
  const shadowCanvas = window.document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 128;
  const context = shadowCanvas.getContext("2d")!;
  const gradient = context.createRadialGradient(64, 64, 8, 64, 64, 64);
  gradient.addColorStop(0, "rgba(7,10,15,0.38)");
  gradient.addColorStop(0.5, "rgba(7,10,15,0.16)");
  gradient.addColorStop(1, "rgba(7,10,15,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const contactTexture = new THREE.CanvasTexture(shadowCanvas);
  const contactMaterial = new THREE.MeshBasicMaterial({
    map: contactTexture,
    transparent: true,
    depthWrite: false,
  });
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), contactMaterial);
  contact.rotation.x = -Math.PI / 2;
  contact.position.set(0, -0.003, 0.03);
  scene.add(contact);
  const grid = new THREE.GridHelper(20, 40, 0x8493a8, 0x68798e);
  grid.position.y = -0.002;
  for (const surface of Array.isArray(grid.material) ? grid.material : [grid.material]) {
    surface.transparent = true;
    surface.opacity = 0.12;
    surface.depthWrite = false;
  }
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
      canvas.dataset.model = "studio-neutral-v1";
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
      clay.dispose();
      eyes.dispose();
      floorMaterial.dispose();
      contactMaterial.dispose();
      contactTexture.dispose();
      environment.dispose();
      key.shadow.dispose();
      renderer.dispose();
      if (destroyContext) renderer.forceContextLoss();
    },
  };
}
