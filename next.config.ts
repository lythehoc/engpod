import type { NextConfig } from "next";

const [repositoryOwner = "", repositoryName = ""] =
  process.env.GITHUB_REPOSITORY?.split("/") ?? [];
const isProjectPage =
  process.env.GITHUB_ACTIONS === "true" &&
  repositoryName.length > 0 &&
  !repositoryName.endsWith(".github.io");
const publicBasePath = isProjectPage ? `/${repositoryName}` : "";
const githubPagesUrl =
  process.env.GITHUB_ACTIONS === "true" && repositoryOwner
    ? repositoryName.endsWith(".github.io")
      ? `https://${repositoryName}`
      : `https://${repositoryOwner}.github.io/${repositoryName}`
    : "http://localhost:3000";
let audioBaseUrl = "";
try {
  const candidate = new URL(process.env.NEXT_PUBLIC_AUDIO_BASE_URL ?? "");
  if (
    candidate.protocol === "https:" &&
    candidate.username === "" &&
    candidate.password === ""
  ) {
    audioBaseUrl = candidate.href.replace(/\/+$/, "");
  }
} catch {
  audioBaseUrl = "";
}

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: publicBasePath,
    NEXT_PUBLIC_SITE_URL: githubPagesUrl,
    NEXT_PUBLIC_AUDIO_BASE_URL: audioBaseUrl,
    NEXT_PUBLIC_PREFER_LOCAL_AUDIO:
      process.env.GITHUB_ACTIONS === "true" ? "false" : "true",
  },
};

export default nextConfig;
