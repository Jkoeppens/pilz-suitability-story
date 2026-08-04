import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) => filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			// GitHub Pages liefert das Projekt unter /pilz-suitability-story/,
			// nicht unter /. Nur für den Produktionsbuild (vite build setzt
			// NODE_ENV=production) — dev bleibt unter / erreichbar.
			paths: {
				base: process.env.NODE_ENV === 'production' ? '/pilz-suitability-story' : ''
			}
		})
	]
});
