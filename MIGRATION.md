# Bestandsaufnahme: main.js / index.html vor der Svelte-5-Migration

Diese Datei beschreibt nur den Ist-Zustand. Keine Umsetzungsvorschläge.

---

## 1. ZUSTAND — echte, unabhängige Zustandsgrößen

Werte, die sich ändern können, ohne dass sie aus etwas anderem im Programm
berechnet werden. Sie werden entweder direkt durch Nutzerinteraktion,
durch ein externes Ereignis (Browser, Netzwerk, Timer) oder durch
explizite Zuweisung gesetzt.

- **`currentLang`** (main.js:37) — aktuell aktive Sprache (`"de"`/`"en"`).
  Initial gesetzt aus `getInitialLang()` (URL-Param → localStorage →
  Browsersprache), danach nur noch durch `setLang()` verändert (Klick auf
  Sprachumschalter).

- **`window.scrollY`** — Scrollposition der Seite. Wird laufend vom Browser
  verändert (Scroll-Event), ist die zentrale treibende Größe fast aller
  Bildschirm-Updates.

- **`window.innerWidth` / `window.innerHeight`** — Fenstergröße. Ändert sich
  durch Resize-Event.

- **`mapReady`** (main.js:166) — Flag, das von `false` auf `true` wechselt,
  sobald das `load`-Event der Haupt-MapLibre-Instanz gefeuert hat
  (main.js:230–235). Danach nie wieder verändert.

- **`suitMapInitialized`** (main.js:582) — Flag, das einmalig auf `true`
  gesetzt wird, sobald die interaktive Eignungskarte zum ersten Mal
  geöffnet wird (main.js:584–589).

- **`animStates['parasol-src']` / `animStates['meisen-src']`**
  (main.js:401–404) — pro Punktquelle: `revealed` (Set), `rippleStart`
  (Map), `revealDelays` (Array), `t0` (Startzeitpunkt), `allRevealed`,
  `done`. Diese Werte entwickeln sich **über Zeit** durch die
  `requestAnimationFrame`-Schleife (main.js:540–570), nicht direkt durch
  Scroll — Scroll löst nur `startPointAnimation()` / `resetPointAnimation()`
  aus, danach läuft die Animation autonom weiter.

- **`pulseRafId`** (main.js:538) — Handle der laufenden
  `requestAnimationFrame`-Schleife; `null` wenn keine Schleife aktiv ist.

- **`pointFeatures['parasol-src']` / `['meisen-src']`** (main.js:395–398) —
  aus GeoJSON geladene Koordinatenlisten. Startet leer, wird einmalig durch
  `loadPointData()` (main.js:409–423, async) gefüllt und ändert sich danach
  nicht mehr.

- **`quadOverlays`** (main.js:169) — `null`, bis `initQuadOverlays()`
  (main.js:182–195) beim ersten Erreichen von Stage 5 die vier `<img>`-
  Elemente erzeugt; danach dauerhaft gesetzt.

- **`currentCamKey`** (main.js:721) — merkt sich, welche Kamera zuletzt
  tatsächlich angewendet wurde (Stage-Key oder Step-Override-Key), damit
  `map.easeTo()` nicht bei jedem Scroll-Tick erneut ausgelöst wird.

- **`canvasVisible`** (main.js:407) — Set der aktuell auf dem Canvas
  sichtbaren Punktquellen; wird bei jedem Scroll neu zugewiesen, dient
  aber auch als Vergleichswert für den *vorherigen* Zustand (siehe
  UNKLAR).

- **`map`, `suitMap`** (main.js:165, 581) — die beiden MapLibre-
  Instanzen selbst. Beginnen als `null`, werden einmalig zugewiesen.

---

## 2. ABGELEITET — Werte, die aus Zustand folgen

Für jeden Wert: aus welchem Zustand, über welche Funktion.

- **`scrollCenter`** ← `scrollY`, `innerHeight` — Inline-Berechnung in
  `onScroll()` (main.js:956): `scrollY + innerHeight * 0.5`.

- **`steps[]`, `groups[]`, `transitions[]`** ← DOM-Struktur (`.step`- und
  `.media-group`-Elemente inkl. `offsetTop`/`offsetHeight`, die ihrerseits
  vom gerenderten Text — also `currentLang` — und von den durch
  `autoSpacing()` gesetzten Margins abhängen) sowie `innerHeight` — über
  `computeLayout()` (main.js:663–696).

- **`currentStage`** ← `scrollCenter`, `transitions` — über
  `getCurrentStage()` (main.js:701–716).

