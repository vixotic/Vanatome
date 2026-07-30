import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateFocusDistance,
  getRelatedStructureIds,
  isStructureSelectable,
  resolveStructureVisibility,
} from "../dist/sceneBehavior.js";

const structures = [
  {
    id: "body",
    name: "Body",
    system: "body",
    layer: "shell",
    selectable: false,
    position: [0, 0, 0],
  },
  {
    id: "digestive",
    name: "Digestive system",
    system: "digestive",
    layer: "organs",
    position: [0, 0, 0],
  },
  {
    id: "stomach",
    name: "Stomach",
    system: "digestive",
    layer: "organs",
    parentId: "digestive",
    position: [0, 0, 0],
  },
  {
    id: "stomach-wall",
    name: "Stomach wall",
    system: "digestive",
    layer: "details",
    parentId: "stomach",
    position: [0, 0, 0],
  },
  {
    id: "heart",
    name: "Heart",
    system: "cardiovascular",
    layer: "organs",
    position: [0, 0, 0],
  },
];

test("related IDs include an aggregate and all of its descendants", () => {
  assert.deepEqual(
    [...getRelatedStructureIds(structures, "digestive")].sort(),
    ["digestive", "stomach", "stomach-wall"],
  );
});

test("visibility applies layers, isolation, then recursive hidden IDs", () => {
  const visibility = resolveStructureVisibility(structures, {
    visibleLayers: ["organs", "details"],
    isolatedId: "digestive",
    hiddenIds: ["stomach"],
  });

  assert.deepEqual([...visibility.visible], ["digestive"]);
  assert.deepEqual(
    [...visibility.hidden].sort(),
    ["stomach", "stomach-wall"],
  );
  assert.deepEqual([...visibility.context], []);
});

test("an empty visible layer list preserves the existing show-all behavior", () => {
  const visibility = resolveStructureVisibility(structures, {
    visibleLayers: [],
  });

  assert.equal(visibility.visible.size, structures.length);
});

test("persistent context bypasses layers but not isolation or explicit hiding", () => {
  const normal = resolveStructureVisibility(structures, {
    visibleLayers: ["organs"],
    alwaysVisibleIds: ["body"],
  });
  const isolated = resolveStructureVisibility(structures, {
    visibleLayers: ["organs"],
    alwaysVisibleIds: ["body"],
    isolation: { id: "stomach", mode: "selected" },
  });
  const hidden = resolveStructureVisibility(structures, {
    visibleLayers: ["organs"],
    alwaysVisibleIds: ["body"],
    hiddenIds: ["body"],
  });

  assert.equal(normal.visible.has("body"), true);
  assert.equal(isolated.visible.has("body"), false);
  assert.equal(hidden.visible.has("body"), false);
});

test("parent isolation modes expose the parent subtree and mark ghost context", () => {
  const parent = resolveStructureVisibility(structures, {
    isolation: { id: "stomach", mode: "parent" },
  });
  const parentContext = resolveStructureVisibility(structures, {
    isolation: { id: "stomach", mode: "parent-context" },
  });

  assert.deepEqual(
    [...parent.visible].sort(),
    ["digestive", "stomach", "stomach-wall"],
  );
  assert.deepEqual([...parent.context], []);
  assert.deepEqual(
    [...parentContext.context],
    ["digestive"],
  );
  assert.equal(parentContext.context.has("stomach"), false);
  assert.equal(parentContext.context.has("stomach-wall"), false);
});

test("selection requires both atlas eligibility and current visibility", () => {
  const visible = new Set(["body", "heart"]);

  assert.equal(isStructureSelectable(structures[0], visible), false);
  assert.equal(isStructureSelectable(structures[4], visible), true);
  assert.equal(isStructureSelectable(structures[2], visible), false);
  assert.equal(isStructureSelectable(undefined, visible), false);
});

test("focus distance grows with geometry and respects the legacy minimum", () => {
  const small = calculateFocusDistance({
    radius: 0.1,
    verticalFovDegrees: 42,
    aspect: 16 / 9,
    padding: 1.25,
    minimumDistance: 2,
    minDistance: 1,
    maxDistance: 30,
  });
  const large = calculateFocusDistance({
    radius: 4,
    verticalFovDegrees: 42,
    aspect: 16 / 9,
    padding: 1.25,
    minimumDistance: 2,
    minDistance: 1,
    maxDistance: 30,
  });

  assert.equal(small, 2);
  assert.ok(large > small);
});

test("focus fitting accounts for narrow portrait viewports", () => {
  const landscape = calculateFocusDistance({
    radius: 2,
    verticalFovDegrees: 42,
    aspect: 16 / 9,
    padding: 1.25,
    minimumDistance: 0,
    minDistance: 1,
    maxDistance: 30,
  });
  const portrait = calculateFocusDistance({
    radius: 2,
    verticalFovDegrees: 42,
    aspect: 9 / 16,
    padding: 1.25,
    minimumDistance: 0,
    minDistance: 1,
    maxDistance: 30,
  });

  assert.ok(portrait > landscape);
});
