import { spawn } from "node:child_process";
import { mkdir, readFile, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const projectRoot = path.resolve(import.meta.dirname, "..");
const catalogPath = path.join(projectRoot, "app", "data", "episodes.json");
const audioDirectory = path.join(projectRoot, "public", "audio");
const concurrency = Math.max(
  1,
  Math.min(8, Number(process.env.AUDIO_DOWNLOAD_CONCURRENCY) || 8),
);

const episodes = JSON.parse(await readFile(catalogPath, "utf8"));
await mkdir(audioDirectory, { recursive: true });

let completed = 0;
let downloaded = 0;
let skipped = 0;
let failed = 0;
let cursor = 0;

async function validFile(filePath) {
  try {
    return (await stat(filePath)).size > 100_000;
  } catch {
    return false;
  }
}

function downloadWithCurl(url, partialPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "curl",
      [
        "-sSL",
        "--fail",
        "--retry",
        "5",
        "--retry-all-errors",
        "--retry-delay",
        "2",
        "--connect-timeout",
        "30",
        "--max-time",
        "900",
        "--continue-at",
        "-",
        url,
        "--output",
        partialPath,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let errorText = "";
    child.stderr.on("data", (chunk) => {
      errorText += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(errorText.trim() || `curl exited with code ${code}`));
    });
  });
}

async function downloadEpisode(episode) {
  const fileName = `${episode.transcript_id}pb.mp3`;
  const finalPath = path.join(audioDirectory, fileName);
  const partialPath = `${finalPath}.part`;

  if (await validFile(finalPath)) {
    skipped += 1;
    return;
  }

  const url =
    `https://ia800408.us.archive.org/10/items/englishpod_all/${fileName}`;
  // Some Archive storage nodes advertise ranges but reject resumed requests.
  // Completed MP3s are still preserved, while an interrupted partial restarts.
  await unlink(partialPath).catch(() => {});
  await downloadWithCurl(url, partialPath);

  if (!(await validFile(partialPath))) {
    await unlink(partialPath).catch(() => {});
    throw new Error("downloaded file is missing or too small");
  }

  await rename(partialPath, finalPath);
  downloaded += 1;
}

async function worker() {
  while (cursor < episodes.length) {
    const episode = episodes[cursor++];
    try {
      await downloadEpisode(episode);
    } catch (error) {
      failed += 1;
      console.error(
        `\nFailed ${episode.transcript_id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      completed += 1;
      process.stdout.write(
        `\rAudio: ${completed}/${episodes.length} checked · ${downloaded} downloaded · ${skipped} existing · ${failed} failed`,
      );
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
process.stdout.write("\n");

if (failed > 0) {
  console.error("Some downloads failed. Run the command again to resume them.");
  process.exitCode = 1;
} else {
  console.log(`All ${episodes.length} episodes are available in public/audio.`);
}
