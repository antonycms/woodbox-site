import { releasesUrl } from "../config.js";
import { getLang, onLanguageChange, t } from "../i18n/index.js";
import { detectArch, detectOs } from "../lib/platform.js";
import { replaceTag } from "../lib/elements.js";
import { fetchLatestRelease, getInstallers, installerArchitecture, selectInstaller } from "../lib/releases.js";

const PLATFORM_NAMES = { windows: "Windows", mac: "macOS", linux: "Linux" };
const FORMATS = { windows: "EXE", mac: "DMG", linux: "AppImage" };

export function initDownloads() {
  const picker = document.querySelector("[data-download-picker]");
  if (!picker) return;
  const find = (name) => picker.querySelector(`[data-${name}]`);
  const radios = [...picker.querySelectorAll('[name="download-os"]')];
  const architecture = find("download-architecture");
  const link = find("installer-link");
  const os = detectOs();
  let selectedOs = os;
  let selectedInstaller = null;
  let automaticInstaller = null;
  let release = null;
  let ready = false;
  let platformChosen = false;

  function archLabel(asset) {
    return t(`download.arch.${installerArchitecture(asset, selectedOs) || "unknown"}`);
  }

  function render() {
    picker.hidden = false;
    picker.dataset.state = !ready ? "loading" : release ? "ready" : "unavailable";
    radios.forEach((radio) => { radio.checked = radio.value === selectedOs; });
    const candidates = getInstallers(release?.assets, selectedOs);
    const guidance = !selectedOs ? t("download.chooseHint")
      : !platformChosen && os ? t("download.detected").replace("{os}", PLATFORM_NAMES[os])
      : t("download.selected").replace("{os}", PLATFORM_NAMES[selectedOs]);
    find("download-guidance").textContent = guidance;

    const status = find("release-status");
    status.replaceChildren();
    if (!ready || !release) {
      status.textContent = t(!ready ? "download.loading" : "download.unavailable");
    } else {
      const version = document.createElement("a");
      version.href = releasesUrl;
      version.target = "_blank";
      version.rel = "noreferrer";
      version.textContent = typeof release.tag_name === "string" ? release.tag_name : t("download.latest");
      status.append(version);
      const date = new Date(release.published_at);
      if (release.published_at && !Number.isNaN(date.getTime())) {
        status.append(` · ${new Intl.DateTimeFormat(getLang(), { dateStyle: "medium", timeZone: "UTC" }).format(date)}`);
      }
    }

    const showArchitecture = candidates.length > 1 || (candidates.length > 0 && !selectedInstaller);
    find("architecture-wrap").hidden = !showArchitecture;
    architecture.replaceChildren();
    const placeholder = new Option(t("download.chooseArch"), "");
    placeholder.disabled = true;
    architecture.append(placeholder);
    candidates.forEach((asset) => architecture.append(new Option(archLabel(asset), asset.name)));
    architecture.value = selectedInstaller?.name || "";

    const meta = find("installer-meta");
    meta.textContent = "";
    if (selectedInstaller) {
      const parts = [FORMATS[selectedOs], archLabel(selectedInstaller)];
      if (Number.isFinite(selectedInstaller.size) && selectedInstaller.size > 0) {
        parts.push(`${new Intl.NumberFormat(getLang(), { maximumFractionDigits: 0 }).format(selectedInstaller.size / 1e6)} MB`);
      }
      meta.textContent = parts.join(" · ");
    } else if (selectedOs && release) {
      meta.textContent = t(candidates.length ? "download.chooseArch" : "download.noInstaller");
    }

    link.href = selectedInstaller?.browser_download_url || releasesUrl;
    find("installer-label").textContent = t(selectedInstaller ? `download.${selectedOs}` : "download.allReleases");
    if (selectedInstaller) {
      link.removeAttribute("target");
      link.title = selectedInstaller.name;
    } else {
      link.target = "_blank";
      link.removeAttribute("title");
    }

    find("mac-note").hidden = selectedOs !== "mac";
    const guide = find("install-guide");
    guide.hidden = !selectedOs;
    if (selectedOs) {
      find("install-title").textContent = t("download.installTitle").replace("{os}", PLATFORM_NAMES[selectedOs]);
      find("install-steps").replaceChildren(...[1, 2, 3].map((step) => {
        const item = document.createElement("li");
        item.textContent = t(`download.install.${selectedOs}.${step}`);
        return item;
      }));
    }

    document.querySelectorAll("[data-download]").forEach((element) => {
      const button = replaceTag(element, automaticInstaller ? "a" : "button");
      if (automaticInstaller) {
        button.href = automaticInstaller.browser_download_url;
        button.removeAttribute("type");
        button.removeAttribute("data-scroll-to");
      } else {
        button.type = "button";
        button.dataset.scrollTo = "#download";
        button.removeAttribute("href");
      }
      button.querySelector("[data-i18n]").textContent = t(automaticInstaller ? `download.${os}` : "download.options");
      if (automaticInstaller) button.title = automaticInstaller.name;
      else button.removeAttribute("title");
    });
  }

  radios.forEach((radio) => radio.addEventListener("change", () => {
    selectedOs = radio.value;
    platformChosen = true;
    const candidates = getInstallers(release?.assets, selectedOs);
    selectedInstaller = candidates.length === 1 ? candidates[0] : null;
    find("install-guide").open = false;
    render();
  }));
  architecture.addEventListener("change", () => {
    selectedInstaller = getInstallers(release?.assets, selectedOs).find((asset) => asset.name === architecture.value) || null;
    render();
  });
  onLanguageChange(render);
  render();

  async function resolve() {
    const [arch, latest] = await Promise.all([detectArch(), fetchLatestRelease()]);
    release = latest;
    ready = true;
    automaticInstaller = selectInstaller(release?.assets, { os, arch });
    const candidates = getInstallers(release?.assets, selectedOs);
    selectedInstaller = platformChosen
      ? candidates.length === 1 ? candidates[0] : null
      : automaticInstaller;
    render();
  }
  resolve();
}
