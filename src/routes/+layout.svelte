<script>
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { lang } from '$lib/lang.svelte.js';

	let { children } = $props();

	$effect(() => {
		document.documentElement.lang = lang.current;
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
