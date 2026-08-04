<script>
	import { steps as stepDefs } from '$lib/steps.js';
	import Step from '$lib/Step.svelte';
	import LangSwitch from '$lib/LangSwitch.svelte';
	import Map from '$lib/Map.svelte';
	import QuadOverlay from '$lib/QuadOverlay.svelte';
	import SuitMap from '$lib/SuitMap.svelte';
	import { untrack } from 'svelte';
	import {
		computeStepMargins,
		computeLayout,
		getCurrentStage,
		getActiveIndex,
		getGroupOpacity,
		computeOverlayZones,
		getOverlayOpacity,
		computeModelZones,
		isModelVisible
	} from '$lib/scroll.js';
	import { getCameraKey, getVisibleLayers, SUIT_LAYER } from '$lib/map.js';
	import { t } from '$lib/i18n.js';

	let scrollY = $state(0);
	let innerWidth = $state(0);
	let innerHeight = $state(0);

	let stepEls = $state(new Array(stepDefs.length).fill(null));
	let scrollRootEl;

	// Von computeLayout() vermessen — kein $derived, siehe Step-Vermessung
	// unten: braucht echte DOM-Geometrie, ist also ein Seiteneffekt.
	let steps = $state([]);
	let transitions = $state([]);

	// stepEls ungetrackt lesen: die Refs werden einmal beim Mount gesetzt und
	// ändern sich danach nicht mehr. Würde man sie hier live mitlesen,
	// entstünde ein Kreis: dieser Effekt schreibt steps → activeIndex
	// ($derived aus steps) ändert sich → Step re-rendert → bind:el schreibt
	// stepEls[i] erneut → Effekt läuft wieder, obwohl sich nichts an den
	// eigentlichen DOM-Referenzen geändert hat (siehe Schritt 6).
	function remeasure(h) {
		const els = untrack(() => stepEls);
		if (els.some((el) => !el)) return;

		const layout = computeLayout(stepDefs, els, h);
		steps = layout.steps;
		transitions = layout.transitions;
	}

	// Reiner Wert aus stepDefs, keine DOM-Messung nötig — siehe Kommentar in
	// scroll.js. Wird als Prop an Step.svelte durchgereicht.
	const stepMargins = $derived(computeStepMargins(stepDefs));

	$effect(() => {
		// innerWidth mitlesen, obwohl die Formeln unten nur innerHeight
		// benutzen: bei schmalerem Viewport bricht Text anders um, wodurch
		// sich offsetHeight ändert — also muss auch bei reinem Breiten-Resize
		// neu vermessen werden, genau wie im Original bei jedem "resize".
		void innerWidth;
		remeasure(innerHeight);
	});

	// Regression gegenüber main.js: main.js awaitet loadMarkdown() (alle
	// Markdown-Dateien geladen) bevor computeLayout() läuft — Step.svelte lädt
	// hier aber pro Step asynchron nach, lange nachdem stepEls gebunden sind.
	// Ohne diesen Beobachter würde einmalig auf leere .step-Boxen vermessen
	// und nie wieder aktualisiert, egal wodurch sich die Höhe später ändert
	// (Markdown, Webfont-Nachladen, Sprachwechsel, …). ResizeObserver auf dem
	// Scroll-Container deckt alle diese Ursachen gleichermaßen ab, statt für
	// jede einzeln einen Sonderfall zu bauen.
	$effect(() => {
		if (!scrollRootEl) return;
		const observer = new ResizeObserver(() => remeasure(innerHeight));
		observer.observe(scrollRootEl);
		return () => observer.disconnect();
	});

	const scrollCenter = $derived(scrollY + innerHeight * 0.5);
	const currentStage = $derived(getCurrentStage(scrollCenter, steps, transitions));
	const activeIndex = $derived(getActiveIndex(scrollCenter, steps));

	// Stage-1-Crossfade (Wald/Pilz). Es gibt nur diese eine .media-group im
	// Markup, aber die Formel selbst ist stage-generisch — siehe scroll.js.
	const groupOpacity = $derived(getGroupOpacity(1, scrollCenter, transitions));

	const overlayZones = $derived(computeOverlayZones(stepDefs, steps, transitions, innerHeight));
	const pilzOpacity = $derived(getOverlayOpacity('overlay-pilz', scrollCenter, overlayZones, innerHeight));

	const modelZones = $derived(computeModelZones(stepDefs, steps, transitions, innerHeight));
	const modelVisible = $derived(isModelVisible(scrollCenter, modelZones));

	const camKey = $derived(getCameraKey(scrollCenter, activeIndex, stepDefs, steps, transitions));
	const visibleLayers = $derived(getVisibleLayers(activeIndex, stepDefs, steps));

	// Aus dem showQuad-Teil von applyMapLayers(): stepDefs[activeIndex].trigger
	// ersetzt activeStep.el.dataset.trigger, gleicher Grund wie überall sonst.
	const showQuad = $derived(currentStage === 5 && stepDefs[activeIndex]?.trigger !== 'prediction-map');

	let quadRect = $state(null);

	// Aus applyPredictionMap(): show = steps[activeIndex]?.el.dataset.trigger
	// === 'prediction-map'. Gleicher stepDefs-statt-dataset-Grund wie überall.
	const showPredictionMap = $derived(stepDefs[activeIndex]?.trigger === 'prediction-map');

	// Aus dem Exit-Button-Handler ganz unten in main.js: findet den Step mit
	// slide5_06_prediction_explain.md und scrollt dorthin zurück.
	// stepDefs.findIndex(...) + steps[idx] ersetzt steps.find(s =>
	// s.el.dataset.md === ...), gleicher Grund wie überall sonst.
	function scrollToPredictionExplain() {
		const idx = stepDefs.findIndex((s) => s.md === 'slide5_06_prediction_explain.md');
		const target = steps[idx];
		if (!target) return;
		window.scrollTo({ top: target.top - innerHeight * 0.25, behavior: 'smooth' });
	}
