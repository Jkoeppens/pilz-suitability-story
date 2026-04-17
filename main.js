/* =========================================================
   Scrollytelling • MapLibre GL JS
========================================================= */

/* =========================================================
   LANGUAGE
========================================================= */
const SUPPORTED_LANGS = new Set(["de", "en"]);
const LANG_STORAGE_KEY = "scrolly_lang";

function getLangFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const lang = (params.get("lang") || "").toLowerCase();
  return SUPPORTED_LANGS.has(lang) ? lang : null;
}

function getBrowserLang() {
  const raw = (navigator.language || "de").toLowerCase();
  const short = raw.split("-")[0];
  return SUPPORTED_LANGS.has(short) ? short : "de";
}

function getInitialLang() {
  const urlLang = getLangFromUrl();
  if (urlLang) return urlLang;
  const stored = (localStorage.getItem(LANG_STORAGE_KEY) || "").toLowerCase();
  if (SUPPORTED_LANGS.has(stored)) return stored;
  return getBrowserLang();
}

let currentLang = getInitialLang();

function updateLangSwitchUI() {
  const root = document.getElementById("lang-switch");
  if (!root) return;
  root.querySelectorAll(".lang-btn").forEach(btn => {
    btn.classList.toggle("is-active", btn.dataset.lang === currentLang);
  });
}

function setLang(nextLang, { updateUrl = true } = {}) {
  if (!SUPPORTED_LANGS.has(nextLang)) return;
  currentLang = nextLang;
  localStorage.setItem(LANG_STORAGE_KEY, currentLang);
  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set("lang", currentLang);
    history.replaceState({}, "", url);
  }
  updateLangSwitchUI();
}

/* =========================================================
   I18N
========================================================= */
const I18N = {
  de: {
    legend_moran_sub:      "lokale Clusterung",
    legend_geary_sub:      "lokaler Kontrast",
    legend_ndwi_sub:       "Feuchte",
    legend_ndvi_sub:       "Vegetation",
    map_suitability_title: "Eignung für Parasole",
    map_back:              "← Zurück"
  },
  en: {
    legend_moran_sub:      "local clustering",
    legend_geary_sub:      "local contrast",
    legend_ndwi_sub:       "moisture",
    legend_ndvi_sub:       "vegetation",
    map_suitability_title: "Parasol suitability",
    map_back:              "← Back"
  }
};

function applyI18n() {
  const dict = I18N[currentLang] || I18N.de;
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    if (!key || dict[key] == null) return;
    el.textContent = dict[key];
  });
  document.documentElement.lang = currentLang;
}

function mountLangSwitchIntoIntro() {
  const sw    = document.getElementById("lang-switch");
  const intro = document.querySelector("#intro .intro-block");
  if (!sw || !intro) return;
  if (sw.parentElement !== intro) intro.prepend(sw);
}

/* =========================================================
   MARKDOWN
========================================================= */
async function loadMarkdown() {
  const mdEls = [...document.querySelectorAll("[data-md]")];
  await Promise.all(
    mdEls.map(async el => {
      if (!el.dataset.md) return;
      try {
        const res = await fetch(`text/${currentLang}/` + el.dataset.md);
        el.innerHTML = marked.parse(await res.text());
      } catch (e) {
        console.error("Fehler beim Laden:", el.dataset.md, e);
      }
    })
  );
}

/* =========================================================
   SCROLL STATE
========================================================= */
let steps       = [];
let groups      = [];   // .media-group elements (Stage 1 PNG overlay)
let transitions = [];

const STAGE_FADE_PORTION = 0.35;
const EXTRA_STAGE_TAIL   = window.innerHeight * 0.5;

/* =========================================================
   MAP CONFIG
========================================================= */
const MAPTILER_KEY = window.MAPTILER_KEY || '';

