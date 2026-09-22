export function initNavigation() {
  const nav = document.querySelector(".nav");
  const menu = document.getElementById("primary-menu");
  const toggle = nav.querySelector("[data-nav-toggle]");
  const mobile = window.matchMedia("(max-width: 980px)");
  nav.closest(".nav-shell").dataset.enhanced = "";

  function setOpen(open, restoreFocus = false) {
    toggle.setAttribute("aria-expanded", String(open));
    menu.hidden = mobile.matches && !open;
    if (restoreFocus) toggle.focus();
  }

  function syncLayout() {
    const focusWasInMenu = menu.contains(document.activeElement);
    toggle.hidden = !mobile.matches;
    setOpen(false, mobile.matches && focusWasInMenu);
  }

  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    setOpen(open);
    if (open) menu.querySelector("[data-scroll-to], a").focus();
  });
  menu.addEventListener("click", (event) => {
    if (event.target.closest("a, [data-scroll-to]")) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && mobile.matches && !menu.hidden) {
      event.preventDefault();
      setOpen(false, true);
    }
  });
  document.addEventListener("click", (event) => {
    if (!nav.contains(event.target)) setOpen(false);
  });
  nav.addEventListener("focusout", (event) => {
    if (!nav.contains(event.relatedTarget)) setOpen(false);
  });
  mobile.addEventListener("change", syncLayout);
  syncLayout();
}
