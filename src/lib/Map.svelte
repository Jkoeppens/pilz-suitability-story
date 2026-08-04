<script>
	import maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import {
		MAP_STYLE_URL,
		STAGE_CAMERAS,
		LAYERS_THIS_STEP,
		IMG_NW,
		IMG_SE,
		addMapLayers,
		getCameraForKey
	} from './map.js';
	import { loadPointData, LAYER_TO_SRC, startPointAnimation, resetPointAnimation, tick } from './points.js';

	// MapLibre verwaltet sein eigenes DOM (Canvas, Controls) innerhalb von
	// #map — Svelte rendert dort nie eigene Kinder hinein, es gibt also
	// nichts zu reconcilen. Abgeleitete Werte kommen als Props herein und
	// fließen unten per $effect imperativ in die Instanz. quadRect fließt
	// umgekehrt hinaus: eine reine Projektion des Kartenzustands, die
	// QuadOverlay konsumiert, ohne dass Map.svelte selbst etwas über Quad
	// weiß.
	let { camKey, visibleLayers, quadRect = $bindable(null) } = $props();

	let container;
	let canvas;
	let map;
	let ready = $state(false);

	function updateQuadRect() {
		const nw = map.project(IMG_NW);
		const se = map.project(IMG_SE);
		quadRect = { left: nw.x, top: nw.y, width: se.x - nw.x, height: se.y - nw.y };
	}

	$effect(() => {
		map = new maplibregl.Map({
			container,
			style: MAP_STYLE_URL,
			center: STAGE_CAMERAS[1].center,
			zoom: STAGE_CAMERAS[1].zoom,
			pitch: 0,
			attributionControl: false
		});

		map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

		map.on('load', async () => {
			addMapLayers(map);
			await loadPointData();
			ready = true;
			updateQuadRect();
		});

		map.on('move', updateQuadRect);

		return () => {
			stopLoop();
			map.remove();
		};
	});

	$effect(() => {
		if (!ready) return;
		const cam = getCameraForKey(camKey);
		if (!cam) return;
		map.easeTo({
			center: cam.center,
			zoom: cam.zoom,
			pitch: 0,
			bearing: 0,
			duration: 1000
		});
	});

	$effect(() => {
		if (!ready) return;
		const visible = visibleLayers;
		LAYERS_THIS_STEP.forEach((id) => {
			map.setLayoutProperty(id, 'visibility', visible.has(id) ? 'visible' : 'none');
		});
	});

	// Aus dem "Canvas point management"-Teil von applyMapLayers(). canvasVisible
	// hält den zuletzt angewendeten Zustand fest — nicht um doppelte Aufrufe zu
	// vermeiden (wie camKey in Schritt 7), sondern um die Übergangs-RICHTUNG zu
	// erkennen: nowVis && !wasVis → Animation starten, !nowVis && wasVis →
	// zurücksetzen. Das ist mit $derived nicht ausdrückbar (siehe Erklärung im
	// Chat) und bleibt deshalb eine von Hand mitgeführte, nicht-reaktive
	// Variable, genau wie im Original.
	let canvasVisible = new Set();
	let rafId = null;

	function loop(now) {
		tick(now, canvas, map, canvasVisible);
		rafId = requestAnimationFrame(loop);
	}

	function startLoop() {
		if (rafId) return;
		rafId = requestAnimationFrame(loop);
	}

	function stopLoop() {
		if (rafId) {
			cancelAnimationFrame(rafId);
			rafId = null;
		}
		if (canvas) canvas.style.display = 'none';
	}

	$effect(() => {
		if (!ready) return;
		const visible = visibleLayers;

		const newCanvasVisible = new Set();
		if (visible.has('parasol-points')) newCanvasVisible.add('parasol-src');
		if (visible.has('meisen-points')) newCanvasVisible.add('meisen-src');

		for (const [layerId, srcId] of Object.entries(LAYER_TO_SRC)) {
			const nowVis = visible.has(layerId);
			const wasVis = canvasVisible.has(srcId);
			if (nowVis && !wasVis) startPointAnimation(srcId);
			else if (!nowVis && wasVis) resetPointAnimation(srcId);
		}
		canvasVisible = newCanvasVisible;

		if (canvasVisible.size > 0) startLoop();
		else stopLoop();
	});
</script>

<div bind:this={container} id="map"></div>
<canvas bind:this={canvas} id="points-canvas"></canvas>

<style>
	#map {
		position: fixed;
		inset: 0;
		z-index: 0;
	}

	#points-canvas {
		position: fixed;
		inset: 0;
		z-index: 5;
		pointer-events: none;
		display: none;
	}
</style>
