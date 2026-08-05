#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { NodeIO } from "@gltf-transform/core";
import { prune } from "@gltf-transform/functions";

import { canonicalJson, parseGlbJson, sha256 } from "./lib.mjs";

const toolRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(toolRoot, "../..");

function usage() {
  console.log(`Usage:
  node tools/anatomy/distribute-release.mjs \\
    --source-model public/models/z-anatomy-1.4.0-full-body.glb \\
    --registry public/models/z-anatomy-1.4.0-registry.json \\
    --manifest public/models/z-anatomy-1.4.0-manifest.json \\
    --version 1.4.0 \\
    --release demo-1.4.0

The full-body GLB is the canonical superset. System GLBs and their metadata are
derived from it, and the generated catalog maps systems to those smaller files.`);
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error(`invalid argument: ${key ?? ""}`);
    }
    options[key.slice(2)] = value;
  }
  return options;
}

function required(options, key) {
  const value = options[key];
  if (!value) throw new Error(`--${key} is required`);
  return value;
}

function title(value) {
  return value
    .split("-")
    .map((word) => `${word[0].toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function fileSha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function modelReference(catalogDirectory, modelPath) {
  const path = relative(catalogDirectory, modelPath).split("\\").join("/");
  return path.startsWith(".") ? path : `./${path}`;
}

function metadataFor({
  registry,
  version,
  buildId,
  bundleId,
  systems,
}) {
  const structures = registry.structures
    .filter((structure) => systems.includes(structure.system))
    .map((structure) => ({
      id: structure.id,
      name: structure.name,
      kind: structure.kind,
      ...(structure.parentId ? { parentId: structure.parentId } : {}),
      system: structure.system,
      layer: structure.system,
      selectable: structure.selectable,
      position: structure.position,
      objectCount: structure.objectCount,
    }));
  return {
    schemaVersion: 1,
    atlasId: registry.atlasId,
    atlasVersion: version,
    buildId,
    bundleId,
    nodeCount: structures.reduce(
      (total, structure) => total + (structure.objectCount ?? 0),
      0,
    ),
    structures,
  };
}

async function splitSystem({
  io,
  sourceModel,
  modelDirectory,
  version,
  systemId,
}) {
  const document = await io.read(sourceModel);
  const root = document.getRoot();
  const taggedNodes = root.listNodes().filter(
    (node) => typeof node.getExtras().anatomySystem === "string",
  );
  const selected = taggedNodes.filter(
    (node) => node.getExtras().anatomySystem === systemId,
  );
  if (!selected.length) {
    throw new Error(`${systemId}: full-body GLB contains no tagged nodes`);
  }
  for (const node of taggedNodes) {
    if (node.getExtras().anatomySystem !== systemId) node.dispose();
  }
  await document.transform(prune({ keepExtras: true }));
  const fileName = `z-anatomy-${version}-${systemId}.glb`;
  const path = resolve(modelDirectory, fileName);
  await io.write(path, document);
  const buffer = await readFile(path);
  const gltf = parseGlbJson(buffer);
  const outputNodes = (gltf.nodes ?? []).filter(
    (node) => node.extras?.anatomySystem === systemId,
  );
  if (outputNodes.length !== selected.length) {
    throw new Error(
      `${systemId}: split GLB node count changed from ${selected.length} to ${outputNodes.length}`,
    );
  }
  return {
    systemId,
    path,
    fileName,
    bytes: buffer.length,
    sha256: fileSha256(buffer),
    nodeCount: outputNodes.length,
    anatomyIds: [...new Set(
      outputNodes.map((node) => node.extras?.anatomyId).filter(Boolean),
    )].sort(),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help === "true") {
    usage();
    return;
  }
  const sourceModel = resolve(repoRoot, required(options, "source-model"));
  const registryPath = resolve(repoRoot, required(options, "registry"));
  const manifestPath = resolve(repoRoot, required(options, "manifest"));
  const version = required(options, "version");
  const releaseId = required(options, "release");
  const catalogDirectory = resolve(
    repoRoot,
    options["catalog-output"] ?? `public/atlas/${releaseId}`,
  );
  const modelDirectory = resolve(
    repoRoot,
    options["model-output"] ?? "public/models",
  );
  const registry = JSON.parse(await readFile(registryPath, "utf8"));
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const sourceBuffer = await readFile(sourceModel);
  const sourceGltf = parseGlbJson(sourceBuffer);
  const sourceNodes = (sourceGltf.nodes ?? []).filter(
    (node) =>
      typeof node.extras?.anatomyId === "string" &&
      typeof node.extras?.anatomySystem === "string",
  );
  if (sourceNodes.length !== manifest.objectCount) {
    throw new Error("Full-body GLB does not match its validated release manifest");
  }

  const systemIds = [...new Set(
    registry.structures.map((structure) => structure.system),
  )].sort();
  await mkdir(catalogDirectory, { recursive: true });
  await mkdir(modelDirectory, { recursive: true });
  const io = new NodeIO();
  const systemAssets = [];
  for (const systemId of systemIds) {
    systemAssets.push(await splitSystem({
      io,
      sourceModel,
      modelDirectory,
      version,
      systemId,
    }));
  }

  const fullBodyIds = [...new Set(
    sourceNodes.map((node) => node.extras.anatomyId),
  )].sort();
  const distributedIds = [...new Set(
    systemAssets.flatMap((asset) => asset.anatomyIds),
  )].sort();
  const distributedNodeCount = systemAssets.reduce(
    (total, asset) => total + asset.nodeCount,
    0,
  );
  if (
    canonicalJson(distributedIds) !== canonicalJson(fullBodyIds) ||
    distributedNodeCount !== sourceNodes.length
  ) {
    throw new Error("System bundles are not an exact partition of full-body anatomy");
  }

  const releaseEvidence = {
    atlasId: registry.atlasId,
    version,
    sourceFullBodySha256: fileSha256(sourceBuffer),
    systems: systemAssets.map(({ systemId, sha256: hash }) => ({
      systemId,
      sha256: hash,
    })),
  };
  const buildId = sha256(canonicalJson(releaseEvidence)).slice(0, 16);
  const fullBodyMetadata = metadataFor({
    registry,
    version,
    buildId,
    bundleId: "curated-full-body",
    systems: systemIds,
  });
  const bundles = [];

  for (const asset of systemAssets) {
    const metadata = metadataFor({
      registry,
      version,
      buildId,
      bundleId: asset.systemId,
      systems: [asset.systemId],
    });
    if (metadata.nodeCount !== asset.nodeCount) {
      throw new Error(
        `${asset.systemId}: registry node count does not match split GLB`,
      );
    }
    const metadataFile = `${asset.systemId}.metadata.json`;
    await writeFile(
      resolve(catalogDirectory, metadataFile),
      `${JSON.stringify(metadata, null, 2)}\n`,
    );
    bundles.push({
      id: asset.systemId,
      name: `${title(asset.systemId)} system`,
      systems: [asset.systemId],
      layers: [asset.systemId],
      modelUrl: modelReference(catalogDirectory, asset.path),
      metadataUrl: `./${metadataFile}`,
      bytes: asset.bytes,
      sha256: asset.sha256,
      structureCount: metadata.structures.length,
      nodeCount: metadata.nodeCount,
    });
  }

  const fullBodyMetadataFile = "full-body.metadata.json";
  await writeFile(
    resolve(catalogDirectory, fullBodyMetadataFile),
    `${JSON.stringify(fullBodyMetadata, null, 2)}\n`,
  );
  bundles.push({
    id: "curated-full-body",
    name: "Curated full-body atlas",
    systems: systemIds,
    layers: systemIds,
    modelUrl: modelReference(catalogDirectory, sourceModel),
    metadataUrl: `./${fullBodyMetadataFile}`,
    bytes: sourceBuffer.length,
    sha256: fileSha256(sourceBuffer),
    structureCount: fullBodyMetadata.structures.length,
    nodeCount: fullBodyMetadata.nodeCount,
  });

  const catalog = {
    schemaVersion: 1,
    atlas: {
      id: registry.atlasId,
      name: manifest.atlas.name,
      version,
      buildId,
    },
    systems: systemIds.map((id) => ({
      id,
      name: title(id),
      bundleId: id,
    })),
    layers: systemIds.map((id) => ({ id, name: title(id) })),
    bundles,
    profiles: [
      {
        id: "full-body",
        name: "Full body",
        bundleId: "curated-full-body",
        description:
          "All released systems plus cross-system and regional context.",
      },
    ],
    defaultProfileId: "full-body",
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
        "System bundle partitioning",
      ],
      noticeUrl: "../../ATTRIBUTION.txt",
    },
  };
  await writeFile(
    resolve(catalogDirectory, "catalog.json"),
    `${JSON.stringify(catalog, null, 2)}\n`,
  );
  const report = {
    status: "distributed",
    release: releaseId,
    version,
    buildId,
    fullBody: {
      file: basename(sourceModel),
      bytes: sourceBuffer.length,
      nodeCount: sourceNodes.length,
      anatomyIdCount: fullBodyIds.length,
    },
    systems: systemAssets.map((asset) => ({
      id: asset.systemId,
      file: asset.fileName,
      bytes: asset.bytes,
      nodeCount: asset.nodeCount,
      anatomyIdCount: asset.anatomyIds.length,
    })),
  };
  await writeFile(
    resolve(catalogDirectory, "distribution-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
