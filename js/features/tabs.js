function selectTab(tabs, selectedTab, { moveFocus = false } = {}) {
  tabs.forEach((tab) => {
    const isSelected = tab === selectedTab;
    tab.setAttribute("aria-selected", String(isSelected));
    tab.tabIndex = isSelected ? 0 : -1;
    const panel = document.getElementById(tab.getAttribute("aria-controls"));
    panel.classList.toggle("is-active", isSelected);
    panel.hidden = !isSelected;
    if (isSelected) {
      panel.querySelectorAll("img[data-src]").forEach((image) => {
        image.src = image.dataset.src;
        delete image.dataset.src;
      });
    }
  });
  if (moveFocus) selectedTab.focus();
}

function targetIndex(key, currentIndex, total) {
  if (key === "ArrowRight") return (currentIndex + 1) % total;
  if (key === "ArrowLeft") return (currentIndex - 1 + total) % total;
  if (key === "Home") return 0;
  if (key === "End") return total - 1;
  return null;
}

function initTablist(tablist) {
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];

  tablist.addEventListener("click", (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (tab) selectTab(tabs, tab);
  });

  tablist.addEventListener("keydown", (event) => {
    const current = tabs.indexOf(document.activeElement);
    if (current < 0) return;
    const index = targetIndex(event.key, current, tabs.length);
    if (index === null) return;

    event.preventDefault();
    selectTab(tabs, tabs[index], { moveFocus: true });
  });
  selectTab(tabs, tabs.find((tab) => tab.getAttribute("aria-selected") === "true") || tabs[0]);
}

export function initTabs() {
  document.querySelectorAll('[role="tablist"]').forEach(initTablist);
}
