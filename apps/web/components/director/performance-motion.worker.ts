/// <reference lib="webworker" />
import {
  FilesetResolver,
  PoseLandmarker,
  HandLandmarker,
  FaceLandmarker,
  type Landmark,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import { motionStride, motionOffsets } from "@actbyme/shared";
let pose: PoseLandmarker, hands: HandLandmarker, face: FaceLandmarker;
const scope = self as unknown as DedicatedWorkerGlobalScope;
const send = (message: unknown, transfer: Transferable[] = []) =>
  scope.postMessage(message, transfer);
function inFrame(point: NormalizedLandmark | undefined) {
  return Boolean(
    point && point.x >= -0.015 && point.x <= 1.015 && point.y >= -0.015 && point.y <= 1.015,
  );
}
function confidence(point: NormalizedLandmark | undefined) {
  return inFrame(point) ? Math.min(point!.visibility ?? 1, point!.presence ?? 1) : 0;
}
function put(output: Float32Array, offset: number, point: Landmark | undefined, score: number) {
  if (point && [point.x, point.y, point.z].every(Number.isFinite)) {
    output[offset] = point.x;
    output[offset + 1] = -point.y;
    output[offset + 2] = -point.z;
    output[offset + 3] = score;
  }
}
scope.onmessage = async (event: MessageEvent) => {
  const message = event.data;
  try {
    if (message.type === "init") {
      const base = new URL("/director-motion/v1/", message.origin).href;
      const files = await FilesetResolver.forVisionTasks(`${base}wasm`, false);
      const common = {
        runningMode: "VIDEO" as const,
        baseOptions: { delegate: "CPU" as const },
        canvas: new OffscreenCanvas(1280, 720),
      };
      send({ type: "progress", stage: "Loading accurate body tracking" });
      pose = await PoseLandmarker.createFromOptions(files, {
        ...common,
        baseOptions: { ...common.baseOptions, modelAssetPath: `${base}pose_landmarker_heavy.task` },
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      send({ type: "progress", stage: "Loading hand tracking" });
      hands = await HandLandmarker.createFromOptions(files, {
        ...common,
        canvas: new OffscreenCanvas(1280, 720),
        baseOptions: { ...common.baseOptions, modelAssetPath: `${base}hand_landmarker.task` },
        numHands: 2,
        minHandDetectionConfidence: 0.45,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      send({ type: "progress", stage: "Loading head and face tracking" });
      face = await FaceLandmarker.createFromOptions(files, {
        ...common,
        canvas: new OffscreenCanvas(1280, 720),
        baseOptions: { ...common.baseOptions, modelAssetPath: `${base}face_landmarker.task` },
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });
      send({ type: "ready" });
      return;
    }
    if (message.type === "frame") {
      const image = message.image as ImageBitmap;
      try {
        const body = pose.detectForVideo(image, message.time),
          detectedHands = hands.detectForVideo(image, message.time),
          detectedFace = face.detectForVideo(image, message.time);
        const output = new Float32Array(motionStride),
          bodyImage = body.landmarks[0],
          world = body.worldLandmarks[0];
        for (let index = 0; index < 33; index++) {
          const visible = bodyImage?.[index];
          put(output, index * 4, world?.[index], confidence(visible));
          if (visible) {
            output[132 + index * 2] = visible.x;
            output[133 + index * 2] = visible.y;
          }
        }
        // Associate by the visible wrist, never a selfie/mirrored handedness assumption.
        const candidates = detectedHands.landmarks.map((points, index) => ({
          index,
          points,
          used: false,
        }));
        for (const [wrist, offset] of [
          [15, 198],
          [16, 282],
        ] as const) {
          const anchor = bodyImage?.[wrist];
          if (!anchor || confidence(anchor) < 0.35) continue;
          const nearest = candidates
            .filter((hand) => !hand.used)
            .sort(
              (first, second) =>
                Math.hypot(first.points[0]!.x - anchor.x, first.points[0]!.y - anchor.y) -
                Math.hypot(second.points[0]!.x - anchor.x, second.points[0]!.y - anchor.y),
            )[0];
          if (
            !nearest ||
            Math.hypot(nearest.points[0]!.x - anchor.x, nearest.points[0]!.y - anchor.y) > 0.25
          )
            continue;
          nearest.used = true;
          const score = detectedHands.handedness[nearest.index]?.[0]?.score ?? 0.9;
          for (let index = 0; index < 21; index++)
            put(
              output,
              offset + index * 4,
              detectedHands.worldLandmarks[nearest.index]?.[index],
              // Hand landmarks have no calibrated per-point visibility/presence (the SDK fills zeros).
              inFrame(nearest.points[index]) ? score : 0,
            );
        }
        const matrix = detectedFace.facialTransformationMatrixes[0]?.data;
        const faceNose = detectedFace.faceLandmarks[0]?.[1],
          bodyNose = bodyImage?.[0];
        const samePerson =
          faceNose &&
          bodyNose &&
          confidence(bodyNose) > 0.4 &&
          Math.hypot(faceNose.x - bodyNose.x, faceNose.y - bodyNose.y) < 0.2;
        if (matrix?.length === 16 && samePerson) {
          const signs = [1, -1, -1];
          for (let column = 0; column < 3; column++)
            for (let row = 0; row < 3; row++)
              output[366 + column * 3 + row] =
                matrix[column * 4 + row]! * signs[column]! * signs[row]!;
          output[motionOffsets.face] = 1;
          const weights = Object.fromEntries(
            (detectedFace.faceBlendshapes[0]?.categories ?? []).map((item) => [
              item.categoryName,
              item.score,
            ]),
          );
          output[motionOffsets.jaw] = weights.jawOpen ?? 0;
          output[motionOffsets.blinkLeft] = weights.eyeBlinkLeft ?? 0;
          output[motionOffsets.blinkRight] = weights.eyeBlinkRight ?? 0;
        }
        send({ type: "frame", sample: output }, [output.buffer]);
      } finally {
        image.close();
      }
    }
  } catch {
    send({
      type: "error",
      message:
        message.type === "init"
          ? "Movement models could not be loaded. Check your connection and use a recent desktop browser, then retry."
          : "Movement analysis failed on a video frame. Try an H.264 MP4 or retry the analysis.",
    });
  }
};
