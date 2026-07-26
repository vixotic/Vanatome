#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { access, copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  canonicalJson,
  sha256,
  sha256File,
  validateStaging,
} from "./lib.mjs";
import {
  mergeComponentGroups,
  registryFor,
  releaseBuildId,
  validateRelease,
} from "./release-lib.mjs";

const toolRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(toolRoot, "../..");
const configPath = resolve(toolRoot, "config/atlas.json");
const exporterPath = resolve(toolRoot, "blender/export_batch.py");
const pipelinePath = resolve(toolRoot, "pipeline.mjs");
const validatorPath = resolve(toolRoot, "lib.mjs");
const releaseToolPath = fileURLToPath(import.meta.url);
const releaseValidatorPath = resolve(toolRoot, "release-lib.mjs");

function usage() {
  console.log(`Usage:
  node tools/anatomy/release.mjs assemble --release <id> --source <Startup.blend> --component-builds <batch=build,...>
  node tools/anatomy/release.mjs validate --release <id> --build <build-id>
  node tools/anatomy/release.mjs promote --release <id> --build <build-id> --confirm <build-id>

Assemble and validate never modify public/models. Promotion is explicit and
requires the exact release build ID as confirmation.`);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    if (!rest[index]?.startsWith("--") || rest[index + 1] === undefined) {
      throw new Error(`invalid argument: ${rest[index] ?? ""}`);
    }
    options[rest[index].slice(2)] = rest[index + 1];
  }
  return { command, options };
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function batchDirectory(config, batchId, buildId) {
  return resolve(repoRoot, config.stagingRoot, config.atlas.version, batchId, buildId);
}

function releaseDirectory(config, releaseId, buildId) {
  return resolve(repoRoot, config.stagingRoot, config.atlas.version, "releases", releaseId, buildId);
}

async function batchToolFingerprints(config, batchId) {
  return {
    exporterSha256: await sha256File(exporterPath),
    pipelineSha256: await sha256File(pipelinePath),
    validatorSha256: await sha256File(validatorPath),
    configSha256: sha256(canonicalJson({
      schemaVersion: config.schemaVersion,
      atlas: config.atlas,
      source: config.source,
      batch: config.batches[batchId],
    })),
  };
}

function parseComponentBuilds(value) {
  if (!value) throw new Error("--component-builds is required");
  return Object.fromEntries(value.split(",").map((entry) => {
    const separator = entry.indexOf("=");
    if (separator < 1) throw new Error(`invalid component build: ${entry}`);
    return [entry.slice(0, separator), entry.slice(separator + 1)];
  }));
}

async function loadComponents(config, releaseId, buildMap) {
  const release = config.releases[releaseId];
  if (!release) throw new Error(`unknown release: ${releaseId}`);
  const supplied = Object.keys(buildMap).sort();
  const expected = [...release.batches].sort();
  if (JSON.stringify(supplied) !== JSON.stringify(expected)) {
    throw new Error(`component batches must be exactly: ${release.batches.join(", ")}`);
  }
  const components = [];
  const manifests = [];
  for (const batchId of release.batches) {
    const buildId = buildMap[batchId];
    const directory = batchDirectory(config, batchId, buildId);
    await validateStaging({
      directory,
      config,
      batchId,
      buildId,
      expectedFingerprints: await batchToolFingerprints(config, batchId),
    });
    const manifestBuffer = await readFile(resolve(directory, "manifest.json"));
    const manifest = JSON.parse(manifestBuffer);
    manifests.push(manifest);
    components.push({
      batch: batchId,
      buildId,
      manifestSha256: sha256(manifestBuffer),
      assetSha256: manifest.asset.sha256,
    });
  }
  mergeComponentGroups(manifests);
  return { components, manifests };
}

async function releaseFingerprints(config, releaseId, source, blender, components) {
  return {
    sourceBlendSha256: await sha256File(source),
    blenderExecutableSha256: await sha256File(blender),
    exporterSha256: await sha256File(exporterPath),
    releaseToolSha256: await sha256File(releaseToolPath),
    releaseValidatorSha256: await sha256File(releaseValidatorPath),
    releaseConfigSha256: sha256(canonicalJson({
      schemaVersion: config.schemaVersion,
      atlas: config.atlas,
      source: config.source,
      release: config.releases[releaseId],
      batches: Object.fromEntries(
        config.releases[releaseId].batches.map((id) => [id, config.batches[id]]),
      ),
    })),
    componentsSha256: sha256(canonicalJson(components)),
  };
}

