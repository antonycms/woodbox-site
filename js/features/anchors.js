import { isPlainLeftClick } from "../lib/events.js";

function findTarget(hash) {
  if (!hash || hash === "#") return null;
  try {
    return document.getElementById(decodeURIComponent(hash.slice(1)));
  } catch {
    return null;
  }
}

function scrollToTarget(target, { moveFocus = false } = {}) {
  target.scrollIntoView();
  if (moveFocus) {
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }
}

function clearHash() {
  history.replaceState(history.state, "", location.pathname + location.search);
}

export function initAnchors() {
  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || link.target === "_blank" || !isPlainLeftClick(event)) return;

    const target = findTarget(link.getAttribute("href"));
    if (!target) return;

    event.preventDefault();
    scrollToTarget(target, { moveFocus: link.classList.contains("skip-link") });
  });

  const initialTarget = findTarget(location.hash);
  if (initialTarget) {
    scrollToTarget(initialTarget);
    clearHash();
    window.addEventListener("load", () => scrollToTarget(initialTarget), { once: true });
  }
}
