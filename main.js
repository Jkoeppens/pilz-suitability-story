/* =========================================================
   Crossfade-Stages • Overlays • Markdown • HTML-Overlay
========================================================= */

let steps = [];
let groups = [];
let transitions = [];

const STAGE_FADE_PORTION   = 0.35;
const OVERLAY_FADE_PORTION = 0.25;
const EXTRA_STAGE_TAIL     = window.innerHeight * 0.5;

// Indizes aus deiner window._steps-Inspektion:
const SHOW_MODEL_AT  = 15; // slide4_03_charts.md
const HIDE_MODEL_AT  = 17; // slide4_05_prediction_explain.md
// Prediction-Map: ab fixer Scroll-Schwelle
const PREDICTION_SCROLL_THRESHOLD = 10500;

/* =========================================================
   MARKDOWN LADEN
========================================================= */
async function loadMarkdown() {
  const mdEls = [...document.querySelectorAll("[data-md]")];

  await Promise.all(
    mdEls.map(async el => {
      if (!el.dataset.md) return;
      try {
        const res = await fetch("text/" + el.dataset.md);
        el.innerHTML = marked.parse(await res.text());
      } catch (e) {
        console.error("Fehler beim Laden:", el.dataset.md, e);
      }
    })
  );
}

/* =========================================================
   AUTO-SPACING PRO STAGE
========================================================= */
function autoSpacing() {
  const stepEls = [...document.querySelectorAll(".step")];
  const byStage = {};

  stepEls.forEach(el => {
    if (el.dataset.introStep) return;
    const st = Number(el.dataset.stage);
    (byStage[st] ||= []).push(el);
  });

  Object.values(byStage).forEach(stageSteps => {
    const margin = 30 + stageSteps.length * 8;
    stageSteps.forEach(s => {
      s.style.marginTop = `${margin}vh`;
      s.style.marginBottom = `${margin}vh`;
    });
  });
}

/* =========================================================
   LAYOUT & TRANSITIONS
========================================================= */
function computeLayout() {
  const stepEls = [...document.querySelectorAll(".step")];

  // -----------------------------
  // 1. Steps erfassen
  // -----------------------------
  steps = stepEls.map((el, i) => {
    const top = el.offsetTop;
    const height = el.offsetHeight;

    return {
      el,
      index: i,
      top,
      center: top + height / 2,
      stage: Number(el.dataset.stage)
    };
  });

  // -----------------------------
  // 2. Media-Gruppen erfassen
  // -----------------------------
  groups = [...document.querySelectorAll(".media-group")];

  // -----------------------------
  // 3. Stage-Wechsel finden
  // -----------------------------
  const rawTransitions = [];

  for (let i = 0; i < steps.length - 1; i++) {
    const a = steps[i];
    const b = steps[i + 1];

    if (a.stage !== b.stage) {
      rawTransitions.push({
        from: a.stage,
        to: b.stage,
        at: b.center
      });
    }
  }

  // -----------------------------
  // 4. Übergänge berechnen
  //    (FIXE Fade-Länge!)
  // -----------------------------
  const FIXED_FADE_LENGTH = window.innerHeight * 1.2;

  transitions = rawTransitions.map(t => ({
    from: t.from,
    to: t.to,
    start: t.at - FIXED_FADE_LENGTH * STAGE_FADE_PORTION,
    end: t.at + EXTRA_STAGE_TAIL
  }));

  // -----------------------------
  // 5. Debug
  // -----------------------------
  window._steps = steps;
  window._transitions = transitions;
  window._groups = groups;
}

/* =========================================================
   STAGE-FADES
========================================================= */
function getGroup(stage) {
  return groups.find(g => Number(g.dataset.stage) === stage);
}

function applyStageFade(scrollCenter) {
  groups.forEach(g => g.style.opacity = 0);

  if (!transitions.length) {
    const g1 = getGroup(1);
    if (g1) g1.style.opacity = 1;
    return;
  }

  const first = transitions[0];

  if (scrollCenter <= first.start) {
    getGroup(first.from).style.opacity = 1;
    return;
  }

  for (const t of transitions) {
    if (scrollCenter >= t.start && scrollCenter <= t.end) {
      const p = (scrollCenter - t.start) / (t.end - t.start);
      getGroup(t.from).style.opacity = 1 - p;
      getGroup(t.to).style.opacity = p;
      return;
    }
    if (scrollCenter < t.start) {
      getGroup(t.from).style.opacity = 1;
      return;
    }
  }

  getGroup(transitions.at(-1).to).style.opacity = 1;
}

/* =========================================================
   CORNER LABELS
========================================================= */
function applyCornerLabels(scrollCenter) {
  const activeGroup =
    groups.find(g => g.style.opacity > 0.5);
  if (!activeGroup) return;

  const labels = [...activeGroup.querySelectorAll(".corner-label")];
  if (!labels.length) return;

  const stage = Number(activeGroup.dataset.stage);
  const firstStep = steps.find(s => s.stage === stage);
  if (!firstStep) return;

  const trigger = firstStep.center - window.innerHeight * 0.3;
  const visible = scrollCenter > trigger;

  labels.forEach(l => (l.style.opacity = visible ? 1 : 0));
}

