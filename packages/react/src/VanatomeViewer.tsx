import { OrbitControls, useGLTF } from "@react-three/drei";
import {
  Canvas,
  type ThreeEvent,
  useFrame,
  useThree,
} from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  createVanatomeHierarchy,
  getVanatomeDescendantIds,
} from "./hierarchy.js";
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

const BODY_SHELL_ID = "body-shell";
const SKELETON_ID = "skeleton";

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
  const hierarchy = useMemo(
    () => createVanatomeHierarchy(atlas.structures),
    [atlas.structures],
  );
  const selectedIds = useMemo(
    () => new Set(selectedId ? getVanatomeDescendantIds(hierarchy, selectedId) : []),
    [hierarchy, selectedId],
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

        if (id === BODY_SHELL_ID) {
          material.transparent = true;
          material.opacity = 0.12;
          material.depthWrite = false;
          material.color.set("#41dff7");
          material.emissive.set("#087c99");
          material.emissiveIntensity = 0.65;
          material.wireframe = true;
        } else if (id === SKELETON_ID) {
          material.transparent = true;
          material.opacity = 0.22;
          material.depthWrite = false;
          material.color.set("#9befff");
          material.emissive.set("#2cbad5");
          material.emissiveIntensity = 0.28;
          material.wireframe = false;
        } else if (selectedIds.has(id)) {
          material.transparent = false;
          material.opacity = 1;
          material.depthWrite = true;
          material.wireframe = false;
          material.emissive.copy(material.color);
          material.emissiveIntensity = 1.75;
        } else {
          material.transparent = true;
          material.opacity = 0.78;
          material.depthWrite = true;
          material.wireframe = false;
          material.emissive.copy(material.color);
          material.emissiveIntensity = 0.2;
        }
        material.needsUpdate = true;
      }
    });
  }, [isolatedIds, model, selectedIds, structures, visibleLayers]);

  useFrame(({ clock }) => {
    const pulse = 1.55 + Math.sin(clock.elapsedTime * 4.2) * 0.65;
    model.traverse((object) => {
      if (
        !(object instanceof THREE.Mesh) ||
        !selectedIds.has(anatomyIdFor(object) ?? "")
      ) {
        return;
      }
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials) {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.emissiveIntensity = pulse;
        }
      }
    });
  });

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
