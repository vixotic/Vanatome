import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  AtlasLoaderError,
  createAtlasLoader,
  createOfficialHumanAtlas,
  OFFICIAL_HUMAN_ATLAS,
} from "../dist/index.js";

const catalog = {
  schemaVersion: 1,
  atlas: {
    id: "vanatome-human",
    name: "Vanatome Human Atlas",
    version: "1.1.0",
    buildId: "c87403fe2f003fba",
  },
  systems: [{ id: "cardiovascular", name: "Cardiovascular" }],
  layers: [{ id: "cardiovascular", name: "Cardiovascular" }],
  bundles: [
    {
      id: "cardiovascular",
      name: "Cardiovascular system",
      systems: ["cardiovascular"],
      layers: ["cardiovascular"],
      modelUrl: "./cardiovascular.glb",
      metadataUrl: "./cardiovascular.metadata.json",
    },
  ],
  provenance: {
    sourceName: "Z-Anatomy",
    sourceUrl: "https://github.com/Z-Anatomy/Models",
    licenseName: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    attribution: "Z-Anatomy contributors, CC BY-SA 4.0",
  },
};

const metadata = {
  schemaVersion: 1,
  atlasId: "vanatome-human",
  atlasVersion: "1.1.0",
  buildId: "c87403fe2f003fba",
  bundleId: "cardiovascular",
  nodeCount: 1,
  structures: [
    {
      id: "cardiovascular-system",
      name: "Cardiovascular",
      kind: "system",
      system: "cardiovascular",
      layer: "cardiovascular",
      position: [0.16, 2.94, 0.17],
      objectCount: 0,
    },
    {
      id: "heart",
      name: "Heart",
      kind: "organ",
      system: "cardiovascular",
      layer: "cardiovascular",
      parentId: "cardiovascular-system",
      position: [0.16, 2.94, 0.17],
      objectCount: 1,
    },
  ],
};

function jsonResponse(body, url, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("official identity requires an explicit catalog source", () => {
  assert.equal(OFFICIAL_HUMAN_ATLAS.id, "vanatome-human");
  const loader = createOfficialHumanAtlas({
    catalogUrl: "https://assets.example/atlas/1.1.0/catalog.json",
    fetch: async () => jsonResponse(catalog, ""),
  });
  assert.deepEqual(loader.getState(), { status: "idle" });
});

test("official loader rejects a catalog for a different release", async () => {
  const loader = createOfficialHumanAtlas({
    catalogUrl: "https://assets.example/atlas/catalog.json",
    fetch: async () =>
      jsonResponse(
        {
          ...catalog,
          atlas: { ...catalog.atlas, version: "2.0.0" },
        },
        "",
      ),
  });

  await assert.rejects(
    loader.loadCatalog(),
    (error) =>
      error instanceof AtlasLoaderError && error.code === "catalog-invalid",
  );
});

test("loads a system lazily and returns a viewer-compatible atlas", async () => {
  const requests = [];
  const loader = createAtlasLoader({
    catalogUrl: "https://assets.example/atlas/1.1.0/catalog.json",
    fetch: async (input) => {
      requests.push(String(input));
      if (requests.length === 1) {
        return jsonResponse(
          catalog,
          "https://assets.example/atlas/1.1.0/catalog.json",
        );
      }
      return jsonResponse(
        metadata,
        "https://assets.example/atlas/1.1.0/cardio.metadata.json",
      );
    },
  });
  const states = [];
  loader.subscribe((state) => states.push(state.status));

  const loaded = await loader.loadSystem("cardiovascular");

  assert.deepEqual(requests, [
    "https://assets.example/atlas/1.1.0/catalog.json",
    "https://assets.example/atlas/1.1.0/cardiovascular.metadata.json",
  ]);
  assert.equal(
    loaded.atlas.modelUrl,
    "https://assets.example/atlas/1.1.0/cardiovascular.glb",
  );
  assert.equal(loaded.atlas.buildId, "c87403fe2f003fba");
  assert.equal(
    loaded.atlas.structures[1].parentId,
    "cardiovascular-system",
  );
  assert.equal(loaded.atlas.attribution, catalog.provenance.attribution);
  assert.deepEqual(states, [
    "loading-catalog",
    "catalog-ready",
    "loading-bundle",
    "ready",
  ]);
});

test("exposes HTTP failures as an explicit error state", async () => {
  const loader = createAtlasLoader({
    catalogUrl: "https://assets.example/missing.json",
    fetch: async () => jsonResponse({}, "", 404),
  });

  await assert.rejects(
    loader.loadCatalog(),
    (error) =>
      error instanceof AtlasLoaderError && error.code === "catalog-fetch",
  );
  assert.equal(loader.getState().status, "error");
  assert.equal(loader.getState().operation, "catalog");
});

test("rejects metadata that crosses a bundle system boundary", async () => {
  const loader = createAtlasLoader({
    catalogUrl: "https://assets.example/catalog.json",
    fetch: async (input) =>
      String(input).endsWith("catalog.json")
        ? jsonResponse(catalog, "")
        : jsonResponse(
            {
              ...metadata,
              structures: [
                { ...metadata.structures[1], system: "respiratory" },
              ],
            },
            "",
          ),
  });

  await assert.rejects(
    loader.loadBundle("cardiovascular"),
    (error) =>
      error instanceof AtlasLoaderError && error.code === "metadata-invalid",
  );
  assert.equal(loader.getState().status, "error");
  assert.equal(loader.getState().operation, "bundle");
});

test("repository demo catalog matches its metadata and immutable GLB", async () => {
  const demoDirectory = new URL(
    "../../../public/atlas/demo-1.1.0/",
    import.meta.url,
  );
  const demoCatalog = JSON.parse(
    await readFile(new URL("catalog.json", demoDirectory), "utf8"),
  );
  const demoMetadata = JSON.parse(
    await readFile(new URL("full-body.metadata.json", demoDirectory), "utf8"),
  );
  const releaseRegistry = JSON.parse(
    await readFile(
      new URL("../../../app/data/z-anatomy-registry.json", import.meta.url),
      "utf8",
    ),
  );
  const model = await readFile(
    new URL("../../models/z-anatomy-full-body.glb", demoDirectory),
  );
  const requests = [];
  const loader = createAtlasLoader({
    catalogUrl: "https://demo.local/atlas/demo-1.1.0/catalog.json",
    fetch: async (input) => {
      requests.push(String(input));
      return String(input).endsWith("catalog.json")
        ? jsonResponse(demoCatalog, "")
        : jsonResponse(demoMetadata, "");
    },
  });

  const loaded = await loader.loadSystem("nervous");
  const cached = await loader.loadSystem("digestive");

  assert.equal(loaded.metadata.buildId, "c87403fe2f003fba");
  assert.equal(loaded.metadata.structures.length, 139);
  assert.equal(loaded.metadata.nodeCount, 349);
  assert.equal(
    loaded.atlas.modelUrl,
    "https://demo.local/models/z-anatomy-full-body.glb",
  );
  assert.equal(
    createHash("sha256").update(model).digest("hex"),
    loaded.descriptor.sha256,
  );
  assert.equal(model.length, loaded.descriptor.bytes);
  assert.equal(cached, loaded);
  assert.equal(requests.length, 2);
  assert.deepEqual(
    loaded.metadata.structures.map(
      ({ id, name, kind, parentId, system, selectable, position, objectCount }) => ({
        id,
        name,
        kind,
        parentId: parentId ?? null,
        system,
        selectable,
        position,
        objectCount,
      }),
    ),
    releaseRegistry.structures,
  );
});
