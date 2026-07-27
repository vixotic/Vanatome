import {
  AtlasLoaderError,
  type AnatomyStructure,
  type AtlasBundleDescriptor,
  type AtlasBundleMetadata,
  type AtlasCatalog,
  type AtlasLoader,
  type AtlasLoaderListener,
  type AtlasLoaderOptions,
  type AtlasLoaderState,
  type LoadedAtlasBundle,
} from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function isStructure(value: unknown): value is AnatomyStructure {
  if (!isRecord(value)) return false;
  const position = value.position;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.system) &&
    isNonEmptyString(value.layer) &&
    (value.parentId === undefined || isNonEmptyString(value.parentId)) &&
    Array.isArray(position) &&
    position.length === 3 &&
    position.every((part) => typeof part === "number" && Number.isFinite(part))
  );
}

function isDescriptor(value: unknown): value is AtlasBundleDescriptor {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isStringArray(value.systems) &&
    isStringArray(value.layers) &&
    isNonEmptyString(value.modelUrl) &&
    isNonEmptyString(value.metadataUrl)
  );
}

function parseCatalog(
  value: unknown,
  expectedAtlas?: { id: string; version?: string },
): AtlasCatalog {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !isRecord(value.atlas) ||
    !isNonEmptyString(value.atlas.id) ||
    !isNonEmptyString(value.atlas.name) ||
    !isNonEmptyString(value.atlas.version) ||
    !Array.isArray(value.systems) ||
    !value.systems.every(
      (system) =>
        isRecord(system) &&
        isNonEmptyString(system.id) &&
        isNonEmptyString(system.name),
    ) ||
    !Array.isArray(value.layers) ||
    !value.layers.every(
      (layer) =>
        isRecord(layer) &&
        isNonEmptyString(layer.id) &&
        isNonEmptyString(layer.name),
    ) ||
    !Array.isArray(value.bundles) ||
    !value.bundles.every(isDescriptor) ||
    !isRecord(value.provenance) ||
    !isNonEmptyString(value.provenance.sourceName) ||
    !isNonEmptyString(value.provenance.sourceUrl) ||
    !isNonEmptyString(value.provenance.licenseName) ||
    !isNonEmptyString(value.provenance.licenseUrl) ||
    !isNonEmptyString(value.provenance.attribution)
  ) {
    throw new AtlasLoaderError(
      "catalog-invalid",
      "The atlas catalog does not match schema version 1.",
    );
  }

  const bundleIds = new Set<string>();
  for (const bundle of value.bundles) {
    if (bundleIds.has(bundle.id)) {
      throw new AtlasLoaderError(
        "catalog-invalid",
        `The atlas catalog contains duplicate bundle ID "${bundle.id}".`,
      );
    }
    bundleIds.add(bundle.id);
  }

  if (
    expectedAtlas &&
    (value.atlas.id !== expectedAtlas.id ||
      (expectedAtlas.version !== undefined &&
        value.atlas.version !== expectedAtlas.version))
  ) {
    throw new AtlasLoaderError(
      "catalog-invalid",
      `The atlas catalog does not match expected release ${expectedAtlas.id}@${expectedAtlas.version ?? "*"}.`,
    );
  }

  return value as AtlasCatalog;
}

function parseMetadata(
  value: unknown,
  catalog: AtlasCatalog,
  bundle: AtlasBundleDescriptor,
): AtlasBundleMetadata {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.atlasId !== catalog.atlas.id ||
    value.atlasVersion !== catalog.atlas.version ||
    value.bundleId !== bundle.id ||
    !Array.isArray(value.structures) ||
    !value.structures.every(isStructure)
  ) {
    throw new AtlasLoaderError(
      "metadata-invalid",
      `Metadata for bundle "${bundle.id}" does not match its catalog release.`,
    );
  }

  const structureIds = new Set<string>();
  for (const structure of value.structures) {
    if (structureIds.has(structure.id)) {
      throw new AtlasLoaderError(
        "metadata-invalid",
        `Bundle "${bundle.id}" contains duplicate anatomy ID "${structure.id}".`,
      );
    }
    if (
      !bundle.systems.includes(structure.system) ||
      !bundle.layers.includes(structure.layer)
    ) {
      throw new AtlasLoaderError(
        "metadata-invalid",
        `Structure "${structure.id}" is outside the systems or layers declared by bundle "${bundle.id}".`,
      );
    }
    structureIds.add(structure.id);
  }

  return value as AtlasBundleMetadata;
}

function resolveUrl(reference: string, catalogUrl: string): string {
  try {
    return new URL(reference, catalogUrl).href;
  } catch {
    return reference;
  }
}

function fetchError(
  code: "catalog-fetch" | "metadata-fetch",
  message: string,
  cause: unknown,
): AtlasLoaderError {
  if (
    (typeof DOMException !== "undefined" &&
      cause instanceof DOMException &&
      cause.name === "AbortError") ||
    (isRecord(cause) && cause.name === "AbortError")
  ) {
    return new AtlasLoaderError("aborted", "Atlas loading was aborted.", cause);
  }
  return cause instanceof AtlasLoaderError
    ? cause
    : new AtlasLoaderError(code, message, cause);
}

