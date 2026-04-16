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
    map_suitability_title: "Eignung für Parasole"
  },
  en: {
    legend_moran_sub:      "local clustering",
    legend_geary_sub:      "local contrast",
    legend_ndwi_sub:       "moisture",
    legend_ndvi_sub:       "vegetation",
    map_suitability_title: "Parasol suitability"
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
  4: { center: [13.40, 52.50], zoom:  9.0 },   // Raster-Viererkarte
  5: { center: [13.50, 52.40], zoom:  8.5 },
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
const SUIT_LAYER    = 'suitability-layer';
const ALL_LAYERS    = [...POINT_LAYERS, ...RASTER_LAYERS, SUIT_LAYER];

/* =========================================================
   MAPLIBRE INIT
========================================================= */
let map             = null;
let mapReady        = false;
let currentMapStage = null;
let cogProtocolRegistered = false;

/* QUAD MAP INSTANCE (Stage 4 – 2×2 Raster-Karte) */
let quadMaps    = null;   // [moranMap, gearyMap, ndwiMap, ndviMap]
let quadVisible = false;

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

  map.on('load', () => {
    registerCogProtocol();
    addMapLayers();
    mapReady = true;
    onScroll();
  });

  // Keep quad maps in sync while main map animates
  map.on('move', syncQuadCameras);
}

function registerCogProtocol() {
  if (cogProtocolRegistered || !window.MaplibreCOGProtocol) return;
  maplibregl.addProtocol('cog', MaplibreCOGProtocol.cogProtocol);
  cogProtocolRegistered = true;
}

/* =========================================================
   LAYER DEFINITIONS
========================================================= */
function addMapLayers() {
  const base = window.location.href.replace(/[^/]*$/, '');

  // ── Parasol find points ──────────────────────────────────
  map.addSource('parasol-src', {
    type: 'geojson',
    data: 'maps/Parasolfunde.geojson'
  });
  map.addLayer({
    id: 'parasol-points',
    type: 'circle',
    source: 'parasol-src',
    layout: { visibility: 'none' },
    paint: {
      'circle-radius':       ['interpolate', ['linear'], ['zoom'], 7, 3, 14, 8],
      'circle-color':        '#ff6600',
      'circle-opacity':      0.85,
      'circle-stroke-width': 0.5,
      'circle-stroke-color': '#fff'
    }
  });

  // ── Meisen (bird) find points ────────────────────────────
  map.addSource('meisen-src', {
    type: 'geojson',
    data: 'maps/Meisenfunde.geojson'
  });
  map.addLayer({
    id: 'meisen-points',
    type: 'circle',
    source: 'meisen-src',
    layout: { visibility: 'none' },
    paint: {
      'circle-radius':       ['interpolate', ['linear'], ['zoom'], 7, 2, 14, 6],
      'circle-color':        '#22aaff',
      'circle-opacity':      0.75,
      'circle-stroke-width': 0.5,
      'circle-stroke-color': '#fff'
    }
  });

  // ── COG raster layers ────────────────────────────────────
  // Requires maplibre-cog-protocol + MapLibre GL JS ≥ 4.1
  // colorParam wird als Fragment an die COG-URL gehängt:
  // #color:<colormap>,<min>,<max>
  const cogLayers = [
    {
      id: 'ndvi-layer',  src: 'ndvi-src',
      file: 'maps/NDVI_Jul_wgs84.tif',
      colorParam: 'BrewerGreens,-0.63,0.93'
    },
    {
      id: 'ndwi-layer',  src: 'ndwi-src',
      file: 'maps/NDWI_wgs84.tif',
      colorParam: 'BrewerBlues,-0.87,0.78'
    },
    {
      id: 'moran-layer', src: 'moran-src',
      file: 'maps/NDVI_Moran_wgs84.tif',
      colorParam: 'BrewerOrRd,-1.52,23.53'
    },
    {
      id: 'geary-layer', src: 'geary-src',
      file: 'maps/NDVI_Geary_wgs84.tif',
      colorParam: 'BrewerPurples,0.0,8.11'
    },
  ];

  cogLayers.forEach(({ id, src, file, colorParam }) => {
    map.addSource(src, {
      type: 'raster',
      url: `cog://${base}${file}#color:${colorParam}`,
      tileSize: 256
    });
    map.addLayer({
      id,
      type: 'raster',
      source: src,
      layout: { visibility: 'none' },
      paint: { 'raster-opacity': 0.85 }
    });
  });

  // ── Suitability tiles (Cloudflare R2, pre-tiled PNGs) ────
  map.addSource('suitability-src', {
    type: 'raster',
    tiles: [
      'https://pub-4f210cbdaa354727aed0c7ebd8e93a0.r2.dev/tiles_suit/{z}/{x}/{y}.png'
    ],
    tileSize: 256,
    scheme:   'tms',
    maxzoom:  15
  });
  map.addLayer({
    id:     SUIT_LAYER,
    type:   'raster',
    source: 'suitability-src',
    layout: { visibility: 'none' },
    paint:  { 'raster-opacity': 0.85 }
  });
}

