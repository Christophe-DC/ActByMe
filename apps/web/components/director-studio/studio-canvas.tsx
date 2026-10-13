"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useEffect, useMemo, useRef } from "react";
import { CanvasTexture, Group, PerspectiveCamera, Vector3, Plane } from "three";
import {
  sampleCamera,
  sampleCharacter,
  samplePose,
  type StudioScene,
  type StudioCharacter,
  type StudioVector,
} from "@actbyme/shared";

function Camera({ scene, time, shot }: { scene: StudioScene; time: number; shot: string }) {
  const { camera, gl } = useThree();
  useEffect(() => {
    if (shot !== "free") return;
    const controls = new OrbitControls(camera, gl.domElement);
    controls.target.set(0, 1, 0);
    controls.maxDistance = 60;
    controls.minDistance = 1;
    controls.update();
    return () => controls.dispose();
  }, [camera, gl, shot]);
  useEffect(() => {
    if (shot === "free") return;
    const sampled = sampleCamera(scene, time, shot || undefined);
    camera.position.set(sampled.position.x, sampled.position.y, sampled.position.z);
    camera.lookAt(sampled.target.x, sampled.target.y, sampled.target.z);
    if (camera instanceof PerspectiveCamera) {
      camera.fov = sampled.fov;
      camera.updateProjectionMatrix();
    }
  }, [camera, scene, time, shot]);
  return null;
}

function Limb({
  position,
  rotation,
  color,
  leg = false,
}: {
  position: [number, number, number];
  rotation: number;
  color: string;
  leg?: boolean;
}) {
  return (
    <group position={position} rotation={[rotation, 0, 0]}>
      <mesh position={[0, -0.23, 0]} castShadow>
        <capsuleGeometry args={[leg ? 0.09 : 0.065, 0.32, 4, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, -0.5, leg ? 0.05 : 0]}>
        <sphereGeometry args={[leg ? 0.09 : 0.07, 12, 8]} />
        <meshStandardMaterial color={leg ? "#333338" : "#c9b6a3"} />
      </mesh>
    </group>
  );
}

function CharacterLabel({
  name,
  emphasized,
  role,
}: {
  name: string;
  emphasized: boolean;
  role: boolean;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 96;
    const context = canvas.getContext("2d");
    if (context) {
      context.fillStyle = emphasized ? "#fcd34d" : "#111214";
      context.fillRect(0, 0, 512, 96);
      context.fillStyle = emphasized ? "#111214" : "#ffffff";
      context.font = "32px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(`${name.slice(0, 26)}${role ? " · Your role" : ""}`, 256, 48, 480);
    }
    return new CanvasTexture(canvas);
  }, [name, emphasized, role]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite position={[0, 2.1, 0]} scale={[1.6, 0.3, 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}

function Character({
  character,
  time,
  selected,
  highlighted,
  onSelect,
  onMove,
}: {
  character: StudioCharacter;
  time: number;
  selected: boolean;
  highlighted: boolean;
  onSelect?: (id: string) => void;
  onMove?: (position: StudioVector) => void;
}) {
  const dragging = useRef(false);
  const state = sampleCharacter(character, time);
  const pose = samplePose(state.action, time);
  const head = useRef<Group>(null);
  useEffect(() => {
    head.current?.lookAt(new Vector3(state.gaze.x, state.gaze.y, state.gaze.z));
  }, [state.gaze]);
  return (
    <group
      position={[state.position.x, state.position.y + pose.height, state.position.z]}
      rotation={[0, (state.rotation * Math.PI) / 180, 0]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.(character.id);
      }}
      onPointerDown={(event) => {
        if (!onMove) return;
        event.stopPropagation();
        onSelect?.(character.id);
        dragging.current = true;
        (event.target as Element).setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!dragging.current || !onMove) return;
        event.stopPropagation();
        const point = event.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), 0), new Vector3());
        if (point) onMove({ x: point.x, y: 0, z: point.z });
      }}
      onPointerUp={(event) => {
        dragging.current = false;
        if (onMove) {
          event.stopPropagation();
          (event.target as Element).releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
    >
      <CharacterLabel
        name={character.name}
        emphasized={selected || highlighted}
        role={highlighted}
      />
      <mesh position={[0, 0.02 - pose.height, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.28, selected || highlighted ? 0.4 : 0.3, 32]} />
        <meshBasicMaterial color={selected || highlighted ? "#fcd34d" : character.color} />
      </mesh>
      <mesh position={[0, 1.1, 0]} castShadow>
        <capsuleGeometry args={[0.19, 0.36, 4, 12]} />
        <meshStandardMaterial color={character.color} />
      </mesh>
      <group ref={head} position={[0, 1.65, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.16, 16, 12]} />
          <meshStandardMaterial color="#c9b6a3" />
        </mesh>
        {[-0.055, 0.055].map((offset) => (
          <mesh key={offset} position={[offset, 0.03, 0.145]}>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshStandardMaterial color="#1b1b20" />
          </mesh>
        ))}
        <mesh position={[0, 0, 0.28]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.025, 0.22, 8]} />
          <meshBasicMaterial color="#fcd34d" transparent opacity={0.6} />
        </mesh>
      </group>
      <Limb position={[-0.25, 1.4, 0]} rotation={pose.leftArm} color={character.color} />
      <Limb position={[0.25, 1.4, 0]} rotation={pose.rightArm} color={character.color} />
      <Limb position={[-0.11, 0.66, 0]} rotation={pose.leftLeg} color="#494954" leg />
      <Limb position={[0.11, 0.66, 0]} rotation={pose.rightLeg} color="#494954" leg />
    </group>
  );
}

