import { initAnchors } from "./features/anchors.js";
import { initDownloads } from "./features/downloads.js";
import { initI18n } from "./i18n/index.js";
import { initReveal } from "./features/reveal.js";
import { initTabs } from "./features/tabs.js";
import { initAiDemo } from "./features/ai-demo.js";
import { initNavigation } from "./features/navigation.js";
import { initImageViewer } from "./features/image-viewer.js";

initNavigation();
initAnchors();
initDownloads();
initTabs();
initI18n();
initImageViewer();
initAiDemo();
initReveal();