// Camera position per stage — adjust center/zoom to your data extent
const STAGE_CAMERAS = {
  1: { center: [13.40, 52.50], zoom:  9.0 },
  2: { center: [13.40, 52.50], zoom: 10.5 },
  3: { center: [13.22, 52.47], zoom: 12.0 },
  4: { center: [13.22, 52.47], zoom: 12.0 },   // Grunewald bleibt durch Stage 4
  5: { center: [13.40, 52.50], zoom:  9.5 },   // Berlin ab slide5_02_signatures_Data
};

// Camera override per step: from this slide onwards, use the given camera
const STEP_CAMERA_OVERRIDES = {
  'slide5_02_signatures_Data.md': { center: [13.40, 52.50], zoom: 9.5 },
};

// Maps data-overlay values → MapLibre layer IDs that should become visible
const OVERLAY_TO_LAYERS = {
  'overlay-pilz':                   [],
  'overlay-parasole':               ['parasol-points'],
  'overlay-parasol2':               ['parasol-points'],
  'overlay-meisen':                 ['parasol-points', 'meisen-points'],
  'overlay-fundpunkte-berlin_stg4': ['parasol-points', 'meisen-points'],
  'overlay-fundpunkte-berlin':      ['parasol-points', 'meisen-points'],
};

const RASTER_LAYERS = ['ndvi-layer', 'ndwi-layer', 'moran-layer', 'geary-layer'];
const POINT_LAYERS  = ['parasol-points', 'meisen-points'];
const HALO_LAYERS   = ['parasol-halo',   'meisen-halo'];
const RIPPLE_LAYERS = ['parasol-ripple', 'meisen-ripple'];
const SUIT_LAYER    = 'suitability-layer';
const ALL_LAYERS    = [...HALO_LAYERS, ...RIPPLE_LAYERS, ...POINT_LAYERS, ...RASTER_LAYERS, SUIT_LAYER];

/* =========================================================
   MAPLIBRE INIT
========================================================= */
let map             = null;
let mapReady        = false;

/* QUAD OVERLAY (Stage 4 – 2×2 Raster-Karte via CSS-positioned <img>) */
let quadOverlays = null;

const QUAD_IMG_DEFS = [
  { container: 'quad-tl', file: 'maps/moran_colored.png' },
  { container: 'quad-tr', file: 'maps/geary_colored.png' },
  { container: 'quad-bl', file: 'maps/ndwi_colored.png'  },
  { container: 'quad-br', file: 'maps/ndvi_colored.png'  },
];

// WGS84 extent shared by all raster layers
const IMG_NW = [12.6470, 53.0203];
const IMG_SE = [14.3160, 51.9793];

function initQuadOverlays() {
  if (quadOverlays) return;
  quadOverlays = QUAD_IMG_DEFS.map(({ container, file }) => {
    const cell = document.getElementById(container);
    const img  = document.createElement('img');
    img.src              = file;
    img.style.position   = 'absolute';
    img.style.opacity    = '0.82';
    img.style.pointerEvents = 'none';
    cell.appendChild(img);
    return img;
  });
  updateQuadOverlays();
}

function updateQuadOverlays() {
  if (!quadOverlays) return;
  const nw = map.project(IMG_NW);
  const se = map.project(IMG_SE);
  const l = nw.x, t = nw.y, w = se.x - nw.x, h = se.y - nw.y;
  quadOverlays.forEach(img => {
    img.style.left   = `${l}px`;
    img.style.top    = `${t}px`;
    img.style.width  = `${w}px`;
    img.style.height = `${h}px`;
  });
}

function initMap() {
  map = new maplibregl.Map({
    container: 'map',
    style: `https://api.maptiler.com/maps/satellite/style.json?key=${MAPTILER_KEY}`,
    center:    STAGE_CAMERAS[1].center,
    zoom:      STAGE_CAMERAS[1].zoom,
    pitch:     0,
    attributionControl: false
  });

  map.addControl(
    new maplibregl.AttributionControl({ compact: true }),
    'bottom-right'
  );

  // Move #quad-root into the canvas container so it shares the same stacking
  // context as the WebGL canvas — MapLibre circle layers then render above it.
  const quadRoot = document.getElementById('quad-root');
  if (quadRoot) map.getCanvasContainer().appendChild(quadRoot);

  map.on('load', async () => {
    addMapLayers();
    await loadPointData();
    mapReady = true;
    onScroll();
  });

  map.on('move', updateQuadOverlays);
}

