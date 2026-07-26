# `@vixotic/vanatome-react`

The embeddable Vanatome anatomy viewer for React. It renders curated Vanatome
glTF atlases and exposes the interaction state needed to build search,
hierarchy, layer, isolate, focus, and detail-panel experiences.

```bash
npm install @vixotic/vanatome-react three @react-three/fiber @react-three/drei
```

```tsx
import { VanatomeViewer, useVanatomeController } from "@vixotic/vanatome-react";
import atlas from "./atlas";

export function Anatomy() {
  const controls = useVanatomeController(["organs", "skeleton"]);

  return (
    <div style={{ height: 640 }}>
      <VanatomeViewer atlas={atlas} {...controls} onSelect={controls.select} />
    </div>
  );
}
```

The host application owns its interface and state. `VanatomeViewer` owns only
the 3D scene, so a product can compose its own sidebar, search, breadcrumbs,
layer controls, and structure details without fighting a bundled UI.

See the
[atlas contract](https://github.com/vixotic/Vanatome/blob/master/docs/atlas-contract.md)
for the atlas data and glTF requirements. Atlas files are distributed separately
and may carry different license obligations from this MIT-licensed viewer code.
