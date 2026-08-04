<script>
	import { steps as stepDefs } from '$lib/steps.js';
	import Step from '$lib/Step.svelte';
	import LangSwitch from '$lib/LangSwitch.svelte';
	import Map from '$lib/Map.svelte';
	import QuadOverlay from '$lib/QuadOverlay.svelte';
	import { untrack } from 'svelte';
	import {
		autoSpacing,
		computeLayout,
		getCurrentStage,
		getActiveIndex,
		getGroupOpacity,
		computeOverlayZones,
		getOverlayOpacity,
		computeModelZones,
		isModelVisible
	} from '$lib/scroll.js';
	import { getCameraKey, getVisibleLayers } from '$lib/map.js';

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

		autoSpacing(stepDefs, els);
		const layout = computeLayout(stepDefs, els, h);
		steps = layout.steps;
		transitions = layout.transitions;
	}

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
</script>

<svelte:window bind:scrollY bind:innerWidth bind:innerHeight />

<Map {camKey} {visibleLayers} bind:quadRect />
<QuadOverlay rect={quadRect} visible={showQuad} />

<!-- Entscheidungsbaum-Overlay: Inhalt kommt erst in Schritt 11, Container bleibt leer. -->
<div class="overlay-model" class:active={modelVisible}></div>

<div id="media-root">
	<div class="media-group" style="opacity: {groupOpacity}">
		<img src="/img/Wald.png" class="bg-img" alt="" />
		<img src="/img/Pilz.png" class="overlay-img overlay-pilz" style="opacity: {pilzOpacity}" alt="" />
	</div>
</div>

<LangSwitch />

<main id="scroll-root" bind:this={scrollRootEl}>
	{#each stepDefs as step, i}
		<Step {step} bind:el={stepEls[i]} active={i === activeIndex} />
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

	#scroll-root {
		position: relative;
		z-index: 10;
		padding: 20vh 0 30vh;
		pointer-events: none;
	}
</style>
