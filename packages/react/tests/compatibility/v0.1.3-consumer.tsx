import {
  VanatomeViewer,
  useVanatomeController,
  type VanatomeAtlas,
  type VanatomeController,
  type VanatomeControllerState,
  type VanatomeViewerProps,
} from "../../dist/index.js";

type PublishedController = {
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

type PublishedViewerProps = {
  atlas: VanatomeAtlas;
  selectedId?: string | null;
  isolatedId?: string | null;
  visibleLayers?: readonly string[];
  focusRequestKey?: string | number;
  resetViewKey?: string | number;
  onSelect?: (id: string | null) => void;
  className?: string;
  modelScale?: number;
  modelPosition?: readonly [number, number, number];
  initialCameraPosition?: readonly [number, number, number];
  focusDistance?: number;
};

type Assert<T extends true> = T;
type Assignable<From, To> = From extends To ? true : false;

export type CompatibilityAssertions = [
  Assert<Assignable<PublishedController, VanatomeController>>,
  Assert<Assignable<VanatomeController, PublishedController>>,
  Assert<Assignable<VanatomeControllerState, PublishedController>>,
  Assert<Assignable<PublishedViewerProps, VanatomeViewerProps>>,
];

const atlas: VanatomeAtlas = {
  id: "compatibility-atlas",
  name: "Compatibility atlas",
  version: "1",
  modelUrl: "/anatomy.glb",
  structures: [],
  attribution: "Compatibility fixture",
};

const legacyController: VanatomeController = {
  selectedId: null,
  isolatedId: null,
  visibleLayers: [],
  focusRequestKey: 0,
  resetViewKey: 0,
  select: () => {},
  focus: () => {},
  isolate: () => {},
  reset: () => {},
  setVisibleLayers: () => {},
  toggleLayer: () => {},
};

const legacyProps: VanatomeViewerProps = {
  atlas,
  selectedId: legacyController.selectedId,
  isolatedId: legacyController.isolatedId,
  visibleLayers: legacyController.visibleLayers,
  focusRequestKey: legacyController.focusRequestKey,
  resetViewKey: legacyController.resetViewKey,
  onSelect: legacyController.select,
  className: "viewer",
  modelScale: 1,
  modelPosition: [0, 0, 0],
  initialCameraPosition: [0, 0, 8],
  focusDistance: 4,
};

export function LegacyConsumer() {
  return <VanatomeViewer {...legacyProps} />;
}

export function EnhancedConsumer() {
  const controller = useVanatomeController();
  return (
    <>
      <button
        type="button"
        onClick={() => controller.isolate("heart", "parent-context")}
      >
        Isolate with context
      </button>
      <button type="button" onClick={controller.clear}>
        Clear
      </button>
      <VanatomeViewer atlas={atlas} {...controller} />
    </>
  );
}

export function CompositeConsumer() {
  return (
    <VanatomeViewer
      atlases={[atlas]}
      incrementalLoadingFallback={<span>Adding anatomy</span>}
      onModelReady={() => {}}
    />
  );
}
