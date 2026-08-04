<script>
	import { steps } from '$lib/steps.js';
	import Step from '$lib/Step.svelte';
</script>

<main>
	{#each steps as step}
		<Step {step} />
	{/each}
</main>
