import { readFile } from "node:fs/promises";

import { canonicalJson, parseGlbJson, sha256 } from "./lib.mjs";

export function mergeComponentGroups(componentManifests) {
  const groups = {};
  const anatomyIds = new Set();
  const sourceObjects = new Set();
  const nodeNames = new Set();
  for (const manifest of componentManifests) {
    for (const [id, group] of Object.entries(manifest.groups)) {
      if (anatomyIds.has(id)) throw new Error(`duplicate anatomy ID across batches: ${id}`);
      anatomyIds.add(id);
      for (const sourceName of group.sourceObjects) {
        if (sourceObjects.has(sourceName)) {
          throw new Error(`duplicate source object across batches: ${sourceName}`);
        }
        sourceObjects.add(sourceName);
      }
      for (const nodeName of group.nodes) {
        if (nodeNames.has(nodeName)) {
          throw new Error(`duplicate generated node across batches: ${nodeName}`);
        }
        nodeNames.add(nodeName);
      }
      groups[id] = group;
    }
  }
  return groups;
}

export function releaseBuildId({ config, releaseId, components, fingerprints, blenderVersion }) {
  return sha256(canonicalJson({
    atlas: config.atlas,
    releaseId,
    release: config.releases[releaseId],
    components,
    fingerprints,
    blenderVersion,
  })).slice(0, 16);
}

export function registryFor(config, releaseId, buildId, groups) {
  const structures = Object.entries(groups).map(([id, group]) => ({
    id,
    system: group.system,
    position: [
      Number((group.centerBlender[0] * 7).toFixed(4)),
      Number((group.centerBlender[2] * 7 - 6.1).toFixed(4)),
      Number((-group.centerBlender[1] * 7).toFixed(4)),
    ],
    objectCount: group.nodes.length,
  }));
  return {
    schemaVersion: 1,
    atlasId: config.atlas.id,
    atlasVersion: config.atlas.version,
    release: releaseId,
    buildId,
    structures,
  };
}

export async function validateRelease({
  directory,
  config,
  releaseId,
  buildId,
  componentManifests,
  expectedFingerprints = {},
}) {
  const release = config.releases[releaseId];
  if (!release) throw new Error(`unknown release: ${releaseId}`);
  const manifest = JSON.parse(await readFile(`${directory}/manifest.json`, "utf8"));
  const asset = await readFile(`${directory}/atlas.glb`);
  const registry = JSON.parse(await readFile(`${directory}/registry.json`, "utf8"));
  const gltf = parseGlbJson(asset);
  const expectedGroups = mergeComponentGroups(componentManifests);
  const expectedIds = Object.keys(expectedGroups).sort();
  const expectedRegistry = registryFor(config, releaseId, buildId, expectedGroups);
  const nodeRows = (gltf.nodes ?? [])
    .filter((node) => node.extras?.anatomyId)
    .map((node) => ({ id: node.extras.anatomyId, name: node.name }));
  const actualIds = [...new Set(nodeRows.map((node) => node.id))].sort();
  const derivedBuildId = releaseBuildId({
    config,
    releaseId,
    components: manifest.components,
    fingerprints: manifest.build.fingerprints,
    blenderVersion: manifest.toolchain.blenderVersion,
  });
  const errors = [];

  if (manifest.schemaVersion !== 1) errors.push("release manifest schemaVersion must be 1");
  if (manifest.atlas.release !== releaseId) errors.push("release manifest ID does not match");
  if (manifest.build.id !== buildId || derivedBuildId !== buildId) {
    errors.push("release build ID cannot be reproduced");
  }
  if (manifest.safety.embeddedBlendScripts !== "disabled") errors.push("embedded Blend scripts were not disabled");
  if (manifest.safety.liveAtlasModifiedDuringAssembly !== false) errors.push("release assembly safety state is invalid");
  if (manifest.source.license !== config.source.license) errors.push("release source license changed");
  if (manifest.source.attribution !== config.source.attribution) errors.push("release attribution changed");
  if (manifest.asset.sha256 !== sha256(asset) || manifest.asset.bytes !== asset.length) {
    errors.push("release asset fingerprint does not match");
  }
  const registryBuffer = Buffer.from(`${JSON.stringify(registry, null, 2)}\n`);
  if (
    manifest.registry?.sha256 !== sha256(registryBuffer) ||
    manifest.registry?.bytes !== registryBuffer.length ||
    manifest.registry?.file !== "registry.json"
  ) {
    errors.push("release registry fingerprint does not match");
  }
  if (asset.length > release.validation.maximumAssetBytes) errors.push("release asset exceeds maximum size");
  if (manifest.objectCount !== release.validation.expectedObjectCount) errors.push("release object count is invalid");
  if (nodeRows.length !== release.validation.expectedObjectCount) errors.push("GLB anatomy node count is invalid");
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) errors.push("release anatomy IDs do not match components");
  if (registry.release !== releaseId || registry.buildId !== buildId) errors.push("registry release identity does not match");
  if (registry.structures.length !== expectedIds.length) errors.push("registry structure count does not match release groups");
  if (canonicalJson(registry) !== canonicalJson(expectedRegistry)) {
    errors.push("registry contents do not match generated release groups");
  }

  for (const [name, fingerprint] of Object.entries(manifest.build.fingerprints ?? {})) {
    if (!/^[a-f0-9]{64}$/u.test(fingerprint)) errors.push(`${name}: invalid release fingerprint`);
  }
  for (const [name, fingerprint] of Object.entries(expectedFingerprints)) {
    if (manifest.build.fingerprints?.[name] !== fingerprint) {
      errors.push(`${name}: release fingerprint does not match current tooling`);
    }
  }
  for (const [id, group] of Object.entries(expectedGroups)) {
    const expectedNodes = [...group.nodes].sort();
    const actualNodes = nodeRows.filter((node) => node.id === id).map((node) => node.name).sort();
    if (JSON.stringify(actualNodes) !== JSON.stringify(expectedNodes)) {
      errors.push(`${id}: release nodes do not match validated component`);
    }
  }
  if (errors.length) throw new Error(errors.join("\n"));
  return {
    release: releaseId,
    buildId,
    objectCount: nodeRows.length,
    structureCount: expectedIds.length,
    bytes: asset.length,
    sha256: manifest.asset.sha256,
  };
}