// Bounding box gemeinsam für alle Raster-Layer (WGS84)
const RASTER_COORDS = [
  [12.6470, 53.0203],  // NW
  [14.3160, 53.0203],  // NE
  [14.3160, 51.9793],  // SE
  [12.6470, 51.9793],  // SW
];

/* =========================================================
   LAYER DEFINITIONS
   Order: raster/suitability first (bottom), then circles on top
========================================================= */
function addMapLayers() {

  // ── Raster layers (pre-coloured PNGs, image source) ─────
  const imageLayers = [
    { id: 'ndvi-layer',  src: 'ndvi-src',  file: 'maps/ndvi_colored.png'  },
    { id: 'ndwi-layer',  src: 'ndwi-src',  file: 'maps/ndwi_colored.png'  },
    { id: 'moran-layer', src: 'moran-src', file: 'maps/moran_colored.png' },
    { id: 'geary-layer', src: 'geary-src', file: 'maps/geary_colored.png' },
  ];

  imageLayers.forEach(({ id, src, file }) => {
    map.addSource(src, {
      type: 'image',
      url: file,
      coordinates: RASTER_COORDS
    });
    map.addLayer({
      id,
      type: 'raster',
      source: src,
      layout: { visibility: 'none' },
      paint: { 'raster-opacity': 0.85 }
    });
  });

  // ── Suitability tiles ────────────────────────────────────
  map.addSource('suitability-src', {
    type: 'raster',
    tiles: ['tiles_suit/{z}/{x}/{y}.png'],
    tileSize: 256,
    maxzoom:  12
  });
  map.addLayer({
    id:     SUIT_LAYER,
    type:   'raster',
    source: 'suitability-src',
    layout: { visibility: 'none' },
    paint:  { 'raster-opacity': 0.85 }
  });

  // ── Parasol find points (staggered-fade + ripple) ────────
  map.addSource('parasol-src', {
    type: 'geojson',
    data: 'maps/Parasolfunde.geojson',
    generateId: true
  });
  map.addLayer({
    id: 'parasol-halo',
    type: 'circle',
    source: 'parasol-src',
    layout: { visibility: 'none' },
    paint: {
      'circle-radius':  12,
      'circle-color':   '#f3e79b',
      'circle-opacity': ['*', ['coalesce', ['feature-state', 'opacity'], 0], 0.25],
      'circle-stroke-width': 0,
    }
  });
  map.addLayer({
    id: 'parasol-ripple',
    type: 'circle',
    source: 'parasol-src',
    layout: { visibility: 'none' },
    paint: {
      'circle-radius':  ['coalesce', ['feature-state', 'ripple_r'],  0],
      'circle-color':   '#f3e79b',
      'circle-opacity': ['coalesce', ['feature-state', 'ripple_op'], 0],
      'circle-stroke-width': 0,
    }
  });
  map.addLayer({
    id: 'parasol-points',
    type: 'circle',
    source: 'parasol-src',
    layout: { visibility: 'none' },
    paint: {
      'circle-radius':       ['interpolate', ['linear'], ['zoom'], 7, 3, 14, 8],
      'circle-color':        '#f3e79b',
      'circle-opacity':      ['*', ['coalesce', ['feature-state', 'opacity'], 0], 0.9],
      'circle-stroke-width': 0.5,
      'circle-stroke-color': 'rgba(0,0,0,0.4)'
    }
  });

  // ── Meisen / Bias-Punkte (staggered-fade + ripple) ───────
  map.addSource('meisen-src', {
    type: 'geojson',
    data: 'maps/Meisenfunde.geojson',
    generateId: true
  });
  map.addLayer({
    id: 'meisen-halo',
    type: 'circle',
    source: 'meisen-src',
    layout: { visibility: 'none' },
    paint: {
      'circle-radius':  12,
      'circle-color':   '#61d1c7',
      'circle-opacity': ['*', ['coalesce', ['feature-state', 'opacity'], 0], 0.25],
      'circle-stroke-width': 0,
    }
  });
  map.addLayer({
    id: 'meisen-ripple',
    type: 'circle',
    source: 'meisen-src',
    layout: { visibility: 'none' },
    paint: {
      'circle-radius':  ['coalesce', ['feature-state', 'ripple_r'],  0],
      'circle-color':   '#61d1c7',
      'circle-opacity': ['coalesce', ['feature-state', 'ripple_op'], 0],
      'circle-stroke-width': 0,
    }
  });
  map.addLayer({
    id: 'meisen-points',
    type: 'circle',
    source: 'meisen-src',
    layout: { visibility: 'none' },
    paint: {
      'circle-radius':       ['interpolate', ['linear'], ['zoom'], 7, 2, 14, 6],
      'circle-color':        '#61d1c7',
      'circle-opacity':      ['*', ['coalesce', ['feature-state', 'opacity'], 0], 0.9],
      'circle-stroke-width': 0.5,
      'circle-stroke-color': 'rgba(0,0,0,0.4)'
    }
  });
}


