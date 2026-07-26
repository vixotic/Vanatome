export type VanatomeVector3 = readonly [number, number, number];

export type VanatomeStructure = {
  id: string;
  name: string;
  system: string;
  layer: string;
  parentId?: string;
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

export type VanatomeViewerProps = {
  atlas: VanatomeAtlas;
  selectedId?: string | null;
  isolatedId?: string | null;
  visibleLayers?: readonly string[];
  focusRequestKey?: string | number;
  resetViewKey?: string | number;
  onSelect?: (id: string | null) => void;
  className?: string;
  modelScale?: number;
  modelPosition?: VanatomeVector3;
  initialCameraPosition?: VanatomeVector3;
  focusDistance?: number;
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