- **`activeIndex` / aktiver Step** ← `scrollCenter`, `steps` (nächstgelegener
  Step-Mittelpunkt) — über `applyStepVisibility()` (main.js:836–847). Die
  `step--active`-Klasse ist derselbe Wert, nur direkt als Nebeneffekt in
  derselben Funktion geschrieben.

- **Zielkamera (`center`/`zoom`) + `camKey`** ← `activeIndex`, `steps`
  (`dataset.md`), `STEP_CAMERA_OVERRIDES`; falls kein Override zutrifft:
  `currentStage` + `STAGE_CAMERAS` — über `applyMapCamera()`
  (main.js:723–755). Ob daraus tatsächlich ein `map.easeTo()` wird, hängt
  zusätzlich vom Vergleich mit `currentCamKey` ab.

- **`visible`** (Set sichtbarer Layer-IDs) ← `activeIndex`, `steps`
  (`dataset.overlay` aller Steps von Index 0 bis `activeIndex` **innerhalb
  der aktuellen Stage**, akkumuliert), `OVERLAY_TO_LAYERS`, sowie
  `activeStep.dataset.trigger === 'prediction-map'` (fügt `SUIT_LAYER`
  hinzu) — über `applyMapLayers()` (main.js:760–831).

- **`newCanvasVisible`** ← `visible` (Mitgliedschaft von
  `parasol-points`/`meisen-points`) — über `applyMapLayers()`.

- **`showQuad`** ← `currentStage` (aus `activeStep.stage`),
  `activeStep.dataset.trigger` — über `applyMapLayers()` (main.js:811).

- **Sichtbarkeit von `#suit-legend`** ← `visible.has(SUIT_LAYER)` — über
  `applyMapLayers()` (main.js:829–830).

- **Sichtbarkeit/`overflow` von `#prediction-map`** ← `activeIndex`,
  `steps[activeIndex].dataset.trigger` — über `applyPredictionMap()`
  (main.js:619–636).

- **Sichtbarkeit/Opacity von `.overlay-model`** ← `scrollCenter`, `steps`
  (`dataset.model`), `transitions` — über `applyHtmlOverlay()`
  (main.js:852–872).

- **Opacity je `.media-group`** (Stage-1-PNG-Crossfade) ← `scrollCenter`,
  `transitions` — über `applyStageFade()` (main.js:881–912).

- **Opacity je `.overlay-img`-Klasse** ← `scrollCenter`, `steps`
  (`dataset.overlay`), `transitions` — über `applyOverlays()`
  (main.js:917–950).

- **Position/Größe der Quad-Overlay-Bilder** (`left`/`top`/`width`/`height`)
  ← aktueller Karten-Viewport von `map` (Pan/Zoom, laufend über das
  `move`-Event aktualisiert), `IMG_NW`/`IMG_SE` — über
  `updateQuadOverlays()` (main.js:197–208).

- **Canvas-Zeichenwerte je Punkt** (Position, Radius, Halo-/Ripple-Opacity)
  ← `pointFeatures`, `animStates` (`revealed`, `rippleStart`),
  Karten-Zoom/`map.project()`, `performance.now()` — über
  `redrawPointsCanvas()` (main.js:435–506).

- **Text der `[data-i18n]`-Elemente + `<html lang>`** ← `currentLang`,
  `I18N` — über `applyI18n()` (main.js:81–89).

- **Aktiver Button im Sprachumschalter** ← `currentLang` — über
  `updateLangSwitchUI()` (main.js:39–45).

- **Markdown-Inhalt der `[data-md]`-Elemente** ← `currentLang` (bestimmt
  Fetch-Pfad `text/{lang}/…`) — über `loadMarkdown()` (main.js:101–114,
  async).

- **`marginTop`/`marginBottom` je `.step`** ← Anzahl Steps pro Stage (aus
  DOM ermittelt) — über `autoSpacing()` (main.js:641–658). Das Ergebnis
  fließt seinerseits in `computeLayout()` ein, da `autoSpacing()` immer
  vor `computeLayout()` aufgerufen wird und `offsetTop` erst danach korrekt
  gemessen werden kann.

---

## 3. WEDER NOCH — Konfiguration und reines Zeichnen

### Konfiguration (Konstanten, Layer-/Kamera-Definitionen)

