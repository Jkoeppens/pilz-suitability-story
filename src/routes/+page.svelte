<script>
	import { steps as stepDefs } from '$lib/steps.js';
	import Step from '$lib/Step.svelte';
	import LangSwitch from '$lib/LangSwitch.svelte';
	import { autoSpacing, computeLayout, getCurrentStage, getActiveIndex } from '$lib/scroll.js';

	let scrollY = $state(0);
	let innerWidth = $state(0);
	let innerHeight = $state(0);

	let stepEls = $state(new Array(stepDefs.length).fill(null));

	// Von computeLayout() vermessen — kein $derived, siehe Step-Vermessung
	// unten: braucht echte DOM-Geometrie, ist also ein Seiteneffekt.
	let steps = $state([]);
	let transitions = $state([]);

	$effect(() => {
		// innerWidth mitlesen, obwohl die Formeln unten nur innerHeight
		// benutzen: bei schmalerem Viewport bricht Text anders um, wodurch
		// sich offsetHeight ändert — also muss auch bei reinem Breiten-Resize
		// neu vermessen werden, genau wie im Original bei jedem "resize".
		void innerWidth;
		const h = innerHeight;

		if (stepEls.some((el) => !el)) return;

		autoSpacing(stepDefs, stepEls);
		const layout = computeLayout(stepDefs, stepEls, h);
		steps = layout.steps;
		transitions = layout.transitions;
	});

	const scrollCenter = $derived(scrollY + innerHeight * 0.5);
	const currentStage = $derived(getCurrentStage(scrollCenter, steps, transitions));
	const activeIndex = $derived(getActiveIndex(scrollCenter, steps));
</script>

<svelte:window bind:scrollY bind:innerWidth bind:innerHeight />

<LangSwitch />

<main>
	{#each stepDefs as step, i}
		<Step {step} bind:el={stepEls[i]} active={i === activeIndex} />
	{/each}
</main>
