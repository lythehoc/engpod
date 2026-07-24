import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import test from "node:test";

async function render() {
  const html = await readFile(
    new URL("../out/index.html", import.meta.url),
    "utf8",
  );
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
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
  assert.match(html, />Random<\/span>/);
  assert.doesNotMatch(html, /Surprise me|aria-label="Volume"|volume-control/);
  assert.match(html, /https:\/\/demo-user\.github\.io\/engpod\/og\.png/);
  assert.doesNotMatch(html, /\/engpod\/engpod\/og\.png/);
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
  assert.match(workflow, /actions\/checkout@v6/);
  assert.match(workflow, /actions\/setup-node@v6/);
  assert.match(workflow, /actions\/configure-pages@v6/);
  assert.match(workflow, /actions\/upload-pages-artifact@v5/);
  assert.match(workflow, /actions\/deploy-pages@v5/);
  assert.match(workflow, /node-version:\s*24/);
  assert.match(workflow, /path:\s*out/);
  assert.ok(socialCard.size > 100_000);
});

test("uses redundant HTTPS Internet Archive audio sources", async () => {
  const root = new URL("../", import.meta.url);
  const page = await readFile(new URL("app/page.tsx", root), "utf8");

  assert.match(page, /ia800408\.us\.archive\.org\/10\/items\/englishpod_all/);
  assert.match(page, /ia600408\.us\.archive\.org\/10\/items\/englishpod_all/);
  assert.doesNotMatch(page, /\/audio\/\$\{audioFileName\}/);
});

test("auto-plays selections and safely persists player preferences", async () => {
  const root = new URL("../", import.meta.url);
  const [page, styles, layout, workflow, dependabot] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL(".github/workflows/deploy.yml", root), "utf8"),
    readFile(new URL(".github/dependabot.yml", root), "utf8"),
  ]);

  assert.match(page, /autoplay = true/);
  assert.match(page, /englishpod:settings-v1/);
  assert.match(page, /groupByLevel/);
  assert.match(page, /selectedLevel/);
  assert.match(page, /transcriptVisible/);
  assert.match(page, /sanitizeTranscriptHtml\(html\)/);
  assert.match(page, /querySelector\("h1"\)\?\.remove\(\)/);
  assert.match(page, />Auto next</);
  assert.doesNotMatch(page, /Surprise me|volume-control/);
  assert.match(styles, /@media \(max-width: 660px\)/);
  assert.match(styles, /--player-height: 188px/);
  assert.match(styles, /\.transport button \{[\s\S]*?width: 44px;[\s\S]*?height: 44px;/);
  assert.match(styles, /\.player-options > button \{[\s\S]*?min-height: 44px;/);
  assert.match(layout, /Content-Security-Policy/);
  assert.doesNotMatch(workflow, /AUDIO_BASE_URL/);
  assert.match(dependabot, /package-ecosystem: npm/);
  assert.match(dependabot, /package-ecosystem: github-actions/);
});
