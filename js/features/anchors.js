import { replaceTag } from "../lib/elements.js";

function findTarget(hash) {
  if (!hash || hash === "#") return null;
  try {
    return document.getElementById(decodeURIComponent(hash.slice(1)));
  } catch {
    return null;
  }
}

function focusTarget(target) {
  if (!target.hasAttribute("tabindex")) {
    target.setAttribute("tabindex", "-1");
    target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
  }
  target.focus({ preventScroll: true });
}

export function initAnchors() {
  // Keep working links in the HTML fallback; enhance in-page actions to buttons
  // so the browser does not preview fragment URLs when hovering them.
  document.querySelectorAll('a[href^="#"]:not([data-download])').forEach((link) => {
    const hash = link.getAttribute("href");
    if (link.target === "_blank" || !findTarget(hash)) return;
    const button = replaceTag(link, "button");
    button.type = "button";
    button.dataset.scrollTo = hash;
    button.removeAttribute("href");
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-scroll-to]");
    if (!button) return;

    const target = findTarget(button.dataset.scrollTo);
    if (!target) return;

    // Scroll within the page without adding section hashes or history entries.
    // CSS controls smooth scrolling, including the reduced-motion preference.
    event.preventDefault();
    if (location.hash) history.replaceState(history.state, "", location.pathname + location.search);
    focusTarget(target);
    target.scrollIntoView({ block: "start" });
  });

  window.addEventListener("hashchange", () => {
    const target = findTarget(location.hash);
    if (target) focusTarget(target);
  });
  window.addEventListener("load", () => {
    const target = findTarget(location.hash);
    if (target) target.scrollIntoView({ behavior: "instant" });
  }, { once: true });
}