export default function StudioCanvas({
  scene,
  time,
  shot,
  selectedId,
  roleId,
  onSelect,
  onMove,
  onFailure,
}: {
  scene: StudioScene;
  time: number;
  shot: string;
  selectedId?: string;
  roleId?: string | null;
  onSelect?: (id: string) => void;
  onMove?: (position: StudioVector) => void;
  onFailure: () => void;
}) {
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 1.5]}
      camera={{ position: [0, 4, 8], fov: 50 }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", onFailure, { once: true });
      }}
    >
      <color attach="background" args={["#111214"]} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 8, 5]} intensity={2} castShadow />
      <gridHelper args={[40, 40, "#665434", "#28282c"]} />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
        onClick={(event) => {
          if (onMove && selectedId) onMove({ x: event.point.x, y: 0, z: event.point.z });
        }}
      >
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#17171b" />
      </mesh>
      {scene.props.map((prop) => (
        <group key={prop.id} position={[prop.position.x, prop.position.y, prop.position.z]}>
          <mesh castShadow receiveShadow>
            <boxGeometry
              args={[
                prop.size.x,
                prop.kind === "table" || prop.kind === "chair" ? 0.1 : prop.size.y,
                prop.size.z,
              ]}
            />
            <meshStandardMaterial color={prop.color} />
          </mesh>
          {prop.kind === "chair" ? (
            <mesh position={[0, prop.size.y / 2, -prop.size.z / 2]}>
              <boxGeometry args={[prop.size.x, prop.size.y, 0.1]} />
              <meshStandardMaterial color={prop.color} />
            </mesh>
          ) : null}
          {prop.kind !== "box"
            ? [-1, 1].flatMap((x) =>
                [-1, 1].map((z) => (
                  <mesh
                    key={`${x}:${z}`}
                    position={[x * prop.size.x * 0.4, -prop.position.y / 2, z * prop.size.z * 0.4]}
                  >
                    <boxGeometry args={[0.08, Math.max(0.1, prop.position.y), 0.08]} />
                    <meshStandardMaterial color={prop.color} />
                  </mesh>
                )),
              )
            : null}
        </group>
      ))}
      {scene.characters.map((character) => (
        <Character
          key={character.id}
          character={character}
          time={time}
          selected={character.id === selectedId}
          highlighted={character.id === roleId}
          onSelect={onSelect}
          onMove={onMove}
        />
      ))}
      <Camera scene={scene} time={time} shot={shot} />
    </Canvas>
  );
}
