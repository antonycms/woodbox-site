import { onLanguageChange, t } from "../i18n/index.js";
import { isPlainLeftClick } from "../lib/events.js";

export function initImageViewer() {
  const dialog = document.querySelector("[data-viewer]");
  if (!dialog?.showModal) return;
  const find = (name) => dialog.querySelector(`[data-viewer-${name}]`);
  const picture = find("image");
  const stage = find("stage");
  const zoomButton = find("zoom");
  let opener = null;
  let zoomed = false;
  let loaded = false;
  let failed = false;
  let scrollPosition = null;
  let pointerStartedOutside = false;
  document.querySelectorAll("a[data-image-viewer]").forEach((link) => link.setAttribute("aria-haspopup", "dialog"));

  function renderLabels() {
    if (!opener) return;
    find("title").textContent = t(opener.dataset.imageTitle);
    picture.alt = t(opener.dataset.imageAlt);
    zoomButton.textContent = t(zoomed ? "viewer.fit" : "viewer.zoom");
    zoomButton.setAttribute("aria-pressed", String(zoomed));
    zoomButton.disabled = !loaded;
    find("hint").textContent = t(zoomed ? "viewer.panHint" : "viewer.hint");
    find("message").textContent = failed ? t("viewer.error") : loaded ? "" : t("viewer.loading");
  }

  function setZoom(value) {
    zoomed = value;
    dialog.dataset.zoomed = String(value);
    renderLabels();
    // Use the subject of each capture as the initial focus at actual size.
    // Native scrolling remains available by touch, trackpad and keyboard.
    if (value && loaded) {
      const x = Number(opener.dataset.imageX) || 0.5;
      const y = Number(opener.dataset.imageY) || 0.5;
      stage.scrollTo({
        left: picture.offsetLeft + picture.offsetWidth * x - stage.clientWidth / 2,
        top: picture.offsetTop + picture.offsetHeight * y - stage.clientHeight / 2,
        behavior: "instant"
      });
    } else {
      stage.scrollTo({ left: 0, top: 0, behavior: "instant" });
    }
  }

  picture.addEventListener("load", () => {
    if (!dialog.open) return;
    loaded = true;
    failed = false;
    picture.hidden = false;
    setZoom(window.matchMedia("(max-width: 700px)").matches);
  });
  picture.addEventListener("error", () => {
    if (!dialog.open) return;
    failed = true;
    loaded = false;
    picture.hidden = true;
    renderLabels();
  });

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-image-viewer]");
    if (!link || !isPlainLeftClick(event)) return;
    event.preventDefault();
    opener = link;
    scrollPosition = { top: window.scrollY, left: window.scrollX };
    loaded = false;
    failed = false;
    picture.hidden = true;
    find("original").href = link.href;
    document.documentElement.classList.add("image-viewer-open");
    dialog.showModal();
    setZoom(false);
    // Reassign on every open so cached images also trigger load.
    picture.src = link.href;
  });

  zoomButton.addEventListener("click", () => setZoom(!zoomed));
  find("close").addEventListener("click", () => dialog.close());
  function outside(event) {
    const rect = dialog.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  }
  dialog.addEventListener("pointerdown", (event) => { pointerStartedOutside = outside(event); });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog && pointerStartedOutside && outside(event)) dialog.close();
    pointerStartedOutside = false;
  });
  dialog.addEventListener("close", () => {
    document.documentElement.classList.remove("image-viewer-open");
    if (scrollPosition) window.scrollTo({ ...scrollPosition, behavior: "instant" });
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    picture.removeAttribute("src");
    opener = null;
  });
  onLanguageChange(renderLabels);
}
