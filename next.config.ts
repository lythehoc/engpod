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

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: publicBasePath,
  assetPrefix: publicBasePath,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: publicBasePath,
    NEXT_PUBLIC_SITE_URL: githubPagesUrl,
  },
};

export default nextConfig;
