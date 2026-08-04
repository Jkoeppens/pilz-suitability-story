<script>
	// Aus ../pilz-suitability-story/index.html: <section id="intro"> mit
	// .intro-block und #intro-md (slide1_01_intro.md), dazu die zugehörigen
	// Regeln aus style.css. Das Markdown-Laden folgt demselben Muster wie
	// Step.svelte (fetch pro Sprachwechsel, siehe dort).
	//
	// mountLangSwitchIntoIntro() aus main.js — main.js:91–96 — verschiebt
	// #lang-switch zur Laufzeit in .intro-block hinein. Hier wird <LangSwitch>
	// stattdessen direkt an dieser Stelle im Markup gerendert, gleicher
	// Grund wie überall sonst: kein Element existiert erst unabhängig, um es
	// danach per JS zu verschieben.
	import { marked } from 'marked';
	import { base } from '$app/paths';
	import { lang } from './lang.svelte.js';
	import LangSwitch from './LangSwitch.svelte';

	let html = $state('');

	$effect(() => {
		const currentLang = lang.current;
		let cancelled = false;
		fetch(`${base}/text/${currentLang}/slide1_01_intro.md`)
			.then((res) => res.text())
			.then((text) => {
				if (!cancelled) html = marked.parse(text);
			})
			.catch((err) => console.error('Fehler beim Laden:', 'slide1_01_intro.md', err));
		return () => {
			cancelled = true;
		};
	});
</script>

<section id="intro">
	<article class="intro-block">
		<LangSwitch />
		<div id="intro-md">
			{#if html}
				{@html html}
			{/if}
		</div>
	</article>
</section>

<style>
	#intro {
		position: relative;
		z-index: 10;
		padding: 20vh 0 8vh;
	}

	.intro-block {
		position: relative;

		width: 56vw;
		max-width: 760px;
		margin: 0 auto;

		padding: 2.8rem 3rem;

		background: rgba(20, 20, 20, 0.55);
		border-radius: 0;
		border: none;

		box-shadow: none;

		font-size: 1.35rem;
		line-height: 1.6;
		color: #f5f5f5;
	}
</style>
