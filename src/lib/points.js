// Aus ../pilz-suitability-story/main.js: POINT_ANIM_CFG, pointFeatures,
// loadPointData(), animStates, LAYER_TO_SRC, shuffleIndices(),
// redrawPointsCanvas(), die Reveal-/Ripple-Logik aus startPulseLoop()s
// tick() — praktisch wörtlich übernommen (rAF-Schleife, Reveal-Timing,
// Ripple, Puls unverändert). map/canvas werden als Parameter hereingereicht
// statt aus Modul-globalen Variablen gelesen; die rAF-Verwaltung selbst
// (startPulseLoop()/stopPulseLoop()) lebt in Map.svelte, weil sie an den
// Lifecycle der Komponente gebunden ist.
//
// Geprüft: parasol/meisen werden im Original in addMapLayers() zusätzlich
// als MapLibre-circle-Layer (inkl. halo/ripple) angelegt, aber
// applyMapLayers() löscht sie vor jedem setLayoutProperty-Durchlauf wieder
// aus dem visible-Set (main.js: "Remove point/halo/ripple from MapLibre
// visibility — canvas handles them") — sie bekommen dauerhaft
// visibility:'none'. Dieselbe Art toter Layer wie die vier Raster-Layer,
// die im vorigen Commit entfernt wurden. Hier werden sie deshalb gar nicht
// erst als MapLibre-Layer angelegt; das GeoJSON wird ausschließlich für die
// Canvas-Zeichnung geladen.

import { base } from '$app/paths';

export const POINT_ANIM_CFG = {
	'parasol-src': { url: `${base}/maps/Parasolfunde.geojson`, count: 0 },
	'meisen-src': { url: `${base}/maps/Meisenfunde.geojson`, count: 0 }
};

// Geladene GeoJSON-Koordinaten je Quelle
export const pointFeatures = {
	'parasol-src': [], // [{id, lng, lat}]
	'meisen-src': []
};

// Laufzeit-Animationszustand je Quelle
export const animStates = {
	'parasol-src': {
		done: false,
		allRevealed: false,
		revealed: new Set(),
		rippleStart: new Map(),
		revealDelays: [],
		t0: null
	},
	'meisen-src': {
		done: false,
		allRevealed: false,
		revealed: new Set(),
		rippleStart: new Map(),
		revealDelays: [],
		t0: null
	}
};

// Layer-ID (aus der visible-Berechnung in map.js) → Quelle für die Canvas-
// Sichtbarkeits-Übergangserkennung.
export const LAYER_TO_SRC = { 'parasol-points': 'parasol-src', 'meisen-points': 'meisen-src' };

export async function loadPointData() {
	for (const [srcId, cfg] of Object.entries(POINT_ANIM_CFG)) {
		try {
			const data = await fetch(cfg.url).then((r) => r.json());
			cfg.count = data.features.length;
			pointFeatures[srcId] = data.features.map((f, i) => ({
				id: i,
				lng: f.geometry.coordinates[0],
				lat: f.geometry.coordinates[1]
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

export function startPointAnimation(srcId) {
	const cfg = POINT_ANIM_CFG[srcId];
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
	state.done = false;
	state.t0 = performance.now();
}

export function resetPointAnimation(srcId) {
	const state = animStates[srcId];
	if (!state) return;
	state.done = false;
	state.allRevealed = false;
	state.t0 = null;
	state.revealed.clear();
	state.rippleStart.clear();
}

/* ── Canvas draw — 1:1 aus redrawPointsCanvas() ─────────── */
function redrawPointsCanvas(canvas, map, now, canvasVisible) {
	if (canvasVisible.size === 0) {
		canvas.style.display = 'none';
		return;
	}
	canvas.style.display = 'block';

	if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	}

	const ctx = canvas.getContext('2d');
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	const zoom = map.getZoom();
	const pulseT = (Math.sin((now / 1000) * Math.PI) + 1) / 2; // 0–1, Periode 2s
	const haloR = 10 + 4 * pulseT;

	for (const [srcId, features] of Object.entries(pointFeatures)) {
		if (!canvasVisible.has(srcId)) continue;

		const isParasol = srcId === 'parasol-src';
		const color = isParasol ? '#f3e79b' : '#61d1c7';
		const minR = isParasol ? 3 : 2;
		const maxR = isParasol ? 8 : 6;
		const coreR = minR + (maxR - minR) * Math.min(1, Math.max(0, (zoom - 7) / 7));
		const state = animStates[srcId];

		for (const { id, lng, lat } of features) {
			if (!state.revealed.has(id)) continue;
			const pt = map.project([lng, lat]);
			if (pt.x < -60 || pt.x > canvas.width + 60 || pt.y < -60 || pt.y > canvas.height + 60) continue;

			// Halo – pulsierender Schimmer
			ctx.beginPath();
			ctx.arc(pt.x, pt.y, haloR, 0, Math.PI * 2);
			ctx.fillStyle = color;
			ctx.globalAlpha = 0.25;
			ctx.fill();

			// Ripple-Ring
			const rs = state.rippleStart.get(id);
			if (rs !== undefined) {
				const t = Math.min(1, (now - rs) / 600);
				if (t < 1) {
					ctx.beginPath();
					ctx.arc(pt.x, pt.y, 5 + 18 * t, 0, Math.PI * 2);
					ctx.fillStyle = color;
					ctx.globalAlpha = 0.55 * (1 - t);
					ctx.fill();
				}
			}

			// Kernpunkt
			ctx.beginPath();
			ctx.arc(pt.x, pt.y, coreR, 0, Math.PI * 2);
			ctx.fillStyle = color;
			ctx.globalAlpha = 0.9;
			ctx.fill();
			ctx.strokeStyle = 'rgba(0,0,0,0.4)';
			ctx.lineWidth = 0.5;
			ctx.globalAlpha = 1;
			ctx.stroke();
		}
	}
	ctx.globalAlpha = 1;
}

// 1:1 aus dem tick() innerhalb von startPulseLoop(): rückt alle aktiven
// Animationen einen Tick weiter (Reveal + Ripple) und zeichnet neu.
export function tick(now, canvas, map, canvasVisible) {
	for (const [srcId, state] of Object.entries(animStates)) {
		if (!canvasVisible.has(srcId) || state.done || state.t0 === null) continue;
		const cfg = POINT_ANIM_CFG[srcId];
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

	redrawPointsCanvas(canvas, map, now, canvasVisible);
}
