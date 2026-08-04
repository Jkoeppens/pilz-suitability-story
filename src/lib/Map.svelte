<script>
	import maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { MAP_STYLE_URL, STAGE_CAMERAS, LAYERS_THIS_STEP, addMapLayers, getCameraForKey } from './map.js';

	// MapLibre verwaltet sein eigenes DOM (Canvas, Controls) innerhalb von
	// #map — Svelte rendert dort nie eigene Kinder hinein, es gibt also
	// nichts zu reconcilen. Abgeleitete Werte kommen als Props herein und
	// fließen unten per $effect imperativ in die Instanz.
	let { camKey, visibleLayers } = $props();

	let container;
	let map;
	let ready = $state(false);

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

		map.on('load', () => {
			addMapLayers(map);
			ready = true;
		});

		return () => map.remove();
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
</script>

<div bind:this={container} id="map"></div>

<style>
	#map {
		position: fixed;
		inset: 0;
		z-index: 0;
	}
</style>
