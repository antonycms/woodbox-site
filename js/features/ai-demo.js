import { getLang, onLanguageChange, t } from "../i18n/index.js";

// A local product demonstration: no database connections or AI requests.
const SCENARIOS = {
  customers: {
    mode: "generate",
    file: "top_customers.sql",
    tables: ["customers", "orders"],
    sql: "SELECT c.name,\n  COUNT(*) AS orders,\n  SUM(o.total) AS spent\nFROM customers c\nJOIN orders o\n  ON o.customer_id = c.id\nWHERE o.status = 'paid'\nGROUP BY c.id, c.name\nORDER BY spent DESC\nLIMIT 3;",
    columns: ["name", "orders", "spent"],
    rows: [["Ana Silva", 24, 4820], ["Lucas Costa", 18, 3640], ["Julia Santos", 15, 2950]],
    decimalColumns: [2],
    duration: "24 ms",
  },
  revenue: {
    mode: "explain",
    file: "monthly_revenue.sql",
    tables: ["orders"],
    sql: "SELECT\n  DATE_TRUNC('month',\n    created_at) AS month,\n  SUM(total) AS revenue\nFROM orders\nWHERE status = 'paid'\n  AND created_at >=\n    DATE_TRUNC('month', NOW())\n    - INTERVAL '2 months'\nGROUP BY 1\nORDER BY 1;",
  },
  pending: {
    mode: "refine",
    baseSql: "SELECT id, total, status\nFROM orders\nWHERE status = 'pending';",
    changedLines: [3, 4, 5],
    file: "pending_orders.sql",
    tables: ["orders"],
    sql: "SELECT id, total, status\nFROM orders\nWHERE status = 'pending'\n  AND total > 200\nORDER BY total DESC\nLIMIT 3;",
    columns: ["id", "total", "status"],
    rows: [[1042, 890, "pending"], [1038, 645, "pending"], [1029, 320, "pending"]],
    decimalColumns: [1],
    duration: "12 ms",
  },
};

const TIME = { sent: 2200, generate: 3600, review: 5200, run: 10500, done: 11500 };
const TOKEN = /('[^']*'|\b(?:SELECT|AS|FROM|JOIN|ON|WHERE|AND|GROUP BY|ORDER BY|DESC|LIMIT|INTERVAL)\b|\b(?:COUNT|SUM|DATE_TRUNC|NOW)\b|\b\d+\b)/g;

function renderSql(element, sql, changedLines = []) {
  const fragment = document.createDocumentFragment();
  sql.split("\n").forEach((line, index) => {
    if (index) fragment.append("\n");
    const row = document.createElement("span");
    row.className = `ai-code-line${changedLines.includes(index) ? " is-changed" : ""}`;
    let cursor = 0;
    for (const match of line.matchAll(TOKEN)) {
      row.append(line.slice(cursor, match.index));
      const token = document.createElement("span");
      const value = match[0];
      const type = value.startsWith("'") ? "string" : /^\d/.test(value) ? "number"
        : /^(COUNT|SUM|DATE_TRUNC|NOW)$/.test(value) ? "function" : "keyword";
      token.className = `ai-token-${type}`;
      token.textContent = value;
      row.append(token);
      cursor = match.index + value.length;
    }
    row.append(line.slice(cursor));
    fragment.append(row);
  });
  element.replaceChildren(fragment);
}

