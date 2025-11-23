// Alle Elemente, die eingeblendet werden sollen
const fadeIns = document.querySelectorAll(".fadein-on-scroll");
const fadeOuts = document.querySelectorAll(".fadeout-on-scroll");

function onScroll() {
    const trigger = window.innerHeight * 0.75;

    fadeIns.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top < trigger) {
            el.classList.add("visible");
        }
    });

    fadeOuts.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.bottom < trigger / 2) {
            el.classList.add("scrolled-out");
        }
    });
}

window.addEventListener("scroll", onScroll);
onScroll(); // Initial run