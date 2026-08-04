<script>
	// Aus ../pilz-suitability-story/main.js: QUAD_IMG_DEFS, initQuadOverlays(),
	// updateQuadOverlays(); dazu #quad-root/.quad-label aus index.html und die
	// zugehörigen Regeln aus style.css.
	//
	// Anders als im Original werden die vier <img> nicht lazy per JS erzeugt
	// (initQuadOverlays()) — sie existieren immer im Baum, sichtbar wird die
	// Karte rein über `visible` (Opacity/Klasse). Die Positionswerte kommen
	// bereits fertig projiziert von Map.svelte herein (rect), nicht durch
	// eigenen Zugriff auf die MapLibre-Instanz.
	//
	// #quad-root ist hier `position: fixed` statt wie im Original `absolute`
	// (relativ zu #app, das mit der Seite scrollt) — dazu siehe die
	// Stapelreihenfolge-Erklärung im Chat: das ist der eigentliche Grund,
	// warum das Original #quad-root zur Laufzeit in map.getCanvasContainer()
	// verschoben hat (map.project() liefert Pixel relativ zum fixed
	// Map-Viewport). z-index bleibt bei 2, identisch zum Original.
	import { t } from './i18n.js';

	let { rect, visible } = $props();

	const left = $derived(rect?.left ?? 0);
	const top = $derived(rect?.top ?? 0);
	const width = $derived(rect?.width ?? 0);
	const height = $derived(rect?.height ?? 0);
</script>

<div id="quad-root" class:hidden={!visible}>
	<div id="quad-tl" class="quad-cell">
		<img src="/maps/moran_colored.png" style="left:{left}px; top:{top}px; width:{width}px; height:{height}px" alt="" />
	</div>
	<div id="quad-tr" class="quad-cell">
		<img src="/maps/geary_colored.png" style="left:{left}px; top:{top}px; width:{width}px; height:{height}px" alt="" />
	</div>
	<div id="quad-bl" class="quad-cell">
		<img src="/maps/ndwi_colored.png" style="left:{left}px; top:{top}px; width:{width}px; height:{height}px" alt="" />
	</div>
	<div id="quad-br" class="quad-cell">
		<img src="/maps/ndvi_colored.png" style="left:{left}px; top:{top}px; width:{width}px; height:{height}px" alt="" />
	</div>

	<div class="quad-label tl">
		<span class="ql-title">Local Moran</span>
		<div class="ql-bar ql-bar--moran"></div>
		<span class="ql-sub">{t('legend_moran_sub')}</span>
	</div>
	<div class="quad-label tr">
		<span class="ql-title">Local Geary</span>
		<div class="ql-bar ql-bar--geary"></div>
		<span class="ql-sub">{t('legend_geary_sub')}</span>
	</div>
	<div class="quad-label bl">
		<span class="ql-title">NDWI</span>
		<div class="ql-bar ql-bar--ndwi"></div>
		<span class="ql-sub">{t('legend_ndwi_sub')}</span>
	</div>
	<div class="quad-label br">
		<span class="ql-title">NDVI</span>
		<div class="ql-bar ql-bar--ndvi"></div>
		<span class="ql-sub">{t('legend_ndvi_sub')}</span>
	</div>
</div>

<style>
	#quad-root {
		position: fixed;
		inset: 0;
		z-index: 2;
		pointer-events: none;
		opacity: 1;
		transition: opacity 0.5s ease;
	}

	#quad-root.hidden {
		opacity: 0;
	}

	.quad-cell {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}

	.quad-cell img {
		position: absolute;
		opacity: 0.82;
		pointer-events: none;
		mix-blend-mode: multiply;
	}

	#quad-tl {
		clip-path: polygon(0% 0%, 50% 0%, 50% 50%, 0% 50%);
	}
	#quad-tr {
		clip-path: polygon(50% 0%, 100% 0%, 100% 50%, 50% 50%);
	}
	#quad-bl {
		clip-path: polygon(0% 50%, 50% 50%, 50% 100%, 0% 100%);
	}
	#quad-br {
		clip-path: polygon(50% 50%, 100% 50%, 100% 100%, 50% 100%);
	}

	#quad-root::before,
	#quad-root::after {
		content: '';
		position: absolute;
		background: rgba(255, 255, 255, 0.45);
		z-index: 10;
		pointer-events: none;
	}
	#quad-root::before {
		top: 50%;
		left: 0;
		right: 0;
		height: 2px;
	}
	#quad-root::after {
		left: 50%;
		top: 0;
		bottom: 0;
		width: 2px;
	}

	.quad-label {
		position: absolute;
		z-index: 11;
		color: #fff;
		font-family: 'IBM Plex Sans', sans-serif;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.85);
		pointer-events: none;
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.quad-label.tl {
		top: 14px;
		left: 14px;
	}
	.quad-label.tr {
		top: 14px;
		right: 14px;
		align-items: flex-end;
	}
	.quad-label.bl {
		bottom: 14px;
		left: 14px;
	}
	.quad-label.br {
		bottom: 14px;
		right: 14px;
		align-items: flex-end;
	}

	.ql-title {
		font-size: 1.05rem;
		font-weight: 600;
	}
	.ql-sub {
		font-size: 0.8rem;
		opacity: 0.85;
	}

	.ql-bar {
		width: 90px;
		height: 7px;
		border-radius: 3px;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
	}
	.ql-bar--moran {
		background: linear-gradient(to right, #fee8c8, #fdbb84, #e34a33);
	}
	.ql-bar--geary {
		background: linear-gradient(to right, #f7f4f9, #998ec3, #542788);
	}
	.ql-bar--ndwi {
		background: linear-gradient(to right, #f7fbff, #6baed6, #08519c);
	}
	.ql-bar--ndvi {
		background: linear-gradient(to right, #f2f2f2, #a3c586, #2f6b3a);
	}
</style>
