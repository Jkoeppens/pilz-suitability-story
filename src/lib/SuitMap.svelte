<script>
	// Aus ../pilz-suitability-story/main.js: initSuitMap(), applyPredictionMap(),
	// der map-exit-btn-Handler; dazu #prediction-map/#suit-map-legend aus
	// index.html und die zugehörigen Regeln aus style.css.
	//
	// Designfrage aus dem Chat: das Original erzeugt suitMap einmal
	// (suitMapInitialized-Flag) und lässt sie danach bestehen, blendet nur
	// aus. Hier gibt es kein {#if} um diese Komponente — sie wird immer
	// gerendert (wie <Map> und die Quad-Bilder), Sichtbarkeit ist rein CSS
	// (class:active). Der Erzeugungs-Effekt unten hat keine reaktiven
	// Abhängigkeiten, läuft also automatisch genau einmal für die gesamte
	// Sitzung — das reproduziert suitMapInitialized, ohne ein eigenes Flag
	// mitzuführen.
	import maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { MAP_STYLE_URL, addSuitMapLayer } from './map.js';
	import { t } from './i18n.js';

	let { visible, onExit } = $props();

	let container;
	let map;

	$effect(() => {
		map = new maplibregl.Map({
			container,
			style: MAP_STYLE_URL,
			center: [13.4, 52.5],
			zoom: 11,
			minZoom: 7,
			attributionControl: false
		});

		map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
		map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

		map.on('load', () => {
			addSuitMapLayer(map);
		});

		return () => map.remove();
	});

	// Aus applyPredictionMap(): "Defer resize until the container is fully
	// visible" — der Container hat vorher schon volle Größe (opacity-basiert,
	// kein display:none), das Original ruft resize() trotzdem bei jedem
	// Öffnen defensiv auf. 1:1 übernommen, nicht hinterfragt.
	$effect(() => {
		if (!visible) return;
		requestAnimationFrame(() => map?.resize());
	});

	// Aus applyPredictionMap(): "Lock page scroll while interactive map is
	// open". body liegt außerhalb des Svelte-Baums (definiert in app.html),
	// daher direkter DOM-Zugriff — derselbe Grund wie bei
	// document.documentElement.lang in +layout.svelte.
	$effect(() => {
		document.body.style.overflow = visible ? 'hidden' : '';
	});
</script>

<!-- Kein class:hidden hier: #prediction-map.hidden hat im Original keine
     CSS-Regel (geprüft) — .active allein regelt die Sichtbarkeit bereits
     vollständig, derselbe Fund wie bei .overlay-model in Schritt 6. -->
<div id="prediction-map" class:active={visible}>
	<button id="map-exit-btn" onclick={onExit}>{t('map_back')}</button>
	<div id="suit-map-legend">
		<div class="legend-gradient"></div>
		<div class="legend-labels">
			<span>0</span>
			<span>{t('map_suitability_title')}</span>
			<span>1</span>
		</div>
	</div>
	<div bind:this={container} id="suit-map-inner"></div>
</div>

<style>
	#prediction-map {
		position: fixed;
		inset: 0;
		z-index: 2000;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.4s ease;
	}

	#prediction-map.active {
		opacity: 1;
		pointer-events: auto;
	}

	#suit-map-inner {
		width: 100%;
		height: 100%;
	}

	#map-exit-btn {
		position: absolute;
		top: 18px;
		right: 18px;
		z-index: 2100;
		background: rgba(255, 255, 255, 0.88);
		border: none;
		border-radius: 0;
		padding: 10px 16px;
		font-size: 14px;
		font-family: 'IBM Plex Sans', sans-serif;
		font-weight: 500;
		cursor: pointer;
		backdrop-filter: blur(6px);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}

	#map-exit-btn:hover {
		background: rgba(255, 255, 255, 1);
	}

	#suit-map-legend {
		position: absolute;
		bottom: 40px;
		right: 18px;
		z-index: 2100;
		width: 220px;
		background: rgba(0, 0, 0, 0.55);
		padding: 10px 12px;
		border-radius: 6px;
		backdrop-filter: blur(4px);
		color: white;
	}

	.legend-gradient {
		width: 100%;
		height: 16px;
		background: linear-gradient(
			to right,
			#440154,
			#482878,
			#3e4a89,
			#31688e,
			#26828e,
			#1f9e89,
			#35b779,
			#6ece58,
			#b5de2b,
			#fde725
		);
		border-radius: 4px;
		margin-bottom: 4px;
	}

	.legend-labels {
		display: flex;
		justify-content: space-between;
		font-size: 13px;
		color: #eee;
	}
</style>
