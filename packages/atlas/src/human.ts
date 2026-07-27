import { createAtlasLoader } from "./loader.js";
import type { AtlasLoader, AtlasLoaderOptions } from "./types.js";

export const OFFICIAL_HUMAN_ATLAS = {
  id: "vanatome-human",
  name: "Vanatome Human Atlas",
  version: "1.1.0",
  buildId: "c87403fe2f003fba",
  catalogFile: "catalog.json",
} as const;

export type HumanAtlasSourceOptions = AtlasLoaderOptions;

/**
 * Connects the official Vanatome human-atlas identity to a caller-selected
 * catalog location. Vanatome does not currently publish a default hosted URL.
 */
export function createOfficialHumanAtlas(
  options: HumanAtlasSourceOptions,
): AtlasLoader {
  return createAtlasLoader({
    ...options,
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
}): AtlasLoader {
  return createAtlasLoader({
    catalogUrl:
      options?.catalogUrl ?? "/atlas/demo-1.1.0/catalog.json",
    fetch: options?.fetch,
    expectedAtlas: {
      id: OFFICIAL_HUMAN_ATLAS.id,
      version: OFFICIAL_HUMAN_ATLAS.version,
      buildId: OFFICIAL_HUMAN_ATLAS.buildId,
    },
  });
}
