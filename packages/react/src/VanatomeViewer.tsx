import {
  OrbitControls,
  useGLTF,
  useProgress,
} from "@react-three/drei";
import {
  Canvas,
  type ThreeEvent,
  useFrame,
  useThree,
} from "@react-three/fiber";
import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import * as THREE from "three";
import {
  calculateFocusDistance,
  createStructureIndex,
  getRelatedStructureIds,
  isStructureSelectable,
  resolveStructureVisibility,
} from "./sceneBehavior.js";
import type {
  VanatomeLoadProgress,
  VanatomeStructure,
  VanatomeViewerAppearance,
  VanatomeViewerError,
  VanatomeViewerProps,
  VanatomeVector3,
  VanatomeViewState,
} from "./types.js";

type LoadedSceneProps = Omit<
  VanatomeViewerProps,
  | "ariaLabel"
  | "className"
  | "errorFallback"
  | "hoveredId"
  | "loadingFallback"
  | "onError"
  | "onHover"
  | "onLoadProgress"
  | "onLoadStart"
  | "style"
> & {
  hoveredId: string | null;
  initialCameraPosition: VanatomeVector3;
  initialCameraTarget: VanatomeVector3;
  modelScale: number;
  modelPosition: VanatomeVector3;
  focusDistance: number;
  focusPadding: number;
  cameraAnimationDuration: number;
  respectReducedMotion: boolean;
  enablePan: boolean;
  minDistance: number;
  maxDistance: number;
  appearance: Required<VanatomeViewerAppearance>;
  onPoint: (id: string | null) => void;
};

type MaterialSnapshot = {
  transparent: boolean;
  opacity: number;
  depthWrite: boolean;
  wireframe: boolean;
  color: THREE.Color;
  emissive: THREE.Color;
  emissiveIntensity: number;
};

type CameraAnimation = {
  elapsed: number;
  duration: number;
  startPosition: THREE.Vector3;
  endPosition: THREE.Vector3;
  startTarget: THREE.Vector3;
  endTarget: THREE.Vector3;
};

const DEFAULT_APPEARANCE: Required<VanatomeViewerAppearance> = {
  bodyShellId: "body-shell",
  skeletonId: "skeleton",
  defaultOpacity: 0.78,
  xrayOpacity: 0.28,
  ghostOpacity: 0.1,
  parentContextOpacity: 0.16,
  hoverEmissiveIntensity: 0.85,
  selectedDescendantEmissiveIntensity: 0.9,
  selectedEmissiveIntensity: 1.75,
  pulseSelection: true,
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

function snapshotMaterial(
  material: THREE.MeshStandardMaterial,
): MaterialSnapshot {
  return {
    transparent: material.transparent,
    opacity: material.opacity,
    depthWrite: material.depthWrite,
    wireframe: material.wireframe,
    color: material.color.clone(),
    emissive: material.emissive.clone(),
    emissiveIntensity: material.emissiveIntensity,
  };
}

function restoreMaterial(
  material: THREE.MeshStandardMaterial,
  snapshot: MaterialSnapshot,
) {
  material.transparent = snapshot.transparent;
  material.opacity = snapshot.opacity;
  material.depthWrite = snapshot.depthWrite;
  material.wireframe = snapshot.wireframe;
  material.color.copy(snapshot.color);
  material.emissive.copy(snapshot.emissive);
  material.emissiveIntensity = snapshot.emissiveIntensity;
}

function vectorTuple(vector: THREE.Vector3): VanatomeVector3 {
  return [vector.x, vector.y, vector.z];
}

function useReducedMotion(enabled: boolean): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!enabled || typeof window === "undefined") return () => {};
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    [enabled],
  );
  const getSnapshot = useCallback(
    () =>
      enabled &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [enabled],
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

function useLatest<T>(value: T) {
  const reference = useRef(value);
  useEffect(() => {
    reference.current = value;
  }, [value]);
  return reference;
}

function LoadingMonitor({
  onProgress,
}: {
  onProgress?: (progress: VanatomeLoadProgress) => void;
}) {
  const { loaded, total, progress } = useProgress();

  useEffect(() => {
    onProgress?.({ loaded, total, percentage: progress });
  }, [loaded, onProgress, progress, total]);

  return null;
}

function LoadStartMonitor({
  modelUrl,
  onLoadStart,
}: {
  modelUrl: string;
  onLoadStart?: (modelUrl: string) => void;
}) {
  const onLoadStartRef = useLatest(onLoadStart);
  const startedUrl = useRef<string | null>(null);

  useEffect(() => {
    if (startedUrl.current === modelUrl) return;
    startedUrl.current = modelUrl;
    onLoadStartRef.current?.(modelUrl);
  }, [modelUrl, onLoadStartRef]);

  return null;
}

function ContextMonitor({
  modelUrl,
  onError,
  onRestore,
}: {
  modelUrl: string;
  onError: (error: VanatomeViewerError) => void;
  onRestore: (modelUrl: string) => void;
}) {
  const { gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;
    const handleContextLoss = (event: Event) => {
      event.preventDefault();
      onError({
        code: "webgl-context-lost",
        message: "The WebGL rendering context was lost.",
        modelUrl,
      });
    };
    const handleContextRestore = () => onRestore(modelUrl);
    canvas.addEventListener("webglcontextlost", handleContextLoss);
    canvas.addEventListener("webglcontextrestored", handleContextRestore);
    return () => {
      canvas.removeEventListener("webglcontextlost", handleContextLoss);
      canvas.removeEventListener("webglcontextrestored", handleContextRestore);
    };
  }, [gl, modelUrl, onError, onRestore]);

  return null;
}

