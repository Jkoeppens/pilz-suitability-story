<script>
	import { steps } from '$lib/steps.js';
	import Step from '$lib/Step.svelte';
	import LangSwitch from '$lib/LangSwitch.svelte';
</script>

<LangSwitch />

<main>
	{#each steps as step}
		<Step {step} />
	{/each}
</main>