- `IS_LOCAL`, `TILES_CONFIG`, `TILES_BASE` (main.js:5–9)
- `SUPPORTED_LANGS`, `LANG_STORAGE_KEY` (main.js:14–15)
- `I18N`-Wörterbuch (main.js:62–79)
- `STAGE_FADE_PORTION`, `EXTRA_STAGE_TAIL` (main.js:123–124)
- `MAPTILER_KEY` (main.js:129, aus `index.html:21`)
- `STAGE_CAMERAS`, `STEP_CAMERA_OVERRIDES` (main.js:132–143)
- `OVERLAY_TO_LAYERS`, `RASTER_LAYERS`, `POINT_LAYERS`, `HALO_LAYERS`,
  `RIPPLE_LAYERS`, `SUIT_LAYER`, `ALL_LAYERS` (main.js:146–160)
- `QUAD_IMG_DEFS`, `IMG_NW`, `IMG_SE`, `RASTER_COORDS` (main.js:171–180,
  241–246)
- `POINT_ANIM_CFG` (URLs; main.js:389–392), `LAYER_TO_SRC` (main.js:406)
- Step-Konfiguration im Markup selbst: `data-stage`, `data-overlay`,
  `data-md`, `data-trigger`, `data-model` an den `<article class="step">`-
  Elementen (index.html:126–233) — reine Konfigurationsdaten, die im HTML
  stehen statt in JS-Objekten.

### Reines Zeichnen / Mechanik (MapLibre, Canvas, DOM-Anwendung)

- `initMap()`, `addMapLayers()` — MapLibre-Source-/Layer-Deklarationen
  (main.js:210–379)
- `initSuitMap()` — zweite MapLibre-Instanz für die interaktive Karte
  (main.js:584–617)
- `initQuadOverlays()` / `updateQuadOverlays()` — CSS-Positionierung von
  `<img>`-Elementen über `map.project()` (main.js:182–208)
- `redrawPointsCanvas()` — Canvas-2D-Zeichenroutine (main.js:435–506)
- `startPulseLoop()` / `stopPulseLoop()` / `tick()` —
  `requestAnimationFrame`-Schleife (main.js:540–576)
- Alle imperativen Schreibvorgänge, die einen bereits abgeleiteten Wert
  nur noch anwenden: `classList.toggle`, `style.opacity =`,
  `style.display =`, `map.setLayoutProperty`, `map.easeTo`,
  `document.body.style.overflow`, `history.replaceState`,
  `localStorage.setItem`
- `shuffleIndices()` — reine Hilfsfunktion, Fisher-Yates-Shuffle
  (main.js:425–432)
- `marked.parse()` — externe Markdown-Bibliothek (index.html:14)
- `mountLangSwitchIntoIntro()` — verschiebt ein DOM-Element an eine andere
  Stelle im Baum (main.js:91–96)

---

## 4. UNKLAR — Grenzfälle ohne Einordnung

- **`map`, `suitMap`, `mapReady`, `suitMapInitialized`** — Sind die
  MapLibre-Instanzen selbst Zustand (weil sie sich von `null` zu einer
  Instanz ändern, `mapReady` von `false` zu `true`), oder sind es
  externe System-Handles, die außerhalb des reaktiven Modells verwaltet
  werden sollten — vergleichbar mit einer DOM-Node-Referenz? `mapReady`
  gated praktisch jede andere Funktion (main.js:724, 761); unklar, ob das
  ein eigenständiger Zustand oder nur ein Ladedetail ist.

- **`currentCamKey` und `canvasVisible`** — beide speichern den zuletzt
  angewendeten abgeleiteten Wert, einzig um im nächsten Durchlauf einen
  Vergleich zu ermöglichen: Kamera nur bewegen, wenn sich `camKey` ändert
  (main.js:745); Punktanimation nur starten/zurücksetzen, wenn sich die
  Sichtbarkeit ändert (main.js:794–800). Ist das echter Zustand (weil es
  zwischen Aufrufen persistieren muss) oder reine Memoisierung eines
  abgeleiteten Werts zur Vermeidung doppelter Seiteneffekte? Das Muster
  taucht zweimal auf, ich bin mir bei der Einordnung nicht sicher.

- **`animStates`** (`revealed`, `rippleStart`, `t0`, `allRevealed`, `done`)
  — entwickelt sich, einmal gestartet, autonom über Zeit via
  `requestAnimationFrame`, unabhängig vom Scroll. Ist das eigenständiger
  fachlicher Zustand (gehört in ZUSTAND) oder reine Animationsmechanik
  ohne fachliche Bedeutung (gehört in WEDER NOCH)? Ich sehe Argumente für
  beides.

