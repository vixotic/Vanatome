# Vanatome atlas contract

A Vanatome atlas is a curated, versioned pair: one browser-ready glTF model and
one typed metadata registry. The viewer is intentionally designed for Vanatome
human anatomy data, not arbitrary uploaded 3D models.

## Metadata

Pass a `VanatomeAtlas` object to `VanatomeViewer`:

```ts
const atlas = {
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
      parentId: "cardiovascular-system",
      position: [0.16, 2.94, 0.17],
      summary: "A muscular organ behind the sternum."
    },
    {
      id: "heart-left-atrium",
      name: "Left atrium",
      system: "Cardiovascular",
      layer: "organs",
      parentId: "heart",
      position: [0.14, 2.96, 0.18]
    }
  ]
} satisfies VanatomeAtlas;
```

Structure IDs are stable public identifiers. Changing an ID is a breaking atlas
change because selections, URLs, saved views, and glTF nodes may refer to it.
Positions are model-space camera targets. `parentId` is optional and drives
recursive hierarchy views. A parent structure may have no mesh of its own: it
acts as an aggregate whose selection, focus, and isolation include all mapped
descendants.

## glTF

Every selectable mesh or one of its ancestors must contain this glTF `extras`
value:

```json
{
  "anatomyId": "heart-left-atrium",
  "anatomyParentId": "heart"
}
```

The ID must match a metadata structure ID. Meshes share an `anatomyId` only when
they represent the same selectable structure. Distinct anatomical parts receive
distinct stable IDs and retain their parent evidence in glTF extras and the
registry. Decorative meshes without a known selectable ID remain visible.
Layer, parent selection, and isolation operate across hierarchy descendants.

Serve the `.glb` from the same origin or with suitable CORS headers. Geometry,
materials, textures, and atlas metadata should be immutable for a released atlas
version.

## Licensing boundary

`@vixotic/vanatome-react` is viewer code. Atlas models and related metadata are data
artifacts with their own provenance and license notices. A distributor of a
Z-Anatomy-derived atlas should preserve attribution, identify modifications,
link to CC BY-SA 4.0, and apply its ShareAlike requirements to the adapted atlas
material. See the repository’s `ASSET-LICENSE.md`; consult the source licenses
for the authoritative terms.
