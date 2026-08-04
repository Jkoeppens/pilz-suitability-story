# CLAUDE.md

Migration der Scrollytelling-Story (`../pilz-suitability-story`, Branch
`main`, Vanilla-JS mit MapLibre) nach SvelteKit. Siehe `MIGRATION.md` für
die Bestandsaufnahme (Zustand/Abgeleitet/Config) des alten `main.js`.

## Regeln

- **Svelte 5 mit Runes.** `$state`, `$derived`, `$effect`, `$props`. Nie
  die alte Options-API (`export let`, `$:`, Stores für Component-State).
  Diese Regel gilt uneingeschränkt für den gesamten Code in diesem Projekt.

- **adapter-static, kein Server.** Die App wird als statische Seite
  gebaut (`@sveltejs/adapter-static`, siehe `vite.config.js`). Kein
  `+page.server.js`, kein `+server.js`, keine Form Actions, kein SSR-only
  Code, der einen Node-Server voraussetzt. `export const prerender = true`
  bleibt im Root-Layout gesetzt.

- **MapLibre, Canvas-Animation und D3-Baum werden nicht umgeschrieben.**
  Diese Teile aus dem alten `main.js` (Karten-Setup, `addMapLayers()`,
  die Punkt-Animation auf `#points-canvas`, der D3-Entscheidungsbaum in
  `viz/`) werden so übernommen, wie sie sind — nicht refaktoriert, nicht
  "verbessert", nicht in reaktive Svelte-Konstrukte übersetzt. Sie laufen
  weiter als das, was sie sind: imperativer Code, der von außen
  aufgerufen wird (z. B. aus `$effect`).

- **Scroll-Mathematik 1:1 übernehmen.** Die Berechnungen in
  `../pilz-suitability-story/main.js` — `computeLayout()`,
  `getCurrentStage()`, `applyStepVisibility()`, `applyMapCamera()`,
  `applyStageFade()`, `applyOverlays()`, `applyHtmlOverlay()`,
  `autoSpacing()` und die zugehörigen Konstanten (`STAGE_FADE_PORTION`,
  `EXTRA_STAGE_TAIL` u. a.) — werden unverändert portiert, nicht
  korrigiert oder optimiert. Auch scheinbare Bugs (z. B. `EXTRA_STAGE_TAIL`
  wird bei Resize nicht neu berechnet, siehe MIGRATION.md) bleiben
  bestehen, außer der Nutzer bittet explizit um eine Korrektur.

- **Ein Schritt pro Sitzung.** Nicht mehrere Migrationsschritte in einer
  Antwort bündeln (z. B. nicht gleichzeitig Zustand einführen, Karten
  verdrahten und Styles übertragen). Jede Sitzung bearbeitet einen
  klar abgegrenzten Teil, damit der Nutzer jeden Schritt nachvollziehen
  kann.

## Projektstruktur

- `static/img/`, `static/maps/`, `static/text/` — unverändert aus dem
  alten Projekt übernommen, unter denselben relativen Pfaden erreichbar
  wie vorher (`/img/…`, `/maps/…`, `/text/…`).
- `src/routes/` — SvelteKit-Routen.
- `vite.config.js` — enthält sowohl die Vite- als auch die
  SvelteKit-/Adapter-Konfiguration (kein separates `svelte.config.js` in
  dieser SvelteKit-Version).