- **`pointFeatures`** — asynchron einmalig geladene GeoJSON-Koordinaten,
  ändert sich nach dem Laden nicht mehr. Ist das ein async geladener
  Zustandswert (leer → gefüllt) oder eher Konfigurationsdaten
  (vergleichbar mit `POINT_ANIM_CFG.url`, aus dem es stammt)?

- **`steps[]` und `groups[]`** — diese Arrays vermischen abgeleitete
  Zahlenwerte (`top`, `center`, `stage`) mit rohen DOM-Element-Referenzen
  (`el`), die später direkt für `dataset`-Zugriffe und
  `classList`-Manipulation verwendet werden (main.js:666–674). Diese
  Vermischung von berechnetem Wert und Zeichen-Handle lässt sich nicht
  eindeutig einer der drei Kategorien zuordnen.

- **`autoSpacing()`-Margins** — technisch ein abgeleiteter Wert (aus der
  Anzahl Steps pro Stage), wird aber zwingend vor `computeLayout()`
  ausgeführt, weil `computeLayout()` die Layoutmaße (`offsetTop`) erst
  danach korrekt messen kann (main.js:975–976). Es besteht also eine
  echte Ausführungsreihenfolge-Abhängigkeit zwischen zwei „abgeleiteten“
  Berechnungen, vermittelt über die Browser-Layout-Engine — unklar, ob
  sich das als reine Ableitung fassen lässt.

- ~~**`EXTRA_STAGE_TAIL`** (main.js:124) wird einmalig beim Modul-Laden aus
  `window.innerHeight` berechnet und bei `resize` **nicht** neu berechnet
  — im Unterschied zu `FIXED_FADE_LENGTH` in `computeLayout()`
  (main.js:676), die bei jedem Aufruf neu aus `innerHeight` berechnet
  wird. Ob das beabsichtigt ist oder ein Bug, kann ich aus dem Code allein
  nicht beurteilen.~~

  **Behoben** (`src/lib/scroll.js`, Commit nach „Schritt 5: Scroll-Zustand“):
  In der Svelte-Portierung wird `EXTRA_STAGE_TAIL` wie `FIXED_FADE_LENGTH`
  direkt in `computeLayout()` aus der jeweils aktuellen `innerHeight`
  berechnet, statt einmalig eingefroren zu werden. Das war zunächst 1:1
  aus `main.js` übernommen worden (siehe Commit „Schritt 5“); ab diesem
  Commit ist es eine **bewusste Abweichung vom Original** — der Bug ist
  behoben, nicht mehr Verhaltensparität mit `main.js`.

- **`currentLang`-Initialisierung** (`getInitialLang()`, main.js:29–35) —
  Reihenfolge URL-Param → localStorage → Browsersprache. Jede Änderung
  über `setLang()` schreibt wieder in URL **und** localStorage zurück
  (main.js:50–54). Ist `currentLang` der eigentliche Zustand mit
  URL/localStorage als reine Persistenzschicht, oder sind URL-Param und
  localStorage gleichrangige, zu synchronisierende Zustände?

- **`quadOverlays`** — wird lazy beim ersten Erreichen von Stage 5 erzeugt
  (`if (quadOverlays) return;`, main.js:183) und danach wiederverwendet.
  Ist das ein Zustandsflag („wurde initialisiert“) oder ein reiner Cache
  innerhalb der Zeichenroutine?

---

## 5. Bewusste Abweichungen vom Original

Stellen, an denen die Svelte-Portierung nicht 1:1 dem Verhalten oder
Aufbau von `main.js`/`style.css` folgt — mit Begründung, damit sich das
später nicht wie ein Versehen liest.

- **`untrack()` in der Step-Vermessung** (`src/routes/+page.svelte`,
  Commit „Schritt 6: Stage-Fades und Overlays“) — der `$effect`, der
  `autoSpacing()`/`computeLayout()` aufruft, liest `stepEls` über
  `untrack(() => stepEls)` statt es direkt zu lesen. Grund: Ohne
  `untrack()` entsteht ein Kreis — der Effekt schreibt `steps`,
  `activeIndex` (`$derived` aus `steps`) ändert sich, jede `Step`-
  Komponente deren `active`-Prop sich ändert re-rendert, `bind:this`
  darin schreibt `stepEls[i]` erneut, was den Effekt erneut auslöst,
  obwohl sich an den tatsächlichen DOM-Knoten nichts geändert hat. In der
  Praxis lief das als Endlosschleife (mehrere tausend Durchläufe pro
  Sekunde, siehe Commit-Testprotokoll). Die Annahme dahinter, die
  `untrack()` erst korrekt macht: die Element-Referenzen in `stepEls`
  werden einmalig beim Mount jeder `Step`-Komponente gesetzt und ändern
  sich danach nie wieder — nur `innerWidth`/`innerHeight` (Resize) sollen
  eine Neuvermessung auslösen, nicht ein erneutes, wertgleiches Schreiben
  von `stepEls`. Hält diese Annahme nicht mehr (z. B. weil Steps künftig
  bedingt gerendert/neu gemountet werden), muss die Messlogik neu
  durchdacht werden, nicht einfach `untrack()` entfernt werden.

