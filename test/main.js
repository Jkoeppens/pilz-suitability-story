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
const PREDICTION_SCROLL_THRESHOLD = 11000;

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

  groups = [...document.querySelectorAll(".media-group")];

  const raw = [];
  for (let i = 0; i < steps.length - 1; i++) {
    if (steps[i].stage !== steps[i + 1].stage) {
      raw.push({
        from: steps[i].stage,
        to: steps[i + 1].stage,
        fromCenter: steps[i].center,
        toCenter: steps[i + 1].center
      });
    }
  }

  transitions = raw.map(t => {
    const span = t.toCenter - t.fromCenter;
    return {
      from: t.from,
      to: t.to,
      start: t.toCenter - span * STAGE_FADE_PORTION,
      end: t.toCenter + EXTRA_STAGE_TAIL
    };
  });

  // Debug-Helfer
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
  const stage4 = document.querySelector('.media-group[data-stage="4"]');
  if (!stage4) return;

  const labels = [...stage4.querySelectorAll(".corner-label")];
  const firstStep4 = steps.find(s => s.stage === 4);
  if (!firstStep4) return;

  const trigger = firstStep4.center - window.innerHeight * 0.3;
  const visible = scrollCenter > trigger;

  labels.forEach(l => (l.style.opacity = visible ? 1 : 0));
}

/* =========================================================
   IMAGE OVERLAYS
========================================================= */
function applyOverlays(scrollCenter) {
  document.querySelectorAll(".overlay-img").forEach(o => (o.style.opacity = 0));

  const zones = {};

  steps.forEach(s => {
    const overlays = (s.el.dataset.overlay || "").split(" ").filter(Boolean);
    if (!overlays.length) return;

    const start = s.center + window.innerHeight * 0.25;
    let end = start;

    const t = transitions.find(tr => tr.from === s.stage);
    if (t) end = Math.max(end, t.end);
    else end = Infinity;

    overlays.forEach(cls => {
      (zones[cls] ||= []).push({ start, end });
    });
  });

  for (const cls in zones) {
    const img = document.querySelector("." + cls);
    if (!img) continue;

    let opacity = 0;
    zones[cls].forEach(({ start, end }) => {
      const fadeLen = window.innerHeight * 0.25;
      const fadeEnd = start + fadeLen;

      if (scrollCenter >= start && scrollCenter <= fadeEnd) {
        opacity = Math.max(opacity, (scrollCenter - start) / fadeLen);
      }

      if (scrollCenter > fadeEnd && scrollCenter <= end) {
        opacity = 1;
      }
    });

    img.style.opacity = opacity;
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
function applyHtmlOverlay(activeIndex) {
  const overlay = document.querySelector(".overlay-model");
  if (!overlay) return;

  if (activeIndex >= SHOW_MODEL_AT && activeIndex < HIDE_MODEL_AT) {
    overlay.classList.add("active");
    overlay.classList.remove("hidden");
    overlay.style.opacity = 1;
    overlay.style.pointerEvents = "auto";
  } else {
    overlay.classList.remove("active");
    overlay.classList.add("hidden");
    overlay.style.opacity = 0;
    overlay.style.pointerEvents = "none";
  }
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
function applyPredictionMap(scrollCenter) {
  const pred    = document.querySelector("#prediction-map");
  const overlay = document.querySelector(".overlay-model");
  if (!pred) return;

  const shouldShow = scrollCenter >= PREDICTION_SCROLL_THRESHOLD;

  if (shouldShow) {
    pred.classList.add("active");
    pred.classList.remove("hidden");

    // Surrogate-Overlay sicher ausblenden
    if (overlay) {
      overlay.classList.remove("active");
      overlay.classList.add("hidden");
      overlay.style.opacity = 0;
      overlay.style.pointerEvents = "none";
    }
  } else {
    pred.classList.remove("active");
    pred.classList.add("hidden");
  }
}

/* =========================================================
   SCROLL HANDLER
========================================================= */
function onScroll() {
  const scrollCenter = window.scrollY + window.innerHeight * 0.5;

  applyStageFade(scrollCenter);
  applyOverlays(scrollCenter);

  const activeIndex = applyStepVisibility(scrollCenter);

  applyHtmlOverlay(activeIndex);
  applyPredictionMap(scrollCenter);
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

  // EXIT BUTTON → Zurück in die Story
  const exit = document.getElementById("map-exit-btn");
  if (exit) {
    exit.addEventListener("click", () => {
      const pred = document.querySelector("#prediction-map");
      if (pred) {
        pred.classList.remove("active");
        pred.classList.add("hidden");
      }

      // ein Stück oberhalb der Schwelle landen
      const offset = 600;
      window.scrollTo({
        top: PREDICTION_SCROLL_THRESHOLD - offset,
        behavior: "smooth"
      });
    });
  }
});