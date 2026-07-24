import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
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

test("renders the finished engpod library", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>engpod — listen, read, repeat<\/title>/i);
  assert.match(html, /engpod/);
  assert.match(html, /Cut In Line/);
  assert.match(html, /Search title, level, or number/);
  assert.match(html, /Shuffle/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("ships all episodes, transcripts, and the GitHub Pages workflow", async () => {
  const root = new URL("../", import.meta.url);
  const [catalog, transcriptNames, workflow, socialCard] = await Promise.all([
    readFile(new URL("app/data/episodes.json", root), "utf8"),
    readdir(new URL("public/transcripts/", root)),
    readFile(new URL(".github/workflows/deploy.yml", root), "utf8"),
    stat(new URL("public/og.png", root)),
  ]);

  const episodes = JSON.parse(catalog);
  assert.equal(episodes.length, 365);
  assert.equal(transcriptNames.filter((name) => name.endsWith(".html")).length, 365);
  assert.ok(episodes.every((episode) => episode.mp3 && episode.transcript_id));
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /path:\s*dist\/client/);
  assert.ok(socialCard.size > 100_000);
});

test("prefers the optional self-hosted audio library", async () => {
  const root = new URL("../", import.meta.url);
  const [page, downloader, audioNames] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("scripts/download-audio.mjs", root), "utf8"),
    readdir(new URL("public/audio/", root)),
  ]);

  assert.match(page, /\/audio\/\$\{audioFileName\}/);
  assert.match(page, /ia800408\.us\.archive\.org\/10\/items\/englishpod_all/);
  assert.match(page, /ia600408\.us\.archive\.org\/10\/items\/englishpod_all/);
  assert.match(downloader, /All \$\{episodes\.length\} episodes are available/);
  assert.equal(audioNames.filter((name) => name.endsWith(".mp3")).length, 365);
  assert.equal(audioNames.filter((name) => name.endsWith(".part")).length, 0);
});

test("auto-plays selections and safely persists player preferences", async () => {
  const root = new URL("../", import.meta.url);
  const [page, layout, headers, workflow, dependabot] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("public/_headers", root), "utf8"),
    readFile(new URL(".github/workflows/deploy.yml", root), "utf8"),
    readFile(new URL(".github/dependabot.yml", root), "utf8"),
  ]);

  assert.match(page, /autoplay = true/);
  assert.match(page, /englishpod:settings-v1/);
  assert.match(page, /groupByLevel/);
  assert.match(page, /selectedLevel/);
  assert.match(page, /transcriptVisible/);
  assert.match(page, /sanitizeTranscriptHtml\(html\)/);
  assert.match(layout, /Content-Security-Policy/);
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.match(workflow, /vars\.AUDIO_BASE_URL/);
  assert.match(page, /NEXT_PUBLIC_PREFER_LOCAL_AUDIO/);
  assert.match(dependabot, /package-ecosystem: npm/);
  assert.match(dependabot, /package-ecosystem: github-actions/);
});
