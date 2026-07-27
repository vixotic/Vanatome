import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export async function sha256File(path) {
  return sha256(await readFile(path));
}

export function stablePartId(parentId, sourceName) {
  const normalized = sourceName
    .replace(/\.l$/iu, " left")
    .replace(/\.r$/iu, " right")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
  return `${parentId}-${normalized}`;
}

export function parseGlbJson(buffer) {
  if (buffer.length < 20 || buffer.toString("utf8", 0, 4) !== "glTF") {
    throw new Error("Asset is not a valid binary glTF file");
  }
  if (buffer.readUInt32LE(4) !== 2) {
    throw new Error("Only glTF 2.0 assets are supported");
  }
  const jsonLength = buffer.readUInt32LE(12);
  const jsonType = buffer.readUInt32LE(16);
  if (jsonType !== 0x4e4f534a || 20 + jsonLength > buffer.length) {
    throw new Error("GLB JSON chunk is missing or truncated");
  }
  return JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength).replace(/\0+$/u, "").trim());
}

export function assertConfig(config, batchId) {
  const errors = [];
  if (config.schemaVersion !== 1) errors.push("config schemaVersion must be 1");
  const batch = config.batches?.[batchId];
  if (!batch) errors.push(`unknown batch: ${batchId}`);
  const ids = batch?.groups?.map((group) => group.id) ?? [];
  if (new Set(ids).size !== ids.length) errors.push("anatomy IDs must be unique");
  for (const group of batch?.groups ?? []) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(group.id)) {
      errors.push(`invalid stable anatomy ID: ${group.id}`);
    }
    const hasSourceObjects = Boolean(group.sourceObjects?.length);
    const hasSourceSelector = Boolean(group.sourceSelector?.collection);
    if (!group.system || hasSourceObjects === hasSourceSelector) {
      errors.push(`${group.id}: system and exactly one source definition are required`);
    }
    if (group.expandSourceParts && group.sourceObjects) {
      const partIds = group.sourceObjects.map((name) => stablePartId(group.id, name));
      if (new Set(partIds).size !== partIds.length) {
        errors.push(`${group.id}: expanded source objects produce duplicate stable IDs`);
      }
    }
  }
  if (errors.length) throw new Error(errors.join("\n"));
  return batch;
}

export async function validateStaging({
  directory,
  config,
  batchId,
  buildId,
  expectedFingerprints = {},
}) {
  const batch = assertConfig(config, batchId);
  const manifest = JSON.parse(await readFile(`${directory}/manifest.json`, "utf8"));
  const asset = await readFile(`${directory}/atlas.glb`);
  const gltf = parseGlbJson(asset);
  const errors = [];
  const derivedBuildId = sha256(canonicalJson({
    atlas: config.atlas,
    batch: batchId,
    batchConfig: batch,
    fingerprints: manifest.build.fingerprints,
    blenderVersion: manifest.toolchain.blenderVersion,
  })).slice(0, 16);
  const nodeRows = (gltf.nodes ?? [])
    .filter((node) => node.extras?.anatomyId)
    .map((node) => ({ id: node.extras.anatomyId, name: node.name }));
  const actualIds = [...new Set(nodeRows.map((node) => node.id))].sort();
  const expectedIds = [];

  if (manifest.schemaVersion !== 1) errors.push("manifest schemaVersion must be 1");
  if (manifest.build.id !== buildId) errors.push("manifest build ID does not match staging directory");
  if (derivedBuildId !== buildId) errors.push("build ID cannot be reproduced from manifest fingerprints");
  if (manifest.atlas.batch !== batchId) errors.push("manifest batch does not match requested batch");
  if (manifest.safety.embeddedBlendScripts !== "disabled") errors.push("embedded Blend scripts were not recorded as disabled");
  if (manifest.safety.liveAtlasModifiedDuringConversion !== false) errors.push("conversion safety state is invalid");
  if (manifest.source.license !== config.source.license) errors.push("source license is missing or changed");
  if (manifest.source.attribution !== config.source.attribution) errors.push("source attribution is missing or changed");
  if (manifest.asset.sha256 !== sha256(asset)) errors.push("asset SHA-256 does not match manifest");
  if (manifest.asset.bytes !== asset.length) errors.push("asset byte count does not match manifest");
  if (asset.length > batch.validation.maximumAssetBytes) errors.push("asset exceeds configured maximum size");
  if (manifest.objectCount !== batch.validation.expectedObjectCount) errors.push("object count does not match validation gate");
  if (nodeRows.length !== batch.validation.expectedObjectCount) errors.push("GLB anatomy node count does not match validation gate");
  for (const [name, fingerprint] of Object.entries(manifest.build.fingerprints ?? {})) {
    if (!/^[a-f0-9]{64}$/u.test(fingerprint)) errors.push(`${name}: invalid SHA-256 fingerprint`);
  }
  for (const [name, fingerprint] of Object.entries(expectedFingerprints)) {
    if (manifest.build.fingerprints?.[name] !== fingerprint) {
      errors.push(`${name}: staged fingerprint does not match current tooling`);
    }
  }

  for (const group of batch.groups) {
    const sourceObjects = group.sourceObjects ?? manifest.groups[group.id]?.sourceObjects ?? [];
    const expand = group.expandSourceParts && sourceObjects.length > 1;
    for (const sourceName of sourceObjects) {
      const anatomyId = expand ? stablePartId(group.id, sourceName) : group.id;
      expectedIds.push(anatomyId);
      const expectedName = `${anatomyId}__${sourceName}`;
      const matchingNodes = nodeRows.filter(
        (node) => node.id === anatomyId && node.name === expectedName,
      );
      if (matchingNodes.length !== 1) {
        errors.push(`${anatomyId}: exported node does not match ${sourceName}`);
      }
    }
    if (manifest.groups[group.id]?.missing?.length) {
      errors.push(`${group.id}: source objects are missing`);
    }
  }
  if (JSON.stringify(actualIds) !== JSON.stringify([...new Set(expectedIds)].sort())) {
    errors.push("GLB anatomy IDs do not match expanded config");
  }
  if (errors.length) throw new Error(errors.join("\n"));
  return {
    batch: batchId,
    buildId,
    objectCount: nodeRows.length,
    bytes: asset.length,
    sha256: manifest.asset.sha256,
    anatomyIds: expectedIds,
  };
}
