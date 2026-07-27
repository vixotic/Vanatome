import assert from "node:assert/strict";
import test from "node:test";

async function render(pathname = "/", bindings = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
      ...bindings,
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the atlas loading shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Vanatome \/\/ Human Anatomy Explorer<\/title>/i);
  assert.match(html, /Vanatome/);
  assert.match(html, /ATLAS CONNECTING/);
  assert.match(html, /CURATED FULL-BODY RELEASE/);
  assert.match(html, /Loading atlas catalog/);
  assert.match(html, /versioned catalog and validated anatomy metadata/i);
  assert.match(html, /OPEN MODEL ATTRIBUTION/);
  assert.match(html, /href="\/ATTRIBUTION\.txt"/);
  assert.doesNotMatch(html, /react-loading-skeleton/i);
});

test("serves production atlas paths from the R2 binding", async () => {
  const requestedKeys = [];
  const response = await render("/releases/1.1.0/catalog.json", {
    ATLAS: {
      get: async (key) => {
        requestedKeys.push(key);
        return {
          body: JSON.stringify({ atlas: "vanatome-human" }),
          httpEtag: "\"atlas-etag\"",
          writeHttpMetadata(headers) {
            headers.set("Content-Type", "application/json");
            headers.set(
              "Cache-Control",
              "public, max-age=31536000, immutable",
            );
          },
        };
      },
    },
  });

  assert.deepEqual(requestedKeys, ["releases/1.1.0/catalog.json"]);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/json");
  assert.equal(response.headers.get("etag"), "\"atlas-etag\"");
  assert.deepEqual(await response.json(), { atlas: "vanatome-human" });
});