async function assemble(config, releaseId, options) {
  const sourceOption = options.source ?? process.env.VANATOME_Z_ANATOMY_BLEND;
  const source = sourceOption ? resolve(sourceOption) : "";
  const blender = resolve(
    options.blender ??
      process.env.VANATOME_BLENDER ??
      "/Applications/Blender.app/Contents/MacOS/Blender",
  );
  if (!source || !(await exists(source))) throw new Error("Z-Anatomy Blend not found");
  if (!(await exists(blender))) throw new Error("Blender executable not found");
  const buildMap = parseComponentBuilds(options["component-builds"]);
  const { components, manifests } = await loadComponents(config, releaseId, buildMap);
  const groups = mergeComponentGroups(manifests);
  const release = config.releases[releaseId];
  const virtualBatch = {
    description: release.description,
    validation: release.validation,
    groups: release.batches.flatMap((batchId) => config.batches[batchId].groups),
  };
  const virtualConfig = {
    ...config,
    batches: { [releaseId]: virtualBatch },
  };
  const versionRun = spawnSync(blender, ["--version"], { encoding: "utf8" });
  if (versionRun.status !== 0) throw new Error(`Unable to inspect Blender: ${versionRun.stderr}`);
  const blenderVersion = versionRun.stdout.split("\n")[0].replace(/^Blender\s+/u, "").trim();
  const fingerprints = await releaseFingerprints(config, releaseId, source, blender, components);
  const buildId = releaseBuildId({
    config,
    releaseId,
    components,
    fingerprints,
    blenderVersion,
  });
  const finalDirectory = releaseDirectory(config, releaseId, buildId);
  if (await exists(finalDirectory)) {
    const validation = await validateRelease({
      directory: finalDirectory,
      config,
      releaseId,
      buildId,
      componentManifests: manifests,
      expectedFingerprints: fingerprints,
    });
    console.log(JSON.stringify({ status: "reused", directory: finalDirectory, ...validation }, null, 2));
    return;
  }

  const tempDirectory = `${finalDirectory}.tmp-${process.pid}`;
  await mkdir(dirname(finalDirectory), { recursive: true });
  await rm(tempDirectory, { recursive: true, force: true });
  await mkdir(tempDirectory, { recursive: true });
  const virtualConfigPath = resolve(tempDirectory, "release-config.json");
  await writeFile(virtualConfigPath, `${JSON.stringify(virtualConfig, null, 2)}\n`);
  try {
    const run = spawnSync(
      blender,
      [
        "--background",
        "--disable-autoexec",
        source,
        "--python",
        exporterPath,
        "--",
        "--config",
        virtualConfigPath,
        "--batch",
        releaseId,
        "--output",
        tempDirectory,
      ],
      { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    await writeFile(resolve(tempDirectory, "blender.log"), `${run.stdout}${run.stderr}`);
    if (run.status !== 0) throw new Error(`Blender release export failed; inspect ${tempDirectory}/blender.log`);
    const report = JSON.parse(await readFile(resolve(tempDirectory, "export-report.json"), "utf8"));
    const assetPath = resolve(tempDirectory, "atlas.glb");
    const assetBuffer = await readFile(assetPath);
    const releaseGroups = Object.fromEntries(
      Object.keys(groups).map((id) => [id, report.groups[id]]),
    );
    const registryBuffer = Buffer.from(
      `${JSON.stringify(registryFor(config, releaseId, buildId, releaseGroups), null, 2)}\n`,
    );
    const manifest = {
      schemaVersion: 1,
      atlas: {
        id: config.atlas.id,
        name: config.atlas.name,
        version: config.atlas.version,
        release: releaseId,
      },
      build: { id: buildId, deterministic: true, fingerprints },
      components,
      source: config.source,
      toolchain: { blenderVersion },
      safety: {
        embeddedBlendScripts: "disabled",
        liveAtlasModifiedDuringAssembly: false,
        promotionRequired: true,
      },
      asset: {
        file: "atlas.glb",
        bytes: assetBuffer.length,
        sha256: sha256(assetBuffer),
      },
      registry: {
        file: "registry.json",
        bytes: registryBuffer.length,
        sha256: sha256(registryBuffer),
      },
      objectCount: report.objectCount,
      groups: releaseGroups,
    };
    await writeFile(resolve(tempDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    await writeFile(resolve(tempDirectory, "registry.json"), registryBuffer);
    await rm(resolve(tempDirectory, "export-report.json"));
    await rm(virtualConfigPath);
    await validateRelease({
      directory: tempDirectory,
      config,
      releaseId,
      buildId,
      componentManifests: manifests,
      expectedFingerprints: fingerprints,
    });
    await rename(tempDirectory, finalDirectory);
  } catch (error) {
    console.error(`Release candidate retained for inspection: ${tempDirectory}`);
    throw error;
  }
  const validation = await validateRelease({
    directory: finalDirectory,
    config,
    releaseId,
    buildId,
    componentManifests: manifests,
    expectedFingerprints: fingerprints,
  });
  console.log(JSON.stringify({ status: "assembled", directory: finalDirectory, ...validation }, null, 2));
}

async function loadReleaseForValidation(config, releaseId, buildId) {
  const directory = releaseDirectory(config, releaseId, buildId);
  const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8"));
  const buildMap = Object.fromEntries(
    manifest.components.map((component) => [component.batch, component.buildId]),
  );
  const { components, manifests } = await loadComponents(config, releaseId, buildMap);
  if (JSON.stringify(components) !== JSON.stringify(manifest.components)) {
    throw new Error("release component evidence no longer matches staged manifests");
  }
  return { directory, manifest, components, manifests };
}

async function validate(config, releaseId, buildId) {
  const loaded = await loadReleaseForValidation(config, releaseId, buildId);
  const result = await validateRelease({
    directory: loaded.directory,
    config,
    releaseId,
    buildId,
    componentManifests: loaded.manifests,
    expectedFingerprints: {
      releaseToolSha256: await sha256File(releaseToolPath),
      releaseValidatorSha256: await sha256File(releaseValidatorPath),
      componentsSha256: sha256(canonicalJson(loaded.components)),
    },
  });
  console.log(JSON.stringify({ status: "valid", directory: loaded.directory, ...result }, null, 2));
}

async function promote(config, releaseId, buildId, confirmation) {
  if (confirmation !== buildId) throw new Error("promotion requires --confirm with the exact release build ID");
  const loaded = await loadReleaseForValidation(config, releaseId, buildId);
  await validateRelease({
    directory: loaded.directory,
    config,
    releaseId,
    buildId,
    componentManifests: loaded.manifests,
    expectedFingerprints: {
      releaseToolSha256: await sha256File(releaseToolPath),
      releaseValidatorSha256: await sha256File(releaseValidatorPath),
      componentsSha256: sha256(canonicalJson(loaded.components)),
    },
  });
  const release = config.releases[releaseId];
  const targets = [
    [resolve(loaded.directory, "atlas.glb"), resolve(repoRoot, release.liveAsset)],
    [resolve(loaded.directory, "manifest.json"), resolve(repoRoot, release.liveManifest)],
    [resolve(loaded.directory, "registry.json"), resolve(repoRoot, release.liveRegistry)],
  ];
  const prepared = [];
  try {
    for (const [source, target] of targets) {
      await mkdir(dirname(target), { recursive: true });
      const temporary = `${target}.promoting-${process.pid}`;
      const rollback = `${target}.rollback-${process.pid}`;
      await copyFile(source, temporary);
      const hadTarget = await exists(target);
      if (hadTarget) await copyFile(target, rollback);
      prepared.push({ target, temporary, rollback, hadTarget });
    }
    for (const item of prepared) await rename(item.temporary, item.target);
  } catch (error) {
    for (const item of prepared) {
      if (item.hadTarget && await exists(item.rollback)) {
        const restore = `${item.target}.restoring-${process.pid}`;
        await copyFile(item.rollback, restore);
        await rename(restore, item.target);
      } else if (!item.hadTarget) {
        await rm(item.target, { force: true });
      }
    }
    throw error;
  } finally {
    for (const item of prepared) {
      await rm(item.temporary, { force: true });
      await rm(item.rollback, { force: true });
    }
  }
  console.log(JSON.stringify({
    status: "promoted",
    release: releaseId,
    buildId,
    targets: targets.map(([, target]) => target),
  }, null, 2));
}

try {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (!command || command === "help") {
    usage();
  } else {
    const config = JSON.parse(await readFile(configPath, "utf8"));
    const releaseId = options.release;
    if (!releaseId || !config.releases[releaseId]) throw new Error("--release must name a configured release");
    if (command === "assemble") await assemble(config, releaseId, options);
    else if (command === "validate") {
      if (!options.build) throw new Error("--build is required");
      await validate(config, releaseId, options.build);
    } else if (command === "promote") {
      if (!options.build) throw new Error("--build is required");
      await promote(config, releaseId, options.build, options.confirm);
    } else throw new Error(`unknown command: ${command}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
