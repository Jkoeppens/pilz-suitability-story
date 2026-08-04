// 1:1 aus ../pilz-suitability-story/index.html (<article class="step">, Zeile ~126-233).
// Alle data-* Attribute werden übernommen, auch die hier noch ungenutzten
// (overlay, trigger, model) — sie werden erst in einem späteren Schritt gebraucht.

export const steps = [
	{ stage: 1, md: null, overlay: null, trigger: null, model: false, introStep: true, invisible: true, spacer: false, style: null },
	{ stage: 1, md: null, overlay: 'overlay-pilz', trigger: null, model: false, introStep: false, invisible: true, spacer: false, style: null },
	{ stage: 1, md: 'slide1_02_body.md', overlay: null, trigger: null, model: false, introStep: false, invisible: false, spacer: false, style: null },
	{ stage: 1, md: null, overlay: null, trigger: null, model: false, introStep: false, invisible: true, spacer: false, style: 'height: 100vh;' },

	{ stage: 2, md: null, overlay: 'overlay-parasole', trigger: null, model: false, introStep: false, invisible: true, spacer: false, style: null },
	{ stage: 2, md: 'slide2_01_intro.md', overlay: null, trigger: null, model: false, introStep: false, invisible: false, spacer: false, style: null },
	{ stage: 2, md: 'slide2_02_parasol.md', overlay: null, trigger: null, model: false, introStep: false, invisible: false, spacer: false, style: null },

	{ stage: 3, md: null, overlay: 'overlay-parasol2', trigger: null, model: false, introStep: false, invisible: true, spacer: false, style: null },
	{ stage: 3, md: 'slide3_01_intro.md', overlay: null, trigger: null, model: false, introStep: false, invisible: false, spacer: false, style: null },
	{ stage: 3, md: null, overlay: 'overlay-meisen', trigger: null, model: false, introStep: false, invisible: true, spacer: false, style: null },
	{ stage: 3, md: 'slide3_03_meisen.md', overlay: null, trigger: null, model: false, introStep: false, invisible: false, spacer: false, style: null },

	{ stage: 4, md: 'slide04_01_bias_text.md', overlay: 'overlay-fundpunkte-berlin_stg4', trigger: null, model: false, introStep: false, invisible: false, spacer: false, style: null },
	{ stage: 4, md: 'slide4_02_signatures.md', overlay: null, trigger: null, model: false, introStep: false, invisible: false, spacer: false, style: null },

	{ stage: 5, md: 'slide5_02_signatures_Data.md', overlay: null, trigger: null, model: false, introStep: false, invisible: false, spacer: false, style: null },
	{ stage: 5, md: 'slide5_03_model_intro.md', overlay: 'overlay-fundpunkte-berlin', trigger: null, model: false, introStep: false, invisible: false, spacer: false, style: null },
	{ stage: 5, md: 'slide5_04_charts.md', overlay: 'overlay-fundpunkte-berlin', trigger: null, model: true, introStep: false, invisible: false, spacer: false, style: null },
	{ stage: 5, md: 'slide5_05_prediction_intro.md', overlay: null, trigger: null, model: true, introStep: false, invisible: false, spacer: false, style: null },
	{ stage: 5, md: 'slide5_06_prediction_explain.md', overlay: null, trigger: null, model: true, introStep: false, invisible: false, spacer: false, style: null },
	{ stage: 5, md: null, overlay: null, trigger: 'prediction-map', model: false, introStep: false, invisible: false, spacer: true, style: null }
];
