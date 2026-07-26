#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { access, copyFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertConfig,
  canonicalJson,
  sha256,
  sha256File,
  validateStaging,
} from "./lib.mjs";

const toolRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(toolRoot, "../..");
const defaultConfigPath = resolve(toolRoot, "config/atlas.json");
const exporterPath = resolve(toolRoot, "blender/export_batch.py");
const validatorPath = resolve(toolRoot, "lib.mjs");
const pipelinePath = fileURLToPath(import.meta.url);

function usage() {
  console.log(`Usage:
  node tools/anatomy/pipeline.mjs stage --batch <id> --source <Startup.blend> [--blender <path>]
  node tools/anatomy/pipeline.mjs validate --batch <id> --build <build-id>
  node tools/anatomy/pipeline.mjs promote --batch <id> --build <build-id> --confirm <build-id>

Environment defaults:
  VANATOME_Z_ANATOMY_BLEND, VANATOME_BLENDER, VANATOME_ATLAS_STAGING_ROOT

Promotion is never implicit. It validates again and requires an exact build ID confirmation.`);
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

async function loadContext(options) {
  const configPath = resolve(repoRoot, options.config ?? defaultConfigPath);
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const batchId = options.batch;
  if (!batchId) throw new Error("--batch is required");
  const batch = assertConfig(config, batchId);
  const stagingRoot = resolve(
    repoRoot,
    options["output-root"] ??
      process.env.VANATOME_ATLAS_STAGING_ROOT ??
      config.stagingRoot,
  );
  return { configPath, config, batchId, batch, stagingRoot };
}

async function fingerprintStage(context, options) {
  const sourceOption = options.source ?? process.env.VANATOME_Z_ANATOMY_BLEND;
  const source = sourceOption ? resolve(sourceOption) : "";
  const blender = resolve(
    options.blender ??
      process.env.VANATOME_BLENDER ??
      "/Applications/Blender.app/Contents/MacOS/Blender",
  );
  if (!source || !(await exists(source))) {
    throw new Error("Z-Anatomy Blend not found; pass --source or VANATOME_Z_ANATOMY_BLEND");
  }
  if (!(await exists(blender))) {
    throw new Error("Blender executable not found; pass --blender or VANATOME_BLENDER");
  }
  if ((await stat(source)).isDirectory()) throw new Error("Z-Anatomy source must be a .blend file");
  const versionRun = spawnSync(blender, ["--version"], { encoding: "utf8" });
  if (versionRun.status !== 0) throw new Error(`Unable to inspect Blender: ${versionRun.stderr}`);
  const blenderVersion = versionRun.stdout.split("\n")[0].replace(/^Blender\s+/u, "").trim();
  const fingerprints = {
    sourceBlendSha256: await sha256File(source),
    blenderExecutableSha256: await sha256File(blender),
    ...await currentToolFingerprints(context.config, context.batchId),
  };
  const buildId = sha256(
    canonicalJson({
      atlas: context.config.atlas,
      batch: context.batchId,
      batchConfig: context.batch,
      fingerprints,
      blenderVersion,
    }),
  ).slice(0, 16);
  return { source, blender, blenderVersion, fingerprints, buildId };
}

async function currentToolFingerprints(config, batchId) {
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

function stagingDirectory(context, buildId) {
  return resolve(
    context.stagingRoot,
    context.config.atlas.version,
    context.batchId,
    buildId,
  );
}

async function writeManifest(context, stageInfo, tempDirectory) {
  const report = JSON.parse(await readFile(resolve(tempDirectory, "export-report.json"), "utf8"));
  const assetPath = resolve(tempDirectory, "atlas.glb");
  const assetBytes = (await stat(assetPath)).size;
  const assetSha256 = await sha256File(assetPath);
  const groups = Object.fromEntries(
    context.batch.groups.map((group) => [group.id, report.groups[group.id]]),
  );
  const manifest = {
    schemaVersion: 1,
    atlas: {
      id: context.config.atlas.id,
      name: context.config.atlas.name,
      version: context.config.atlas.version,
      batch: context.batchId,
    },
    build: {
      id: stageInfo.buildId,
      deterministic: true,
      fingerprints: stageInfo.fingerprints,
    },
    source: {
      name: context.config.source.name,
      fileName: context.config.source.fileName,
      projectUrl: context.config.source.projectUrl,
      license: context.config.source.license,
      licenseUrl: context.config.source.licenseUrl,
      attribution: context.config.source.attribution,
    },
    toolchain: {
      blenderVersion: stageInfo.blenderVersion,
    },
    safety: {
      embeddedBlendScripts: "disabled",
      liveAtlasModifiedDuringConversion: false,
      promotionRequired: true,
    },
    asset: {
      file: "atlas.glb",
      bytes: assetBytes,
      sha256: assetSha256,
    },
    objectCount: report.objectCount,
    groups,
  };
  await writeFile(resolve(tempDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await rm(resolve(tempDirectory, "export-report.json"));
}

async function stage(context, options) {
  const stageInfo = await fingerprintStage(context, options);
  const finalDirectory = stagingDirectory(context, stageInfo.buildId);
  if (await exists(finalDirectory)) {
    const validation = await validateStaging({
      directory: finalDirectory,
      config: context.config,
      batchId: context.batchId,
      buildId: stageInfo.buildId,
      expectedFingerprints: stageInfo.fingerprints,
    });
    console.log(JSON.stringify({ status: "reused", directory: finalDirectory, ...validation }, null, 2));
    return;
  }
  const tempDirectory = `${finalDirectory}.tmp-${process.pid}`;
  await mkdir(dirname(finalDirectory), { recursive: true });
  await rm(tempDirectory, { recursive: true, force: true });
  await mkdir(tempDirectory, { recursive: true });
  try {
    const run = spawnSync(
      stageInfo.blender,
      [
        "--background",
        "--disable-autoexec",
        stageInfo.source,
        "--python",
        exporterPath,
        "--",
        "--config",
        context.configPath,
        "--batch",
        context.batchId,
        "--output",
        tempDirectory,
      ],
      { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    await writeFile(resolve(tempDirectory, "blender.log"), `${run.stdout}${run.stderr}`);
    if (run.status !== 0) throw new Error(`Blender export failed; inspect ${tempDirectory}/blender.log`);
    if (!run.stdout.includes("VANATOME_EXPORT_COMPLETE")) {
      throw new Error("Blender did not emit the expected completion marker");
    }
    await writeManifest(context, stageInfo, tempDirectory);
    await validateStaging({
      directory: tempDirectory,
      config: context.config,
      batchId: context.batchId,
      buildId: stageInfo.buildId,
      expectedFingerprints: stageInfo.fingerprints,
    });
    await rename(tempDirectory, finalDirectory);
  } catch (error) {
    console.error(`Staging candidate retained for inspection: ${tempDirectory}`);
    throw error;
  }
  const validation = await validateStaging({
    directory: finalDirectory,
    config: context.config,
    batchId: context.batchId,
    buildId: stageInfo.buildId,
    expectedFingerprints: stageInfo.fingerprints,
  });
  console.log(JSON.stringify({ status: "staged", directory: finalDirectory, ...validation }, null, 2));
}

async function validate(context, options) {
  if (!options.build) throw new Error("--build is required");
  const directory = stagingDirectory(context, options.build);
  const result = await validateStaging({
    directory,
    config: context.config,
    batchId: context.batchId,
    buildId: options.build,
    expectedFingerprints: await currentToolFingerprints(context.config, context.batchId),
  });
  console.log(JSON.stringify({ status: "valid", directory, ...result }, null, 2));
}

async function promote(context, options) {
  if (!options.build) throw new Error("--build is required");
  if (options.confirm !== options.build) {
    throw new Error("promotion requires --confirm with the exact build ID");
  }
  const directory = stagingDirectory(context, options.build);
  await validateStaging({
    directory,
    config: context.config,
    batchId: context.batchId,
    buildId: options.build,
    expectedFingerprints: await currentToolFingerprints(context.config, context.batchId),
  });
  const assetTarget = resolve(repoRoot, context.batch.liveAsset);
  const manifestTarget = resolve(repoRoot, context.batch.liveManifest);
  await mkdir(dirname(assetTarget), { recursive: true });
  const assetTemp = `${assetTarget}.promoting-${process.pid}`;
  const manifestTemp = `${manifestTarget}.promoting-${process.pid}`;
  await copyFile(resolve(directory, "atlas.glb"), assetTemp);
  await copyFile(resolve(directory, "manifest.json"), manifestTemp);
  await rename(assetTemp, assetTarget);
  await rename(manifestTemp, manifestTarget);
  console.log(JSON.stringify({
    status: "promoted",
    buildId: options.build,
    asset: assetTarget,
    manifest: manifestTarget,
  }, null, 2));
}

try {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (!command || command === "help") {
    usage();
  } else {
    const context = await loadContext(options);
    if (command === "stage") await stage(context, options);
    else if (command === "validate") await validate(context, options);
    else if (command === "promote") await promote(context, options);
    else throw new Error(`unknown command: ${command}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
