import {
  AtlasLoaderError,
  type AnatomyStructure,
  type AtlasBundleDescriptor,
  type AtlasBundleMetadata,
  type AtlasCatalog,
  type AtlasLoaderWithProfiles,
  type AtlasLoaderListener,
  type AtlasLoaderOptions,
  type AtlasLoaderState,
  type LoadedAtlasBundle,
  type LoadedAtlasCollection,
  type LoadAtlasSystemsOptions,
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
    (value.kind === undefined ||
      value.kind === "system" ||
      value.kind === "organ" ||
      value.kind === "part") &&
    isNonEmptyString(value.system) &&
    isNonEmptyString(value.layer) &&
    (value.parentId === undefined || isNonEmptyString(value.parentId)) &&
    (value.selectable === undefined || typeof value.selectable === "boolean") &&
    (value.objectCount === undefined ||
      (typeof value.objectCount === "number" &&
        Number.isInteger(value.objectCount) &&
        value.objectCount >= 0)) &&
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
    isNonEmptyString(value.metadataUrl) &&
    (value.bytes === undefined ||
      (typeof value.bytes === "number" &&
        Number.isInteger(value.bytes) &&
        value.bytes >= 0)) &&
    (value.sha256 === undefined ||
      (typeof value.sha256 === "string" &&
        /^[a-f0-9]{64}$/u.test(value.sha256))) &&
    (value.structureCount === undefined ||
      (typeof value.structureCount === "number" &&
        Number.isInteger(value.structureCount) &&
        value.structureCount >= 0)) &&
    (value.nodeCount === undefined ||
      (typeof value.nodeCount === "number" &&
        Number.isInteger(value.nodeCount) &&
        value.nodeCount >= 0))
  );
}

function isProfile(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.bundleId) &&
    (value.description === undefined || isNonEmptyString(value.description))
  );
}

