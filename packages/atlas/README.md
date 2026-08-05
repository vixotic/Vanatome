# `@vixotic/vanatome-atlas`

Official human-anatomy catalog contracts and a browser-safe loader for
[`@vixotic/vanatome-react`](https://www.npmjs.com/package/@vixotic/vanatome-react).
The npm package contains loader code and TypeScript types, not growing GLB
assets.

## Install

```bash
npm install @vixotic/vanatome-atlas @vixotic/vanatome-react \
  react react-dom three @react-three/fiber @react-three/drei
```

The Atlas package declares `@vixotic/vanatome-react` `^0.1.6` as a peer. Its
build checks the returned atlas object against the published viewer contract
without adding React or Three.js to the Atlas runtime.

## Quick start

`createOfficialHumanAtlas()` uses the immutable public 1.4.0 catalog by
default. A custom URL can point to an exact mirror, another CDN, object store,
or static files shipped with your application.

```tsx
import { useEffect, useState } from "react";
import {
  AtlasLoaderError,
  createOfficialHumanAtlas,
  type VanatomeViewerAtlas,
} from "@vixotic/vanatome-atlas";
import { VanatomeViewer } from "@vixotic/vanatome-react";

const humanAtlas = createOfficialHumanAtlas();

export function CardiovascularAtlas() {
  const [atlas, setAtlas] = useState<VanatomeViewerAtlas | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    humanAtlas
      .loadSystem("cardiovascular", { signal: controller.signal })
      .then((bundle) => setAtlas(bundle.atlas))
      .catch((reason) => {
        if (
          !(reason instanceof AtlasLoaderError) ||
          reason.code !== "aborted"
        ) {
          setError(
            reason instanceof Error ? reason : new Error("Atlas unavailable"),
          );
        }
      });
    return () => controller.abort();
  }, []);

  if (error) return <p>Atlas unavailable: {error.message}</p>;
  if (!atlas) return <p>Loading anatomy…</p>;
  return <VanatomeViewer atlas={atlas} />;
}
```

`bundle.atlas` is structurally compatible with the viewer package's
`VanatomeAtlas` type. The loader has no React, Three.js, or Node.js runtime
dependency.

The request above downloads catalog JSON, cardiovascular metadata, and the
cardiovascular GLB—not the other ten system models. The GLB request begins
when `VanatomeViewer` renders the returned atlas.

## Loading state

Subscribe when the host needs progress UI:

```ts
const unsubscribe = humanAtlas.subscribe((state) => {
  switch (state.status) {
    case "loading-catalog":
    case "loading-bundle":
      showSpinner();
      break;
    case "error":
      showError(state.error);
      break;
    case "ready":
      showAtlas(state.bundle.atlas);
  }
});
```

States are `idle`, `loading-catalog`, `catalog-ready`, `loading-bundle`,
`ready`, and `error`. Errors include stable codes for network failures,
invalid catalogs/metadata, missing or ambiguous systems, and cancellation.
Calling a load method again provides an explicit retry path.

## Selective system loading

`loadSystem("nervous")` resolves the catalog, follows the system's explicit
`bundleId`, and fetches only that bundle's metadata. The viewer fetches that
system GLB only after its atlas object is rendered. Metadata and loaded bundles
are cached by the loader, so repeated loads do not fetch metadata again.

Legacy catalogs without explicit mappings retain the original lookup behavior:
the loader scans bundle `systems` and requires exactly one match. This keeps the
published `1.1.0` catalog compatible.

```ts
import { createOfficialHumanAtlas } from "@vixotic/vanatome-atlas";

const humanAtlas = createOfficialHumanAtlas();
const { atlas } = await humanAtlas.loadSystem("digestive");
```

For a user-selected set, `loadSystems()` fetches only those systems' metadata
with bounded concurrency and returns viewer-ready atlases in the requested
order. Repeated IDs and shared bundles are deduplicated.

```tsx
const selection = await humanAtlas.loadSystems(
  ["cardiovascular", "respiratory"],
  { concurrency: 3 },
);

return (
  <VanatomeViewer
    atlases={selection.atlases}
    visibleLayers={selection.systemIds}
    incrementalLoadingFallback={<span>Adding anatomy…</span>}
  />
);
```

Keep one loader instance for the session. Its catalog, bundle metadata, and
in-flight requests are shared, so adding a system does not refetch retained
metadata. The viewer separately caches and retains the mounted GLBs.

The official release exposes `cardiovascular`, `digestive`, `endocrine`,
`lymphatic`, `muscular`, `nervous`, `regional-anatomy`, `reproductive`,
`respiratory`, `skeletal`, and `urinary` systems. Read `catalog.systems` instead
of hard-coding this list when building system pickers.

## Full-body profiles

System bundles are delivery units; the full-body profile is the cumulative
superset. Release assembly produces and validates full body first, then derives
each system GLB from those exact nodes. New converted batches must therefore be
part of full body before they can appear in a system bundle.

```ts
const humanAtlas = createOfficialHumanAtlas();
const cardiovascular = await humanAtlas.loadSystem("cardiovascular");
const fullBody = await humanAtlas.loadProfile("full-body");
```

The `1.4.0` release contains eleven independently loadable system GLBs and a
`full-body` profile. Its system node counts sum to the same 984 nodes declared
by the full-body bundle. Full body additionally preserves cross-system and
regional context.

| Load target | Mapped nodes | GLB size |
| --- | ---: | ---: |
| Cardiovascular | 64 | 7.6 MiB |
| Digestive | 12 | 5.5 MiB |
| Endocrine | 10 | 3.3 MiB |
| Lymphatic | 54 | 3.7 MiB |
| Muscular | 170 | 10.2 MiB |
| Nervous | 234 | 10.8 MiB |
| Regional anatomy | 236 | 6.0 MiB |
| Reproductive | 14 | 3.4 MiB |
| Respiratory | 6 | 4.0 MiB |
| Skeletal | 181 | 3.7 MiB |
| Urinary | 3 | 3.3 MiB |
| Full body | 984 | 30.4 MiB |

Sizes are the immutable 1.4.0 artifacts and may change in a later atlas
release.

## Loader API

| Method | Result |
| --- | --- |
| `loadCatalog(options?)` | Validates and caches the release catalog. |
| `loadSystem(systemId, options?)` | Loads metadata for one system bundle. |
| `loadSystems(systemIds, options?)` | Loads a deduplicated system collection with bounded concurrency. |
| `loadProfile(profileId?, options?)` | Loads a named profile or the catalog default. |
| `loadBundle(bundleId, options?)` | Loads metadata for an exact delivery bundle. |
| `subscribe(listener)` | Reports loader state changes; returns an unsubscribe function. |
| `getState()` | Returns the current loader state synchronously. |

Every load method accepts `{ signal }` for cancellation. `loadSystems` also
accepts `concurrency` (default `3`). Catalog and bundle
metadata are cached by loader instance; create a new loader when the catalog
URL or release identity changes.

Use `loadSystem` for one system, `loadSystems` for a proportional multi-system
selection, `loadProfile` for a product-defined experience such as full body,
and `loadBundle` only when the application already knows a catalog bundle ID.
For a hybrid picker, ordinary selections should use `loadSystems`; an explicit
“All” action should use the optimized `full-body` profile.

## Custom and self-hosted catalogs

Use `createAtlasLoader` for a different atlas identity:

```ts
import { createAtlasLoader } from "@vixotic/vanatome-atlas";

const customAtlas = createAtlasLoader({
  catalogUrl: "https://cdn.example.com/anatomy/2.0.0/catalog.json",
  expectedAtlas: {
    id: "example-human",
    version: "2.0.0",
  },
});
```

Use `createOfficialHumanAtlas({ catalogUrl })` only for a mirror of the exact
official release; it validates the official ID, version, and build ID.
`createDemoHumanAtlas()` is intended for the Vanatome repository's checked-in
development fixture.

After assembling and validating a canonical full-body release, regenerate its
delivery bundles with:

```bash
npm run atlas:distribute
```

Distribution fails unless the generated system files are an exact node and
anatomy-ID partition of full body.

## Self-hosting

Copy a versioned directory to static hosting and keep released files immutable:

```text
public/
├── ATTRIBUTION.txt
├── releases/1.4.0/
│   ├── catalog.json
│   ├── cardiovascular.metadata.json
│   ├── respiratory.metadata.json
│   └── full-body.metadata.json
└── models/
    ├── z-anatomy-1.4.0-cardiovascular.glb
    ├── z-anatomy-1.4.0-respiratory.glb
    └── z-anatomy-1.4.0-full-body.glb
```

Catalog URLs are resolved relative to the fetched `catalog.json`, so the whole
directory can move without rewriting internal paths. Serve JSON and GLB files
with the correct content types and configure CORS when assets use another
origin. A service worker or normal static-site packaging can make the same
directory available offline; no Vanatome backend, account, or analytics service
is required.

Recommended response headers:

| File | Content type | Cache policy |
| --- | --- | --- |
| `*.json` | `application/json` | Long-lived and immutable for versioned releases |
| `*.glb` | `model/gltf-binary` | Long-lived and immutable for versioned releases |
| `ATTRIBUTION.txt` | `text/plain; charset=utf-8` | Revalidate when attribution changes |

Each structure ID is a public compatibility key used by glTF
`extras.anatomyId`, selection state, URLs, and saved views. Keep IDs stable
across compatible releases. Metadata includes `kind`, `parentId`, system,
layer, selectable state, and mapped-node counts. The loader rejects missing
parents, cycles, release build mismatches, or node-count drift before returning
an atlas to the viewer.

## Licensing

Package code is MIT-licensed. Z-Anatomy-derived catalogs, metadata, and GLBs are
separate CC BY-SA 4.0 data artifacts. Preserve catalog provenance, attribution,
modification notices, and applicable ShareAlike terms when redistributing or
self-hosting them. See [ASSET-LICENSE.md](ASSET-LICENSE.md).

## Upgrading to 0.1.4

Version 0.1.4 keeps the catalog schema and existing loader methods backward
compatible. It adds `loadSystems()` for bounded, deduplicated collection
loading. The official default moves to the additive 1.4.0 atlas release with
intrinsic hand musculature, eleven system bundles, and a 984-node full-body
profile. Immutable older releases remain available to applications that pin an
exact catalog URL.
