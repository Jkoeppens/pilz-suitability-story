// scrolly.js

// 1) DOM-Referenzen
const steps = document.querySelectorAll(".step");

const layers = {
  bg: document.getElementById("layer-bg"),
  pilz: document.getElementById("layer-pilz"),
  parasole: document.getElementById("layer-parasole"),
  grunParasol: document.getElementById("layer-grunewald-parasol"),
  grunMeise: document.getElementById("layer-grunewald-meise"),
  vierer: document.getElementById("layer-vierer"),
  satBerlin: document.getElementById("layer-sat-berlin"),
};

// -----------------------------------------------------
// 2) Helper: alle Layer ausblenden
// -----------------------------------------------------
function hideAllLayers() {
  Object.values(layers).forEach((el) => {
    if (!el) return;
    el.classList.add("hidden");
  });
}

// -----------------------------------------------------
// 3) Szenen-Logik (Stage bleibt wie gehabt)
// -----------------------------------------------------
function showScene(scene) {
  hideAllLayers();

  // NEU: Suitability-Mode für die Karte
  // 👉 Falls deine Suitability-Karte in einer anderen Scene ist,
  //    einfach die "4" unten anpassen.
  if (scene === "4") {
    document.body.classList.add("mode-suit");
  } else {
    document.body.classList.remove("mode-suit");
  }

  switch (scene) {
    case "1":
      // Slide 1 – Wald + Pilz
      if (layers.bg) {
        layers.bg.src = "img/Wald.png";
        layers.bg.classList.remove("hidden");
      }
      if (layers.pilz) layers.pilz.classList.remove("hidden");
      break;

    case "2":
      // Slide 2 – Sat Berlin + Parasolfunde
      if (layers.bg) {
        layers.bg.src = "img/Sat_Berlin.png";
        layers.bg.classList.remove("hidden");
      }
      if (layers.parasole) layers.parasole.classList.remove("hidden");
      break;

    case "3":
      // Slide 3 – Grunewald + Pilz + Meise
      if (layers.bg) {
        layers.bg.src = "img/Grunewald.png";
        layers.bg.classList.remove("hidden");
      }
      if (layers.grunParasol) layers.grunParasol.classList.remove("hidden");
      if (layers.grunMeise) layers.grunMeise.classList.remove("hidden");
      break;

    case "4":
      // Slide 4 – Viererkarte / Suitability (deine letzte Karte)
      if (layers.bg) {
        layers.bg.src = "img/Sat_Berlin.png";
        layers.bg.classList.remove("hidden");
      }
      if (layers.vierer) layers.vierer.classList.remove("hidden");
      break;
  }
}

// -----------------------------------------------------
// 4) Spacing-Logik: Klassen je nach Stage-Zugehörigkeit
// -----------------------------------------------------
function assignSpacingClasses() {
  if (!steps.length) return;

  steps.forEach((step) => {
    step.classList.remove("spacing-first", "spacing-same", "spacing-change");
  });

  steps.forEach((step, index) => {
    const currentStage = step.dataset.stage;

    if (index === 0) {
      // allererster Textblock
      step.classList.add("spacing-first");
      return;
    }

    const prevStep = steps[index - 1];
    const prevStage = prevStep.dataset.stage;

    if (!prevStage || !currentStage || prevStage !== currentStage) {
      // Wechsel der Bühne
      step.classList.add("spacing-change");
    } else {
      // gleiche Bühne
      step.classList.add("spacing-same");
    }
  });
}

// Direkt nach Laden einmal ausführen
assignSpacingClasses();

// -----------------------------------------------------
// 5) Scroll-Observer
// -----------------------------------------------------
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const scene = entry.target.dataset.scene;
        if (scene) {
          showScene(scene);
        }
      }
    });
  },
  {
    root: null,
    threshold: 0.55, // Step gilt als „aktiv“, wenn ~55% im Viewport
  }
);

// 6) Steps überwachen
steps.forEach((step) => observer.observe(step));

// 7) Initiale Szene (falls Seite mittendrin geladen wird)
if (steps[0]) {
  const firstScene = steps[0].dataset.scene;
  if (firstScene) {
    showScene(firstScene);
  }
}