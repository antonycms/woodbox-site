import { releaseDownloadPrefix, releasesApiUrl } from "../config.js";

const FETCH_TIMEOUT_MS = 5000;

const INSTALLER_EXTENSIONS = {
  windows: /\.exe$/i,
  mac: /\.dmg$/i,
  linux: /\.AppImage$/i
};

const ARCH_PATTERNS = [
  ["arm64", /(?:^|[-_.])(?:arm64|aarch64)(?:[-_.]|$)/],
  ["x64", /(?:^|[-_.])(?:x64|x86_64|amd64)(?:[-_.]|$)/],
  ["ia32", /(?:^|[-_.])(?:ia32|i386|i686)(?:[-_.]|$)/]
];

const UNIVERSAL_PATTERN = /(?:^|[-_.])universal(?:[-_.]|$)/;

export async function fetchLatestRelease() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(releasesApiUrl, {
      headers: { Accept: "application/vnd.github+json" },
      cache: "no-cache",
      signal: controller.signal
    });
    if (!response.ok) return null;

    const release = await response.json();
    const isPublished = !release.draft && !release.prerelease && Array.isArray(release.assets);
    return isPublished ? release : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

function isOfficialInstaller(asset, os) {
  return typeof asset.name === "string"
    && INSTALLER_EXTENSIONS[os].test(asset.name)
    && Boolean(asset.browser_download_url?.startsWith(releaseDownloadPrefix));
}

function archFromAssetName(name, os) {
  const match = ARCH_PATTERNS.find(([, pattern]) => pattern.test(name));
  if (match) return match[0];
  if (os === "mac") return null;
  return "x64";
}

function fitsArch(asset, os, arch) {
  const name = asset.name.toLowerCase();
  if (os === "mac" && UNIVERSAL_PATTERN.test(name)) return true;
  if (!arch) return false;
  return archFromAssetName(name, os) === arch;
}

export function selectInstaller(assets, { os, arch }) {
  return assets
    .filter((asset) => isOfficialInstaller(asset, os))
    .find((asset) => fitsArch(asset, os, arch)) ?? null;
}