/* =========================================================
   POINT ANIMATION – canvas overlay (z-index 20, above quad)
   All point rendering happens on #points-canvas, not via
   MapLibre circle layers, so circles are always above the
   CSS quad images regardless of stacking context.
========================================================= */

const POINT_ANIM_CFG = {
  'parasol-src': { url: 'maps/Parasolfunde.geojson', count: 0 },
  'meisen-src':  { url: 'maps/Meisenfunde.geojson',  count: 0 },
};

// Loaded GeoJSON coordinates per source
const pointFeatures = {
  'parasol-src': [],   // [{id, lng, lat}]
  'meisen-src':  [],
};

// Per-source runtime animation state
const animStates = {
  'parasol-src': { done: false, allRevealed: false, revealed: new Set(), rippleStart: new Map(), revealDelays: [], t0: null },
  'meisen-src':  { done: false, allRevealed: false, revealed: new Set(), rippleStart: new Map(), revealDelays: [], t0: null },
};

const LAYER_TO_SRC = { 'parasol-points': 'parasol-src', 'meisen-points': 'meisen-src' };
let   canvasVisible = new Set();  // which sources are currently shown on the canvas

async function loadPointData() {
  for (const [srcId, cfg] of Object.entries(POINT_ANIM_CFG)) {
    try {
      const data = await fetch(cfg.url).then(r => r.json());
      cfg.count = data.features.length;
      pointFeatures[srcId] = data.features.map((f, i) => ({
        id:  i,
        lng: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
      }));
    } catch (e) {
      console.warn('[points] could not load', cfg.url, e);
    }
  }
}

function shuffleIndices(n) {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ── Canvas draw ─────────────────────────────────────── */
function redrawPointsCanvas(now = performance.now()) {
  const canvas = document.getElementById('points-canvas');
  if (!canvas || !mapReady) return;

  if (canvasVisible.size === 0) {
    canvas.style.display = 'none';
    return;
  }
  canvas.style.display = 'block';

  if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const zoom   = map.getZoom();
  const pulseT = (Math.sin(now / 1000 * Math.PI) + 1) / 2;   // 0–1, period 2 s
  const haloR  = 10 + 4 * pulseT;

  for (const [srcId, features] of Object.entries(pointFeatures)) {
    if (!canvasVisible.has(srcId)) continue;

    const isParasol = srcId === 'parasol-src';
    const color = isParasol ? '#f3e79b' : '#61d1c7';
    const minR  = isParasol ? 3 : 2;
    const maxR  = isParasol ? 8 : 6;
    const coreR = minR + (maxR - minR) * Math.min(1, Math.max(0, (zoom - 7) / 7));
    const state = animStates[srcId];

    for (const { id, lng, lat } of features) {
      if (!state.revealed.has(id)) continue;
      const pt = map.project([lng, lat]);
      if (pt.x < -60 || pt.x > canvas.width + 60 ||
          pt.y < -60 || pt.y > canvas.height + 60) continue;

      // Halo – pulsing glow
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, haloR, 0, Math.PI * 2);
      ctx.fillStyle   = color;
      ctx.globalAlpha = 0.25;
      ctx.fill();

      // Ripple ring
      const rs = state.rippleStart.get(id);
      if (rs !== undefined) {
        const t = Math.min(1, (now - rs) / 600);
        if (t < 1) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 5 + 18 * t, 0, Math.PI * 2);
          ctx.fillStyle   = color;
          ctx.globalAlpha = 0.55 * (1 - t);
          ctx.fill();
        }
      }

      // Core dot
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, coreR, 0, Math.PI * 2);
      ctx.fillStyle   = color;
      ctx.globalAlpha = 0.9;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth   = 0.5;
      ctx.globalAlpha = 1;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

