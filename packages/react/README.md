# `@vixotic/vanatome-react`

The embeddable Vanatome anatomy viewer for React. It renders curated Vanatome
glTF atlases and exposes the interaction state needed to build search,
hierarchy, layer, isolate, focus, and detail-panel experiences.

## Install

```bash
npm install @vixotic/vanatome-react react three \
  @react-three/fiber @react-three/drei
```

React 19, React Three Fiber 9, Drei 10, and Three.js 0.180 or newer are peer
dependencies. The package is ESM-only and includes TypeScript declarations.

## Quick start

```tsx
import { VanatomeViewer, useVanatomeController } from "@vixotic/vanatome-react";
import atlas from "./atlas";

export function Anatomy() {
  const viewer = useVanatomeController(["organs", "skeleton"]);

  return (
    <div style={{ height: 640 }}>
      <VanatomeViewer
        atlas={atlas}
        selectedId={viewer.selectedId}
        isolation={viewer.isolation}
        visibleLayers={viewer.visibleLayers}
        focusRequestKey={viewer.focusRequestKey}
        resetViewKey={viewer.resetViewKey}
        onSelect={viewer.select}
        onEscape={viewer.clear}
        enablePan
      />
    </div>
  );
}
```

The container must have a non-zero height. `atlas` is a `VanatomeAtlas` object
whose `modelUrl` points to a GLB and whose structures map stable anatomy IDs to
glTF nodes. The companion
[`@vixotic/vanatome-atlas`](https://www.npmjs.com/package/@vixotic/vanatome-atlas)
package loads the official hosted release and returns this object directly.

The host application owns its interface and state. `VanatomeViewer` owns only
the 3D scene, so a product can compose its own sidebar, search, breadcrumbs,
layer controls, and structure details without fighting a bundled UI.

## The atlas contract

Every selectable glTF node needs `extras.anatomyId`; distributed system models
also use `extras.anatomySystem`. Structure IDs must match the metadata and stay
stable if applications persist selections in URLs or saved views.

```ts
import type { VanatomeAtlas } from "@vixotic/vanatome-react";

const atlas: VanatomeAtlas = {
  id: "example-human",
  name: "Example human atlas",
  version: "1.0.0",
  modelUrl: new URL("./human.glb", import.meta.url).href,
  attribution: "Example anatomy source",
  structures: [
    {
      id: "heart",
      name: "Heart",
      kind: "organ",
      system: "cardiovascular",
      layer: "cardiovascular",
      position: [0, 1.2, 0],
    },
  ],
};
```

`position` is a fallback focus point. When mapped geometry is present, focus
uses the actual visible bounds. See the repository's
[atlas contract](https://github.com/vixotic/Vanatome/blob/master/docs/atlas-contract.md)
for hierarchy, validation, and glTF details.

## Viewer behavior

The scene resolves interaction in a predictable order:

1. `visibleLayers` filters atlas structures.
2. `isolation` or legacy `isolatedId` chooses an isolation boundary.
3. `hiddenIds` removes structures and their descendants.
4. Hover and selection styles apply to the geometry that remains.

An empty `visibleLayers` array means “show every layer” for compatibility with
the initial package releases. Structures with `selectable: false`, hidden
structures, and filtered structures do not emit hover or selection events.
Dragging rotates the model without committing a selection; click or tap selects,
and clicking empty space clears selection. Use `alwaysVisibleIds` for
non-interactive spatial context that should bypass layer filters; explicit
hiding and isolation still take precedence.

```tsx
<VanatomeViewer
  atlas={atlas}
  selectedId={selectedId}
  isolatedId={isolatedId}
  alwaysVisibleIds={["body-shell"]}
  hiddenIds={["body-shell"]}
  displayMode="xray"
  onHover={setHoveredId}
  onSelect={setSelectedId}
  onEscape={() => {
    setSelectedId(null);
    setIsolatedId(null);
  }}
/>
```

Display modes are `normal`, `xray`, and `ghost`. The official body shell and
skeleton appearance remains the default; use `appearance` to change their IDs,
opacities, highlight intensities, or selection pulse without reaching into the
Three.js scene.

### Layers and multi-system views

Pass all active system or layer IDs in `visibleLayers`. The viewer renders
their union, so a host can implement single-select, multi-select, or presets
without changing the scene component.

```tsx
const viewer = useVanatomeController([
  "cardiovascular",
  "respiratory",
]);

viewer.toggleLayer("skeletal");
viewer.setVisibleLayers(["cardiovascular", "skeletal"]);
```

An empty array intentionally means “all layers” for compatibility. If the host
needs a “none selected” state, do not mount the viewer or hide the canvas.

### Isolation modes

`useVanatomeController().isolate(id, mode)` supports:

- `selected`: only the selected structure and its descendants.
- `parent`: the selected structure inside its complete direct-parent subtree.
- `parent-context`: the selected subtree stays solid while the rest of its
  direct-parent subtree becomes translucent.

The controller exposes the resulting `isolation` object and retains
`isolatedId` as a compatibility alias. Passing only `isolatedId` to the viewer
continues to use `selected` mode.

The published `VanatomeController` contract remains compatible with `0.1.3`.
`useVanatomeController` returns the additive `VanatomeControllerState` type,
which includes `isolation`, multi-mode `isolate`, and `clear`.

The package remains headless. Use `onStructureContextMenu` to render product
actions without coupling a menu design to the canvas:

```tsx
<VanatomeViewer
  atlas={atlas}
  isolation={controls.isolation}
  onStructureContextMenu={({ id, clientX, clientY }) => {
    openStructureMenu({ id, clientX, clientY });
  }}
/>
```

Right-clicking without dragging emits the event. A right-drag remains available
for panning when `enablePan` is set; two-finger touch gestures provide the
corresponding pan/zoom behavior. Shift+F10 or the Context Menu key opens the
host menu for the current selection.

## Camera behavior

Focus requests frame the visible geometry for the selected structure and its
descendants. The viewer preserves the current viewing direction, accounts for
the canvas aspect ratio, and cancels its animation as soon as the user starts
orbiting.

```tsx
<VanatomeViewer
  atlas={atlas}
  selectedId={selectedId}
  focusRequestKey={focusRequestKey}
  focusPadding={1.3}
  focusDistance={2}
  cameraAnimationDuration={550}
  enablePan
  onFocusRejected={(id, reason) => {
    console.warn(`Could not focus ${id}: ${reason}`);
  }}
  onCameraChange={(view) => saveView(view)}
/>
```

`focusDistance` is the minimum focus distance retained for compatibility; large
structures automatically move the camera farther away. Set
`cameraAnimationDuration={0}` for immediate movement. Animated focus and reset
automatically become immediate when the user prefers reduced motion unless
`respectReducedMotion={false}` is supplied.

## Loading and recovery

The atlas loader resolves catalog metadata. The viewer separately owns the GLB
request and reports its lifecycle:

```tsx
<VanatomeViewer
  atlas={atlas}
  loadingFallback={<p>Loading geometry…</p>}
  errorFallback={(error) => <p>{error.message}</p>}
  onLoadStart={(modelUrl) => console.info("Loading", modelUrl)}
  onLoadProgress={({ percentage }) => setProgress(percentage)}
  onReady={() => setSceneReady(true)}
  onError={(error) => reportViewerError(error)}
/>
```

Model failures and WebGL context loss use stable error codes. Replacing
`atlas.modelUrl` resets the lifecycle and prevents the previous model's state
from being presented as the new scene.

The focusable viewer wrapper is labelled “Interactive 3D anatomy viewer” by
default; override `ariaLabel` for a more specific host context. Mouse orbit,
wheel zoom, one-finger orbit, pinch zoom, Escape, and reduced-motion behavior
are built in. Hierarchy keyboard navigation remains the host application's
responsibility.

## Controller actions

`useVanatomeController(initialLayers?)` returns controlled viewer state plus
these actions:

| Action | Effect |
| --- | --- |
| `select(id)` | Selects a structure and requests focus. Pass `null` to clear selection. |
| `focus(id?)` | Requests another focus animation, optionally changing selection. |
| `isolate(id?, mode?)` | Applies `selected`, `parent`, or `parent-context` isolation. |
| `clear()` | Clears selection and isolation without changing the camera or layers. |
| `reset()` | Clears selection/isolation, restores initial layers, and resets the camera. |
| `setVisibleLayers(ids)` | Replaces the visible layer union. |
| `toggleLayer(id)` | Adds or removes one layer. |

## Viewer props

The main prop groups are:

| Group | Props |
| --- | --- |
| Data | `atlas` |
| Selection | `selectedId`, `hoveredId`, `onSelect`, `onHover` |
| Visibility | `visibleLayers`, `alwaysVisibleIds`, `hiddenIds`, `displayMode` |
| Isolation | `isolation`, compatibility alias `isolatedId` |
| Camera | `focusRequestKey`, `resetViewKey`, `focusPadding`, `focusDistance`, `cameraAnimationDuration`, `enablePan`, `minDistance`, `maxDistance` |
| Lifecycle | `onLoadStart`, `onLoadProgress`, `onReady`, `onError`, `loadingFallback`, `errorFallback` |
| Interaction | `onStructureContextMenu`, `onEscape`, `onCameraChange`, `onInteractionStart`, `onInteractionEnd` |
| Presentation | `appearance`, `className`, `style`, `ariaLabel`, `modelScale`, `modelPosition` |

All callbacks and props are optional except `atlas`. Import
`VanatomeViewerProps`, `VanatomeViewerAppearance`, and the event/state types
from the package for exact signatures.

## Upgrading from 0.1.3

Version 0.1.4 is backward compatible with the 0.1.3 public contract.
`isolatedId` continues to isolate a selected subtree, the original
`VanatomeController` type remains unchanged, and an empty `visibleLayers`
array still displays all layers. Pan, context-menu events, multi-mode
isolation, appearance controls, camera events, and `VanatomeControllerState`
are additive.

## Licensing

Viewer code is MIT-licensed. Atlas files are distributed separately and may
carry different attribution and ShareAlike obligations. Preserve the
attribution supplied by the loaded atlas.
