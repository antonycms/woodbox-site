import { releasesUrl } from "../config.js";
import { onLanguageChange, t } from "../i18n/index.js";
import { isPlainLeftClick } from "../lib/events.js";
import { detectArch, detectOs } from "../lib/platform.js";
import { fetchLatestRelease, selectInstaller } from "../lib/releases.js";

export function initDownloads() {
  const buttons = document.querySelectorAll("[data-download]");
  const os = detectOs();
  let installer = null;

  function render() {
    buttons.forEach((button) => {
      const label = button.querySelector("[data-i18n]");
      const labelKey = os ? `download.${os}` : label.dataset.i18n;

      label.textContent = t(labelKey);
      button.href = installer?.browser_download_url ?? releasesUrl;

      if (installer) {
        button.removeAttribute("target");
        button.title = installer.name;
      }
    });
  }

  async function resolveInstaller() {
    if (!os) return;

    const [arch, release] = await Promise.all([detectArch(), fetchLatestRelease()]);
    installer = release ? selectInstaller(release.assets, { os, arch }) : null;
    render();
  }

  const ready = resolveInstaller();

  buttons.forEach((button) => {
    button.addEventListener("click", async (event) => {
      if (!isPlainLeftClick(event)) return;

      event.preventDefault();
      button.setAttribute("aria-busy", "true");
      await ready;
      button.removeAttribute("aria-busy");
      window.location.assign(button.href);
    });
  });

  onLanguageChange(render);
}
