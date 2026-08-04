<script>
	import { marked } from 'marked';
	import { base } from '$app/paths';
	import { lang } from './lang.svelte.js';

	let { step, el = $bindable(null), active = false, margin = 0 } = $props();

	let html = $state('');

	$effect(() => {
		if (!step.md) {
			html = '';
			return;
		}
		const currentLang = lang.current;
		let cancelled = false;
		fetch(`${base}/text/${currentLang}/${step.md}`)
			.then((res) => res.text())
			.then((text) => {
				if (!cancelled) html = marked.parse(text);
			})
			.catch((err) => console.error('Fehler beim Laden:', step.md, err));
		return () => {
			cancelled = true;
		};
	});
</script>

<article
	bind:this={el}
	class="step"
	class:step--invisible={step.invisible}
	class:step--spacer={step.spacer}
	class:step--active={active}
	style={step.style}
	style:margin-top="{margin}vh"
	style:margin-bottom="{margin}vh"
>
	{#if html}
		{@html html}
	{/if}
</article>

<style>
	.step {
		width: 52vw;
		max-width: 680px;

		margin-left: 6vw;

		padding: 2rem 2.4rem;

		background: rgba(240, 240, 235, 0.88);
		border-radius: 0;
		border-left: 3px solid #222;

		box-shadow: none;

		font-size: 1.15rem;
		line-height: 1.65;
		color: #111;

		pointer-events: auto;
		user-select: text;
	}

	/* Invisible Steps für Overlay-Trigger (keine Textbox!) */
	.step--invisible {
		height: 0 !important;
		margin: 0 !important;
		padding: 0 !important;
		opacity: 0 !important;
		pointer-events: none !important;

		border: none !important;
		background: none !important;
		box-shadow: none !important;
	}

	.step--spacer {
		height: 120vh; /* genug, um sicher aktiv zu werden */
		margin: 0;
		padding: 0;
		background: none;
		border: none;
		box-shadow: none;
	}
</style>