- **`#scroll-root { z-index: 10 }`** (`src/routes/+page.svelte`, Commit
  „Schritt 6“) — im Original folgt diese Regel aus `style.css`
  automatisch mit, weil `#scroll-root` von Anfang an Teil des Markups
  war. In der Portierung existierte der Text-Container bis Schritt 6 ohne
  eigenen Stacking-Context; er musste jetzt explizit ergänzt werden, weil
  sonst das neu hinzugekommene `#media-root` (`z-index: 1`, `position:
  fixed`, volle Bildschirmfläche) die Textboxen verdeckt hätte. Keine
  Änderung an einer Formel, sondern eine bislang fehlende Voraussetzung,
  die durch das Hinzufügen von `#media-root` erst nötig wurde.

- **Weggelassenes `.hidden` auf `.overlay-model`** — das Original-Markup
  trägt `<div class="overlay-model hidden">`, und `applyHtmlOverlay()`
  toggelt zusätzlich zu `style.opacity`/`style.pointerEvents` auch die
  Klassen `active`/`hidden` (main.js:868–871). Geprüft: Es existiert in
  `style.css` keine Regel für `.overlay-model.hidden` oder ein
  eigenständiges `.hidden` (nur `#quad-root.hidden` und
  `#suit-legend.hidden`, beide auf andere IDs beschränkt). Die Klasse ist
  im Original toter Code ohne visuellen Effekt — `.overlay-model`
  (Basis: `opacity: 0`) und `.overlay-model.active` (`opacity: 1`) regeln
  die Sichtbarkeit bereits vollständig. Die Portierung setzt daher nur
  `class:active`, ohne `.hidden` und ohne die redundanten Inline-Styles.

