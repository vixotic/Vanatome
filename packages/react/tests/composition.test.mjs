import assert from "node:assert/strict";
import test from "node:test";

import {
  composeVanatomeAtlases,
  resolveVanatomeAtlasSources,
} from "../dist/index.js";

function atlas(id, modelUrl, structures, options = {}) {
  return {
    id,
    name: id,
    version: options.version ?? "1.3.0",
    buildId: options.buildId ?? "release-build",
    modelUrl,
    structures,
    attribution: "Fixture",
  };
}

const heart = {
  id: "heart",
  name: "Heart",
  system: "cardiovascular",
  layer: "cardiovascular",
  position: [0, 0, 0],
};
const lungs = {
  id: "lungs",
  name: "Lungs",
  system: "respiratory",
  layer: "respiratory",
  position: [0, 0, 0],
};

test("composes independent atlas models in source order", () => {
  const composition = composeVanatomeAtlases([
    atlas("cardio", "/cardio.glb", [heart]),
    atlas("respiratory", "/respiratory.glb", [lungs]),
  ]);

  assert.deepEqual(composition.modelUrls, [
    "/cardio.glb",
    "/respiratory.glb",
  ]);
  assert.deepEqual(
    composition.structures.map((structure) => structure.id),
    ["heart", "lungs"],
  );
});

test("deduplicates repeated references to the same model", () => {
  const cardio = atlas("cardio", "/cardio.glb", [heart]);
  const composition = composeVanatomeAtlases([cardio, cardio]);

  assert.equal(composition.atlases.length, 1);
  assert.deepEqual(composition.modelUrls, ["/cardio.glb"]);
});

test("rejects incompatible releases and duplicate anatomy IDs", () => {
  assert.throws(
    () => composeVanatomeAtlases([
      atlas("cardio", "/cardio.glb", [heart]),
      atlas("respiratory", "/respiratory.glb", [lungs], {
        version: "2.0.0",
      }),
    ]),
    /Cannot compose atlas versions/,
  );
  assert.throws(
    () => composeVanatomeAtlases([
      {
        ...atlas("legacy", "/legacy.glb", [heart]),
        buildId: undefined,
      },
      atlas("cardio", "/cardio.glb", [heart], { buildId: "build-one" }),
      atlas("respiratory", "/respiratory.glb", [lungs], {
        buildId: "build-two",
      }),
    ]),
    /Cannot compose atlas builds/,
  );
  assert.throws(
    () => composeVanatomeAtlases([
      atlas("cardio", "/cardio.glb", [heart]),
      atlas("duplicate", "/duplicate.glb", [heart]),
    ]),
    /duplicated across composed atlas models/,
  );
});

test("requires exactly one non-empty source prop", () => {
  const cardio = atlas("cardio", "/cardio.glb", [heart]);
  assert.throws(() => resolveVanatomeAtlasSources({}), /at least one/);
  assert.throws(
    () => resolveVanatomeAtlasSources({ atlas: cardio, atlases: [cardio] }),
    /either `atlas` or `atlases`/,
  );
});
