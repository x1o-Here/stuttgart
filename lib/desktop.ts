import { getVersion } from "@tauri-apps/api/app";
import { invoke, isTauri } from "@tauri-apps/api/core";

/** Desktop builds are published as releases of this repository (see desktop/). */
const LATEST_RELEASE_URL =
  "https://api.github.com/repos/x1o-Here/stuttgart/releases/latest";

export type DesktopPlatform = "mac" | "windows";

export type DesktopRelease = {
  version: string;
  publishedAt: string;
  downloads: Partial<Record<DesktopPlatform, string>>;
};

type GitHubRelease = {
  tag_name: string;
  published_at: string;
  assets: { name: string; browser_download_url: string }[];
};

/** True when the page is running inside the Stuttgart desktop app. */
export const isDesktopApp = isTauri;

export function getDesktopVersion() {
  return getVersion();
}

/** Starts an update check; resolves to the new version when one is downloading. */
export function checkForDesktopUpdate() {
  return invoke<string | null>("check_for_updates");
}

export async function fetchLatestDesktopRelease(): Promise<DesktopRelease | null> {
  const response = await fetch(LATEST_RELEASE_URL, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`GitHub responded with ${response.status}`);
  }

  const release: GitHubRelease = await response.json();
  const assetUrl = (suffix: string) =>
    release.assets.find((asset) => asset.name.endsWith(suffix))
      ?.browser_download_url;

  return {
    version: release.tag_name.replace(/^desktop-v/, ""),
    publishedAt: release.published_at,
    downloads: { mac: assetUrl(".dmg"), windows: assetUrl("-setup.exe") },
  };
}

export function detectDesktopPlatform(): DesktopPlatform | null {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes("mac")) return "mac";
  if (userAgent.includes("win")) return "windows";
  return null;
}