export function createAtlasLoader(options: AtlasLoaderOptions): AtlasLoader {
  let state: AtlasLoaderState = { status: "idle" };
  let catalog: AtlasCatalog | undefined;
  let resolvedCatalogUrl = options.catalogUrl;
  const listeners = new Set<AtlasLoaderListener>();

  function setState(next: AtlasLoaderState): void {
    state = next;
    for (const listener of listeners) listener(state);
  }

  function getFetch(): typeof globalThis.fetch {
    const fetchImplementation = options.fetch ?? globalThis.fetch;
    if (!fetchImplementation) {
      throw new AtlasLoaderError(
        "fetch-unavailable",
        "No Fetch API implementation is available for atlas loading.",
      );
    }
    return fetchImplementation;
  }

  async function loadCatalog(loadOptions?: {
    signal?: AbortSignal;
  }): Promise<AtlasCatalog> {
    if (catalog) return catalog;
    setState({ status: "loading-catalog", catalogUrl: options.catalogUrl });
    try {
      const response = await getFetch()(options.catalogUrl, {
        signal: loadOptions?.signal,
      });
      if (!response.ok) {
        throw new AtlasLoaderError(
          "catalog-fetch",
          `Atlas catalog request failed with HTTP ${response.status}.`,
        );
      }
      resolvedCatalogUrl = response.url || options.catalogUrl;
      catalog = parseCatalog(await response.json(), options.expectedAtlas);
      setState({ status: "catalog-ready", catalog });
      return catalog;
    } catch (cause) {
      const error = fetchError(
        "catalog-fetch",
        `Unable to load atlas catalog from ${options.catalogUrl}.`,
        cause,
      );
      setState({ status: "error", operation: "catalog", error });
      throw error;
    }
  }

  async function loadBundle(
    bundleId: string,
    loadOptions?: { signal?: AbortSignal },
  ): Promise<LoadedAtlasBundle> {
    const loadedCatalog = await loadCatalog(loadOptions);
    const bundle = loadedCatalog.bundles.find(
      (candidate) => candidate.id === bundleId,
    );
    if (!bundle) {
      const error = new AtlasLoaderError(
        "bundle-not-found",
        `Atlas bundle "${bundleId}" is not present in release ${loadedCatalog.atlas.version}.`,
      );
      setState({
        status: "error",
        operation: "bundle",
        error,
        catalog: loadedCatalog,
      });
      throw error;
    }

    setState({ status: "loading-bundle", catalog: loadedCatalog, bundle });
    try {
      const metadataUrl = resolveUrl(bundle.metadataUrl, resolvedCatalogUrl);
      const response = await getFetch()(metadataUrl, {
        signal: loadOptions?.signal,
      });
      if (!response.ok) {
        throw new AtlasLoaderError(
          "metadata-fetch",
          `Bundle metadata request failed with HTTP ${response.status}.`,
        );
      }
      const metadata = parseMetadata(
        await response.json(),
        loadedCatalog,
        bundle,
      );
      const loaded: LoadedAtlasBundle = {
        descriptor: bundle,
        metadata,
        provenance: {
          ...loadedCatalog.provenance,
          noticeUrl: loadedCatalog.provenance.noticeUrl
            ? resolveUrl(
                loadedCatalog.provenance.noticeUrl,
                resolvedCatalogUrl,
              )
            : undefined,
        },
        atlas: {
          id: `${loadedCatalog.atlas.id}:${bundle.id}`,
          name: `${loadedCatalog.atlas.name} — ${bundle.name}`,
          version: loadedCatalog.atlas.version,
          modelUrl: resolveUrl(bundle.modelUrl, resolvedCatalogUrl),
          structures: metadata.structures,
          attribution: loadedCatalog.provenance.attribution,
        },
      };
      setState({
        status: "ready",
        catalog: loadedCatalog,
        bundle: loaded,
      });
      return loaded;
    } catch (cause) {
      const error = fetchError(
        "metadata-fetch",
        `Unable to load metadata for atlas bundle "${bundle.id}".`,
        cause,
      );
      setState({
        status: "error",
        operation: "bundle",
        error,
        catalog: loadedCatalog,
        bundle,
      });
      throw error;
    }
  }

  async function loadSystem(
    systemId: string,
    loadOptions?: { signal?: AbortSignal },
  ): Promise<LoadedAtlasBundle> {
    const loadedCatalog = await loadCatalog(loadOptions);
    const bundles = loadedCatalog.bundles.filter((bundle) =>
      bundle.systems.includes(systemId),
    );
    if (bundles.length === 0) {
      const error = new AtlasLoaderError(
        "system-not-found",
        `Anatomy system "${systemId}" is not present in release ${loadedCatalog.atlas.version}.`,
      );
      setState({
        status: "error",
        operation: "bundle",
        error,
        catalog: loadedCatalog,
      });
      throw error;
    }
    if (bundles.length > 1) {
      const error = new AtlasLoaderError(
        "system-ambiguous",
        `Anatomy system "${systemId}" is split across multiple bundles; load one by bundle ID.`,
      );
      setState({
        status: "error",
        operation: "bundle",
        error,
        catalog: loadedCatalog,
      });
      throw error;
    }
    return loadBundle(bundles[0].id, loadOptions);
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    loadCatalog,
    loadBundle,
    loadSystem,
  };
}