class ViewerErrorBoundary extends Component<
  {
    children: ReactNode;
    modelUrl: string;
    onError: (error: VanatomeViewerError) => void;
  },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onError({
      code: "model-load-failed",
      message: error instanceof Error ? error.message : "The model failed to load.",
      modelUrl: this.props.modelUrl,
      cause: error,
    });
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function AtlasModel({
  atlas,
  model,
  selectedId,
  hoveredId,
  isolatedId,
  isolation,
  visibleLayers,
  alwaysVisibleIds,
  hiddenIds,
  displayMode = "normal",
  appearance,
  onSelect,
  onPoint,
  onStructureContextMenu,
}: Pick<
  LoadedSceneProps,
  | "atlas"
  | "selectedId"
  | "hoveredId"
  | "isolatedId"
  | "isolation"
  | "visibleLayers"
  | "alwaysVisibleIds"
  | "hiddenIds"
  | "displayMode"
  | "appearance"
  | "onSelect"
  | "onPoint"
  | "onStructureContextMenu"
> & {
  model: THREE.Group;
}) {
  const structures = useMemo(
    () => createStructureIndex(atlas.structures),
    [atlas.structures],
  );
  const visibility = useMemo(
    () =>
      resolveStructureVisibility(atlas.structures, {
        visibleLayers,
        isolatedId,
        isolation,
        hiddenIds,
        alwaysVisibleIds,
      }),
    [
      alwaysVisibleIds,
      atlas.structures,
      hiddenIds,
      isolatedId,
      isolation,
      visibleLayers,
    ],
  );
  const selectedIds = useMemo(
    () =>
      selectedId
        ? getRelatedStructureIds(atlas.structures, selectedId)
        : new Set<string>(),
    [atlas.structures, selectedId],
  );
  const hoveredIds = useMemo(
    () =>
      hoveredId
        ? getRelatedStructureIds(atlas.structures, hoveredId)
        : new Set<string>(),
    [atlas.structures, hoveredId],
  );
  const snapshots = useMemo(() => {
    const result = new WeakMap<THREE.MeshStandardMaterial, MaterialSnapshot>();
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials) {
        if (material instanceof THREE.MeshStandardMaterial) {
          result.set(material, snapshotMaterial(material));
        }
      }
    });
    return result;
  }, [model]);
  const updateSelectionPulse = useRef<(pulse: number) => void>(() => {});
  const pointerGesture = useRef<{
    button: number;
    x: number;
    y: number;
    distance: number;
  } | null>(null);

  useEffect(() => {
    const pulseTargets: THREE.MeshStandardMaterial[] = [];

    model.traverse((object) => {
      const id = anatomyIdFor(object);
      if (!(object instanceof THREE.Mesh) || !id) return;
      object.visible = visibility.visible.has(id);

      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        const snapshot = snapshots.get(material);
        if (!snapshot) continue;
        restoreMaterial(material, snapshot);

        if (id === appearance.bodyShellId) {
          material.transparent = true;
          material.opacity = 0.12;
          material.depthWrite = false;
          material.color.set("#41dff7");
          material.emissive.set("#087c99");
          material.emissiveIntensity = 0.65;
          material.wireframe = true;
        } else if (id === appearance.skeletonId) {
          material.transparent = true;
          material.opacity = 0.22;
          material.depthWrite = false;
          material.color.set("#9befff");
          material.emissive.set("#2cbad5");
          material.emissiveIntensity = 0.28;
          material.wireframe = false;
        } else if (id === selectedId) {
          material.transparent = false;
          material.opacity = 1;
          material.depthWrite = true;
          material.wireframe = false;
          material.emissive.copy(material.color);
          material.emissiveIntensity = appearance.selectedEmissiveIntensity;
          pulseTargets.push(material);
        } else if (selectedIds.has(id)) {
          material.transparent = false;
          material.opacity = 1;
          material.depthWrite = true;
          material.wireframe = false;
          material.emissive.copy(material.color);
          material.emissiveIntensity =
            appearance.selectedDescendantEmissiveIntensity;
        } else if (visibility.context.has(id)) {
          material.transparent = true;
          material.opacity = appearance.parentContextOpacity;
          material.depthWrite = false;
          material.wireframe = false;
          material.emissive.copy(material.color);
          material.emissiveIntensity = 0.08;
        } else {
          const opacity =
            displayMode === "xray"
              ? appearance.xrayOpacity
              : displayMode === "ghost"
                ? appearance.ghostOpacity
                : appearance.defaultOpacity;
          material.transparent = opacity < 1;
          material.opacity = opacity;
          material.depthWrite = displayMode === "normal";
          material.wireframe = false;

          if (id === hoveredId || hoveredIds.has(id)) {
            material.emissive.copy(material.color);
            material.emissiveIntensity =
              id === hoveredId
                ? appearance.hoverEmissiveIntensity
                : appearance.hoverEmissiveIntensity * 0.55;
          } else {
            material.emissive.copy(material.color);
            material.emissiveIntensity = 0.2;
          }
        }
        material.needsUpdate = true;
      }
    });

    updateSelectionPulse.current = (pulse: number) => {
      for (const material of pulseTargets) {
        material.emissiveIntensity = pulse;
      }
    };
    return () => {
      updateSelectionPulse.current = () => {};
    };
  }, [
    appearance,
    displayMode,
    hoveredId,
    hoveredIds,
    model,
    selectedId,
    selectedIds,
    snapshots,
    visibility.context,
    visibility.visible,
  ]);

  useFrame(({ clock }) => {
    if (!appearance.pulseSelection) return;
    const pulse =
      appearance.selectedEmissiveIntensity +
      Math.sin(clock.elapsedTime * 4.2) * 0.65;
    updateSelectionPulse.current(pulse);
  });

  const selectableIdFor = useCallback(
    (event: {
      intersections: ThreeEvent<PointerEvent>["intersections"];
    }) => {
      for (const intersection of event.intersections) {
        const id = anatomyIdFor(intersection.object);
        if (
          id &&
          isStructureSelectable(structures.get(id), visibility.visible)
        ) {
          return id;
        }
      }
      return null;
    },
    [structures, visibility.visible],
  );

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    pointerGesture.current = {
      button: event.button,
      x: event.clientX,
      y: event.clientY,
      distance: 0,
    };
  };

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    const gesture = pointerGesture.current;
    if (!gesture) return;
    const distance = Math.hypot(
      event.clientX - gesture.x,
      event.clientY - gesture.y,
    );
    gesture.distance = Math.max(gesture.distance, distance);
    if (gesture.button !== 0 || gesture.distance > 5) return;
    const id = selectableIdFor(event);
    if (!id) return;
    event.stopPropagation();
    onSelect?.(id);
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    const gesture = pointerGesture.current;
    if (gesture) {
      gesture.distance = Math.max(
        gesture.distance,
        Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y),
      );
    }
    const id = selectableIdFor(event);
    event.stopPropagation();
    onPoint(id);
  };

  const handleContextMenu = (event: ThreeEvent<MouseEvent>) => {
    event.nativeEvent.preventDefault();
    event.stopPropagation();
    const gesture = pointerGesture.current;
    if (gesture?.button === 2 && gesture.distance > 5) {
      pointerGesture.current = null;
      return;
    }
    pointerGesture.current = null;
    const id = selectableIdFor(event);
    if (!id) return;
    if (id !== selectedId) onSelect?.(id);
    onStructureContextMenu?.({
      id,
      clientX: event.clientX,
      clientY: event.clientY,
    });
  };

  return (
    <primitive
      object={model}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerOut={() => onPoint(null)}
      onContextMenu={handleContextMenu}
    />
  );
}

