# Safe Z-Anatomy conversion pipeline

Vanatome converts Z-Anatomy source data into immutable, browser-ready batches.
Conversion never writes to `public/models/`. It first produces a validated,
content-addressed candidate under the ignored `work/anatomy-staging/` tree.

The checked-in configuration owns stable `anatomyId` values, source object
names, materials, batch membership, validation limits, and promotion targets.
Changing an anatomy ID is an atlas compatibility change and requires review.

## Prerequisites

- Blender 5.2 LTS or a deliberately reviewed replacement.
- A local Z-Anatomy `Startup.blend` obtained from the upstream project.
- Node.js 22.13 or newer.

The initial source used to prove this pipeline was:

`/Users/vix/Documents/Codex/2026-07-26/anatomy-hologram-explorer/work/z-anatomy-source/Z-Anatomy/Startup.blend`

That local path is documentation, not build input. The deterministic manifest
records the source filename and SHA-256, never a machine-specific absolute path.
No separate downloaded archive was present in the inspected source workspace;
the extracted `Startup.blend` was the only conversion source payload.
The previous one-off scripts and inspection logs remain ignored in
`/Users/vix/Documents/Vanatomi/work/`; reusable behavior now lives under
`tools/anatomy/`.

## Stage and validate

```bash
export VANATOME_Z_ANATOMY_BLEND=/absolute/path/to/Z-Anatomy/Startup.blend
export VANATOME_BLENDER=/Applications/Blender.app/Contents/MacOS/Blender
npm run atlas:stage -- --batch visceral-core
```

The runner:

1. validates the declarative batch;
2. fingerprints the Blend, Blender executable, exporter, runner, validator, and
   canonical batch-scoped config;
3. derives a 16-character build ID and versioned staging path;
4. invokes Blender with `--background --disable-autoexec`;
5. writes the GLB and deterministic manifest to a temporary directory;
6. parses the GLB and applies object-count, ID, source-name, size, attribution,
   missing-object, and fingerprint gates;
7. atomically makes the candidate available only after validation succeeds.

Identical inputs reuse and revalidate the same build directory. Failed
candidates retain their temporary directory and Blender log for diagnosis.

To revalidate an existing candidate:

```bash
npm run atlas:validate -- --batch visceral-core --build BUILD_ID
```

## Explicit promotion

Promotion is separate, validates the candidate again, and requires the exact
build ID twice:

```bash
npm run atlas:promote -- \
  --batch visceral-core \
  --build BUILD_ID \
  --confirm BUILD_ID
```

Do not run promotion as part of unattended daily conversion. The current live
full-body model and manifest remain untouched until a person selects and
promotes a validated candidate. The initial batch has separate promotion
targets (`z-anatomy-visceral-core.*`) and cannot overwrite the current
`z-anatomy-full-body.*` artifacts.

## Assemble a release

Release assembly validates exact component build IDs, rejects anatomy ID,
source-object, and generated-node collisions, then performs one deterministic
export from the pinned Blend using the ordered union of the component batches.
It does not merge or trust binary GLBs.

```bash
npm run atlas:release -- assemble \
  --release demo-1.1.0 \
  --source "$VANATOME_Z_ANATOMY_BLEND" \
  --component-builds \
visceral-core=BUILD_A,torso-skeleton=BUILD_B,body-shell=BUILD_C,brainstem-core=BUILD_D
```

The release candidate includes a GLB, provenance manifest, Blender log, and a
generated model-space registry. Revalidate it with:

```bash
npm run atlas:release -- validate \
  --release demo-1.1.0 \
  --build RELEASE_BUILD
```

Release promotion is also exact-ID protected:

```bash
npm run atlas:release -- promote \
  --release demo-1.1.0 \
  --build RELEASE_BUILD \
  --confirm RELEASE_BUILD
```

Promotion prepares every target before making per-file atomic replacements. If
any replacement fails, it restores all prior live files from temporary rollback
copies. The generated registry consumed by the demo is validated against the
release groups and fingerprinted in the manifest. Git also keeps the previous
tracked release recoverable.

## Selectable hierarchy

Set `expandSourceParts: true` on a multi-object anatomy group to retain the
existing group ID as an aggregate parent and generate a stable selectable ID
for every source object. Laterality suffixes are normalized, so `Kidney.l`
becomes `kidneys-kidney-left`. The exporter records the child `anatomyId`,
`anatomyParentId`, original source name, and system in glTF extras.

The generated registry contains system roots, aggregate organs, individual
parts, parent IDs, model-space focus positions, and mapped-object counts.
Non-interactive context such as the body shell remains renderable with
`selectable: false`. Validation rejects duplicate generated IDs and verifies
that every configured source object produces exactly one correctly identified
mesh.

## Daily operation

The stage command is safe for recurring local execution because outputs are
content-addressed, already-complete builds are revalidated, and live assets are
outside the staging path. No cron, launchd job, or notification integration is
enabled. Choose a local run time and success/failure notification behavior
before adding scheduling.

Z-Anatomy-derived outputs remain CC BY-SA 4.0. Preserve `ASSET-LICENSE.md`,
`public/ATTRIBUTION.txt`, and the source/license/attribution fields in every
generated manifest.
