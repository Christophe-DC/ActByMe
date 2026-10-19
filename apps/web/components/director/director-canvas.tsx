"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PerspectiveCamera, Vector3, Group } from "three";
import { useEffect, useRef, useMemo } from "react";
import {
  directorCastTimelinePosition,
  directorDuration,
  directorShotAt,
  sampleDirectorCamera,
  type DirectorDocument,
  type DirectorCast,
} from "@actbyme/shared";

function Box({
  position,
  scale,
  color,
  rotation = 0,
}: {
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
  rotation?: number;
}) {
  return (
    <mesh position={position} scale={scale} rotation={[0, rotation, 0]} castShadow receiveShadow>
      <boxGeometry />
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
  );
}
function Plant({ x, z, height = 2 }: { x: number; z: number; height?: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.2, 0.5, 12]} />
        <meshStandardMaterial color="#a1927b" />
      </mesh>
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.035, 0.06, height, 8]} />
        <meshStandardMaterial color="#7d6a4e" />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <group
          key={index}
          rotation={[0, index * 1.05, 0]}
          position={[0, height * (index % 2 ? 0.72 : 0.9), 0]}
        >
          <mesh rotation={[0, 0, -0.65]} position={[0.3, 0.05, 0]} castShadow>
            <sphereGeometry args={[0.55, 8, 6]} />
            <meshStandardMaterial color={index % 2 ? "#536b55" : "#75886b"} roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
