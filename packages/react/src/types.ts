import type { CSSProperties, ReactNode } from "react";

export type VanatomeVector3 = readonly [number, number, number];

export type VanatomeStructure = {
  id: string;
  name: string;
  kind?: "system" | "organ" | "part";
  system: string;
  layer: string;
  parentId?: string;
  selectable?: boolean;
  objectCount?: number;
  color?: string;
  position: VanatomeVector3;
  summary?: string;
  function?: string;
  fact?: string;
};

export type VanatomeAtlas = {
  id: string;
  name: string;
  version: string;
  modelUrl: string;
  structures: readonly VanatomeStructure[];
  attribution: string;
};

export type VanatomeHierarchyNode = VanatomeStructure & {
  children: VanatomeHierarchyNode[];
};

export type VanatomeDisplayMode = "normal" | "xray" | "ghost";

export type VanatomeIsolationMode =
  | "selected"
  | "parent"
  | "parent-context";

export type VanatomeIsolationState = {
  id: string;
  mode: VanatomeIsolationMode;
};

export type VanatomeContextMenuEvent = {
  id: string;
  clientX: number;
  clientY: number;
};

export type VanatomeViewState = {
  position: VanatomeVector3;
  target: VanatomeVector3;
};

export type VanatomeLoadProgress = {
  loaded: number;
  total: number;
  percentage: number;
};

export type VanatomeFocusRejectionReason =
  | "structure-not-found"
  | "structure-not-visible"
  | "structure-has-no-visible-geometry";

export type VanatomeViewerError = {
  code: "model-load-failed" | "webgl-context-lost";
  message: string;
  modelUrl: string;
  cause?: unknown;
};

export type VanatomeViewerAppearance = {
  bodyShellId?: string | null;
  skeletonId?: string | null;
  defaultOpacity?: number;
  xrayOpacity?: number;
  ghostOpacity?: number;
  parentContextOpacity?: number;
  hoverEmissiveIntensity?: number;
  selectedDescendantEmissiveIntensity?: number;
  selectedEmissiveIntensity?: number;
  pulseSelection?: boolean;
};

export type VanatomeViewerProps = {
  atlas: VanatomeAtlas;
  selectedId?: string | null;
  hoveredId?: string | null;
  isolatedId?: string | null;
  isolation?: VanatomeIsolationState | null;
  visibleLayers?: readonly string[];
  alwaysVisibleIds?: readonly string[];
  hiddenIds?: readonly string[];
  displayMode?: VanatomeDisplayMode;
  focusRequestKey?: string | number;
  resetViewKey?: string | number;
  onSelect?: (id: string | null) => void;
  onHover?: (id: string | null) => void;
  onStructureContextMenu?: (event: VanatomeContextMenuEvent) => void;
  onEscape?: () => void;
  onLoadStart?: (modelUrl: string) => void;
  onLoadProgress?: (progress: VanatomeLoadProgress) => void;
  onReady?: () => void;
  onError?: (error: VanatomeViewerError) => void;
  onFocusRejected?: (
    id: string,
    reason: VanatomeFocusRejectionReason,
  ) => void;
  onCameraChange?: (view: VanatomeViewState) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  loadingFallback?: ReactNode;
  errorFallback?: ReactNode | ((error: VanatomeViewerError) => ReactNode);
  modelScale?: number;
  modelPosition?: VanatomeVector3;
  initialCameraPosition?: VanatomeVector3;
  initialCameraTarget?: VanatomeVector3;
  focusDistance?: number;
  focusPadding?: number;
  cameraAnimationDuration?: number;
  respectReducedMotion?: boolean;
  enablePan?: boolean;
  minDistance?: number;
  maxDistance?: number;
  appearance?: VanatomeViewerAppearance;
};

export type VanatomeController = {
  selectedId: string | null;
  isolatedId: string | null;
  visibleLayers: readonly string[];
  focusRequestKey: number;
  resetViewKey: number;
  select: (id: string | null) => void;
  focus: (id?: string | null) => void;
  isolate: (id?: string | null) => void;
  reset: () => void;
  setVisibleLayers: (layers: readonly string[]) => void;
  toggleLayer: (layer: string) => void;
};

export type VanatomeControllerState = Omit<
  VanatomeController,
  "isolate"
> & {
  isolation: VanatomeIsolationState | null;
  isolate: (
    id?: string | null,
    mode?: VanatomeIsolationMode,
  ) => void;
  clear: () => void;
};
