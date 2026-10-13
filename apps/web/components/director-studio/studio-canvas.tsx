"use client";

import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { memo, useEffect, useMemo, useRef, type RefObject } from "react";
import { CanvasTexture, Group, PerspectiveCamera, Vector3 } from "three";
import {
  sampleCamera,
  sampleCharacterPose,
  type StudioScene,
  type StudioCharacter,
  type StudioSelection,
} from "@actbyme/shared";

function Camera({
  scene,
  clock,
  shot,
  playing,
}: {
  scene: StudioScene;
  clock: RefObject<number>;
  shot: string;
  playing: boolean;
}) {
  const { camera, gl, invalidate } = useThree();
  useEffect(() => {
    if (shot !== "free") return;
    const controls = new OrbitControls(camera, gl.domElement);
    controls.target.set(0, 1, 0);
    controls.maxDistance = 60;
    controls.minDistance = 1;
    const refresh = () => invalidate();
    controls.addEventListener("change", refresh);
    controls.update();
    return () => {
      controls.removeEventListener("change", refresh);
      controls.dispose();
    };
  }, [camera, gl, shot, invalidate]);
  useFrame(() => {
    if (shot !== "free") {
      const sampled = sampleCamera(scene, clock.current, shot || undefined);
      camera.position.set(sampled.position.x, sampled.position.y, sampled.position.z);
      camera.lookAt(sampled.target.x, sampled.target.y, sampled.target.z);
      if (camera instanceof PerspectiveCamera && camera.fov !== sampled.fov) {
        camera.fov = sampled.fov;
        camera.updateProjectionMatrix();
      }
    }
    if (playing) invalidate();
  });
  return null;
}
function Invalidate({
  scene,
  time,
  selection,
  playing,
  shot,
}: {
  scene: StudioScene;
  time: number;
  selection?: StudioSelection;
  playing: boolean;
  shot: string;
}) {
  const { invalidate } = useThree();
  useEffect(() => {
    invalidate();
  }, [scene, time, selection, playing, shot, invalidate]);
  return null;
}
function Limb({
  position,
  color,
  leg = false,
  joint,
  knee,
}: {
  position: [number, number, number];
  color: string;
  leg?: boolean;
  joint: RefObject<Group | null>;
  knee?: RefObject<Group | null>;
}) {
  return (
    <group ref={joint} position={position}>
      <mesh position={[0, -0.2, 0]}>
        <capsuleGeometry args={[leg ? 0.085 : 0.065, 0.25, 4, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <group ref={knee} position={[0, -0.4, 0]} rotation={[leg ? 0 : -0.12, 0, 0]}>
        <mesh position={[0, -0.14, 0]}>
          <capsuleGeometry args={[leg ? 0.07 : 0.05, 0.18, 4, 8]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <mesh position={[0, -0.3, leg ? 0.05 : 0]}>
          <sphereGeometry args={[leg ? 0.09 : 0.07, 8, 8]} />
          <meshStandardMaterial color={leg ? "#333338" : "#c9b6a3"} />
        </mesh>
      </group>
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
      context.fillText(name.slice(0, 26) + (role ? " · Your role" : ""), 256, 48, 480);
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
const Character = memo(function Character({
  character,
  scene,
  clock,
  selected,
  highlighted,
  onSelect,
}: {
  character: StudioCharacter;
  scene: StudioScene;
  clock: RefObject<number>;
  selected: boolean;
  highlighted: boolean;
  onSelect?: (selection: StudioSelection) => void;
}) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const head = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const leftKnee = useRef<Group>(null);
  const rightKnee = useRef<Group>(null);
  const gaze = useMemo(() => new Vector3(), []);
  useFrame(() => {
    if (!root.current || !body.current) return;
    const state = sampleCharacterPose(character, clock.current, scene);
    root.current.position.set(state.position.x, state.position.y, state.position.z);
    root.current.rotation.y = (state.rotation * Math.PI) / 180;
    body.current.position.y = state.pose.height;
    if (leftArm.current) leftArm.current.rotation.x = state.pose.leftArm;
    if (rightArm.current) {
      rightArm.current.rotation.x = state.pose.rightArm;
      rightArm.current.rotation.z = state.action === "wave" ? -0.3 : 0;
    }
    if (leftLeg.current) leftLeg.current.rotation.x = state.pose.leftLeg;
    if (rightLeg.current) rightLeg.current.rotation.x = state.pose.rightLeg;
    const bend = (Math.max(0, Math.min(1, -state.pose.height / 0.2)) * Math.PI) / 2;
    if (leftKnee.current) leftKnee.current.rotation.x = bend;
    if (rightKnee.current) rightKnee.current.rotation.x = bend;
    root.current.updateWorldMatrix(true, true);
    gaze.set(state.gaze.x, state.gaze.y, state.gaze.z);
    head.current?.lookAt(gaze);
  });
  return (
    <group
      ref={root}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.({ kind: "character", id: character.id });
      }}
    >
      <CharacterLabel
        name={character.name}
        emphasized={selected || highlighted}
        role={highlighted}
      />
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.28, selected || highlighted ? 0.4 : 0.3, 24]} />
        <meshBasicMaterial color={selected || highlighted ? "#fcd34d" : character.color} />
      </mesh>
      <group ref={body}>
        <mesh position={[0, 1.1, 0]} castShadow>
          <capsuleGeometry args={[0.19, 0.36, 4, 10]} />
          <meshStandardMaterial color={character.color} />
        </mesh>
        <group ref={head} position={[0, 1.65, 0]}>
          <mesh>
            <sphereGeometry args={[0.16, 12, 8]} />
            <meshStandardMaterial color="#c9b6a3" />
          </mesh>
          {[-0.055, 0.055].map((offset) => (
            <mesh key={offset} position={[offset, 0.03, 0.145]}>
              <sphereGeometry args={[0.025, 6, 6]} />
              <meshStandardMaterial color="#1b1b20" />
            </mesh>
          ))}
          {selected || highlighted ? (
            <mesh position={[0, 0, 0.28]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.025, 0.22, 6]} />
              <meshBasicMaterial color="#fcd34d" transparent opacity={0.6} />
            </mesh>
          ) : null}
        </group>
        <Limb position={[-0.25, 1.4, 0]} color={character.color} joint={leftArm} />
        <Limb position={[0.25, 1.4, 0]} color={character.color} joint={rightArm} />
        <Limb position={[-0.11, 0.66, 0]} color="#494954" leg joint={leftLeg} knee={leftKnee} />
        <Limb position={[0.11, 0.66, 0]} color="#494954" leg joint={rightLeg} knee={rightKnee} />
      </group>
    </group>
  );
});
function Prop({
  prop,
  selected,
  onSelect,
}: {
  prop: StudioScene["props"][number];
  selected: boolean;
  onSelect?: (selection: StudioSelection) => void;
}) {
  return (
    <group
      position={[prop.position.x, prop.position.y, prop.position.z]}
      rotation={[0, ((prop.rotation ?? 0) * Math.PI) / 180, 0]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.({ kind: "prop", id: prop.id });
      }}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={[prop.size.x, prop.kind === "box" ? prop.size.y : 0.1, prop.size.z]} />
        <meshStandardMaterial color={selected ? "#e7ad52" : prop.color} />
      </mesh>
      {prop.kind === "chair" ? (
        <mesh position={[0, prop.size.y / 2, -prop.size.z / 2]}>
          <boxGeometry args={[prop.size.x, prop.size.y, 0.1]} />
          <meshStandardMaterial color={prop.color} />
        </mesh>
      ) : null}
      {prop.kind !== "box"
        ? [-1, 1].flatMap((sideX) =>
            [-1, 1].map((sideZ) => (
              <mesh
                key={sideX + ":" + sideZ}
                position={[
                  sideX * prop.size.x * 0.4,
                  -prop.position.y / 2,
                  sideZ * prop.size.z * 0.4,
                ]}
              >
                <boxGeometry args={[0.08, Math.max(0.1, prop.position.y), 0.08]} />
                <meshStandardMaterial color={prop.color} />
              </mesh>
            )),
          )
        : null}
    </group>
  );
}
export default memo(function StudioCanvas({
  scene,
  clock,
  time,
  playing,
  shot,
  selection,
  roleId,
  onSelect,
  onFailure,
}: {
  scene: StudioScene;
  clock: RefObject<number>;
  time: number;
  playing: boolean;
  shot: string;
  selection?: StudioSelection;
  roleId?: string | null;
  onSelect?: (selection: StudioSelection) => void;
  onFailure: () => void;
}) {
  const mobile = typeof window !== "undefined" && window.matchMedia("(max-width: 700px)").matches;
  return (
    <Canvas
      frameloop="demand"
      shadows={!mobile}
      dpr={mobile ? 1 : [1, 1.5]}
      camera={{ position: [0, 4, 8], fov: 50 }}
      gl={{ powerPreference: "low-power", antialias: !mobile }}
      onCreated={({ gl }) =>
        gl.domElement.addEventListener(
          "webglcontextlost",
          (event) => {
            event.preventDefault();
            onFailure();
          },
          { once: true },
        )
      }
    >
      <color attach="background" args={["#111214"]} />
      <ambientLight intensity={0.9} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.8}
        castShadow={!mobile}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <gridHelper args={[40, 40, "#665434", "#28282c"]} />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
        onClick={() => onSelect?.({ kind: "scene", id: "scene" })}
      >
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#17171b" />
      </mesh>
      {scene.props.map((prop) => (
        <Prop
          key={prop.id}
          prop={prop}
          selected={selection?.kind === "prop" && selection.id === prop.id}
          onSelect={onSelect}
        />
      ))}
      {scene.characters.map((character) => (
        <Character
          key={character.id}
          character={character}
          scene={scene}
          clock={clock}
          selected={selection?.kind === "character" && character.id === selection.id}
          highlighted={character.id === roleId}
          onSelect={onSelect}
        />
      ))}
      <Camera scene={scene} clock={clock} shot={shot} playing={playing} />
      <Invalidate scene={scene} time={time} selection={selection} playing={playing} shot={shot} />
    </Canvas>
  );
});
