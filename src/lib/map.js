// Aus ../pilz-suitability-story/main.js: Abschnitt MAP CONFIG (STAGE_CAMERAS,
// STEP_CAMERA_OVERRIDES, OVERLAY_TO_LAYERS, RASTER_LAYERS/POINT_LAYERS/...),
// addMapLayers() — hier nur der Suitability-Layer, die Punkt-Layer
// (parasol/meisen, halo, ripple) kommen erst in einem späteren Schritt —,
// sowie die reinen Berechnungen aus applyMapCamera() und der
// visible-Ermittlung in applyMapLayers().
//
// Die vier Raster-Layer (ndvi/ndwi/moran/geary) aus dem Original wurden
// entfernt: sie waren nie sichtbar (nichts in OVERLAY_TO_LAYERS zeigt auf
// sie, siehe MIGRATION.md), und QuadOverlay zeigt dieselben PNGs bereits
// als CSS-positionierte <img>. RASTER_LAYERS bleibt als Konstante stehen
// (Teil der ursprünglichen main.js-Layer-Vocabular), ist aber in
// LAYERS_THIS_STEP bewusst nicht mehr enthalten.
//
// IS_LOCAL/TILES_CONFIG sind 1:1 aus main.js: ein Hostname-Check, kein
// Build-Modus-Check, damit sich lokale Kachel-Server (tiles_suit/) genau wie
// im Original nur auf localhost/127.0.0.1 einschalten.

import { browser } from '$app/environment';
import { PUBLIC_MAPTILER_KEY } from '$env/static/public';
import { getCurrentStage } from './scroll.js';

const IS_LOCAL =
	browser && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const TILES_CONFIG = IS_LOCAL
	? { url: `${browser ? window.location.origin : ''}/tiles_suit/{z}/{x}/{y}.png`, maxzoom: 12 }
	: { url: 'https://pub-4f210cbdaa354727aed0c7ebd8e993a0.r2.dev/tiles_suit/{z}/{x}/{y}.png', maxzoom: 7 };
export const TILES_BASE = TILES_CONFIG.url;

export const MAP_STYLE_URL = `https://api.maptiler.com/maps/satellite/style.json?key=${PUBLIC_MAPTILER_KEY}`;

// Kameraposition je Stage
export const STAGE_CAMERAS = {
	1: { center: [13.4, 52.5], zoom: 9.0 },
	2: { center: [13.4, 52.5], zoom: 10.5 },
	3: { center: [13.22, 52.47], zoom: 12.0 },
	4: { center: [13.22, 52.47], zoom: 12.0 }, // Grunewald bleibt durch Stage 4
	5: { center: [13.4, 52.5], zoom: 9.5 } // Berlin ab slide5_02_signatures_Data
};

// Kamera-Override je Step: ab diesem Slide gilt die angegebene Kamera
export const STEP_CAMERA_OVERRIDES = {
	'slide5_02_signatures_Data.md': { center: [13.4, 52.5], zoom: 9.5 }
};

// data-overlay-Werte → MapLibre-Layer-IDs, die sichtbar werden sollen
export const OVERLAY_TO_LAYERS = {
	'overlay-pilz': [],
	'overlay-parasole': ['parasol-points'],
	'overlay-parasol2': ['parasol-points'],
	'overlay-meisen': ['parasol-points', 'meisen-points'],
	'overlay-fundpunkte-berlin_stg4': ['parasol-points', 'meisen-points'],
	'overlay-fundpunkte-berlin': ['parasol-points', 'meisen-points']
};

export const RASTER_LAYERS = ['ndvi-layer', 'ndwi-layer', 'moran-layer', 'geary-layer'];
export const POINT_LAYERS = ['parasol-points', 'meisen-points'];
export const HALO_LAYERS = ['parasol-halo', 'meisen-halo'];
export const RIPPLE_LAYERS = ['parasol-ripple', 'meisen-ripple'];
export const SUIT_LAYER = 'suitability-layer';
export const ALL_LAYERS = [...HALO_LAYERS, ...RIPPLE_LAYERS, ...POINT_LAYERS, ...RASTER_LAYERS, SUIT_LAYER];

// Von addMapLayers() in diesem Schritt tatsächlich angelegte Layer — nur
// diese dürfen wir per setLayoutProperty ansprechen, nicht ALL_LAYERS.
// RASTER_LAYERS sind hier bewusst ausgeschlossen: ndvi-/ndwi-/moran-/
// geary-layer werden nicht mehr angelegt (siehe addMapLayers() unten) —
// dieselben PNGs zeigt QuadOverlay als CSS-positionierte <img>.
export const LAYERS_THIS_STEP = [SUIT_LAYER];

// Ausdehnung der Quad-Karte (WGS84), gemeinsam mit den Raster-Layern
export const IMG_NW = [12.647, 53.0203];
export const IMG_SE = [14.316, 51.9793];

export function addMapLayers(map) {
	map.addSource('suitability-src', {
		type: 'raster',
		tiles: [TILES_BASE],
		tileSize: 256,
		maxzoom: TILES_CONFIG.maxzoom
	});
	map.addLayer({
		id: SUIT_LAYER,
		type: 'raster',
		source: 'suitability-src',
		layout: { visibility: 'none' },
		paint: { 'raster-opacity': 0.85 }
	});
}

// Aus applyMapCamera(). Liefert nur den String-Schlüssel, nicht das
// {center,zoom}-Objekt — als eigenständiges $derived-Primitive lässt sich
// darüber die Verdopplung von easeTo()-Aufrufen vermeiden, die im Original
// currentCamKey per Hand erledigt hat (siehe Erklärung im Chat).
export function getCameraKey(scrollCenter, activeIndex, stepDefs, steps, transitions) {
	for (let i = activeIndex; i >= 0; i--) {
		const md = stepDefs[i]?.md;
		if (md && STEP_CAMERA_OVERRIDES[md]) return md;
	}
	const stage = getCurrentStage(scrollCenter, steps, transitions);
	return `stage-${stage}`;
}

export function getCameraForKey(camKey) {
	if (STEP_CAMERA_OVERRIDES[camKey]) return STEP_CAMERA_OVERRIDES[camKey];
	if (camKey?.startsWith('stage-')) {
		return STAGE_CAMERAS[Number(camKey.slice(6))] ?? null;
	}
	return null;
}

// Aus der visible-Berechnung in applyMapLayers() — 1:1, inklusive Akkumulation
// über alle Steps 0..activeIndex innerhalb der aktuellen Stage. stepDefs[i]
// ersetzt s.el.dataset (siehe scroll.js-Kommentar zum selben Wechsel).
export function getVisibleLayers(activeIndex, stepDefs, steps) {
	const activeStep = steps[activeIndex];
	if (!activeStep) return new Set();

	const currentStage = activeStep.stage;
	const visible = new Set();

	for (let i = 0; i <= activeIndex; i++) {
		const s = steps[i];
		if (s.stage !== currentStage) continue;

		(stepDefs[i].overlay || '')
			.split(' ')
			.filter(Boolean)
			.forEach((ov) => {
				(OVERLAY_TO_LAYERS[ov] || []).forEach((l) => visible.add(l));
			});
	}

	if (stepDefs[activeIndex].trigger === 'prediction-map') {
		visible.add(SUIT_LAYER);
	}

	return visible;
}
