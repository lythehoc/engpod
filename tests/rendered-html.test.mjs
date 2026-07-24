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
  assert.match(html, /<title>engpod — small step every day<\/title>/i);
  assert.match(html, /small step every day/i);
  assert.doesNotMatch(html, /listen[. ]+read[. ]+repeat/i);
  assert.match(html, /engpod/);
  assert.match(html, /Cut In Line/);
  assert.match(html, /Search title, level, or number/);
  assert.match(html, />Random<\/span>/);
  assert.doesNotMatch(html, /Surprise me|aria-label="Volume"|volume-control/);
  assert.doesNotMatch(html, /NOW PLAYING|ARCHIVE AUDIO/);
  assert.match(html, /Open Elementary episodes/);
  assert.match(html, /https:\/\/demo-user\.github\.io\/engpod\/og\.png/);
  assert.doesNotMatch(html, /\/engpod\/engpod\/og\.png/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("ships all episodes, transcripts, and the GitHub Pages workflow", async () => {
  const root = new URL("../", import.meta.url);
  const [catalog, transcriptNames, workflow, socialCard, handwritingFont, fontLicense] =
    await Promise.all([
    readFile(new URL("app/data/episodes.json", root), "utf8"),
    readdir(new URL("public/transcripts/", root)),
    readFile(new URL(".github/workflows/deploy.yml", root), "utf8"),
    stat(new URL("public/og.png", root)),
    stat(new URL("app/fonts/PatrickHand-Regular.ttf", root)),
    stat(new URL("public/fonts/PatrickHand-OFL.txt", root)),
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
  assert.ok(handwritingFont.size > 100_000);
  assert.ok(fontLicense.size > 1_000);
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
  assert.match(page, /speaker-tone-\$\{\(speakerTones\.size % 6\) \+ 1\}/);
  assert.match(page, /closest\("\.line"\)\?\.classList\.add\(toneClass\)/);
  assert.match(styles, /\.line\.speaker-tone-1[\s\S]*?\.line\.speaker-tone-6/);
  assert.match(styles, /\.line \{[\s\S]*?border-radius: 14px;[\s\S]*?background:/);
  assert.match(page, />Auto next</);
  assert.doesNotMatch(page, /Surprise me|volume-control/);
  assert.equal(page.match(/small step every day/g)?.length, 1);
  assert.doesNotMatch(page, /Small steps, clear ears, confident English/);
  assert.doesNotMatch(page, /resumeNotice|setResumeNotice|Welcome back|Saved on this device/);
  assert.doesNotMatch(page, /Your episode, position, filters|Not affiliated with or endorsed/);
  assert.doesNotMatch(styles, /\.brand-row p/);
  assert.doesNotMatch(styles, /project-disclaimer/);
  assert.doesNotMatch(styles, /resume-note|radial-gradient/);
  assert.match(styles, /\.app-shell \{[\s\S]*?background: var\(--bg\);/);
  assert.match(styles, /--accent: #167d73/);
  assert.match(styles, /--accent: #168f82/);
  assert.doesNotMatch(styles, /#e85d3f|#ff7657|#c94229|#ff9178|#f9d9cc|#3b211c/);
  assert.match(styles, /@media \(max-width: 660px\)/);
  assert.match(styles, /--player-height: 160px/);
  assert.match(styles, /grid-template-columns: 34px minmax\(0, 1fr\) 34px/);
  assert.match(styles, /\.progress-time:last-child \{[\s\S]*?text-align: right;/);
  assert.match(styles, /\.transport button \{[\s\S]*?width: 50px;[\s\S]*?height: 50px;/);
  assert.match(styles, /\.transport \.play-button \{[\s\S]*?width: 68px;[\s\S]*?height: 68px;/);
  assert.match(styles, /\.transport \.play-button \{[\s\S]*?box-shadow: none;/);
  assert.match(styles, /\.player-options > button \{[\s\S]*?min-height: 44px;/);
  assert.match(styles, /\.player-options > button\.is-on \{[^}]*var\(--accent\) 8%/);
  assert.doesNotMatch(styles, /\.player-options > button\.is-on \{[^}]*background: var\(--accent-soft\)/);
  assert.match(styles, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.player-options > button \{[\s\S]*?max-width: 96px;[\s\S]*?justify-self: center;/);
  assert.match(styles, /@media \(hover: hover\) and \(pointer: fine\)/);
  assert.match(styles, /-webkit-tap-highlight-color: transparent/);
  assert.match(styles, /\.lesson-heading \{[\s\S]*?position: sticky;/);
  assert.match(styles, /grid-template-columns: max-content minmax\(0, 1fr\)/);
  assert.match(styles, /\.speaker \{[\s\S]*?min-width: 32px;[\s\S]*?max-width: min\(126px, 32vw\);/);
  assert.match(layout, /Content-Security-Policy/);
  assert.match(layout, /PatrickHand-Regular\.ttf/);
  assert.doesNotMatch(workflow, /AUDIO_BASE_URL/);
  assert.match(dependabot, /package-ecosystem: npm/);
  assert.match(dependabot, /package-ecosystem: github-actions/);
});