function CoastalHouse() {
  return (
    <group>
      <Box position={[0, -0.25, 0]} scale={[32, 0.35, 28]} color="#a3aa8b" />
      <Box position={[0, -0.06, -1]} scale={[13, 0.18, 14]} color="#d4c9b2" />
      <Box position={[0, -0.02, 7.5]} scale={[11, 0.2, 3]} color="#ae9b7b" />
      <Box position={[-7.4, -0.05, 3]} scale={[2.8, 0.12, 6]} color="#78a7a6" />
      <Box position={[0, 0, -8]} scale={[34, 0.15, 5]} color="#c9bda1" />
      <Box position={[0, -0.07, -30]} scale={[160, 0.1, 45]} color="#7fa6b0" />
      <Box position={[0, 0.08, -1]} scale={[12, 0.1, 13]} color="#bdb19c" />
      {[-6, 6].map((x) => (
        <group key={x}>
          <Box position={[x, 1.65, -1]} scale={[0.2, 3.3, 13]} color="#d8cebb" />
          <Box position={[x * 0.65, 1.6, -7]} scale={[0.2, 3.2, 0.18]} color="#584e43" />
        </group>
      ))}
      {[-6, -3, 0, 3, 6].map((x) => (
        <group key={x}>
          <Box position={[x, 1.65, -7.5]} scale={[0.09, 3.3, 0.1]} color="#675e52" />
          <Box position={[x, 1.65, 5.5]} scale={[0.1, 3.3, 0.12]} color="#b8ad98" />
        </group>
      ))}
      <Box position={[0, 3.3, -1]} scale={[12.2, 0.15, 13.4]} color="#d3cab8" />
      <Box position={[0, 3.1, 5.5]} scale={[12, 0.35, 0.3]} color="#beb29b" />
      <Box position={[-3, 0.19, -0.5]} scale={[4.5, 0.04, 4.4]} color="#ded6c8" />
      <group position={[-3.4, 0.2, -1.4]}>
        <Box position={[0, 0.35, 0]} scale={[3.7, 0.55, 1.2]} color="#bfb6a7" />
        <Box position={[0, 0.72, -0.53]} scale={[3.7, 0.65, 0.25]} color="#cec6b8" />
        {[-1.3, -0.45, 0.45, 1.3].map((x) => (
          <Box key={x} position={[x, 0.65, -0.17]} scale={[0.8, 0.22, 0.75]} color="#e3dccf" />
        ))}
        <Box position={[-1.9, 0.5, 0]} scale={[0.2, 0.7, 1.25]} color="#d5cabb" />
      </group>
      <mesh position={[-2.6, 0.6, 1.1]} castShadow receiveShadow>
        <cylinderGeometry args={[0.9, 0.9, 0.12, 32]} />
        <meshStandardMaterial color="#a59478" />
      </mesh>
      <mesh position={[-2.6, 0.32, 1.1]}>
        <cylinderGeometry args={[0.18, 0.23, 0.55, 16]} />
        <meshStandardMaterial color="#7c6b54" />
      </mesh>
      <mesh position={[-2.6, 0.84, 1.1]} castShadow>
        <sphereGeometry args={[0.2, 20, 16]} />
        <meshStandardMaterial color="#e5dfd1" />
      </mesh>
      <Box position={[3.6, 0.7, -2.2]} scale={[2.4, 1.15, 4]} color="#c3b39b" />
      <Box position={[3.6, 1.3, -2.2]} scale={[2.6, 0.12, 4.2]} color="#e0dacd" />
      {[0.1, -1.4, -2.9].map((z) => (
        <group key={z}>
          <mesh position={[1.8, 0.95, z]} castShadow>
            <cylinderGeometry args={[0.32, 0.28, 0.12, 20]} />
            <meshStandardMaterial color="#857359" />
          </mesh>
          <Box position={[1.8, 0.5, z]} scale={[0.1, 0.9, 0.1]} color="#5a5144" />
        </group>
      ))}
      <Plant x={-5} z={3.7} height={2.6} />
      <Plant x={5} z={-6} height={2.2} />
      <Plant x={-8} z={6} height={3.8} />
      <Plant x={8} z={-5} height={4.5} />
      <Plant x={-8} z={-10} height={4} />
      {[-1, 2].map((x) => (
        <group key={x} position={[x, 0.2, -10]}>
          <Box position={[0, 0.2, 0]} scale={[1.2, 0.25, 2.2]} color="#e2d7c4" />
          <Box
            position={[0, 0.6, -0.8]}
            scale={[1.2, 0.75, 0.15]}
            color="#c4b59c"
            rotation={0.15}
          />
        </group>
      ))}
    </group>
  );
}
function StudioEnvironment() {
  return (
    <group>
      <Box position={[0, -0.12, 0]} scale={[40, 0.2, 40]} color="#b5b2a7" />
      <Box position={[0, 3, -7]} scale={[22, 6, 0.15]} color="#d8d1c2" />
      <mesh position={[0, 0.65, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.9, 1, 1.3, 48]} />
        <meshStandardMaterial color="#d1c6af" />
      </mesh>
      <mesh position={[0, 1.58, 0]} castShadow>
        <torusKnotGeometry args={[0.3, 0.09, 80, 12]} />
        <meshStandardMaterial color="#ac8152" metalness={0.55} roughness={0.24} />
      </mesh>
      <Plant x={-4} z={-3} />
    </group>
  );
}
function Mannequin({
  person,
  document,
  time,
  moving,
}: {
  person: DirectorCast;
  document: DirectorDocument;
  time: number;
  moving: boolean;
}) {
  const root = useRef<Group>(null);
  const legs = useRef<Group>(null);
  useFrame(() => {
    if (!root.current) return;
    const position = directorCastTimelinePosition(document, person, time);
    root.current.position.set(position.x, 0.15, position.z);
    const direction = Math.atan2(
      person.endPosition.x - person.position.x,
      person.endPosition.z - person.position.z,
    );
    root.current.rotation.y = direction;
    if (legs.current) legs.current.rotation.x = moving ? Math.sin(time * 6) * 0.22 : 0;
  });
  const color =
    person.kind === "placeholder" ? "#a3a1a0" : person.kind === "virtual" ? "#9da8ba" : "#bb9c7c";
  return (
    <group ref={root}>
      <mesh position={[0, 1.6, 0]} castShadow>
        <sphereGeometry args={[0.14, 20, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.2, 0]} castShadow>
        <capsuleGeometry args={[0.2, 0.42, 8, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <group ref={legs}>
        {[-0.13, 0.13].map((x) => (
          <mesh key={x} position={[x, 0.5, 0]} castShadow>
            <capsuleGeometry args={[0.075, 0.65, 6, 8]} />
            <meshStandardMaterial color={color} />
          </mesh>
        ))}
      </group>
      {[-0.3, 0.3].map((x) => (
        <mesh key={x} position={[x, 1.12, 0]} rotation={[0, 0, x > 0 ? 0.14 : -0.14]} castShadow>
          <capsuleGeometry args={[0.06, 0.5, 6, 8]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}
function CameraRig({
  document,
  time,
  free,
}: {
  document: DirectorDocument;
  time: number;
  free: boolean;
}) {
  const { camera, gl, invalidate } = useThree();
  const vector = useMemo(() => new Vector3(), []);
  useEffect(() => {
    if (!free) return;
    camera.position.set(-12, 9, 16);
    camera.lookAt(0, 1, 0);
    const controls = new OrbitControls(camera, gl.domElement);
    controls.target.set(0, 1, 0);
    controls.minDistance = 1;
    controls.maxDistance = 50;
    const refresh = () => invalidate();
    controls.addEventListener("change", refresh);
    controls.update();
    invalidate();
    return () => {
      controls.removeEventListener("change", refresh);
      controls.dispose();
    };
  }, [free, camera, gl, invalidate]);
  useEffect(() => {
    invalidate();
  }, [document, time, free, invalidate]);
  useFrame(() => {
    if (free) return;
    const { shot, localTime } = directorShotAt(document, time);
    const sampled = sampleDirectorCamera(
      shot,
      localTime,
      document.cast,
      time,
      directorDuration(document),
      document,
    );
    camera.position.set(sampled.position.x, sampled.position.y, sampled.position.z);
    camera.lookAt(vector.set(sampled.target.x, sampled.target.y, sampled.target.z));
    if (camera instanceof PerspectiveCamera) {
      camera.fov = (2 * Math.atan(24 / (2 * sampled.lens)) * 180) / Math.PI;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}
export default function DirectorCanvas({
  document,
  time,
  free,
  onFailure,
}: {
  document: DirectorDocument;
  time: number;
  free: boolean;
  onFailure: () => void;
}) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      frameloop="demand"
      camera={{ position: [-7, 1.8, 9], near: 0.05, far: 180 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", onFailure, { once: true });
      }}
    >
      <color attach="background" args={["#c6d3d2"]} />
      <fog attach="fog" args={["#c6d3d2", 30, 110]} />
      <ambientLight intensity={1.4} />
      <hemisphereLight args={["#e6ede9", "#7f7865", 1.7]} />
      <directionalLight
        position={[-10, 13, -8]}
        intensity={3}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-normalBias={0.04}
      />
      {document.environment === "coastal" ? <CoastalHouse /> : <StudioEnvironment />}
      {document.cast.map((person) => (
        <Mannequin
          key={person.id}
          person={person}
          document={document}
          time={time}
          moving={document.tracks.some(
            (item) =>
              item.castId === person.id && time >= item.start && time < item.start + item.duration,
          )}
        />
      ))}
      <CameraRig document={document} time={time} free={free} />
    </Canvas>
  );
}
