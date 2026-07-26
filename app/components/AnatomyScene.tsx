"use client";

import { OrbitControls, Stars, useGLTF } from "@react-three/drei";
import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { GLTF } from "three-stdlib";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { anatomyById } from "../data/anatomy";

type Props = {
  selectedId: string | null;
  focusSignal: number;
  resetSignal: number;
  onSelect: (id: string) => void;
};

const MODEL_SCALE = 7;
const MODEL_OFFSET_Y = -6.1;
const selectableIds = new Set(Object.keys(anatomyById));

function anatomyIdFor(object: THREE.Object3D | null): string | null {
  let current = object;
  while (current) {
    const id = current.userData?.anatomyId;
    if (typeof id === "string") return id;
    current = current.parent;
  }
  return null;
}

function RealTorsoModel({ selectedId, onSelect }: Props) {
  const gltf = useGLTF("/models/z-anatomy-full-body.glb") as GLTF;
  const model = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.material = Array.isArray(object.material)
        ? object.material.map((material) => material.clone())
        : object.material.clone();
      object.castShadow = false;
      object.receiveShadow = false;
    });
    return clone;
  }, [gltf.scene]);

  useEffect(() => {
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const id = anatomyIdFor(object);
      const materials = Array.isArray(object.material) ? object.material : [object.material];

      materials.forEach((material) => {
        if (!(material instanceof THREE.MeshStandardMaterial)) return;

        if (id === "body-shell") {
          material.transparent = true;
          material.opacity = 0.12;
          material.depthWrite = false;
          material.color.set("#41dff7");
          material.emissive.set("#087c99");
          material.emissiveIntensity = 0.65;
          material.wireframe = true;
        } else if (id === "skeleton") {
          material.transparent = true;
          material.opacity = 0.22;
          material.depthWrite = false;
          material.color.set("#9befff");
          material.emissive.set("#2cbad5");
          material.emissiveIntensity = 0.28;
        } else if (id === selectedId) {
          material.transparent = false;
          material.opacity = 1;
          material.emissive.copy(material.color);
          material.emissiveIntensity = 1.75;
        } else {
          material.transparent = true;
          material.opacity = 0.78;
          material.depthWrite = true;
          material.emissive.copy(material.color);
          material.emissiveIntensity = 0.2;
        }
        material.needsUpdate = true;
      });
    });
  }, [model, selectedId]);

  useFrame(({ clock }) => {
    const pulse = 1.55 + Math.sin(clock.elapsedTime * 4.2) * 0.65;
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || anatomyIdFor(object) !== selectedId) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.emissiveIntensity = pulse;
        }
      });
    });
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    const id = anatomyIdFor(event.object);
    if (!id || !selectableIds.has(id)) return;
    event.stopPropagation();
    onSelect(id);
  };

  return (
    <primitive
      object={model}
      scale={MODEL_SCALE}
      position={[0, MODEL_OFFSET_Y, 0]}
      onClick={handleClick}
      onPointerOver={(event: ThreeEvent<PointerEvent>) => {
        const id = anatomyIdFor(event.object);
        if (id && selectableIds.has(id)) document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "default";
      }}
    />
  );
}

function CameraController({
  selectedId,
  focusSignal,
  resetSignal,
}: Pick<Props, "selectedId" | "focusSignal" | "resetSignal">) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const desiredTarget = useMemo(() => new THREE.Vector3(), []);
  const desiredCamera = useMemo(() => new THREE.Vector3(), []);
  const animating = useRef(false);

  useEffect(() => {
    if (!selectedId) return;
    const organ = anatomyById[selectedId];
    desiredTarget.set(...organ.position);
    const cameraDistance = 7.5;
    desiredCamera.set(
      organ.position[0] + 0.1,
      organ.position[1] + 0.12,
      cameraDistance,
    );
    animating.current = true;
  }, [desiredCamera, desiredTarget, focusSignal, selectedId]);

  useEffect(() => {
    desiredTarget.set(0, 0, 0);
    desiredCamera.set(0, 0, 18);
    animating.current = true;
  }, [desiredCamera, desiredTarget, resetSignal]);

  useFrame(() => {
    if (!controls.current || !animating.current) return;
    controls.current.target.lerp(desiredTarget, 0.075);
    camera.position.lerp(desiredCamera, 0.075);
    controls.current.update();

    if (
      controls.current.target.distanceTo(desiredTarget) < 0.008 &&
      camera.position.distanceTo(desiredCamera) < 0.015
    ) {
      controls.current.target.copy(desiredTarget);
      camera.position.copy(desiredCamera);
      controls.current.update();
      animating.current = false;
    }
  });

  return (
    <OrbitControls
      ref={controls}
      enablePan={false}
      minDistance={3.6}
      maxDistance={24}
      dampingFactor={0.06}
      enableDamping
      onStart={() => {
        animating.current = false;
      }}
    />
  );
}

function SceneContent(props: Props) {
  return (
    <>
      <color attach="background" args={["#03080d"]} />
      <fog attach="fog" args={["#03080d", 14, 28]} />
      <ambientLight intensity={0.72} color="#7cecff" />
      <directionalLight position={[4, 5, 6]} intensity={2.4} color="#e5fbff" />
      <pointLight position={[-4, 0, 3]} intensity={32} distance={10} color="#0077ff" />
      <pointLight position={[4, -2, 2]} intensity={20} distance={8} color="#ff3d9a" />
      <Stars radius={15} depth={8} count={550} factor={1.2} saturation={0} fade speed={0.5} />
      <RealTorsoModel {...props} />
      <gridHelper args={[12, 24, "#0d7089", "#062933"]} position={[0, -2.85, 0]} />
      <CameraController
        selectedId={props.selectedId}
        focusSignal={props.focusSignal}
        resetSignal={props.resetSignal}
      />
    </>
  );
}

export function AnatomyScene(props: Props) {
  return (
    <Canvas
      camera={{ position: [0, 0, 18], fov: 42 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
    >
      <SceneContent {...props} />
    </Canvas>
  );
}

useGLTF.preload("/models/z-anatomy-full-body.glb");
