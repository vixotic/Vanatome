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

test("server-renders the anatomy explorer shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Vanatome \/\/ Human Anatomy Explorer<\/title>/i);
  assert.match(html, /Vanatome/);
  assert.match(html, /Search anatomy/);
  assert.match(html, /Anatomy layers/);
  assert.match(html, /HIERARCHY/);
  assert.match(html, /Head/);
  assert.match(html, /Thorax/);
  assert.match(html, /Abdomen/);
  assert.match(html, /Pelvis/);
  assert.match(html, /Interactive 3D human anatomy model/);
  assert.match(html, /No structure selected/);
  assert.match(html, /Educational visualization/);
  assert.match(html, /Nervous/);
  assert.match(html, />349</);
  assert.match(html, /MAPPED NODES/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});
