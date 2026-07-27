import assert from "node:assert/strict";
import test from "node:test";

import {
  assertConfig,
  canonicalJson,
  parseGlbJson,
  sha256,
  stablePartId,
} from "../lib.mjs";
import { mergeComponentGroups, registryFor } from "../release-lib.mjs";

function syntheticGlb(json) {
  const payload = Buffer.from(JSON.stringify(json));
  const paddedLength = Math.ceil(payload.length / 4) * 4;
  const buffer = Buffer.alloc(20 + paddedLength, 0x20);
  buffer.write("glTF", 0);
  buffer.writeUInt32LE(2, 4);
  buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(paddedLength, 12);
  buffer.writeUInt32LE(0x4e4f534a, 16);
  payload.copy(buffer, 20);
  return buffer;
}

test("canonical JSON and fingerprints ignore object key insertion order", () => {
  assert.equal(canonicalJson({ b: 2, a: { d: 4, c: 3 } }), '{"a":{"c":3,"d":4},"b":2}');
  assert.equal(sha256(canonicalJson({ b: 2, a: 1 })), sha256(canonicalJson({ a: 1, b: 2 })));
});

test("GLB parser reads anatomy extras from the JSON chunk", () => {
  const json = { asset: { version: "2.0" }, nodes: [{ name: "heart__Left atrium", extras: { anatomyId: "heart" } }] };
  assert.deepEqual(parseGlbJson(syntheticGlb(json)), json);
});

test("config validation rejects duplicate anatomy IDs", () => {
  const config = {
    schemaVersion: 1,
    batches: {
      duplicate: {
        groups: [
          { id: "heart", system: "cardiovascular", sourceObjects: ["Left atrium"] },
          { id: "heart", system: "cardiovascular", sourceObjects: ["Right atrium"] },
        ],
      },
    },
  };
  assert.throws(() => assertConfig(config, "duplicate"), /anatomy IDs must be unique/u);
});

test("release composition rejects anatomy IDs shared by component batches", () => {
  const group = {
    system: "nervous",
    sourceObjects: ["Pons.l"],
    nodes: ["brainstem__Pons.l"],
  };
  assert.throws(
    () => mergeComponentGroups([
      { groups: { brainstem: group } },
      { groups: { brainstem: group } },
    ]),
    /duplicate anatomy ID across batches: brainstem/u,
  );
});

test("release registry is derived from stable group metadata", () => {
  const registry = registryFor(
    { atlas: { id: "z-anatomy", version: "1.1.0" } },
    "demo-1.1.0",
    "build-1",
    {
      brainstem: {
        system: "nervous",
        centerBlender: [1, 2, 3],
        nodes: ["brainstem__Pons.l", "brainstem__Pons.r"],
      },
    },
  );
  assert.deepEqual(registry.structures[1], {
    id: "brainstem",
    name: "brainstem",
    kind: "organ",
    parentId: null,
    system: "nervous",
    selectable: true,
    position: [7, 14.9, -14],
    objectCount: 2,
  });
});

test("source-derived part IDs preserve laterality deterministically", () => {
  assert.equal(stablePartId("kidneys", "Kidney.l"), "kidneys-kidney-left");
  assert.equal(
    stablePartId("brainstem", "Medulla oblongata.r"),
    "brainstem-medulla-oblongata-right",
  );
});
