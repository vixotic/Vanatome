import { readFile, writeFile } from "node:fs/promises";

const repositoryRoot = new URL("../../../", import.meta.url);
const releaseRegistryUrl = new URL(
  "app/data/z-anatomy-registry.json",
  repositoryRoot,
);
const releaseManifestUrl = new URL(
  "public/models/z-anatomy-manifest.json",
  repositoryRoot,
);
const catalogUrl = new URL(
  "public/atlas/demo-1.1.0/catalog.json",
  repositoryRoot,
);
const metadataUrl = new URL(
  "public/atlas/demo-1.1.0/full-body.metadata.json",
  repositoryRoot,
);

const registry = JSON.parse(await readFile(releaseRegistryUrl, "utf8"));
const manifest = JSON.parse(await readFile(releaseManifestUrl, "utf8"));

if (
  registry.atlasId !== manifest.atlas.id ||
  registry.atlasVersion !== manifest.atlas.version ||
  registry.buildId !== manifest.build.id
) {
  throw new Error("Atlas registry and release manifest identities do not match.");
}

const systemIds = [...new Set(registry.structures.map(({ system }) => system))];
const title = (value) =>
  value
    .split("-")
    .map((word) => `${word[0].toUpperCase()}${word.slice(1)}`)
    .join(" ");
const nodeCount = registry.structures.reduce(
  (total, structure) => total + structure.objectCount,
  0,
);

if (nodeCount !== manifest.objectCount) {
  throw new Error("Atlas registry node count does not match the release manifest.");
}

const catalog = {
  schemaVersion: 1,
  atlas: {
    id: registry.atlasId,
    name: manifest.atlas.name,
    version: registry.atlasVersion,
    buildId: registry.buildId,
  },
  systems: systemIds.map((id) => ({ id, name: title(id) })),
  layers: systemIds.map((id) => ({ id, name: title(id) })),
  bundles: [
    {
      id: "curated-full-body",
      name: "Curated full-body atlas",
      systems: systemIds,
      layers: systemIds,
      modelUrl: "../../models/z-anatomy-full-body.glb",
      metadataUrl: "./full-body.metadata.json",
      bytes: manifest.asset.bytes,
      sha256: manifest.asset.sha256,
      structureCount: registry.structures.length,
      nodeCount,
    },
  ],
  provenance: {
    sourceName: manifest.source.name,
    sourceUrl: manifest.source.projectUrl,
    licenseName: manifest.source.license,
    licenseUrl: manifest.source.licenseUrl,
    attribution: manifest.source.attribution,
    modifications: [
      "Web export",
      "Stable structure and hierarchy identifiers",
      "Material adjustments",
      "Curve-to-mesh conversion",
      "Geometry optimization",
    ],
    noticeUrl: "../../ATTRIBUTION.txt",
  },
};

const metadata = {
  schemaVersion: 1,
  atlasId: registry.atlasId,
  atlasVersion: registry.atlasVersion,
  buildId: registry.buildId,
  bundleId: "curated-full-body",
  nodeCount,
  structures: registry.structures.map((structure) => ({
    id: structure.id,
    name: structure.name,
    kind: structure.kind,
    ...(structure.parentId ? { parentId: structure.parentId } : {}),
    system: structure.system,
    layer: structure.system,
    selectable: structure.selectable,
    position: structure.position,
    objectCount: structure.objectCount,
  })),
};

await writeFile(catalogUrl, `${JSON.stringify(catalog, null, 2)}\n`);
await writeFile(metadataUrl, `${JSON.stringify(metadata, null, 2)}\n`);