function CameraController({
  atlas,
  model,
  selectedId,
  isolatedId,
  isolation,
  visibleLayers,
  alwaysVisibleIds,
  hiddenIds,
  focusRequestKey,
  resetViewKey,
  initialCameraPosition,
  initialCameraTarget,
  focusDistance,
  focusPadding,
  cameraAnimationDuration,
  respectReducedMotion,
  enablePan,
  minDistance,
  maxDistance,
  onFocusRejected,
  onCameraChange,
  onInteractionStart,
  onInteractionEnd,
}: Pick<
  LoadedSceneProps,
  | "atlas"
  | "selectedId"
  | "isolatedId"
  | "isolation"
  | "visibleLayers"
  | "alwaysVisibleIds"
  | "hiddenIds"
  | "focusRequestKey"
  | "resetViewKey"
  | "initialCameraPosition"
  | "initialCameraTarget"
  | "focusDistance"
  | "focusPadding"
  | "cameraAnimationDuration"
  | "respectReducedMotion"
  | "enablePan"
  | "minDistance"
  | "maxDistance"
  | "onFocusRejected"
  | "onCameraChange"
  | "onInteractionStart"
  | "onInteractionEnd"
> & {
  model: THREE.Group;
}) {
  const controls = useRef<React.ElementRef<typeof OrbitControls>>(null);
  const animation = useRef<CameraAnimation | null>(null);
  const previousResetKey = useRef(resetViewKey);
  const { camera, size } = useThree();
  const visibility = useMemo(
    () =>
      resolveStructureVisibility(atlas.structures, {
        visibleLayers,
        isolatedId,
        isolation,
        hiddenIds,
        alwaysVisibleIds,
      }),
    [
      alwaysVisibleIds,
      atlas.structures,
      hiddenIds,
      isolatedId,
      isolation,
      visibleLayers,
    ],
  );
  const reducedMotion = useReducedMotion(respectReducedMotion);

  const emitCameraChange = useCallback(() => {
    const instance = controls.current;
    if (!instance) return;
    const view: VanatomeViewState = {
      position: vectorTuple(camera.position),
      target: vectorTuple(instance.target),
    };
    onCameraChange?.(view);
  }, [camera.position, onCameraChange]);

  const moveCamera = useCallback(
    (endPosition: THREE.Vector3, endTarget: THREE.Vector3) => {
      const instance = controls.current;
      if (!instance) return;
      const duration = reducedMotion ? 0 : Math.max(0, cameraAnimationDuration);
      if (duration === 0) {
        camera.position.copy(endPosition);
        instance.target.copy(endTarget);
        instance.update();
        return;
      }
      animation.current = {
        elapsed: 0,
        duration: duration / 1000,
        startPosition: camera.position.clone(),
        endPosition,
        startTarget: instance.target.clone(),
        endTarget,
      };
    },
    [
      camera.position,
      cameraAnimationDuration,
      reducedMotion,
    ],
  );

  useEffect(() => {
    if (!selectedId) return;
    const selected = atlas.structures.find(
      (structure: VanatomeStructure) => structure.id === selectedId,
    );
    if (!selected) {
      onFocusRejected?.(selectedId, "structure-not-found");
      return;
    }

    const relatedIds = getRelatedStructureIds(atlas.structures, selectedId);
    const hasVisibleStructure = [...relatedIds].some((id) =>
      visibility.visible.has(id),
    );
    if (!hasVisibleStructure) {
      onFocusRejected?.(selectedId, "structure-not-visible");
      return;
    }

    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3();
    model.traverse((object) => {
      if (
        object instanceof THREE.Mesh &&
        object.visible &&
        relatedIds.has(anatomyIdFor(object) ?? "")
      ) {
        bounds.expandByObject(object);
      }
    });
    if (bounds.isEmpty()) {
      onFocusRejected?.(selectedId, "structure-has-no-visible-geometry");
      return;
    }

    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const instance = controls.current;
    if (!instance) return;
    const direction = camera.position.clone().sub(instance.target);
    if (direction.lengthSq() < 0.0001) direction.set(0, 0, 1);
    direction.normalize();

    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    const distance = calculateFocusDistance({
      radius: sphere.radius,
      verticalFovDegrees: perspectiveCamera.fov,
      aspect,
      padding: focusPadding,
      minimumDistance: focusDistance,
      minDistance,
      maxDistance,
    });
    moveCamera(
      sphere.center.clone().add(direction.multiplyScalar(distance)),
      sphere.center.clone(),
    );
  }, [
    atlas.structures,
    camera,
    focusDistance,
    focusPadding,
    focusRequestKey,
    maxDistance,
    minDistance,
    model,
    moveCamera,
    onFocusRejected,
    selectedId,
    size.height,
    size.width,
    visibility.visible,
  ]);

  useEffect(() => {
    if (previousResetKey.current === resetViewKey) return;
    previousResetKey.current = resetViewKey;
    moveCamera(
      new THREE.Vector3(...initialCameraPosition),
      new THREE.Vector3(...initialCameraTarget),
    );
  }, [
    initialCameraPosition,
    initialCameraTarget,
    moveCamera,
    resetViewKey,
  ]);

  useFrame((_, delta) => {
    const instance = controls.current;
    const current = animation.current;
    if (!instance || !current) return;
    current.elapsed += delta;
    const progress = Math.min(1, current.elapsed / current.duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    camera.position.lerpVectors(
      current.startPosition,
      current.endPosition,
      eased,
    );
    instance.target.lerpVectors(current.startTarget, current.endTarget, eased);
    instance.update();
    if (progress === 1) animation.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      enablePan={enablePan}
      enableDamping
      minDistance={minDistance}
      maxDistance={maxDistance}
      onChange={emitCameraChange}
      onStart={() => {
        animation.current = null;
        onInteractionStart?.();
      }}
      onEnd={() => {
        emitCameraChange();
        onInteractionEnd?.();
      }}
    />
  );
}

function LoadedScene(props: LoadedSceneProps) {
  const {
    atlas,
    modelPosition,
    modelScale,
    onReady,
  } = props;
  const onReadyRef = useLatest(onReady);
  const readyUrl = useRef<string | null>(null);
  const [modelX, modelY, modelZ] = modelPosition;
  const gltf = useGLTF(atlas.modelUrl) as { scene: THREE.Group };
  const model = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.position.set(modelX, modelY, modelZ);
    clone.scale.setScalar(modelScale);
    clone.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.material = Array.isArray(object.material)
        ? object.material.map((material) => material.clone())
        : object.material.clone();
    });
    clone.updateMatrixWorld(true);
    return clone;
  }, [gltf.scene, modelScale, modelX, modelY, modelZ]);

  useEffect(() => {
    if (readyUrl.current !== atlas.modelUrl) {
      readyUrl.current = atlas.modelUrl;
      onReadyRef.current?.();
    }
    return () => {
      model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((material) => material.dispose());
      });
    };
  }, [atlas.modelUrl, model, onReadyRef]);

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[4, 5, 6]} intensity={2.2} />
      <AtlasModel {...props} model={model} />
      <CameraController {...props} model={model} />
    </>
  );
}

