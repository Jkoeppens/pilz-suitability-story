// Aus ../pilz-suitability-story/main.js: das I18N-Wörterbuch und applyI18n().
// Die Schlüssel werden erst in einem späteren Schritt im Markup gebraucht
// (Quad-Legende, Eignungskarten-Legende, Exit-Button) — hier schon vollständig
// übernommen wie bei steps.js.

import { lang } from './lang.svelte.js';

const I18N = {
	de: {
		legend_moran_sub: 'lokale Clusterung',
		legend_geary_sub: 'lokaler Kontrast',
		legend_ndwi_sub: 'Feuchte',
		legend_ndvi_sub: 'Vegetation',
		map_suitability_title: 'Eignung für Parasole',
		map_back: '← Zurück'
	},
	en: {
		legend_moran_sub: 'local clustering',
		legend_geary_sub: 'local contrast',
		legend_ndwi_sub: 'moisture',
		legend_ndvi_sub: 'vegetation',
		map_suitability_title: 'Parasol suitability',
		map_back: '← Back'
	}
};

export function t(key) {
	const dict = I18N[lang.current] || I18N.de;
	return dict[key] ?? '';
}
