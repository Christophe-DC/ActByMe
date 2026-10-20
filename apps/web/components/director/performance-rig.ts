import * as THREE from "three";
import { motionOffsets, samplePerformanceMotion, type PerformanceMotion } from "@actbyme/shared";
const up = new THREE.Vector3(0, 1, 0),
  front = new THREE.Vector3(0, 0, 1);
const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));
export function createPerformanceRig(model: THREE.Object3D) {
  const bones = new Map<string, THREE.Bone>();
  model.traverse((object) => {
    if (object instanceof THREE.Bone) bones.set(object.name, object);
  });
  if (!bones.has("leftHand") || !bones.has("rightMiddle3") || !bones.has("head"))
    throw new Error("The movement figure has no complete skeleton. Reload and try again.");
  const rest = new Map(
    [...bones].map(([name, bone]) => [
      name,
      {
        position: bone.position.clone(),
        quaternion: bone.quaternion.clone(),
        scale: bone.scale.clone(),
      },
    ]),
  );
  const sample = new Float32Array(379);
  const position = (name: string) => bones.get(name)!.getWorldPosition(new THREE.Vector3());
  const global = (name: string, rotation: THREE.Quaternion, weight = 1) => {
    const bone = bones.get(name)!;
    const parent = bone.parent!.getWorldQuaternion(new THREE.Quaternion()).invert();
    const local = parent.multiply(rotation);
    bone.quaternion.slerp(local, clamp(weight));
    bone.updateWorldMatrix(false, true);
  };
  const frame = (direction: THREE.Vector3, normal: THREE.Vector3) => {
    const vertical = direction.clone().normalize(),
      depth = normal.clone().addScaledVector(vertical, -normal.dot(vertical));
    if (depth.lengthSq() < 0.000001)
      depth.copy(front).addScaledVector(vertical, -front.dot(vertical));
    if (depth.lengthSq() < 0.000001) depth.set(1, 0, 0).addScaledVector(vertical, -vertical.x);
    depth.normalize();
    const horizontal = new THREE.Vector3().crossVectors(vertical, depth).normalize();
    depth.crossVectors(horizontal, vertical).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(horizontal, vertical, depth),
    );
  };
  const aim = (name: string, direction: THREE.Vector3, normal = front, weight = 1) => {
    if (direction.lengthSq() > 0.000001) global(name, frame(direction, normal), weight);
  };
  const reset = () => {
    model.position.set(0, 0, 0);
    for (const [name, bone] of bones) {
      const bind = rest.get(name)!;
      bone.position.copy(bind.position);
      bone.quaternion.copy(bind.quaternion);
      bone.scale.copy(bind.scale);
    }
    model.updateWorldMatrix(true, true);
  };
  const neutralArms = () => {
    for (const [side, sign] of [
      ["left", 1],
      ["right", -1],
    ] as const) {
      const elbow = new THREE.Vector3(sign * 0.3, 1.17, 0.07),
        wrist = new THREE.Vector3(sign * 0.26, 1.16, 0.3);
      aim(`${side}UpperArm`, elbow.clone().sub(position(`${side}UpperArm`)));
      aim(`${side}LowerArm`, wrist.clone().sub(position(`${side}LowerArm`)));
      aim(`${side}Hand`, new THREE.Vector3(sign * 0.02, 0.03, 0.09), front);
    }
  };
  const point = (offset: number, index: number) =>
    new THREE.Vector3(
      sample[offset + index * 4]!,
      sample[offset + index * 4 + 1]!,
      sample[offset + index * 4 + 2]!,
    );
  const confidence = (offset: number, ...indices: number[]) =>
    Math.min(...indices.map((index) => sample[offset + index * 4 + 3]!));
  const confidenceWeight = (score: number) => clamp((score - 0.35) / 0.2);
  const apply = (motion: PerformanceMotion | null | undefined, time: number) => {
    reset();
    if (!motion) {
      neutralArms();
      return;
    }
    samplePerformanceMotion(motion, time, sample);
    const leftShoulder = point(0, 11),
      rightShoulder = point(0, 12),
      shoulders = leftShoulder.clone().add(rightShoulder).multiplyScalar(0.5);
    const hips = point(0, 23).add(point(0, 24)).multiplyScalar(0.5);
    const torsoRotation = new THREE.Quaternion();
    if (confidence(0, 11, 12) > 0.45) {
      const lateral = leftShoulder.clone().sub(rightShoulder).normalize();
      const vertical = shoulders.clone().sub(hips).normalize();
      if (vertical.y < 0.15) vertical.copy(up);
      const forward = new THREE.Vector3().crossVectors(lateral, vertical).normalize();
      vertical.crossVectors(forward, lateral).normalize();
      torsoRotation.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(lateral, vertical, forward),
      );
      const pelvisRotation = new THREE.Quaternion();
      if (confidence(0, 23, 24) > 0.6) {
        const hipDirection = point(0, 23).sub(point(0, 24));
        pelvisRotation.setFromAxisAngle(up, -Math.atan2(hipDirection.z, hipDirection.x));
        global("hips", pelvisRotation);
      }
      global("spine", pelvisRotation.clone().slerp(torsoRotation, 0.45));
      global("chest", torsoRotation);
    }
    const bodyForward = front.clone().applyQuaternion(torsoRotation);
    // Unobserved segments keep the relaxed bind pose relative to their tracked parent.
    for (const [side, sign, shoulder, elbow, wrist, handOffset] of [
      ["left", 1, 11, 13, 15, 198],
      ["right", -1, 12, 14, 16, 282],
    ] as const) {
      const upper = point(0, elbow).sub(point(0, shoulder)),
        lower = point(0, wrist).sub(point(0, elbow));
      // The bend-plane normal is the elbow hinge (local X), not the skin's local Z.
      // Derive each segment's depth axis to avoid a 90-degree shoulder/forearm twist.
      const hinge = new THREE.Vector3().crossVectors(upper, lower);
      let upperNormal = bodyForward,
        lowerNormal = bodyForward;
      if (hinge.lengthSq() > 0.00001 && confidence(0, shoulder, elbow, wrist) > 0.45) {
        const expectedHinge = new THREE.Vector3().crossVectors(upper, bodyForward);
        if (hinge.dot(expectedHinge) < 0) hinge.negate();
        upperNormal = new THREE.Vector3().crossVectors(hinge, upper).normalize();
        lowerNormal = new THREE.Vector3().crossVectors(hinge, lower).normalize();
      }
      aim(`${side}UpperArm`, upper, upperNormal, confidenceWeight(confidence(0, shoulder, elbow)));
      aim(`${side}LowerArm`, lower, lowerNormal, confidenceWeight(confidence(0, elbow, wrist)));
      if (confidence(handOffset, 0, 5, 9, 17) > 0.45 && confidence(0, wrist) > 0.35) {
        const handWrist = point(handOffset, 0),
          index = point(handOffset, 5).sub(handWrist),
          pinky = point(handOffset, 17).sub(handWrist);
        const palm = new THREE.Vector3()
          .crossVectors(index, pinky)
          .normalize()
          .multiplyScalar(-sign);
        const handDirection = point(handOffset, 9).sub(handWrist);
        aim(`${side}Hand`, handDirection, palm, confidenceWeight(confidence(handOffset, 0, 9)));
        for (const [finger, start] of [
          ["Thumb", 1],
          ["Index", 5],
          ["Middle", 9],
          ["Ring", 13],
          ["Pinky", 17],
        ] as const)
          for (let segment = 0; segment < 3; segment++)
            aim(
              `${side}${finger}${segment + 1}`,
              point(handOffset, start + segment + 1).sub(point(handOffset, start + segment)),
              palm,
              confidenceWeight(confidence(handOffset, start + segment, start + segment + 1)),
            );
      } else if (confidence(0, wrist, wrist === 15 ? 19 : 20, wrist === 15 ? 17 : 18) > 0.45) {
        const middle = point(0, wrist === 15 ? 19 : 20)
          .add(point(0, wrist === 15 ? 17 : 18))
          .multiplyScalar(0.5);
        aim(`${side}Hand`, middle.sub(point(0, wrist)), bodyForward);
      }
    }
    if (sample[motionOffsets.face]! > 0.5) {
      const horizontal = new THREE.Vector3(sample[366], sample[367], sample[368]).normalize();
      const vertical = new THREE.Vector3(sample[369], sample[370], sample[371]);
      vertical.addScaledVector(horizontal, -vertical.dot(horizontal)).normalize();
      const depth = new THREE.Vector3().crossVectors(horizontal, vertical).normalize();
      const headRotation = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(horizontal, vertical, depth),
      );
      global("neck", torsoRotation.clone().slerp(headRotation, 0.25));
      global("head", headRotation);
      const jaw = bones.get("jaw")!;
      jaw.quaternion.multiply(
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(1, 0, 0),
          -clamp(sample[motionOffsets.jaw]!) * 0.42,
        ),
      );
    } else if (confidence(0, 0, 7, 8) > 0.5) {
      const horizontal = point(0, 7).sub(point(0, 8)).normalize();
      const vertical = up.clone().addScaledVector(horizontal, -horizontal.dot(up)).normalize();
      const headRotation = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(
          horizontal,
          vertical,
          new THREE.Vector3().crossVectors(horizontal, vertical),
        ),
      );
      global("head", headRotation, 0.7);
    }
    for (const [side, hip, knee, ankle, toe] of [
      ["left", 23, 25, 27, 31],
      ["right", 24, 26, 28, 32],
    ] as const) {
      const weight = clamp((confidence(0, hip, knee, ankle) - 0.55) / 0.15);
      aim(`${side}UpperLeg`, point(0, knee).sub(point(0, hip)), bodyForward, weight);
      aim(`${side}LowerLeg`, point(0, ankle).sub(point(0, knee)), bodyForward, weight);
      aim(
        `${side}Foot`,
        point(0, toe).sub(point(0, ankle)),
        up,
        weight * confidenceWeight(confidence(0, toe)),
      );
    }
    model.updateWorldMatrix(true, true);
    if (motion.coverage.legs > 0.5 && confidence(0, 23, 24, 27, 28) > 0.6) {
      const first = motion.samples;
      const referenceX = (first[132 + 23 * 2]! + first[132 + 24 * 2]!) * 0.5;
      const currentX = (sample[132 + 23 * 2]! + sample[132 + 24 * 2]!) * 0.5;
      const span = Math.max(0.08, Math.abs(first[132 + 11 * 2]! - first[132 + 12 * 2]!));
      model.position.x = clamp(((currentX - referenceX) / span) * 0.4, -2, 2);
      model.position.y -= Math.min(position("leftFoot").y, position("rightFoot").y) - 0.1;
      model.updateWorldMatrix(true, true);
    }
  };
  return {
    apply,
    focus(kind: "body" | "face" | "mouth" | "hands") {
      if (kind === "hands")
        return position("leftHand").add(position("rightHand")).multiplyScalar(0.5);
      if (kind === "face" || kind === "mouth") {
        const head = bones.get("head")!;
        return head.localToWorld(
          new THREE.Vector3(0, kind === "face" ? 0.11 : 0.055, kind === "face" ? 0.075 : 0.14),
        );
      }
      return model.localToWorld(new THREE.Vector3(0, 0.9, 0.08));
    },
    joints() {
      return Object.fromEntries(
        ["head", "leftHand", "rightHand", "leftLowerArm", "rightLowerArm"].map((name) => [
          name,
          position(name).toArray(),
        ]),
      );
    },
  };
}
