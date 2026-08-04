// Aus ../pilz-suitability-story/main.js: autoSpacing(), computeLayout(),
// getCurrentStage() und die Index-Ermittlung aus applyStepVisibility()
// (das DOM-classList.add/remove daraus wird zur Klassenbindung in Step.svelte).
//
// Die Formeln sind 1:1 übernommen — mit einer bewussten Abweichung vom
// Original: EXTRA_STAGE_TAIL wurde im alten main.js einmalig beim Laden aus
// window.innerHeight berechnet und bei Resize nie neu (siehe MIGRATION.md,
// Abschnitt UNKLAR). Hier wird es wie FIXED_FADE_LENGTH aus derselben,
// jeweils aktuellen innerHeight in computeLayout() berechnet — der Bug ist
// damit behoben.
//
// Eine weitere Anpassung gegenüber main.js: die Stage-Nummer kommt aus
// stepDefs[i].stage (dem steps.js-Array) statt aus el.dataset.stage — wir
// schreiben data-stage gar nicht ins Markup, siehe Step.svelte/steps.js aus
// Schritt 3.
//
// autoSpacing() ist keine eigene Funktion mehr, sondern computeStepMargins()
// (reiner Wert statt DOM-Schreibzugriff): die Margins hängen nur von der
// Step-Anzahl pro Stage ab, also von stepDefs allein — keine gemessene
// Geometrie nötig. +page.svelte berechnet sie als $derived und reicht sie
// als Prop an Step.svelte durch, das sie per style:-Bindung setzt. Der
// Vermessungs-Effekt unten liest damit nur noch, er schreibt nicht mehr ins
// DOM, bevor er misst.

export const STAGE_FADE_PORTION = 0.35;

export function computeStepMargins(stepDefs) {
	const byStage = {};

	stepDefs.forEach((def, i) => {
		if (def.introStep) return;
		(byStage[def.stage] ||= []).push(i);
	});

	const margins = new Array(stepDefs.length).fill(0);
	Object.values(byStage).forEach((indices) => {
		const margin = 30 + indices.length * 8;
		indices.forEach((i) => {
			margins[i] = margin;
		});
	});

	return margins;
}

export function computeLayout(stepDefs, stepEls, innerHeight) {
	const steps = stepEls.map((el, i) => ({
		index: i,
		top: el.offsetTop,
		center: el.offsetTop + el.offsetHeight / 2,
		stage: stepDefs[i].stage
	}));

	const FIXED_FADE_LENGTH = innerHeight * 1.2;
	const EXTRA_STAGE_TAIL = innerHeight * 0.5;
	const rawTransitions = [];

	for (let i = 0; i < steps.length - 1; i++) {
		const a = steps[i];
		const b = steps[i + 1];
		if (a.stage !== b.stage) {
			rawTransitions.push({ from: a.stage, to: b.stage, at: b.center });
		}
	}

	const transitions = rawTransitions.map((t) => ({
		from: t.from,
		to: t.to,
		at: t.at,
		start: t.at - FIXED_FADE_LENGTH * STAGE_FADE_PORTION,
		end: t.at + EXTRA_STAGE_TAIL
	}));

	return { steps, transitions };
}

export function getCurrentStage(scrollCenter, steps, transitions) {
	if (!transitions.length) return steps[0]?.stage ?? 1;

	const first = transitions[0];
	if (scrollCenter <= first.start) return first.from;

	for (const t of transitions) {
		if (scrollCenter < t.start) return t.from;
		if (scrollCenter <= t.end) {
			const p = (scrollCenter - t.start) / (t.end - t.start);
			return p < 0.5 ? t.from : t.to;
		}
	}

	return transitions.at(-1).to;
}

export function getActiveIndex(scrollCenter, steps) {
	let bestIndex = 0;
	let bestDist = Infinity;
	steps.forEach((s, i) => {
		const d = Math.abs(scrollCenter - s.center);
		if (d < bestDist) {
			bestIndex = i;
			bestDist = d;
		}
	});
	return bestIndex;
}

// Aus applyStageFade(). Original setzt zuerst ALLE .media-group-Elemente auf
// opacity 0 und danach nur das/die gerade relevanten wieder hoch — das
// Zurücksetzen entfällt hier, weil jede Aufrufstelle ihre Opacity als
// $derived aus scrollCenter neu berechnet statt einen alten Wert stehen zu
// lassen. Die Fallunterscheidung selbst ist 1:1 aus main.js übernommen.
export function getGroupOpacity(stage, scrollCenter, transitions) {
	if (!transitions.length) {
		return stage === 1 ? 1 : 0;
	}

	const first = transitions[0];
	if (scrollCenter <= first.start) {
		return stage === first.from ? 1 : 0;
	}

	for (const t of transitions) {
		if (scrollCenter >= t.start && scrollCenter <= t.end) {
			const p = (scrollCenter - t.start) / (t.end - t.start);
			if (stage === t.from) return 1 - p;
			if (stage === t.to) return p;
			return 0;
		}
		if (scrollCenter < t.start) {
			return stage === t.from ? 1 : 0;
		}
	}

	// hinter allen Übergängen — Stage 1 ist vollständig ausgeblendet
	return 0;
}

// Aus applyOverlays(). In main.js las die Zonen-Ermittlung s.el.dataset.overlay
// direkt vom DOM; hier kommt der overlay-String aus stepDefs[i].overlay (siehe
// computeLayout()-Kommentar oben zum selben Wechsel bei .stage). Die Formeln
// (0.25-Offset, fadeLen, Zonen-Grenzen) sind unverändert.
export function computeOverlayZones(stepDefs, steps, transitions, innerHeight) {
	const zones = {};

	steps.forEach((s, i) => {
		const overlays = (stepDefs[i].overlay || '').split(' ').filter(Boolean);
		if (!overlays.length) return;

		const start = s.center + innerHeight * 0.25;
		let end = start;
		const t = transitions.find((tr) => tr.from === s.stage);
		if (t) end = Math.max(end, t.end);
		else end = Infinity;

		overlays.forEach((cls) => {
			(zones[cls] ||= []).push({ start, end });
		});
	});

	return zones;
}

export function getOverlayOpacity(cls, scrollCenter, zones, innerHeight) {
	const clsZones = zones[cls];
	if (!clsZones || !clsZones.length) return 0;

	let opacity = 0;
	clsZones.forEach(({ start, end }) => {
		const fadeLen = innerHeight * 0.25;
		const fadeEnd = start + fadeLen;
		if (scrollCenter >= start && scrollCenter <= fadeEnd) {
			opacity = Math.max(opacity, (scrollCenter - start) / fadeLen);
		}
		if (scrollCenter > fadeEnd && scrollCenter <= end) opacity = 1;
	});
	return opacity;
}

// Aus applyHtmlOverlay(). stepDefs[i].model ersetzt s.el.dataset.model,
// gleicher Grund wie bei .stage/.overlay oben.
export function computeModelZones(stepDefs, steps, transitions, innerHeight) {
	const zones = [];

	steps.forEach((s, i) => {
		if (!stepDefs[i].model) return;
		const start = s.center + innerHeight * 0.25;
		let end = start;
		const t = transitions.find((tr) => tr.from === s.stage);
		if (t) end = Math.max(end, t.end);
		else end = Infinity;
		zones.push({ start, end });
	});

	return zones;
}

export function isModelVisible(scrollCenter, zones) {
	return zones.some(({ start, end }) => scrollCenter >= start && scrollCenter <= end);
}
