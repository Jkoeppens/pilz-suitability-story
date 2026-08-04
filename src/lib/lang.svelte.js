// Aus ../pilz-suitability-story/main.js: getLangFromUrl(), getBrowserLang(),
// getInitialLang(), setLang(). currentLang wird hier zu echtem $state.

import { browser } from '$app/environment';

const SUPPORTED_LANGS = new Set(['de', 'en']);
const LANG_STORAGE_KEY = 'scrolly_lang';

function getLangFromUrl() {
	const params = new URLSearchParams(window.location.search);
	const value = (params.get('lang') || '').toLowerCase();
	return SUPPORTED_LANGS.has(value) ? value : null;
}

function getBrowserLang() {
	const raw = (navigator.language || 'de').toLowerCase();
	const short = raw.split('-')[0];
	return SUPPORTED_LANGS.has(short) ? short : 'de';
}

function getInitialLang() {
	// Während des adapter-static Prerenderings gibt es kein window/localStorage/
	// navigator (Node-Umgebung, siehe CLAUDE.md "adapter-static, kein Server").
	if (!browser) return 'de';

	const urlLang = getLangFromUrl();
	if (urlLang) return urlLang;

	const stored = (localStorage.getItem(LANG_STORAGE_KEY) || '').toLowerCase();
	if (SUPPORTED_LANGS.has(stored)) return stored;

	return getBrowserLang();
}

export const lang = $state({ current: getInitialLang() });

export function setLang(nextLang) {
	if (!SUPPORTED_LANGS.has(nextLang)) return;
	lang.current = nextLang;

	localStorage.setItem(LANG_STORAGE_KEY, nextLang);

	const url = new URL(window.location.href);
	url.searchParams.set('lang', nextLang);
	history.replaceState({}, '', url);
}