/* =========================================================
   IMAGE OVERLAYS
========================================================= */
function applyOverlays(scrollCenter) {
  // alles zurücksetzen
  document.querySelectorAll(".overlay-img").forEach(o => {
    o.style.opacity = 0;
  });

  const zones = {};

  // Zonen sammeln
  steps.forEach(s => {
    const overlays = (s.el.dataset.overlay || "")
      .split(" ")
      .filter(Boolean);

    if (!overlays.length) return;

    const start = s.center + window.innerHeight * 0.25;
    let end = start;

    const t = transitions.find(tr => tr.from === s.stage);
    if (t) end = Math.max(end, t.end);
    else end = Infinity;

    overlays.forEach(cls => {
      if (!zones[cls]) zones[cls] = [];
      zones[cls].push({ start, end });
    });
  });

  // Overlays anwenden
  for (const cls in zones) {
    const imgs = document.querySelectorAll("." + cls);
    if (!imgs.length) continue;

    let opacity = 0;

    zones[cls].forEach(({ start, end }) => {
      const fadeLen = window.innerHeight * 0.25;
      const fadeEnd = start + fadeLen;

      if (scrollCenter >= start && scrollCenter <= fadeEnd) {
        opacity = Math.max(
          opacity,
          (scrollCenter - start) / fadeLen
        );
      }

      if (scrollCenter > fadeEnd && scrollCenter <= end) {
        opacity = 1;
      }
    });

    imgs.forEach(img => {
      img.style.opacity = opacity;
    });
  }
}

/* =========================================================
   ACTIVE TEXT STEP
========================================================= */
function applyStepVisibility(scrollCenter) {
  steps.forEach(s => s.el.classList.remove("step--active"));

  let best = null;
  let bestDist = Infinity;

  steps.forEach(s => {
    const d = Math.abs(scrollCenter - s.center);
    if (d < bestDist) {
      best = s;
      bestDist = d;
    }
  });

  if (best) best.el.classList.add("step--active");

  return best.index;
}

/* =========================================================
   SURROGATE TREE OVERLAY (Decision Tree)
========================================================= */
function applyHtmlOverlay(scrollCenter) {
  const overlay = document.querySelector(".overlay-model");
  if (!overlay) return;

  let visible = false;

  steps.forEach(s => {
    // nur Steps, die das Modell explizit wollen
    if (!s.el.dataset.model) return;

    // Start: leicht nach dem Step-Zentrum
    const start = s.center + window.innerHeight * 0.25;

    // Ende: bis zum Ende des Stage-Fades
    let end = start;
    const t = transitions.find(tr => tr.from === s.stage);
    if (t) {
      end = Math.max(end, t.end);
    } else {
      end = Infinity;
    }

    // Sichtbarkeitsprüfung
    if (scrollCenter >= start && scrollCenter <= end) {
      visible = true;
    }
  });

  // Anwendung
  overlay.style.opacity = visible ? 1 : 0;
  overlay.style.pointerEvents = visible ? "auto" : "none";

  overlay.classList.toggle("active", visible);
  overlay.classList.toggle("hidden", !visible);
}

/* =========================================================
   FULLSCREEN LEAFLET SUITABILITY MAP
========================================================= */

let suitMap = null;
let suitMapInitialized = false;

function initSuitMap() {
  if (suitMapInitialized) {
    suitMap.invalidateSize();
    return;
  }
  suitMapInitialized = true;

  suitMap = L.map("suit-map-inner", {
    zoomControl: true,
    attributionControl: false
  }).setView([52.50, 13.40], 11);

  // Hintergrund
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19
  }).addTo(suitMap);

  // Suitability-Tiles (über Cloudflare R2)
  L.tileLayer(
    "https://pub-4f210cbdaa354727aed0c7ebd8e993a0.r2.dev/tiles_suit/{z}/{x}/{y}.png",
    {
      tms: true,
      crossOrigin: true,
      maxNativeZoom: 15,
      maxZoom: 19,
      opacity: 0.85
    }
  ).addTo(suitMap);

  setTimeout(() => suitMap.invalidateSize(), 250);
}

/* =========================================================
   PREDICTION MAP OVERLAY (zeige/verstecke #prediction-map)
========================================================= */
function applyPredictionMapByStep(activeIndex) {
  const pred = document.querySelector("#prediction-map");
  if (!pred) return;

  const show =
    steps[activeIndex]?.el.dataset.trigger === "prediction-map";

  pred.classList.toggle("active", show);
  pred.classList.toggle("hidden", !show);

  if (show) initSuitMap();
}

/* =========================================================
   SCROLL HANDLER
========================================================= */
function onScroll() {
  const scrollCenter = window.scrollY + window.innerHeight * 0.5;

  applyStageFade(scrollCenter);
  applyOverlays(scrollCenter);

  const activeIndex = applyStepVisibility(scrollCenter);

  applyHtmlOverlay(scrollCenter);
  applyPredictionMapByStep(activeIndex);
  applyCornerLabels(scrollCenter);
}

/* =========================================================
   INIT
========================================================= */
document.addEventListener("DOMContentLoaded", async () => {
  await loadMarkdown();

  autoSpacing();
  computeLayout();
  initSuitMap();
  onScroll();

  window.addEventListener("scroll", onScroll);
  window.addEventListener("resize", () => {
    autoSpacing();
    computeLayout();
    onScroll();
  });

// EXIT BUTTON → Zurück zur Erklärung vor der Karte
const exit = document.getElementById("map-exit-btn");

if (exit) {
  exit.addEventListener("click", () => {

    const target = steps.find(
      s => s.el.dataset.md === "slide5_06_prediction_explain.md"
    );

    if (!target) {
      console.warn("prediction-explain Step nicht gefunden");
      return;
    }

    // relativer Offset: 25 % Viewport-Höhe
    window.scrollTo({
      top: target.top - window.innerHeight * 0.25,
      behavior: "smooth"
    });
  });
}
});