</script>

<svelte:window bind:scrollY bind:innerWidth bind:innerHeight />

<Map {camKey} {visibleLayers} bind:quadRect />
<QuadOverlay rect={quadRect} visible={showQuad} />
<SuitMap visible={showPredictionMap} onExit={scrollToPredictionExplain} />

<!-- Entscheidungsbaum-Overlay: viz/ ist eine eigenständige Anwendung (D3 vom
     CDN, eigenes index.html/style.css/main.js) und wird wie im Original als
     iframe eingebunden, nicht nach Svelte portiert. -->
<div class="overlay-model" class:active={modelVisible}>
	<div class="overlay-model-inner">
		<iframe src="/viz/index.html" class="model-frame" loading="lazy"></iframe>
	</div>
</div>

<!-- Legende für die Eignungskarte auf der Hintergrundkarte — erscheint, wenn
     der Suitability-Layer aktiv ist. Deckungsgleiche Bedingung wie
     showPredictionMap (SUIT_LAYER wird nur bei trigger === 'prediction-map'
     sichtbar), daher optisch von SuitMap überdeckt, sobald diese offen ist
     (z-index 2000 > 100) — 1:1 aus dem Original übernommen, nicht "behoben". -->
<div id="suit-legend" class:hidden={!visibleLayers.has(SUIT_LAYER)}>
	<div class="legend-gradient"></div>
	<div class="legend-labels">
		<span>0</span>
		<span>{t('map_suitability_title')}</span>
		<span>1</span>
	</div>
</div>

<div id="media-root">
	<div class="media-group" style="opacity: {groupOpacity}">
		<img src="/img/Wald.png" class="bg-img" alt="" />
		<img src="/img/Pilz.png" class="overlay-img overlay-pilz" style="opacity: {pilzOpacity}" alt="" />
	</div>
</div>

<LangSwitch />

<main id="scroll-root" bind:this={scrollRootEl}>
	{#each stepDefs as step, i}
		<Step {step} bind:el={stepEls[i]} active={i === activeIndex} margin={stepMargins[i]} />
	{/each}
</main>

<style>
	#media-root {
		position: fixed;
		inset: 0;
		z-index: 1;
		overflow: hidden;
		pointer-events: none;
	}

	.media-group {
		position: absolute;
		inset: 0;
		opacity: 0;
		pointer-events: none;
		transition: none !important;
	}

	.bg-img {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 1 !important;
		pointer-events: none;
	}

	.overlay-img {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0;
		pointer-events: none;
		transition: none !important;
	}

	.overlay-model {
		position: fixed;
		inset: 0;
		z-index: 7;
		display: flex;
		align-items: center;
		justify-content: center;

		background: rgba(255, 255, 255, 0.05);
		backdrop-filter: blur(18px);

		opacity: 0;
		pointer-events: none;
		transition:
			opacity 0.6s ease,
			backdrop-filter 0.6s ease;
	}

	.overlay-model.active {
		opacity: 1;
		pointer-events: auto;
	}

	.overlay-model-inner {
		background: rgba(245, 244, 238, 0.94);
		padding: 2rem;

		box-shadow:
			0 12px 28px rgba(0, 0, 0, 0.18),
			0 4px 10px rgba(0, 0, 0, 0.12);

		border-radius: 0;

		display: flex;
		justify-content: center;
		align-items: center;

		max-width: 98vw;
		max-height: 90vh;
	}

	.model-frame {
		width: min(98vw, 1400px);
		height: 85vh;
		border: none;
		background: transparent;
		pointer-events: auto;
		z-index: 10;
		filter: drop-shadow(0 6px 18px rgba(0, 0, 0, 0.25));
	}

	#scroll-root {
		position: relative;
		z-index: 10;
		padding: 20vh 0 30vh;
		pointer-events: none;
	}

	#suit-legend {
		position: fixed;
		bottom: 40px;
		right: 18px;
		z-index: 100;

		width: 220px;
		background: rgba(0, 0, 0, 0.55);
		padding: 10px 12px;
		border-radius: 6px;
		backdrop-filter: blur(4px);
		color: white;

		opacity: 1;
		transition: opacity 0.4s ease;
	}

	#suit-legend.hidden {
		opacity: 0;
		pointer-events: none;
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
