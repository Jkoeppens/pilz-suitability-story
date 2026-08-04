<script>
	import { lang, setLang } from './lang.svelte.js';
</script>

<div class="lang-switch" aria-label="Language switch">
	<button
		type="button"
		class="lang-btn"
		class:is-active={lang.current === 'de'}
		onclick={() => setLang('de')}
	>
		DE
	</button>
	<span class="lang-sep">/</span>
	<button
		type="button"
		class="lang-btn"
		class:is-active={lang.current === 'en'}
		onclick={() => setLang('en')}
	>
		EN
	</button>
</div>

<style>
	.lang-switch {
		position: absolute;
		top: 16px;
		right: 16px;
		z-index: 30;

		display: inline-flex;
		align-items: center;
		gap: 10px;

		padding: 8px 10px;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.16);
		backdrop-filter: blur(10px);

		font-family: 'IBM Plex Sans', sans-serif;
	}

	.lang-btn {
		appearance: none;
		border: none;
		background: transparent;
		color: rgba(255, 255, 255, 0.75);
		font-size: 14px;
		font-weight: 600;
		letter-spacing: 0.02em;
		cursor: pointer;
		padding: 4px 6px;
	}

	.lang-btn:hover {
		color: rgba(255, 255, 255, 0.95);
	}

	.lang-btn.is-active {
		color: #fff;
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.lang-sep {
		color: rgba(255, 255, 255, 0.45);
		font-size: 14px;
	}
</style>