function parseCatalog(
  value: unknown,
  expectedAtlas?: { id: string; version?: string; buildId?: string },
): AtlasCatalog {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !isRecord(value.atlas) ||
    !isNonEmptyString(value.atlas.id) ||
    !isNonEmptyString(value.atlas.name) ||
    !isNonEmptyString(value.atlas.version) ||
    !isNonEmptyString(value.atlas.buildId) ||
    !Array.isArray(value.systems) ||
    !value.systems.every(
      (system) =>
        isRecord(system) &&
        isNonEmptyString(system.id) &&
        isNonEmptyString(system.name) &&
        (system.bundleId === undefined || isNonEmptyString(system.bundleId)),
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
    (value.profiles !== undefined &&
      (!Array.isArray(value.profiles) || !value.profiles.every(isProfile))) ||
    (value.defaultProfileId !== undefined &&
      !isNonEmptyString(value.defaultProfileId)) ||
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

  for (const system of value.systems) {
    if (
      system.bundleId !== undefined &&
      (!bundleIds.has(system.bundleId) ||
        !value.bundles
          .find((bundle) => bundle.id === system.bundleId)
          ?.systems.includes(system.id))
    ) {
      throw new AtlasLoaderError(
        "catalog-invalid",
        `System "${system.id}" references an invalid bundle "${system.bundleId}".`,
      );
    }
  }

  const profileIds = new Set<string>();
  for (const profile of value.profiles ?? []) {
    if (profileIds.has(profile.id) || !bundleIds.has(profile.bundleId)) {
      throw new AtlasLoaderError(
        "catalog-invalid",
        `Profile "${profile.id}" is duplicated or references an unknown bundle.`,
      );
    }
    profileIds.add(profile.id);
  }
  if (
    value.defaultProfileId !== undefined &&
    !profileIds.has(value.defaultProfileId)
  ) {
    throw new AtlasLoaderError(
      "catalog-invalid",
      `Default profile "${value.defaultProfileId}" is not present in the catalog.`,
    );
  }

  if (
    expectedAtlas &&
    (value.atlas.id !== expectedAtlas.id ||
      (expectedAtlas.version !== undefined &&
        value.atlas.version !== expectedAtlas.version) ||
      (expectedAtlas.buildId !== undefined &&
        value.atlas.buildId !== expectedAtlas.buildId))
  ) {
    throw new AtlasLoaderError(
      "catalog-invalid",
      `The atlas catalog does not match expected release ${expectedAtlas.id}@${expectedAtlas.version ?? "*"} (${expectedAtlas.buildId ?? "any build"}).`,
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
    value.buildId !== catalog.atlas.buildId ||
    value.bundleId !== bundle.id ||
    typeof value.nodeCount !== "number" ||
    !Number.isInteger(value.nodeCount) ||
    value.nodeCount < 0 ||
    !Array.isArray(value.structures) ||
    !value.structures.every(isStructure)
  ) {
    throw new AtlasLoaderError(
      "metadata-invalid",
      `Metadata for bundle "${bundle.id}" does not match its catalog release.`,
    );
  }

  const structureIds = new Set<string>();
  const structuresById = new Map<string, AnatomyStructure>();
  let mappedNodeCount = 0;
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
    structuresById.set(structure.id, structure);
    mappedNodeCount += structure.objectCount ?? 0;
  }

  for (const structure of value.structures) {
    if (structure.parentId && !structureIds.has(structure.parentId)) {
      throw new AtlasLoaderError(
        "metadata-invalid",
        `Structure "${structure.id}" references missing parent "${structure.parentId}".`,
      );
    }
    const ancestors = new Set<string>([structure.id]);
    let parentId = structure.parentId;
    while (parentId) {
      if (ancestors.has(parentId)) {
        throw new AtlasLoaderError(
          "metadata-invalid",
          `Structure "${structure.id}" belongs to a cyclic hierarchy.`,
        );
      }
      ancestors.add(parentId);
      parentId = structuresById.get(parentId)?.parentId;
    }
  }

  if (mappedNodeCount !== value.nodeCount) {
    throw new AtlasLoaderError(
      "metadata-invalid",
      `Bundle "${bundle.id}" node count does not match its structure metadata.`,
    );
  }
  if (
    (bundle.structureCount !== undefined &&
      value.structures.length !== bundle.structureCount) ||
    (bundle.nodeCount !== undefined && value.nodeCount !== bundle.nodeCount)
  ) {
    throw new AtlasLoaderError(
      "metadata-invalid",
      `Bundle "${bundle.id}" structure or node counts do not match its catalog descriptor.`,
    );
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

export function createAtlasLoader(
  options: AtlasLoaderOptions,
): AtlasLoaderWithProfiles {
  let state: AtlasLoaderState = { status: "idle" };
  let catalog: AtlasCatalog | undefined;
  let loadingCatalog: Promise<AtlasCatalog> | undefined;
  let resolvedCatalogUrl = options.catalogUrl;
  const loadedBundles = new Map<string, LoadedAtlasBundle>();
  const loadingBundles = new Map<string, Promise<LoadedAtlasBundle>>();
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
    if (loadingCatalog) return loadingCatalog;
    const pending = (async () => {
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
    })();
    loadingCatalog = pending;
    try {
      return await pending;
    } finally {
      if (loadingCatalog === pending) loadingCatalog = undefined;
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

    const cached = loadedBundles.get(bundle.id);
    if (cached) {
      setState({
        status: "ready",
        catalog: loadedCatalog,
        bundle: cached,
      });
      return cached;
    }

    const activeLoad = loadingBundles.get(bundle.id);
    if (activeLoad) return activeLoad;

    const pending = (async () => {
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
            buildId: loadedCatalog.atlas.buildId,
            modelUrl: resolveUrl(bundle.modelUrl, resolvedCatalogUrl),
            structures: metadata.structures,
            attribution: loadedCatalog.provenance.attribution,
          },
        };
        loadedBundles.set(bundle.id, loaded);
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
    })();
    loadingBundles.set(bundle.id, pending);
    try {
      return await pending;
    } finally {
      if (loadingBundles.get(bundle.id) === pending) {
        loadingBundles.delete(bundle.id);
      }
    }
  }

  async function loadSystem(
    systemId: string,
    loadOptions?: { signal?: AbortSignal },
  ): Promise<LoadedAtlasBundle> {
    const loadedCatalog = await loadCatalog(loadOptions);
    const system = loadedCatalog.systems.find(
      (candidate) => candidate.id === systemId,
    );
    if (system?.bundleId) {
      return loadBundle(system.bundleId, loadOptions);
    }
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

  async function loadSystems(
    systemIds: readonly string[],
    loadOptions?: LoadAtlasSystemsOptions,
  ): Promise<LoadedAtlasCollection> {
    const uniqueSystemIds = [...new Set(systemIds)];
    if (uniqueSystemIds.length === 0) {
      throw new AtlasLoaderError(
        "systems-empty",
        "At least one anatomy system is required.",
      );
    }

    const requestedConcurrency = Math.floor(loadOptions?.concurrency ?? 3);
    const concurrency = Math.min(
      uniqueSystemIds.length,
      Number.isFinite(requestedConcurrency)
        ? Math.max(1, requestedConcurrency)
        : 3,
    );
    const results = new Array<LoadedAtlasBundle>(uniqueSystemIds.length);
    let nextIndex = 0;
    const workers = Array.from({ length: concurrency }, async () => {
      while (nextIndex < uniqueSystemIds.length) {
        if (loadOptions?.signal?.aborted) {
          throw new AtlasLoaderError(
            "aborted",
            "Atlas loading was aborted.",
          );
        }
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await loadSystem(uniqueSystemIds[index], {
          signal: loadOptions?.signal,
        });
      }
    });
    await Promise.all(workers);

    const bundles = [...new Map(
      results.map((bundle) => [bundle.descriptor.id, bundle]),
    ).values()];
    return {
      systemIds: uniqueSystemIds,
      bundles,
      atlases: bundles.map((bundle) => bundle.atlas),
    };
  }

  async function loadProfile(
    profileId?: string,
    loadOptions?: { signal?: AbortSignal },
  ): Promise<LoadedAtlasBundle> {
    const loadedCatalog = await loadCatalog(loadOptions);
    const targetId = profileId ?? loadedCatalog.defaultProfileId;
    const profile = loadedCatalog.profiles?.find(
      (candidate) => candidate.id === targetId,
    );
    if (!profile) {
      const error = new AtlasLoaderError(
        "profile-not-found",
        targetId
          ? `Atlas profile "${targetId}" is not present in release ${loadedCatalog.atlas.version}.`
          : `Release ${loadedCatalog.atlas.version} does not declare a default atlas profile.`,
      );
      setState({
        status: "error",
        operation: "profile",
        error,
        catalog: loadedCatalog,
      });
      throw error;
    }
    return loadBundle(profile.bundleId, loadOptions);
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
    loadSystems,
    loadProfile,
  };
}
