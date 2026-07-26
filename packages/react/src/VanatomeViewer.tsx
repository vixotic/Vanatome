import { OrbitControls, useGLTF } from "@react-three/drei";
import {
  Canvas,
  type ThreeEvent,
  useFrame,
  useThree,
} from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type {
  VanatomeStructure,
  VanatomeViewerProps,
  VanatomeVector3,
} from "./types.js";

type SceneProps = Omit<VanatomeViewerProps, "className"> & {
  initialCameraPosition: VanatomeVector3;
  focusDistance: number;
  modelScale: number;
  modelPosition: VanatomeVector3;
};

function anatomyIdFor(object: THREE.Object3D | null): string | null {
  let current = object;
  while (current) {
    const id = current.userData?.anatomyId;
    if (typeof id === "string") return id;
    current = current.parent;
  }
  return null;
}

function AtlasModel({
  atlas,
  selectedId,
  isolatedId,
  visibleLayers,
  modelScale,
  modelPosition,
  onSelect,
}: SceneProps) {
  const gltf = useGLTF(atlas.modelUrl) as { scene: THREE.Group };
  const structures = useMemo(
    () => new Map(atlas.structures.map((structure) => [structure.id, structure])),
    [atlas.structures],
  );
  const isolatedIds = useMemo(() => {
    if (!isolatedId) return null;
    const ids = new Set<string>();
    for (const structure of atlas.structures) {
      let current: VanatomeStructure | undefined = structure;
      while (current) {
        if (current.id === isolatedId) {
          ids.add(structure.id);
          break;
        }
        current = current.parentId
          ? structures.get(current.parentId)
          : undefined;
      }
    }
    return ids;
  }, [atlas.structures, isolatedId, structures]);
  const model = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.material = Array.isArray(object.material)
        ? object.material.map((material) => material.clone())
        : object.material.clone();
    });
    return clone;
  }, [gltf.scene]);

  useEffect(() => {
    const visibleLayerSet = visibleLayers?.length
      ? new Set(visibleLayers)
      : null;
    model.traverse((object) => {
      const id = anatomyIdFor(object);
      if (!id) return;
      const structure = structures.get(id);
      object.visible =
        (!isolatedIds || isolatedIds.has(id)) &&
        (!visibleLayerSet || !structure || visibleLayerSet.has(structure.layer));
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        material.transparent = id !== selectedId;
        material.opacity = id === selectedId ? 1 : 0.72;
        material.emissive.copy(material.color);
        material.emissiveIntensity = id === selectedId ? 1.4 : 0.12;
        material.needsUpdate = true;
      }
    });
  }, [isolatedIds, model, selectedId, structures, visibleLayers]);

  const selectFromEvent = (event: ThreeEvent<MouseEvent>) => {
    const id = anatomyIdFor(event.object);
    if (!id || !structures.has(id)) return;
    event.stopPropagation();
    onSelect?.(id);
  };

  return (
    <primitive
      object={model}
      scale={modelScale}
      position={modelPosition}
      onClick={selectFromEvent}
    />
  );
}

function CameraController({
  atlas,
  selectedId,
  focusRequestKey,
  resetViewKey,
  initialCameraPosition,
  focusDistance,
}: Pick<
  SceneProps,
  | "atlas"
  | "selectedId"
  | "focusRequestKey"
  | "resetViewKey"
  | "initialCameraPosition"
  | "focusDistance"
>) {
  const controls = useRef<React.ElementRef<typeof OrbitControls>>(null);
  const { camera } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);
  const destination = useMemo(() => new THREE.Vector3(), []);
  const animating = useRef(false);
  const selected = atlas.structures.find(
    (structure: VanatomeStructure) => structure.id === selectedId,
  );

  useEffect(() => {
    if (!selected) return;
    target.set(...selected.position);
    destination.set(
      selected.position[0],
      selected.position[1],
      selected.position[2] + focusDistance,
    );
    animating.current = true;
  }, [destination, focusDistance, focusRequestKey, selected, target]);

  useEffect(() => {
    target.set(0, 0, 0);
    destination.set(...initialCameraPosition);
    animating.current = true;
  }, [destination, initialCameraPosition, resetViewKey, target]);

  useFrame(() => {
    const instance = controls.current;
    if (!instance || !animating.current) return;
    instance.target.lerp(target, 0.08);
    camera.position.lerp(destination, 0.08);
    instance.update();
    if (
      instance.target.distanceTo(target) < 0.01 &&
      camera.position.distanceTo(destination) < 0.02
    ) {
      animating.current = false;
    }
  });

  return (
    <OrbitControls
      ref={controls}
      enablePan={false}
      enableDamping
      minDistance={2}
      maxDistance={30}
      onStart={() => {
        animating.current = false;
      }}
    />
  );
}

function Scene(props: SceneProps) {
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[4, 5, 6]} intensity={2.2} />
      <AtlasModel {...props} />
      <CameraController {...props} />
    </>
  );
}

export function VanatomeViewer({
  className,
  modelScale = 1,
  modelPosition = [0, 0, 0],
  initialCameraPosition = [0, 0, 8],
  focusDistance = 4,
  onSelect,
  ...props
}: VanatomeViewerProps) {
  return (
    <div className={className} style={{ width: "100%", height: "100%" }}>
      <Canvas
        camera={{ position: [...initialCameraPosition], fov: 42 }}
        onPointerMissed={() => onSelect?.(null)}
      >
        <Scene
          {...props}
          onSelect={onSelect}
          modelScale={modelScale}
          modelPosition={modelPosition}
          initialCameraPosition={initialCameraPosition}
          focusDistance={focusDistance}
        />
      </Canvas>
    </div>
  );
}
