<div align="center">

<img src="public/favicon.svg" alt="Vanatome" width="76" height="76">

# Vanatome

**Explore human anatomy as an interactive, layered system.**

A focused anatomy product and embeddable React viewer powered by a curated,
Z-Anatomy-derived atlas.

[Quick start](#quick-start) · [Viewer package](#embed-vanatome) ·
[Atlas contract](docs/atlas-contract.md) · [Contributing](CONTRIBUTING.md)

</div>

---

Vanatome turns a browser-ready human atlas into an interface for discovery:
select a structure in the model or sidebar, move the camera into focus, isolate
what matters, and move through anatomical systems without losing context. It is
static and frontend-friendly—no backend, account, analytics service, or paid
platform is required.

## See anatomy in context

| Explore | Understand | Embed |
| --- | --- | --- |
| Rotate, zoom, select, focus, isolate, and reset the atlas. | Search structures, navigate hierarchy, filter layers, and pair the model with concise details. | Compose the headless React scene with your own sidebar, controls, and content. |

The product demo presents the atlas as a full-screen systems console with a
structure browser, responsive detail panel, direct model picking, focus
transitions, and a persistent spatial overview.

## Quick start

Vanatome requires Node.js 22.13 or newer.

```bash
git clone https://github.com/vixotic/Vanatome.git
cd Vanatome
npm install
npm run dev
```

Open the local address printed by the development server. To validate a
production build:

```bash
npm test
```

## Embed Vanatome

The React package is prepared for npm as `@vixotic/vanatome-react`.

After the first public release, install it with:

```bash
npm install @vixotic/vanatome-react three @react-three/fiber @react-three/drei
```

```tsx
import {
  VanatomeViewer,
  useVanatomeController,
  type VanatomeAtlas,
} from "@vixotic/vanatome-react";

const atlas: VanatomeAtlas = {
  id: "vanatome-human",
  name: "Vanatome Human Atlas",
  version: "1.0.0",
  modelUrl: "/models/vanatome-human.glb",
  attribution: "Z-Anatomy contributors, CC BY-SA 4.0",
  structures: [
    {
      id: "heart",
      name: "Heart",
      system: "Cardiovascular",
      layer: "organs",
      position: [0.16, 2.94, 0.17],
    },
  ],
};

export function AnatomyView() {
  const viewer = useVanatomeController(["organs", "skeleton"]);

  return (
    <div style={{ height: 640 }}>
      <VanatomeViewer
        atlas={atlas}
        selectedId={viewer.selectedId}
        isolatedId={viewer.isolatedId}
        visibleLayers={viewer.visibleLayers}
        focusRequestKey={viewer.focusRequestKey}
        resetViewKey={viewer.resetViewKey}
        onSelect={viewer.select}
      />
    </div>
  );
}
```

The host owns navigation and UI state; the package owns the 3D scene. This keeps
search, breadcrumbs, hierarchy, layer switches, isolate/reset controls, and
sidebar content fully composable. See the [atlas contract](docs/atlas-contract.md)
for required metadata and glTF `anatomyId` extras.

## Interaction guide

- Drag to orbit and scroll or pinch to zoom.
- Choose a named structure in the model or structure browser to select it.
- Focus moves the camera to the selected structure; manual camera movement
  cancels the transition.
- Isolate hides other identified structures. Reset restores the overview.
- Layer controls can reveal systems independently while the hierarchy preserves
  anatomical context.

## Atlas capabilities

Vanatome’s current atlas foundation covers a complete external body shell,
torso skeleton structures, and major cardiovascular, respiratory, digestive,
and urinary structures. The product architecture supports:

- richer skeletal and muscular layer navigation;
- nervous, vascular, lymphatic, and reproductive system layers;
- deeper regional hierarchy and structure-to-structure navigation;
- versioned atlas bundles with stable public structure identifiers;
- accessible annotations and education-focused structure content.

Vanatome is an educational visualization, not a diagnostic tool or a substitute
for professional medical guidance.

## Architecture for consumers

`@vixotic/vanatome-react` exports:

- `VanatomeViewer`, a controlled React Three Fiber scene;
- `useVanatomeController`, state helpers for select, focus, isolate, layer, and
  reset interactions;
- hierarchy utilities for sidebar and breadcrumb experiences;
- TypeScript contracts for atlases, structures, vectors, and viewer props.

The package is browser-only at render time, has no Next.js dependency, and loads
static glTF assets from a URL supplied by the host.

The Vanatome product demo consumes this same package through the repository
workspace. Its production build and interaction surface act as the reference
integration for selection, focus, isolation, reset, hierarchy, and layers.

## Licensing and attribution

Viewer source code is available under the [MIT License](LICENSE).

The included atlas files are adapted from
[Z-Anatomy](https://github.com/Z-Anatomy/Models), credited to Gauthier Kervyn,
Marcin Zielinski, additional Z-Anatomy contributors, and documented upstream
sources. Z-Anatomy-derived atlas material is subject to
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) and is not
relicensed under MIT. Preserve attribution, indicate modifications, and follow
the applicable ShareAlike terms when redistributing adapted atlas material.
See [ASSET-LICENSE.md](ASSET-LICENSE.md) and
[public/ATTRIBUTION.txt](public/ATTRIBUTION.txt) for the repository’s provenance
notes; the upstream licenses remain authoritative.

## Contributing

Contributions that improve the viewer, accessibility, anatomy navigation,
documentation, or atlas quality are welcome. Read
[CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request, and include
clear provenance for any proposed atlas material.
