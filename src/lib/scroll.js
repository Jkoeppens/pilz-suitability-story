// Aus ../pilz-suitability-story/main.js: autoSpacing(), computeLayout(),
// getCurrentStage() und die Index-Ermittlung aus applyStepVisibility()
// (das DOM-classList.add/remove daraus wird zur Klassenbindung in Step.svelte).
//
// Die Formeln sind 1:1 übernommen — auch der bekannte Bug bei
// EXTRA_STAGE_TAIL (siehe MIGRATION.md, Abschnitt UNKLAR): wird beim
// ersten Laden einmalig aus der Fensterhöhe berechnet und danach NIE
// wieder aktualisiert, auch nicht bei Resize. Absichtlich nicht repariert.
//
// Eine Anpassung gegenüber main.js: die Stage-Nummer kommt aus stepDefs[i].stage
// (dem steps.js-Array) statt aus el.dataset.stage — wir schreiben data-stage
// gar nicht ins Markup, siehe Step.svelte/steps.js aus Schritt 3.

import { browser } from '$app/environment';

export const STAGE_FADE_PORTION = 0.35;
export const EXTRA_STAGE_TAIL = browser ? window.innerHeight * 0.5 : 0;

export function autoSpacing(stepDefs, stepEls) {
	const byStage = {};

	stepDefs.forEach((def, i) => {
		if (def.introStep) return;
		(byStage[def.stage] ||= []).push(stepEls[i]);
	});

	Object.values(byStage).forEach((stageEls) => {
		const margin = 30 + stageEls.length * 8;
		stageEls.forEach((el) => {
			el.style.marginTop = `${margin}vh`;
			el.style.marginBottom = `${margin}vh`;
		});
	});
}

export function computeLayout(stepDefs, stepEls, innerHeight) {
	const steps = stepEls.map((el, i) => ({
		index: i,
		top: el.offsetTop,
		center: el.offsetTop + el.offsetHeight / 2,
		stage: stepDefs[i].stage
	}));

	const FIXED_FADE_LENGTH = innerHeight * 1.2;
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
