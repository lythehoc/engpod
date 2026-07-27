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
  const repositoryOwner =
    process.env.GITHUB_REPOSITORY?.split("/")[0] ?? "demo-user";
  assert.match(html, /<title>engpod - small step every day<\/title>/i);
  assert.doesNotMatch(html, /engpod — small step every day/i);
  assert.match(html, /small step every day/i);
  assert.doesNotMatch(html, /listen[. ]+read[. ]+repeat/i);
  assert.match(html, /engpod/);
  assert.match(html, /Cut In Line/);
  assert.match(html, /Search title, level, or number/);
  assert.match(html, />Random<\/span>/);
  assert.doesNotMatch(html, /Surprise me|aria-label="Volume"|volume-control/);
  assert.doesNotMatch(html, /NOW PLAYING|ARCHIVE AUDIO/);
  assert.match(html, /Open Elementary episodes/);
  assert.ok(
    html.includes(
      `https://${repositoryOwner}.github.io/engpod/og.png`,
    ),
  );
  assert.match(html, /\/engpod\/favicon\.svg/);
  assert.match(html, /\/engpod\/manifest\.webmanifest/);
  assert.doesNotMatch(html, /\/engpod\/engpod\/og\.png/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("ships all episodes, transcripts, and the GitHub Pages workflow", async () => {
  const root = new URL("../", import.meta.url);
  const [catalog, transcriptNames, workflow, readme, socialCard, mobileManifest, mobileIcon, handwritingFont, fontLicense] =
    await Promise.all([
    readFile(new URL("app/data/episodes.json", root), "utf8"),
    readdir(new URL("public/transcripts/", root)),
    readFile(new URL(".github/workflows/deploy.yml", root), "utf8"),
    readFile(new URL("README.md", root), "utf8"),
    stat(new URL("public/og.png", root)),
    readFile(new URL("public/manifest.webmanifest", root), "utf8"),
    readFile(new URL("public/favicon.svg", root), "utf8"),
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
  assert.match(workflow, /run:\s*npm run lint/);
  assert.match(workflow, /run:\s*node --test tests\/rendered-html\.test\.mjs/);
  assert.match(workflow, /permissions:\s*\{\}/);
  assert.doesNotMatch(readme, /independent educational project|not affiliated with|endorsed by EnglishPod/i);
  assert.doesNotMatch(readme, /^## Audio$|Audio streams from the public Internet Archive/m);
  assert.match(readme, /Tap any episode to play, then resume later/);
  assert.equal(
    readme.match(/^-/gm)?.length,
    4,
  );
  assert.ok(socialCard.size > 100_000);
  assert.match(mobileManifest, /"short_name": "engpod"/);
  assert.match(mobileManifest, /"src": "logo\.jpg"/);
  assert.match(mobileIcon, /#167D73/);
  assert.doesNotMatch(mobileIcon, /#0C79D8|#2E9EFF/);
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
  assert.match(page, /resume: "englishpod:last-resume"/);
  assert.match(page, /type ResumeRecord = \{\s*episodeId: number;\s*position: number;/);
  assert.match(page, /JSON\.stringify\(\{ episodeId, position: savedPosition \}\)/);
  assert.match(page, /Math\.max\(safePosition, checkpoint\.position\)/);
  assert.match(page, /savedResume\.position - 10/);
  assert.match(page, /lastPositionWriteRef\.current > 10_000/);
  assert.match(page, /addEventListener\("pagehide", saveCurrentPosition\)/);
  assert.match(page, /addEventListener\("visibilitychange", handleVisibilityChange\)/);
  assert.match(page, /removeItem\(STORAGE\.legacyEpisode\)/);
  assert.match(page, /removeItem\(STORAGE\.legacyPositions\)/);
  assert.doesNotMatch(page, /positions\[String\(episodeId\)\]\s*=/);
  assert.doesNotMatch(page, /groupByLevel|Group levels|groupedEpisodes/);
  assert.match(page, /selectedLevel/);
  assert.match(page, /type CompletionFilter = "all" \| "unfinished" \| "finished"/);
  assert.match(page, /completionFilter: CompletionFilter/);
  assert.match(page, /COMPLETION_FILTERS\.includes/);
  assert.match(page, /completionFilter === "finished"/);
  assert.match(page, /completionFilter === "unfinished"/);
  assert.match(page, /return \[\.\.\.filtered\]\.sort\(\(a, b\) => a\.id - b\.id\)/);
  assert.doesNotMatch(page, /SortMode|sortMode|Sort episodes|<select/);
  assert.match(page, /aria-label="Filter by completion"/);
  assert.match(page, /\["unfinished", "Not finished"\]/);
  assert.match(page, /\["finished", "Finished"\]/);
  assert.match(page, /setSelectedLevel\("All"\);\s*setCompletionFilter\("all"\);/);
  assert.match(page, /transcriptVisible/);
  assert.match(page, /if \(!transcriptVisible\) return;/);
  assert.match(page, /setTranscript\(""\);\s*setTranscriptLoading\(true\);/);
  assert.match(page, /setTimeout\(\(\) => controller\.abort\(\), 10_000\)/);
  assert.match(page, /\[currentEpisode\.transcript_id, transcriptVisible\]/);
  assert.match(page, /sanitizeTranscriptHtml\(html\)/);
  assert.match(page, /const EpisodeRow = memo\(function EpisodeRow/);
  assert.match(page, /const completedIdSet = useMemo\(\(\) => new Set\(completedIds\)/);
  assert.match(page, /completed=\{completedIdSet\.has\(episode\.id\)\}/);
  assert.match(page, /querySelector\("h1"\)\?\.remove\(\)/);
  assert.doesNotMatch(page, /speaker-tone-|speakerTones|toneClass/);
  assert.doesNotMatch(styles, /--speaker-|speaker-tone-/);
  assert.match(styles, /\.line \{[^}]*border: 1px solid var\(--line\);[^}]*border-radius: 18px;[^}]*background: color-mix\(in srgb, var\(--surface-2\) 28%, var\(--surface\)\);/);
  assert.match(styles, /\.speaker \{[^}]*border: 1px solid color-mix\(in srgb, var\(--accent\) 16%, var\(--line\)\);[^}]*background: color-mix\(in srgb, var\(--accent\) 7%, transparent\);[^}]*color: var\(--accent-strong\);/);
  assert.match(page, />Auto next</);
  assert.match(page, /SLEEP_TIMER_OPTIONS = \[0, 15, 30, 45, 60\]/);
  assert.match(page, /function formatCountdown\(value: number\)/);
  assert.match(page, /setInterval\(updateRemainingTime, 1_000\)/);
  assert.match(page, /sleepTimerEndAt - Date\.now\(\)/);
  assert.match(page, /formatCountdown\(sleepTimerRemainingSeconds\)/);
  assert.match(page, /: "Sleep"/);
  assert.match(page, /Mark episode as finished/);
  assert.match(page, /className=\{`episode-complete \$\{completed \? "is-finished" : ""\}`\}/);
  assert.match(page, /onToggleCompleted=\{updateCompleted\}/);
  assert.match(page, /<span className="episode-number" aria-hidden="true">\s*\{episode\.id\}/);
  assert.doesNotMatch(page, /active \? "▶" : episode\.id/);
  assert.doesNotMatch(page, /now-label|>NOW</);
  assert.match(page, /updateCompleted\(currentId, true\)/);
  assert.match(page, /orderedCandidates\.find\([\s\S]*?!completedIds\.includes\(episode\.id\)/);
  assert.match(page, /previousCandidates\.find\([\s\S]*?!completedIds\.includes\(episode\.id\)/);
  assert.match(page, /unfinishedVisible[\s\S]*?unfinishedAnywhere/);
  assert.match(page, /<span className="speed-value">\{playbackRate\}×<\/span>/);
  assert.match(page, /<span className="control-label">Speed<\/span>/);
  assert.match(page, /className="track-button"/);
  assert.match(page, /<MediaIcon name="replay10" \/>/);
  assert.match(page, /<MediaIcon name="previous" \/>/);
  assert.match(page, /<MediaIcon name=\{isPlaying \? "pause" : "play"\} \/>/);
  assert.match(page, /<MediaIcon name="next" \/>/);
  assert.match(page, /<MediaIcon name="forward10" \/>/);
  assert.doesNotMatch(page, /skip-glyph|skip-arrow|⟲|⟳|\|◀|▶\|/);
  assert.doesNotMatch(page, /className="soft-button"|brand-actions/);
  assert.match(page, /className="brand-name"[\s\S]*?className="guide-icon-button"[\s\S]*?className="mobile-close"/);
  assert.match(page, /type UiIconName = "help" \| "close" \| "sun" \| "moon"/);
  assert.match(page, /className="guide-icon-button"[\s\S]*?onClick=\{\(\) => setHelpOpen\(true\)\}[\s\S]*?aria-label="Open quick guide"[\s\S]*?<UiIcon name="help" \/>/);
  assert.match(page, /className="mobile-close"[\s\S]*?<UiIcon name="close" \/>/);
  assert.match(page, /className="theme-toggle"[\s\S]*?<UiIcon name=\{theme === "dark" \? "sun" : "moon"\} \/>[\s\S]*?\{theme === "dark" \? "Light" : "Dark"\}/);
  assert.doesNotMatch(page, /setSidebarOpen\(false\);\s*setHelpOpen\(true\);/);
  assert.match(page, /querySelector<HTMLElement>\("\.episode-row\.is-active"\)/);
  assert.match(page, /scrollIntoView\(\{[\s\S]*?behavior: "smooth",[\s\S]*?block: "center"/);
  assert.match(page, /distanceX >= 56 && distanceX > distanceY \* 1\.25/);
  assert.match(page, /onTouchStart=\{handleSidebarTouchStart\}/);
  assert.match(page, /onTouchEnd=\{handleSidebarTouchEnd\}/);
  assert.match(page, /closest\("\[data-drawer-swipe-ignore\]"\)/);
  assert.match(page, /className="level-filters"[\s\S]*?data-drawer-swipe-ignore/);
  assert.match(page, /onTouchStart=\{handlePlayerTouchStart\}/);
  assert.match(page, /onTouchEnd=\{handlePlayerTouchEnd\}/);
  assert.match(page, /event\.target\.closest\("button, input, select, a"\)/);
  assert.match(page, /distanceX = touch\.clientX - start\.x/);
  assert.match(page, /setSidebarOpen\(true\);/);
  assert.doesNotMatch(page, /className="modal-close"/);
  assert.doesNotMatch(page, /Surprise me|volume-control/);
  assert.equal(page.match(/small step every day/g)?.length, 1);
  assert.doesNotMatch(page, /Small steps, clear ears, confident English/);
  assert.doesNotMatch(page, /resumeNotice|setResumeNotice|Welcome back|Saved on this device/);
  assert.doesNotMatch(page, /Your episode, position, filters|Not affiliated with or endorsed/);
  assert.doesNotMatch(styles, /\.brand-row p/);
  assert.doesNotMatch(styles, /\.brand-actions|\.soft-button/);
  assert.match(styles, /\.brand-name \{[^}]*flex: 1;/);
  assert.match(styles, /\.guide-icon-button,[\s\S]*?\.mobile-close \{[\s\S]*?width: 40px;[\s\S]*?height: 40px;[\s\S]*?border: 1px solid var\(--line\);[\s\S]*?border-radius: 14px;/);
  assert.match(styles, /\.ui-icon \{[\s\S]*?stroke-width: 1\.9;[\s\S]*?stroke-linecap: round;/);
  assert.match(styles, /\.theme-toggle \{[\s\S]*?display: inline-flex;[\s\S]*?gap: 7px;/);
  assert.match(styles, /\.guide-icon-button:hover,[\s\S]*?\.mobile-close:hover \{[\s\S]*?background: var\(--surface-3\);/);
  assert.doesNotMatch(styles, /project-disclaimer/);
  assert.doesNotMatch(styles, /resume-note|radial-gradient/);
  assert.match(styles, /\.app-shell \{[\s\S]*?background: var\(--bg\);/);
  assert.match(styles, /\.brand-block \{[^}]*padding: 24px 22px 10px;/);
  assert.doesNotMatch(styles, /\.brand-block \{[^}]*border-bottom:/);
  assert.match(styles, /\.library-tools \{[^}]*padding: 10px 16px 12px;/);
  assert.match(styles, /\.completion-filters \{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(styles, /\.completion-filters button \{[\s\S]*?min-height: 43px;/);
  assert.doesNotMatch(page, /<span>Sort<\/span>/);
  assert.doesNotMatch(styles, /\.list-options|\.group-heading|\.episode-group/);
  assert.match(styles, /--accent: #167d73/);
  assert.match(styles, /--accent: #168f82/);
  assert.doesNotMatch(styles, /#e85d3f|#ff7657|#c94229|#ff9178|#f9d9cc|#3b211c/);
  assert.match(styles, /@media \(max-width: 660px\)/);
  assert.match(styles, /--player-height: 160px/);
  assert.match(styles, /\.lesson-heading h2 \{[\s\S]*?font-size: clamp\(32px, 4\.2vw, 56px\);/);
  assert.match(styles, /\.lesson-heading h2 \{[\s\S]*?font-size: clamp\(27px, 8vw, 36px\);/);
  assert.match(styles, /grid-template-columns: 34px minmax\(0, 1fr\) 34px/);
  assert.match(styles, /\.progress-time:last-child \{[\s\S]*?text-align: right;/);
  assert.match(styles, /\.transport button \{[\s\S]*?width: 52px;[\s\S]*?height: 52px;/);
  assert.match(styles, /\.transport button \{[^}]*padding: 0;[^}]*display: grid;[^}]*place-items: center;/);
  assert.match(styles, /\.transport \.track-button \{[\s\S]*?width: 58px;[\s\S]*?height: 58px;/);
  assert.match(styles, /\.transport \.skip-button \{[\s\S]*?width: 54px;[\s\S]*?height: 54px;/);
  assert.match(styles, /\.transport \.play-button \{[\s\S]*?width: 70px;[\s\S]*?height: 70px;/);
  assert.match(styles, /\.transport \.play-button \{[\s\S]*?box-shadow: none;/);
  assert.match(styles, /\.media-icon \{[^}]*width: 30px;[^}]*height: 30px;/);
  assert.match(styles, /\.track-button \.media-icon \{[^}]*width: 32px;[^}]*height: 32px;/);
  assert.match(styles, /\.play-button \.media-icon \{[^}]*width: 44px;[^}]*height: 44px;/);
  assert.doesNotMatch(styles, /\.media-icon-play \{[^}]*transform:/);
  assert.match(styles, /\.transport \.track-button \{[^}]*border: 0;[^}]*background: transparent;/);
  assert.match(styles, /\.player-options > button \{[\s\S]*?min-height: 44px;/);
  assert.match(styles, /\.player-options > button\.is-on \{[^}]*var\(--accent\) 8%/);
  assert.doesNotMatch(styles, /\.player-options > button\.is-on \{[^}]*background: var\(--accent-soft\)/);
  assert.match(styles, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.player-options > button \{[\s\S]*?max-width: 82px;[\s\S]*?justify-self: center;/);
  assert.doesNotMatch(styles, /\.modal-close|place-items: end center|max-height: min\(78dvh, 620px\)/);
  assert.match(styles, /\.primary-button \{[^}]*margin-top: 18px;/);
  assert.match(styles, /\.guide-modal \{[\s\S]*?padding: 28px 20px 20px;/);
  assert.match(styles, /\.guide-modal h2 \{[^}]*font-family: var\(--font-handwriting\)/);
  assert.match(styles, /\.library-panel \{[\s\S]*?touch-action: pan-y;/);
  assert.match(styles, /\.content-panel \{[\s\S]*?touch-action: pan-y;/);
  assert.match(styles, /@media \(hover: hover\) and \(pointer: fine\)/);
  assert.match(styles, /-webkit-tap-highlight-color: transparent/);
  assert.match(styles, /\.lesson-heading \{[\s\S]*?position: sticky;/);
  assert.match(styles, /\.heading-complete \{[^}]*width: 44px;[^}]*height: 44px;/);
  assert.match(styles, /\.heading-complete \{[^}]*border: 1px solid var\(--line\);[^}]*background: var\(--surface-2\);[^}]*color: var\(--muted\);/);
  assert.doesNotMatch(styles, /\.heading-complete \{[^}]*var\(--accent/);
  assert.match(styles, /\.heading-complete\.is-finished \{[^}]*background: var\(--accent\);/);
  assert.match(styles, /\.episode-complete \{[^}]*width: 40px;[^}]*height: 40px;/);
  assert.match(styles, /\.episode-complete \{[^}]*background: var\(--surface-2\);[^}]*color: var\(--muted\);/);
  assert.doesNotMatch(styles, /\.episode-complete \{[^}]*var\(--accent/);
  assert.match(styles, /\.episode-complete\.is-finished \{[^}]*background: var\(--accent\);/);
  assert.doesNotMatch(styles, /\.episode-row\.is-active \.episode-number/);
  assert.doesNotMatch(styles, /\.now-label|\.complete-toggle/);
  assert.match(styles, /\.speed-value \{[^}]*var\(--font-geist-mono\)/);
  assert.match(styles, /grid-template-columns: max-content minmax\(0, 1fr\)/);
  assert.match(styles, /\.speaker \{[\s\S]*?min-width: 32px;[\s\S]*?max-width: min\(126px, 32vw\);/);
  assert.match(layout, /Content-Security-Policy/);
  assert.match(layout, /PatrickHand-Regular\.ttf/);
  assert.doesNotMatch(workflow, /AUDIO_BASE_URL/);
  assert.match(dependabot, /package-ecosystem: npm/);
  assert.match(dependabot, /package-ecosystem: github-actions/);
});
