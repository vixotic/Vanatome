export type VanatomeVector3 = readonly [number, number, number];

/**
 * A stable public identifier. Consumers may persist these values in URLs and
 * saved views, so an atlas release must not silently repurpose one.
 */
export type AnatomyId = string;
export type AnatomySystemId = string;
export type AnatomyLayerId = string;

export type AnatomyStructure = {
  id: AnatomyId;
  name: string;
  system: AnatomySystemId;
  layer: AnatomyLayerId;
  parentId?: AnatomyId;
  position: VanatomeVector3;
  color?: string;
  summary?: string;
  function?: string;
  fact?: string;
};

export type AnatomySystem = {
  id: AnatomySystemId;
  name: string;
  description?: string;
};

export type AnatomyLayer = {
  id: AnatomyLayerId;
  name: string;
  description?: string;
};

export type AtlasProvenance = {
  sourceName: string;
  sourceUrl: string;
  licenseName: string;
  licenseUrl: string;
  attribution: string;
  modifications?: readonly string[];
  noticeUrl?: string;
};

export type AtlasBundleDescriptor = {
  id: string;
  name: string;
  systems: readonly AnatomySystemId[];
  layers: readonly AnatomyLayerId[];
  modelUrl: string;
  metadataUrl: string;
  bytes?: number;
  sha256?: string;
};

export type AtlasCatalog = {
  schemaVersion: 1;
  atlas: {
    id: string;
    name: string;
    version: string;
  };
  systems: readonly AnatomySystem[];
  layers: readonly AnatomyLayer[];
  bundles: readonly AtlasBundleDescriptor[];
  provenance: AtlasProvenance;
};

export type AtlasBundleMetadata = {
  schemaVersion: 1;
  atlasId: string;
  atlasVersion: string;
  bundleId: string;
  structures: readonly AnatomyStructure[];
};

/**
 * The structural subset consumed by @vixotic/vanatome-react. It intentionally
 * has no runtime dependency on React or Three.js.
 */
export type VanatomeViewerAtlas = {
  id: string;
  name: string;
  version: string;
  modelUrl: string;
  structures: readonly AnatomyStructure[];
  attribution: string;
};

export type LoadedAtlasBundle = {
  descriptor: AtlasBundleDescriptor;
  metadata: AtlasBundleMetadata;
  provenance: AtlasProvenance;
  atlas: VanatomeViewerAtlas;
};

export type AtlasLoaderErrorCode =
  | "fetch-unavailable"
  | "catalog-fetch"
  | "catalog-invalid"
  | "bundle-not-found"
  | "system-not-found"
  | "system-ambiguous"
  | "metadata-fetch"
  | "metadata-invalid"
  | "aborted";

export type AtlasLoaderOperation = "catalog" | "bundle";

export type AtlasLoaderState =
  | { status: "idle" }
  | { status: "loading-catalog"; catalogUrl: string }
  | { status: "catalog-ready"; catalog: AtlasCatalog }
  | {
      status: "loading-bundle";
      catalog: AtlasCatalog;
      bundle: AtlasBundleDescriptor;
    }
  | {
      status: "ready";
      catalog: AtlasCatalog;
      bundle: LoadedAtlasBundle;
    }
  | {
      status: "error";
      operation: AtlasLoaderOperation;
      error: AtlasLoaderError;
      catalog?: AtlasCatalog;
      bundle?: AtlasBundleDescriptor;
    };

export type AtlasLoaderOptions = {
  catalogUrl: string;
  fetch?: typeof globalThis.fetch;
  expectedAtlas?: {
    id: string;
    version?: string;
  };
};

export type AtlasLoaderListener = (state: AtlasLoaderState) => void;

export interface AtlasLoader {
  getState(): AtlasLoaderState;
  subscribe(listener: AtlasLoaderListener): () => void;
  loadCatalog(options?: { signal?: AbortSignal }): Promise<AtlasCatalog>;
  loadBundle(
    bundleId: string,
    options?: { signal?: AbortSignal },
  ): Promise<LoadedAtlasBundle>;
  loadSystem(
    systemId: AnatomySystemId,
    options?: { signal?: AbortSignal },
  ): Promise<LoadedAtlasBundle>;
}

export class AtlasLoaderError extends Error {
  readonly code: AtlasLoaderErrorCode;
  readonly cause?: unknown;

  constructor(code: AtlasLoaderErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "AtlasLoaderError";
    this.code = code;
    this.cause = cause;
  }
}
