# `@vixotic/vanatome-atlas`

Official human-anatomy catalog contracts and a browser-safe loader for
[`@vixotic/vanatome-react`](https://www.npmjs.com/package/@vixotic/vanatome-react).
The npm package contains loader code and TypeScript types, not growing GLB
assets.

## Install

```bash
npm install @vixotic/vanatome-atlas @vixotic/vanatome-react three @react-three/fiber @react-three/drei
```

Vanatome does not yet operate a public hosted atlas endpoint. Choose a catalog
URL you control; it can point at a CDN, object storage, or static files shipped
with your application.

```tsx
import { useEffect, useState } from "react";
import {
  AtlasLoaderError,
  createOfficialHumanAtlas,
  type VanatomeViewerAtlas,
} from "@vixotic/vanatome-atlas";
import { VanatomeViewer } from "@vixotic/vanatome-react";

const humanAtlas = createOfficialHumanAtlas({
  catalogUrl: "/vanatome-atlas/1.1.0/catalog.json",
});

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

`loadSystem("nervous")` resolves the catalog first, then fetches only the
metadata for the bundle that declares that system. The viewer fetches that
bundle's GLB only after its atlas object is rendered. A production catalog
should map each selectively loadable system to one bundle. Use
`loadBundle(bundleId)` for catalogs that intentionally split one system across
multiple bundles.

The repository demo uses one existing full-body compatibility bundle, so all
of its system lookups resolve to the same GLB. It demonstrates the catalog
contract but does not pretend to provide production system-level splitting:

```ts
import { createDemoHumanAtlas } from "@vixotic/vanatome-atlas";

const demo = createDemoHumanAtlas();
const { atlas } = await demo.loadSystem("digestive");
```

## Self-hosting

Copy a versioned directory to static hosting and keep released files immutable:

```text
public/vanatome-atlas/1.1.0/
├── catalog.json
├── cardiovascular.glb
├── cardiovascular.metadata.json
├── nervous.glb
└── nervous.metadata.json
```

Catalog URLs are resolved relative to the fetched `catalog.json`, so the whole
directory can move without rewriting internal paths. Serve JSON and GLB files
with the correct content types and configure CORS when assets use another
origin. A service worker or normal static-site packaging can make the same
directory available offline; no Vanatome backend, account, or analytics service
is required.

Each structure ID is a public compatibility key used by glTF
`extras.anatomyId`, selection state, URLs, and saved views. Keep IDs stable
across compatible releases. Metadata supports `parentId`, system, and layer
fields so hosts can build hierarchy and visibility controls.

## Licensing

Package code is MIT-licensed. Z-Anatomy-derived catalogs, metadata, and GLBs are
separate CC BY-SA 4.0 data artifacts. Preserve catalog provenance, attribution,
modification notices, and applicable ShareAlike terms when redistributing or
self-hosting them. See [ASSET-LICENSE.md](ASSET-LICENSE.md).
