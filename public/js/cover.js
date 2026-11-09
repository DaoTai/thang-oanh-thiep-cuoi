// Guest cover for personal links (?to=…, see the inline script in index.html).
// Tapping the wax seal: the seal sinks and fades, a gold flash, the flap swings
// open in 3D, light and petals spill out, then the cover dissolves into the page.
// Timings live in css/styles.css ("guest cover"); OPEN_MS is when the page
// underneath starts its own entrance, DONE_MS when the cover is removed.

const OPEN_MS = 1750;
const DONE_MS = 2900;
const PETALS = 18;

export function initCover() {
  const name = window.GUEST;

  // The greeting section is filled whether or not the cover is still shown.
  const greet = document.getElementById("kinh-moi");
  if (name && greet) {
    for (const el of greet.querySelectorAll("[data-guest]")) el.textContent = name;
    greet.hidden = false;
  }

  const cover = document.getElementById("cover");
  if (!cover) return;

  const root = document.documentElement;
  const seal = document.getElementById("cv-seal");
  const env = document.getElementById("cv-env");
  const behind = ["main", "nav", "dock", "music-btn"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

  behind.forEach((el) => (el.inert = true));
  seal.focus({ preventScroll: true });

  let opened = false;
  const open = () => {
    if (opened) return;
    opened = true;
    cover.classList.add("is-opening");
    if (!still) setTimeout(() => spillPetals(env), 650);

    setTimeout(() => {
      behind.forEach((el) => (el.inert = false));
      root.classList.remove("has-cover"); // hero entrance starts under the fading cover
      cover.classList.add("is-leaving");
    }, still ? 0 : OPEN_MS);

    setTimeout(() => cover.remove(), still ? 400 : DONE_MS);
  };

  // The seal is the button; tapping anywhere on the envelope or the hint works too.
  cover.addEventListener("click", (e) => {
    if (e.target.closest(".cv-env, .cover-hint")) open();
  });
  cover.addEventListener("keydown", (e) => {
    if (e.key === "Escape") open();
  });
}

function spillPetals(env) {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < PETALS; i++) {
    const p = document.createElement("i");
    p.className = "petal";
    // Fan upward out of the opening, some drifting wide.
    const ang = (-90 + (Math.random() * 2 - 1) * 70) * (Math.PI / 180);
    const dist = 140 + Math.random() * 220;
    p.style.setProperty("--x", `${Math.cos(ang) * dist}px`);
    p.style.setProperty("--y", `${Math.sin(ang) * dist}px`);
    p.style.setProperty("--r", `${(Math.random() * 2 - 1) * 320}deg`);
    p.style.setProperty("--s", (0.6 + Math.random() * 0.8).toFixed(2));
    p.style.setProperty("--t", `${1100 + Math.random() * 700}ms`);
    p.style.setProperty("--d", `${Math.random() * 260}ms`);
    if (i % 3 === 0) p.classList.add("petal--light");
    p.addEventListener("animationend", () => p.remove(), { once: true });
    frag.append(p);
  }
  env.append(frag);
}