- **`ResizeObserver` auf `#scroll-root`, um die Step-Vermessung nach
  spät ankommendem Markdown erneut laufen zu lassen** (`src/routes/+page.svelte`,
  Commit vor „Schritt 8: 2×2-Rasterkarte“) — behebt eine **Regression aus
  der Portierung**, keine Verhaltensangleichung ans Original:

  **Ist main.js vom selben Problem betroffen?** Empirisch geprüft (Original
  lokal gestartet, `window._steps` — dort zu Debug-Zwecken global abgelegt
  — gegen live `offsetTop` über alle 19 Steps verglichen): **Nein, `diff: 0`
  überall.** `main.js` awaitet `loadMarkdown()` (alle Markdown-Dateien
  geladen) explizit, bevor `computeLayout()` läuft (main.js, `DOMContentLoaded`-
  Handler); die dafür nötige Netzwerk-Wartezeit reicht in der Praxis aus,
  damit auch die nachladende Google-Font (`display=swap`) fertig ist. Kein
  Bug im Original — ein Nebeneffekt der Reihenfolge, der das Font-Problem
  zufällig mit abdeckt.

  **Regression in der Portierung:** `Step.svelte` lädt sein Markdown per
  eigenem `$effect` und `fetch()` — asynchron, pro Step, unabhängig von der
  Vermessung in `+page.svelte`. Die Vermessung selbst lief seit Schritt 5
  nur einmal beim Mount (alle `stepEls`-Refs gebunden) und danach nur bei
  `innerWidth`/`innerHeight`-Änderungen — beides passiert, bevor auch nur
  ein einziger Markdown-Fetch zurückkommt. Gemessen: Step-Index 3 lag bei
  der (einzigen) Vermessung auf `offsetTop 1042px`, tatsächlich renderte er
  nach Ankunft des Markdowns bei `1862px` — 820px Differenz an nur einer
  Stelle, die sich über die Seite aufsummiert (Index 12: bereits >1800px).
  In der Praxis bedeutete das falsche `activeIndex`/`currentStage`-Werte,
  sobald man weit genug scrollte — u. a. Ursache dafür, dass die Quad-Karte
  in Schritt 8 zunächst an der falschen Stelle erschien.

  **Fix:** Ein `ResizeObserver` beobachtet `#scroll-root` selbst (nicht die
  einzelnen Steps) und löst dieselbe `remeasure()`-Funktion aus wie der
  bestehende Resize-Effekt, sobald sich dessen Gesamthöhe ändert — egal ob
  durch nachladendes Markdown, Webfont-Tausch, Sprachwechsel oder künftige
  Bilder. Ein Sonderfall pro Ursache war nicht nötig.

  **Kreis-Check** (explizit geprüft, siehe Schritt-6-`untrack()`-Vorfall):
  `autoSpacing()` setzt Margins ausschließlich aus der Step-*Anzahl* pro
  Stage, nie aus gemessenen Werten — bei gleichbleibender Anzahl liefert es
  bei jedem Aufruf dieselben Margin-Werte, verändert also nicht erneut die
  Höhe von `#scroll-root` und triggert den Observer nicht ein zweites Mal.
  Verifiziert über einen Aufruf-Zähler während der Entwicklung: keine
  Endlosschleife.

  **Testgrenze:** `ResizeObserver`-Benachrichtigungen selbst konnten in der
  Browser-Automatisierungsumgebung dieser Session nicht beobachtet werden
  — `document.visibilityState` blieb dort durchgehend `"hidden"` (bestätigt
  über ein isoliertes, app-unabhängiges Test-Element: selbst ein nackter
  `requestAnimationFrame`-Aufruf feuerte nicht). Das ist ein bekanntes
  Chromium-Verhalten für nicht sichtbare Tabs, keine Eigenschaft des Codes.
  Verifiziert wurde stattdessen: die Registrierung des Observers am
  richtigen Element, keine Endlosschleife, und das korrekte Endergebnis
  (Step-Positionen nach Ankunft des Markdowns korrekt, Quad-Karte in
  Schritt 8 erscheint an der richtigen Stelle).

- **`#app`-Wrapper weggelassen** (Schritt 12) — im Original umschließt
  `<div id="app">` (`min-height: 100vh; position: relative;`) fast das
  gesamte Markup. Geprüft: nichts in der Portierung hängt von einem
  positionierten Vorfahren ab — `#map`, `#media-root`, `.overlay-model`,
  `#prediction-map` sind `position: fixed` und unabhängig von jedem
  Elternelement; `#intro` und `#scroll-root` setzen ihr eigenes
  `position: relative; z-index: 10`, nicht relativ zu `#app`. Der Wrapper
  ist damit ohne Funktion — nicht übernommen.

- **Toter `.legend`/`.legend-title`/`.legend-sub`/`.legend-bar`/
  `.legend-ndvi`/`.legend-ndwi`/`.legend-moran`/`.legend-geary`-Block aus
  style.css nicht übernommen** (Schritt 12) — geprüft: keine Stelle in
  `index.html` oder `main.js` referenziert diese Klassen. Ersetzt durch
  `.quad-label`/`.ql-*`, das mit den Eck-Legenden der 2×2-Rasterkarte
  bereits in Schritt 8 übernommen wurde.

## 6. Bekannte UX-Mängel des Originals (nicht behoben)

Verhalten, das 1:1 aus dem Original übernommen wurde, aber beim
empirischen Vergleich als möglicherweise unbeabsichtigt auffiel. Wird
hier nur dokumentiert, nicht automatisch korrigiert — Entscheidung
darüber steht noch aus.

- **Sprachumschalter scrollt aus dem Viewport** — `#lang-switch` sitzt
  `position: absolute` innerhalb von `.intro-block` (im Original per
  `mountLangSwitchIntoIntro()` dorthin verschoben, hier direkt als
  `<LangSwitch>` in `Intro.svelte` gerendert). Da `.intro-block` selbst
  normal im Dokumentfluss steht, scrollt der Umschalter mit dem
  Intro-Text weg, statt dauerhaft erreichbar zu bleiben. Empirisch auf
  `:3000` (Original) geprüft: bei `scrollY: 1000` steht `#lang-switch`
  bei `top: -831px`, also vollständig außerhalb des Viewports — das
  Original hat exakt dasselbe Verhalten, es ist keine Regression der
  Portierung. Ob das so bleiben oder der Umschalter z. B. `position:
  fixed` werden soll, ist eine separate Entscheidung.
