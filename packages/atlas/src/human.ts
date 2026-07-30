import { createAtlasLoader } from "./loader.js";
import type {
  AtlasLoaderOptions,
  AtlasLoaderWithProfiles,
} from "./types.js";

export const OFFICIAL_HUMAN_ATLAS = {
  id: "vanatome-human",
  name: "Vanatome Human Atlas",
  version: "1.2.0",
  buildId: "e9a45d0a551acb8f",
  catalogFile: "catalog.json",
  catalogUrl:
    "https://atlas.vanatome.vixotic.in/releases/1.2.0/catalog.json",
  defaultProfileId: "full-body",
} as const;

export const DEMO_HUMAN_ATLAS = {
  id: "vanatome-human",
  name: "Vanatome Human Atlas",
  version: "1.2.0",
  buildId: "e9a45d0a551acb8f",
  catalogFile: "catalog.json",
  defaultProfileId: "full-body",
} as const;

export type HumanAtlasSourceOptions = Omit<
  AtlasLoaderOptions,
  "catalogUrl"
> & {
  catalogUrl?: string;
};

/**
 * Loads the immutable official atlas release. Pass catalogUrl to use an exact
 * mirror or self-hosted copy of the same release.
 */
export function createOfficialHumanAtlas(
  options: HumanAtlasSourceOptions = {},
): AtlasLoaderWithProfiles {
  return createAtlasLoader({
    ...options,
    catalogUrl:
      options.catalogUrl ?? OFFICIAL_HUMAN_ATLAS.catalogUrl,
    expectedAtlas: {
      id: OFFICIAL_HUMAN_ATLAS.id,
      version: OFFICIAL_HUMAN_ATLAS.version,
      buildId: OFFICIAL_HUMAN_ATLAS.buildId,
    },
  });
}

/**
 * Points at the catalog served by this repository's demo application.
 * Applications outside the Vanatome repository should configure their own URL.
 */
export function createDemoHumanAtlas(options?: {
  catalogUrl?: string;
  fetch?: typeof globalThis.fetch;
}): AtlasLoaderWithProfiles {
  return createAtlasLoader({
    catalogUrl:
      options?.catalogUrl ?? "/atlas/demo-1.2.0/catalog.json",
    fetch: options?.fetch,
    expectedAtlas: {
      id: DEMO_HUMAN_ATLAS.id,
      version: DEMO_HUMAN_ATLAS.version,
      buildId: DEMO_HUMAN_ATLAS.buildId,
    },
  });
}