/* ── Animation start / reset ─────────────────────────── */
function startPointAnimation(srcId) {
  const cfg   = POINT_ANIM_CFG[srcId];
  const state = animStates[srcId];
  if (!state || state.done || cfg.count === 0) return;

  const order = shuffleIndices(cfg.count);
  state.revealDelays = new Array(cfg.count);
  order.forEach((featureId, rank) => {
    state.revealDelays[featureId] = (rank / cfg.count) * 1500;
  });

  state.revealed.clear();
  state.rippleStart.clear();
  state.allRevealed = false;
  state.done        = false;
  state.t0          = performance.now();
}

function resetPointAnimation(srcId) {
  const state = animStates[srcId];
  if (!state) return;
  state.done        = false;
  state.allRevealed = false;
  state.t0          = null;
  state.revealed.clear();
  state.rippleStart.clear();
}

/* ── Single continuous rAF loop: reveal + ripple + pulse ─ */
let pulseRafId = null;

function startPulseLoop() {
  if (pulseRafId) return;
  function tick(now) {
    // Advance all active animations
    for (const [srcId, state] of Object.entries(animStates)) {
      if (!canvasVisible.has(srcId) || state.done || state.t0 === null) continue;
      const cfg     = POINT_ANIM_CFG[srcId];
      const elapsed = now - state.t0;

      if (!state.allRevealed) {
        for (let id = 0; id < cfg.count; id++) {
          if (!state.revealed.has(id) && elapsed >= state.revealDelays[id]) {
            state.revealed.add(id);
            state.rippleStart.set(id, now);
          }
        }
        if (state.revealed.size === cfg.count) state.allRevealed = true;
      }

      for (const [id, t_start] of state.rippleStart) {
        if (now - t_start >= 600) state.rippleStart.delete(id);
      }

      if (state.allRevealed && state.rippleStart.size === 0) state.done = true;
    }

    redrawPointsCanvas(now);
    pulseRafId = requestAnimationFrame(tick);
  }
  pulseRafId = requestAnimationFrame(tick);
}

function stopPulseLoop() {
  if (pulseRafId) { cancelAnimationFrame(pulseRafId); pulseRafId = null; }
  const canvas = document.getElementById('points-canvas');
  if (canvas) canvas.style.display = 'none';
}

/* =========================================================
   INTERACTIVE SUITABILITY MAP
========================================================= */
let suitMap            = null;
let suitMapInitialized = false;