export function VanatomeViewer({
  className,
  style,
  ariaLabel = "Interactive 3D anatomy viewer",
  loadingFallback,
  errorFallback,
  modelScale = 1,
  modelPosition = [0, 0, 0],
  initialCameraPosition = [0, 0, 8],
  initialCameraTarget = [0, 0, 0],
  focusDistance = 4,
  focusPadding = 1.25,
  cameraAnimationDuration = 550,
  respectReducedMotion = true,
  enablePan = false,
  minDistance = 2,
  maxDistance = 30,
  appearance,
  hoveredId,
  onHover,
  onLoadStart,
  onLoadProgress,
  onReady,
  onError,
  onSelect,
  onStructureContextMenu,
  onEscape,
  selectedId,
  atlas,
  ...props
}: VanatomeViewerProps) {
  const [pointed, setPointed] = useState<{
    modelUrl: string;
    id: string | null;
  }>(() => ({ modelUrl: atlas.modelUrl, id: null }));
  const [loadState, setLoadState] = useState<{
    modelUrl: string;
    status: "loading" | "ready" | "error";
    error: VanatomeViewerError | null;
  }>(() => ({
    modelUrl: atlas.modelUrl,
    status: "loading",
    error: null,
  }));
  const wrapper = useRef<HTMLDivElement>(null);
  const pointedKeyRef = useRef<string | null>(null);
  const previousModelUrl = useRef(atlas.modelUrl);
  const onHoverRef = useLatest(onHover);
  const resolvedAppearance = useMemo(
    () => ({ ...DEFAULT_APPEARANCE, ...appearance }),
    [appearance],
  );
  const effectiveHoveredId =
    hoveredId === undefined
      ? pointed.modelUrl === atlas.modelUrl
        ? pointed.id
        : null
      : hoveredId;

  useEffect(() => {
    if (previousModelUrl.current === atlas.modelUrl) return;
    previousModelUrl.current = atlas.modelUrl;
    pointedKeyRef.current = null;
    onHoverRef.current?.(null);
  }, [atlas.modelUrl, onHoverRef]);

  const handlePoint = useCallback(
    (id: string | null) => {
      const key = `${atlas.modelUrl}\u0000${id ?? ""}`;
      if (pointedKeyRef.current === key) return;
      pointedKeyRef.current = key;
      setPointed({ modelUrl: atlas.modelUrl, id });
      onHover?.(id);
    },
    [atlas.modelUrl, onHover],
  );

  const handleReady = useCallback((modelUrl: string) => {
    setLoadState({
      modelUrl,
      status: "ready",
      error: null,
    });
    onReady?.();
  }, [onReady]);

  const handleError = useCallback(
    (error: VanatomeViewerError) => {
      setLoadState({
        modelUrl: error.modelUrl,
        status: "error",
        error,
      });
      onError?.(error);
    },
    [onError],
  );
  const handleSceneReady = useCallback(
    () => handleReady(atlas.modelUrl),
    [atlas.modelUrl, handleReady],
  );

  const currentLoadState =
    loadState.modelUrl === atlas.modelUrl
      ? loadState
      : {
          modelUrl: atlas.modelUrl,
          status: "loading" as const,
          error: null,
        };
  const fallback =
    currentLoadState.status === "error" && currentLoadState.error
      ? typeof errorFallback === "function"
        ? errorFallback(currentLoadState.error)
        : errorFallback
      : currentLoadState.status === "loading"
        ? loadingFallback
        : null;

  return (
    <div
      ref={wrapper}
      className={className}
      role="application"
      aria-label={ariaLabel}
      aria-busy={currentLoadState.status === "loading"}
      tabIndex={0}
      data-vanatome-status={currentLoadState.status}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        cursor: effectiveHoveredId ? "pointer" : "grab",
        ...style,
      }}
      onPointerDownCapture={() => wrapper.current?.focus({ preventScroll: true })}
      onPointerLeave={() => handlePoint(null)}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          if (onEscape) onEscape();
          else onSelect?.(null);
          return;
        }
        if (
          (event.key === "ContextMenu" ||
            (event.shiftKey && event.key === "F10")) &&
          selectedId &&
          onStructureContextMenu
        ) {
          event.preventDefault();
          const bounds = wrapper.current?.getBoundingClientRect();
          onStructureContextMenu({
            id: selectedId,
            clientX: bounds ? bounds.left + bounds.width / 2 : 0,
            clientY: bounds ? bounds.top + bounds.height / 2 : 0,
          });
        }
      }}
    >
      <Canvas
        camera={{ position: [...initialCameraPosition], fov: 42 }}
        onPointerMissed={() => onSelect?.(null)}
      >
        <LoadStartMonitor
          modelUrl={atlas.modelUrl}
          onLoadStart={onLoadStart}
        />
        <ContextMonitor
          modelUrl={atlas.modelUrl}
          onError={handleError}
          onRestore={handleReady}
        />
        <ViewerErrorBoundary
          key={atlas.modelUrl}
          modelUrl={atlas.modelUrl}
          onError={handleError}
        >
          <Suspense
            fallback={<LoadingMonitor onProgress={onLoadProgress} />}
          >
            <LoadedScene
              {...props}
              atlas={atlas}
              selectedId={selectedId}
              hoveredId={effectiveHoveredId}
              onSelect={onSelect}
              onStructureContextMenu={onStructureContextMenu}
              onPoint={handlePoint}
              onReady={handleSceneReady}
              modelScale={modelScale}
              modelPosition={modelPosition}
              initialCameraPosition={initialCameraPosition}
              initialCameraTarget={initialCameraTarget}
              focusDistance={focusDistance}
              focusPadding={focusPadding}
              cameraAnimationDuration={cameraAnimationDuration}
              respectReducedMotion={respectReducedMotion}
              enablePan={enablePan}
              minDistance={minDistance}
              maxDistance={maxDistance}
              appearance={resolvedAppearance}
            />
          </Suspense>
        </ViewerErrorBoundary>
      </Canvas>
      {fallback != null && (
        <div
          aria-live="polite"
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
          }}
        >
          {fallback}
        </div>
      )}
    </div>
  );
}
