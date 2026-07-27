import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
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
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});