function initSuitMap() {
  if (suitMapInitialized) {
    suitMap?.resize();
    return;
  }
  suitMapInitialized = true;

  suitMap = new maplibregl.Map({
    container: 'suit-map-inner',
    style: `https://api.maptiler.com/maps/satellite/style.json?key=${MAPTILER_KEY}`,
    center: [13.40, 52.50],
    zoom: 11,
    minZoom: 7,
    attributionControl: false
  });

  suitMap.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
  suitMap.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

  suitMap.on('load', () => {
    suitMap.addSource('suit-tiles', {
      type:   'raster',
      tiles:  ['tiles_suit/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom:  13
    });
    suitMap.addLayer({
      id:    'suit-overlay',
      type:  'raster',
      source: 'suit-tiles',
      paint: { 'raster-opacity': 0.82 }
    });
  });
}

function applyPredictionMap(activeIndex) {
  const pred = document.getElementById('prediction-map');
  if (!pred) return;

  const show = steps[activeIndex]?.el.dataset.trigger === 'prediction-map';

  pred.classList.toggle('active', show);
  pred.classList.toggle('hidden', !show);

  // Lock page scroll while interactive map is open
  document.body.style.overflow = show ? 'hidden' : '';

  if (show) {
    initSuitMap();
    // Defer resize until the container is fully visible
    requestAnimationFrame(() => suitMap?.resize());
  }
}

/* =========================================================
   AUTO-SPACING
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
      s.style.marginTop    = `${margin}vh`;
      s.style.marginBottom = `${margin}vh`;
    });
  });
}

/* =========================================================
   LAYOUT & TRANSITIONS
========================================================= */
function computeLayout() {
  const stepEls = [...document.querySelectorAll(".step")];

  steps = stepEls.map((el, i) => ({
    el,
    index:  i,
    top:    el.offsetTop,
    center: el.offsetTop + el.offsetHeight / 2,
    stage:  Number(el.dataset.stage)
  }));

  groups = [...document.querySelectorAll('.media-group')];

  const FIXED_FADE_LENGTH = window.innerHeight * 1.2;
  const rawTransitions    = [];

  for (let i = 0; i < steps.length - 1; i++) {
    const a = steps[i], b = steps[i + 1];
    if (a.stage !== b.stage) {
      rawTransitions.push({ from: a.stage, to: b.stage, at: b.center });
    }
  }

  transitions = rawTransitions.map(t => ({
    from:  t.from,
    to:    t.to,
    at:    t.at,
    start: t.at - FIXED_FADE_LENGTH * STAGE_FADE_PORTION,
    end:   t.at + EXTRA_STAGE_TAIL
  }));

  window._steps       = steps;
  window._transitions = transitions;
}

/* =========================================================
   CURRENT STAGE RESOLVER
========================================================= */
function getCurrentStage(scrollCenter) {
  if (!transitions.length) return steps[0]?.stage ?? 1;

  const first = transitions[0];
  if (scrollCenter <= first.start) return first.from;

  for (const t of transitions) {
    if (scrollCenter < t.start) return t.from;
    if (scrollCenter <= t.end) {
      const p = (scrollCenter - t.start) / (t.end - t.start);
      return p < 0.5 ? t.from : t.to;
    }
  }

  return transitions.at(-1).to;
}

/* =========================================================
   MAP: CAMERA
========================================================= */
let currentCamKey = null;

function applyMapCamera(scrollCenter, activeIndex) {
  if (!mapReady) return;

  // Find the last step-level override that is at or before activeIndex
  let cam = null;
  let camKey = null;
  for (let i = activeIndex; i >= 0; i--) {
    const md = steps[i]?.el.dataset.md;
    if (md && STEP_CAMERA_OVERRIDES[md]) {
      cam    = STEP_CAMERA_OVERRIDES[md];
      camKey = md;
      break;
    }
  }

  // Fall back to stage-based camera
  if (!cam) {
    const stage = getCurrentStage(scrollCenter);
    cam    = STAGE_CAMERAS[stage];
    camKey = `stage-${stage}`;
  }

  if (!cam || camKey === currentCamKey) return;
  currentCamKey = camKey;

  map.easeTo({
    center:   cam.center,
    zoom:     cam.zoom,
    pitch:    0,
    bearing:  0,
    duration: 1000
  });
}

/* =========================================================
   MAP: LAYER VISIBILITY
========================================================= */
function applyMapLayers(activeIndex) {
  if (!mapReady) return;

  const activeStep = steps[activeIndex];
  if (!activeStep) return;

  const currentStage = activeStep.stage;
  const visible      = new Set();

  // Accumulate all layers triggered by steps up to activeIndex within this stage
  for (let i = 0; i <= activeIndex; i++) {
    const s = steps[i];
    if (s.stage !== currentStage) continue;

    (s.el.dataset.overlay || '')
      .split(' ')
      .filter(Boolean)
      .forEach(ov => {
        (OVERLAY_TO_LAYERS[ov] || []).forEach(l => visible.add(l));
      });
  }

  // Prediction step: also show the suitability layer
  if (activeStep.el.dataset.trigger === 'prediction-map') {
    visible.add(SUIT_LAYER);
  }

  // ── Canvas point management ──────────────────────────────
  // Points are drawn on #points-canvas (z-index 20), not as MapLibre layers,
  // so they always render above the CSS quad images.
  const newCanvasVisible = new Set();
  if (visible.has('parasol-points')) newCanvasVisible.add('parasol-src');
  if (visible.has('meisen-points'))  newCanvasVisible.add('meisen-src');

  for (const [layerId, srcId] of Object.entries(LAYER_TO_SRC)) {
    const nowVis = visible.has(layerId);
    const wasVis = canvasVisible.has(srcId);
    if (nowVis && !wasVis)  startPointAnimation(srcId);
    else if (!nowVis && wasVis) resetPointAnimation(srcId);
  }
  canvasVisible = newCanvasVisible;

  if (canvasVisible.size > 0) startPulseLoop();
  else                        stopPulseLoop();

  // Remove point/halo/ripple from MapLibre visibility — canvas handles them
  POINT_LAYERS.forEach(id => visible.delete(id));
  HALO_LAYERS.forEach(id  => visible.delete(id));
  RIPPLE_LAYERS.forEach(id => visible.delete(id));

  // ── Stage 5: 2×2 Raster-Viererkarte ──────────────────────
  const showQuad = (currentStage === 5) && activeStep.el.dataset.trigger !== 'prediction-map';

  ALL_LAYERS.forEach(id => {
    try {
      map.setLayoutProperty(id, 'visibility', visible.has(id) ? 'visible' : 'none');
    } catch (_) {}
  });

  const quadRoot = document.getElementById('quad-root');
  if (quadRoot) {
    quadRoot.classList.toggle('hidden', !showQuad);
    if (showQuad) {
      initQuadOverlays();
      updateQuadOverlays();
    }
  }

  // Show/hide suitability legend
  const legend = document.getElementById('suit-legend');
  if (legend) legend.classList.toggle('hidden', !visible.has(SUIT_LAYER));
}

/* =========================================================
   ACTIVE TEXT STEP
========================================================= */
function applyStepVisibility(scrollCenter) {
  steps.forEach(s => s.el.classList.remove("step--active"));

  let best = null, bestDist = Infinity;
  steps.forEach(s => {
    const d = Math.abs(scrollCenter - s.center);
    if (d < bestDist) { best = s; bestDist = d; }
  });

  if (best) best.el.classList.add("step--active");
  return best?.index ?? 0;
}

/* =========================================================
   DECISION TREE HTML OVERLAY
========================================================= */
function applyHtmlOverlay(scrollCenter) {
  const overlay = document.querySelector(".overlay-model");
  if (!overlay) return;

  let visible = false;

  steps.forEach(s => {
    if (!s.el.dataset.model) return;
    const start = s.center + window.innerHeight * 0.25;
    let end     = start;
    const t     = transitions.find(tr => tr.from === s.stage);
    if (t) end  = Math.max(end, t.end);
    else   end  = Infinity;
    if (scrollCenter >= start && scrollCenter <= end) visible = true;
  });

  overlay.style.opacity      = visible ? 1 : 0;
  overlay.style.pointerEvents = visible ? 'auto' : 'none';
  overlay.classList.toggle('active', visible);
  overlay.classList.toggle('hidden', !visible);
}

/* =========================================================
   STAGE 1 PNG FADE (Wald / Pilz blendet aus wenn Karte kommt)
========================================================= */
function getGroup(stage) {
  return groups.find(g => Number(g.dataset.stage) === stage);
}

function applyStageFade(scrollCenter) {
  groups.forEach(g => (g.style.opacity = 0));
  if (!transitions.length) {
    const g1 = getGroup(1);
    if (g1) g1.style.opacity = 1;
    return;
  }

  const first = transitions[0];
  if (scrollCenter <= first.start) {
    const g = getGroup(first.from);
    if (g) g.style.opacity = 1;
    return;
  }

  for (const t of transitions) {
    if (scrollCenter >= t.start && scrollCenter <= t.end) {
      const p  = (scrollCenter - t.start) / (t.end - t.start);
      const gF = getGroup(t.from);
      const gT = getGroup(t.to);
      if (gF) gF.style.opacity = 1 - p;
      if (gT) gT.style.opacity = p;
      return;
    }
    if (scrollCenter < t.start) {
      const g = getGroup(t.from);
      if (g) g.style.opacity = 1;
      return;
    }
  }
  // past all transitions — Stage 1 group is fully gone
}

/* =========================================================
   STAGE 1 IMAGE OVERLAYS (Pilz ein-/ausblenden)
========================================================= */
function applyOverlays(scrollCenter) {
  document.querySelectorAll('.overlay-img').forEach(o => (o.style.opacity = 0));

  const zones = {};
  steps.forEach(s => {
    const overlays = (s.el.dataset.overlay || '').split(' ').filter(Boolean);
    if (!overlays.length) return;

    const start = s.center + window.innerHeight * 0.25;
    let end = start;
    const t = transitions.find(tr => tr.from === s.stage);
    if (t) end = Math.max(end, t.end);
    else   end = Infinity;

    overlays.forEach(cls => {
      (zones[cls] ||= []).push({ start, end });
    });
  });

  for (const cls in zones) {
    const imgs = document.querySelectorAll('.' + cls);
    if (!imgs.length) continue;
    let opacity = 0;
    zones[cls].forEach(({ start, end }) => {
      const fadeLen = window.innerHeight * 0.25;
      const fadeEnd = start + fadeLen;
      if (scrollCenter >= start && scrollCenter <= fadeEnd) {
        opacity = Math.max(opacity, (scrollCenter - start) / fadeLen);
      }
      if (scrollCenter > fadeEnd && scrollCenter <= end) opacity = 1;
    });
    imgs.forEach(img => (img.style.opacity = opacity));
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
  applyHtmlOverlay(scrollCenter);
  applyMapCamera(scrollCenter, activeIndex);
  applyMapLayers(activeIndex);
  applyPredictionMap(activeIndex);
}

/* =========================================================
   INIT
========================================================= */
document.addEventListener("DOMContentLoaded", async () => {
  await loadMarkdown();
  applyI18n();
  mountLangSwitchIntoIntro();
  updateLangSwitchUI();
  autoSpacing();
  computeLayout();
  initMap();   // map loads async; layers applied on map 'load' event
  onScroll();

  const langSwitch = document.getElementById("lang-switch");
  if (langSwitch) {
    langSwitch.addEventListener("click", async e => {
      const btn = e.target.closest(".lang-btn");
      if (!btn || btn.dataset.lang === currentLang) return;
      btn.blur();
      const scrollY = window.scrollY;
      setLang(btn.dataset.lang);
      await loadMarkdown();
      applyI18n();
      mountLangSwitchIntoIntro();
      autoSpacing();
      computeLayout();
      onScroll();
      requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: 'auto' }));
    });
  }

  window.addEventListener("scroll", onScroll);
  window.addEventListener("resize", () => {
    autoSpacing();
    computeLayout();
    onScroll();
  });

  // ── Exit-Button: Eignungskarte schließen → zurück zum letzten Erklärungsschritt
  document.getElementById('map-exit-btn')?.addEventListener('click', () => {
    const target = steps.find(s => s.el.dataset.md === 'slide5_06_prediction_explain.md');
    if (!target) return;
    window.scrollTo({ top: target.top - window.innerHeight * 0.25, behavior: 'smooth' });
  });

});