function renderResults(element, scenario) {
  const table = document.createElement("table");
  const header = table.createTHead().insertRow();
  scenario.columns.forEach((column) => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = column;
    header.append(cell);
  });
  const body = table.createTBody();
  const decimals = new Intl.NumberFormat(getLang(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  scenario.rows.forEach((values) => {
    const row = body.insertRow();
    values.forEach((value, index) => {
      row.insertCell().textContent = scenario.decimalColumns.includes(index) ? decimals.format(value) : String(value);
    });
  });
  element.replaceChildren(table);
}

export function initAiDemo() {
  const demo = document.querySelector("[data-ai-demo]");
  if (!demo) return;

  const find = (name) => demo.querySelector(`[data-ai-${name}]`);
  const code = find("code");
  const chatCode = find("chat-code");
  const prompt = find("prompt");
  const runButton = find("run");
  const pauseButton = find("pause");
  const replayButton = find("replay");
  const conversation = demo.querySelector(".ai-chat-conversation");
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const scenarioButtons = [...demo.querySelectorAll("[data-scenario]")];
  let selected = "customers";
  let elapsed = 0;
  let previousTimestamp = null;
  let frame = null;
  let visible = false;
  let promptVisible = false;
  let paused = false;
  let state = "";
  let renderedSql = null;

  function setCode(sql) {
    if (renderedSql === sql) return;
    renderedSql = sql;
    const changes = elapsed >= TIME.review ? SCENARIOS[selected].changedLines : [];
    renderSql(code, sql, changes);
    renderSql(chatCode, sql, changes);
  }

  function updateControls() {
    find("controls").hidden = motion.matches;
    const complete = elapsed >= TIME.done || state === "explained";
    const canPlay = paused || complete;
    const label = state === "review" ? "ai.waiting" : complete ? "ai.replay" : canPlay ? "ai.resume" : "ai.pause";
    pauseButton.disabled = state === "review";
    pauseButton.setAttribute("aria-label", t(label));
    pauseButton.title = t(label);
    pauseButton.querySelector("use").setAttribute("href", canPlay ? "#i-play" : "#i-pause");
    replayButton.title = t("ai.replay");
    demo.dataset.paused = String(paused || !visible || document.hidden || (elapsed === 0 && !promptVisible));
    find("caption").textContent = t(state === "review" ? "ai.waiting" : state === "explained" ? "ai.explained" : "ai.preview");
  }

  function setState(next) {
    if (state === next) return;
    state = next;
    demo.dataset.state = next;
    runButton.disabled = next !== "review";
    const runLabel = next === "done" ? "ai.finished" : next === "running" ? "ai.running" : "ai.run";
    runButton.querySelector("span").textContent = t(runLabel);
    runButton.querySelector("use").setAttribute("href", next === "done" ? "#i-check" : "#i-play");
    const step = ["typing", "thinking"].includes(next) ? "ask" : ["done", "explained"].includes(next) ? "done" : "review";
    demo.querySelectorAll("[data-ai-step]").forEach((element) => {
      const current = element.dataset.aiStep === step;
      element.classList.toggle("is-current", current);
      if (current) element.setAttribute("aria-current", "step");
      else element.removeAttribute("aria-current");
    });
    // Announce stages, never each typed character.
    if (visible && !document.hidden) {
      const status = next === "generating" && SCENARIOS[selected].mode === "explain" ? "explaining" : next;
      find("status").textContent = t(`ai.status.${status}`);
    }
    if (next === "typing") conversation.scrollTop = 0;
    updateControls();
  }

  function render() {
    const scenario = SCENARIOS[selected];
    let next = elapsed < TIME.sent ? "typing" : elapsed < TIME.generate ? "thinking"
      : elapsed < TIME.review ? "generating" : elapsed < TIME.run ? "review"
      : elapsed < TIME.done ? "running" : "done";
    if (scenario.mode === "explain" && elapsed >= TIME.review) next = "explained";
    const question = t(`ai.${selected}.prompt`);
    prompt.textContent = next === "typing"
      ? question.slice(0, Math.floor(question.length * Math.min(1, elapsed / (TIME.sent - 350)))) || "…"
      : question;
    const progress = Math.max(0, Math.min(1, (elapsed - TIME.generate) / (TIME.review - TIME.generate)));
    setCode(scenario.mode === "explain" ? scenario.sql
      : elapsed < TIME.generate && scenario.baseSql ? scenario.baseSql
      : scenario.sql.slice(0, Math.floor(scenario.sql.length * progress)));
    setState(next);
  }

  function canAnimate() {
    // Reaching review never approves a query. Only the run button advances
    // elapsed to TIME.run, including after pause, replay or a language change.
    const limit = elapsed < TIME.run ? TIME.review : TIME.done;
    const canStart = elapsed > 0 || promptVisible;
    return canStart && visible && !document.hidden && !paused && !motion.matches && elapsed < limit;
  }

  function tick(timestamp) {
    frame = null;
    if (!canAnimate()) return;
    const limit = elapsed < TIME.run ? TIME.review : TIME.done;
    if (previousTimestamp !== null) elapsed = Math.min(limit, elapsed + timestamp - previousTimestamp);
    previousTimestamp = timestamp;
    render();
    if (canAnimate()) frame = requestAnimationFrame(tick);
  }

  function syncPlayback() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    previousTimestamp = null;
    updateControls();
    if (canAnimate()) frame = requestAnimationFrame(tick);
  }

  function selectScenario(id) {
    selected = id;
    const scenario = SCENARIOS[id];
    demo.dataset.mode = scenario.mode;
    find("filename").textContent = scenario.file;
    find("prompt").textContent = t(`ai.${id}.prompt`);
    find("summary").textContent = t(`ai.${id}.summary`);
    find("response").textContent = t(`ai.${scenario.mode}.response`);
    find("step-review").textContent = t(scenario.mode === "explain" ? "ai.stepRead" : "ai.stepReview");
    find("step-done").textContent = t(scenario.mode === "explain" ? "ai.stepUnderstand" : "ai.stepDone");
    find("context").textContent = scenario.tables.join(" + ");
    if (scenario.mode !== "explain") {
      find("rowcount").textContent = String(scenario.rows.length);
      find("result-time").textContent = scenario.duration;
      renderResults(find("results"), scenario);
    }
    scenarioButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.scenario === id)));
    demo.querySelectorAll("[data-ai-table]").forEach((row) => row.classList.toggle("is-used", scenario.tables.includes(row.dataset.aiTable)));
    state = "";
    renderedSql = null;
    elapsed = motion.matches || paused ? TIME.review : 0;
    conversation.scrollTop = 0;
    render();
    syncPlayback();
  }

  scenarioButtons.forEach((button) => {
    button.addEventListener("click", () => selectScenario(button.dataset.scenario));
  });

  runButton.addEventListener("click", () => {
    if (state !== "review") return;
    // The manual action also works while playback is paused.
    elapsed = paused || motion.matches ? TIME.done : TIME.run;
    render();
    syncPlayback();
  });

  pauseButton.addEventListener("click", () => {
    if (elapsed >= TIME.done || state === "explained") {
      paused = false;
      selectScenario(selected);
    } else {
      paused = !paused;
      syncPlayback();
    }
  });

  replayButton.addEventListener("click", () => {
    paused = false;
    selectScenario(selected);
  });

  onLanguageChange(() => {
    // Preserve progress and the user's pause preference when switching languages.
    const position = elapsed;
    selectScenario(selected);
    elapsed = position;
    render();
    syncPlayback();
  });

  motion.addEventListener("change", () => {
    if (motion.matches) elapsed = elapsed >= TIME.run ? TIME.done : TIME.review;
    render();
    syncPlayback();
  });

  document.addEventListener("visibilitychange", syncPlayback);
  find("controls").hidden = false;
  selectScenario(selected);

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.1;
      syncPlayback();
    }, { threshold: 0.1, rootMargin: "-105px 0px -24px 0px" });
    observer.observe(demo.querySelector(".ai-chat"));
    const startObserver = new IntersectionObserver(([entry]) => {
      promptVisible = entry.isIntersecting && entry.intersectionRatio >= 0.85;
      syncPlayback();
    }, { threshold: 0.85, rootMargin: "-105px 0px -24px 0px" });
    startObserver.observe(prompt);
  } else {
    visible = true;
    promptVisible = true;
    syncPlayback();
  }
}