/* =========================================================
   QUAD-MAP INIT (Stage 4 – 2×2 Raster-Karte)
========================================================= */
const QUAD_DEFS = [
  {
    container: 'quad-tl',
    file:  'maps/NDVI_Moran_wgs84.tif',
    colorParam: 'BrewerOrRd,-1.52,23.53'
  },
  {
    container: 'quad-tr',
    file:  'maps/NDVI_Geary_wgs84.tif',
    colorParam: 'BrewerPurples,0.0,8.11'
  },
  {
    container: 'quad-bl',
    file:  'maps/NDWI_wgs84.tif',
    colorParam: 'BrewerBlues,-0.87,0.78'
  },
  {
    container: 'quad-br',
    file:  'maps/NDVI_Jul_wgs84.tif',
    colorParam: 'BrewerGreens,-0.63,0.93'
  },
];

function initQuadMaps() {
  if (quadMaps) return;

  registerCogProtocol();

  const base   = window.location.href.replace(/[^/]*$/, '');
  const style  = `https://api.maptiler.com/maps/satellite/style.json?key=${MAPTILER_KEY}`;
  const center = map.getCenter();
  const zoom   = map.getZoom();

  quadMaps = QUAD_DEFS.map(({ container, file, colorParam }, i) => {
    const m = new maplibregl.Map({
      container,
      style,
      center,
      zoom,
      pitch:              0,
      bearing:            0,
      interactive:        false,   // camera is driven by the main map
      attributionControl: false
    });

    m.on('load', () => {
      m.addSource(`q-src-${i}`, {
        type:     'raster',
        url:      `cog://${base}${file}#color:${colorParam}`,
        tileSize: 256
      });
      m.addLayer({
        id:     `q-layer-${i}`,
        type:   'raster',
        source: `q-src-${i}`,
        paint:  { 'raster-opacity': 0.82 }
      });
    });

    return m;
  });
}

function syncQuadCameras() {
  if (!quadMaps) return;
  const cam = {
    center:  map.getCenter(),
    zoom:    map.getZoom(),
    bearing: map.getBearing(),
    pitch:   map.getPitch()
  };
  quadMaps.forEach(m => m.jumpTo(cam));
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
function applyMapCamera(scrollCenter) {
  if (!mapReady) return;

  const stage = getCurrentStage(scrollCenter);
  if (stage === currentMapStage) return;
  currentMapStage = stage;

  const cam = STAGE_CAMERAS[stage];
  if (!cam) return;

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

  // Stage 5: all four analysis rasters always visible on the main map
  if (currentStage === 5) {
    RASTER_LAYERS.forEach(l => visible.add(l));
  }

  // Prediction step: also show the suitability layer
  if (activeStep.el.dataset.trigger === 'prediction-map') {
    visible.add(SUIT_LAYER);
  }

  ALL_LAYERS.forEach(id => {
    try {
      map.setLayoutProperty(id, 'visibility', visible.has(id) ? 'visible' : 'none');
    } catch (_) {}
  });

  // ── Stage 4: 2×2 Raster-Viererkarte ─────────────────────
  const showQuad = (currentStage === 4);
  const quadRoot = document.getElementById('quad-root');
  if (quadRoot) {
    quadRoot.classList.toggle('hidden', !showQuad);
    if (showQuad) {
      if (!quadMaps) initQuadMaps();   // lazy init on first appearance
      else syncQuadCameras();          // snap to current camera on re-entry
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
  applyMapCamera(scrollCenter);
  applyMapLayers(activeIndex);
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
});
