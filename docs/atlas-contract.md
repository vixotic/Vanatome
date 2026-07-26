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
      parentId: "thorax",
      position: [0.16, 2.94, 0.17],
      summary: "A muscular organ behind the sternum."
    }
  ]
} satisfies VanatomeAtlas;
```

Structure IDs are stable public identifiers. Changing an ID is a breaking atlas
change because selections, URLs, saved views, and glTF nodes may refer to it.
Positions are model-space camera targets. `parentId` is optional and drives
consumer-built hierarchy views.

## glTF

Every selectable mesh or one of its ancestors must contain this glTF `extras`
value:

```json
{ "anatomyId": "heart" }
```

The value must match a metadata structure ID. A structure may span multiple
meshes; all of them can share the same `anatomyId`. Decorative meshes without a
known ID remain visible but are not selectable. Layer and isolation controls
operate on identified structures.

Serve the `.glb` from the same origin or with suitable CORS headers. Geometry,
materials, textures, and atlas metadata should be immutable for a released atlas
version.

## Licensing boundary

`@vanatome/react` is viewer code. Atlas models and related metadata are data
artifacts with their own provenance and license notices. A distributor of a
Z-Anatomy-derived atlas should preserve attribution, identify modifications,
link to CC BY-SA 4.0, and apply its ShareAlike requirements to the adapted atlas
material. See the repository’s `ASSET-LICENSE.md`; consult the source licenses
for the authoritative terms.
