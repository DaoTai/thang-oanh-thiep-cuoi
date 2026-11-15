/* Hearts and musical notes while the music plays. Two emitters:
   - the music button: a burst when music starts, then a trickle rising from it;
   - wide screens: a steady flow drifting up the two side gutters beside the
     sheet, never over the content column.
   Each particle is a small shaded SVG (gradient body + highlight + soft shadow)
   animated with the Web Animations API, transform and opacity only. Skipped
   entirely under prefers-reduced-motion and paused while the tab is hidden. */

const NS = "http://www.w3.org/2000/svg";

// Gradients live once in the document; every particle references them by id.
const DEFS = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="fx-heart-rose" cx="35%" cy="30%" r="75%">
      <stop offset="0" stop-color="#f6b8c8"/>
      <stop offset=".45" stop-color="#d9708f"/>
      <stop offset="1" stop-color="#9b3f5c"/>
    </radialGradient>
    <radialGradient id="fx-heart-blush" cx="35%" cy="30%" r="75%">
      <stop offset="0" stop-color="#fff1f4"/>
      <stop offset=".5" stop-color="#f3b3c3"/>
      <stop offset="1" stop-color="#c97690"/>
    </radialGradient>
    <radialGradient id="fx-heart-deep" cx="35%" cy="30%" r="75%">
      <stop offset="0" stop-color="#e98aa3"/>
      <stop offset=".5" stop-color="#b8486a"/>
      <stop offset="1" stop-color="#6f2238"/>
    </radialGradient>
    <linearGradient id="fx-note-rose" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#c9667f"/>
      <stop offset="1" stop-color="#7f2f48"/>
    </linearGradient>
    <linearGradient id="fx-note-gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ecd3a8"/>
      <stop offset=".5" stop-color="#c4a27f"/>
      <stop offset="1" stop-color="#8f6d4a"/>
    </linearGradient>
  </defs>
</svg>`;

const HEART = (fill) => `
  <path fill="url(#${fill})" d="M12 21.2c-.3 0-.6-.1-.8-.3C6.4 16.9 2.6 13.6 2.6 9.3 2.6 6.4 4.8 4.2 7.6 4.2c1.7 0 3.3.8 4.4 2.2 1.1-1.4 2.7-2.2 4.4-2.2 2.8 0 5 2.2 5 5.1 0 4.3-3.8 7.6-8.6 11.6-.2.2-.5.3-.8.3Z"/>
  <ellipse cx="7.6" cy="8.4" rx="2.1" ry="1.3" fill="#fff" opacity=".55" transform="rotate(-35 7.6 8.4)"/>
  <circle cx="9.6" cy="6.9" r=".55" fill="#fff" opacity=".8"/>`;

const NOTE = (fill) => `
  <path fill="url(#${fill})" d="M10.2 3.2 18.6 1.4c.5-.1 1 .3 1 .8v2.6c0 .4-.3.7-.6.8l-7.4 1.6v10.6c0 2-1.9 3.6-4.2 3.6S3.2 19.8 3.2 18s1.9-3.4 4.2-3.4c.8 0 1.5.2 2 .5V4c0-.4.3-.7.8-.8Z"/>
  <ellipse cx="6.2" cy="17.2" rx="1.3" ry=".7" fill="#fff" opacity=".45" transform="rotate(-25 6.2 17.2)"/>`;

const NOTES = (fill) => `
  <path fill="url(#${fill})" d="M8.4 3.6 19.6 1.2c.6-.1 1.1.3 1.1.9v13.6c0 1.8-1.7 3.2-3.8 3.2s-3.7-1.3-3.7-3 1.7-3 3.7-3c.6 0 1.2.1 1.7.3V6.4l-8.2 1.8v10c0 1.8-1.7 3.2-3.8 3.2S2.9 20.1 2.9 18.4s1.7-3 3.7-3c.6 0 1.2.1 1.7.3V4.5c0-.4.3-.8.8-.9Z"/>
  <ellipse cx="5.2" cy="17.9" rx="1.2" ry=".6" fill="#fff" opacity=".45" transform="rotate(-25 5.2 17.9)"/>
  <ellipse cx="15.6" cy="15.1" rx="1.2" ry=".6" fill="#fff" opacity=".45" transform="rotate(-25 15.6 15.1)"/>`;

// Weighted pool: roughly three hearts for every note.
const KINDS = [
  () => HEART("fx-heart-rose"),
  () => HEART("fx-heart-rose"),
  () => HEART("fx-heart-rose"),
  () => HEART("fx-heart-blush"),
  () => HEART("fx-heart-blush"),
  () => HEART("fx-heart-deep"),
  () => HEART("fx-heart-deep"),
  () => HEART("fx-heart-blush"),
  () => HEART("fx-heart-rose"),
  () => NOTE("fx-note-rose"),
  () => NOTE("fx-note-gold"),
  () => NOTES("fx-note-gold"),
];

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[(Math.random() * list.length) | 0];
const sign = () => (Math.random() < 0.5 ? -1 : 1);

/* One shaded particle in `layer`. `near` (0..1) is depth: far ones are smaller,
   dimmer, softly blurred and slower. Removed when its animation ends. */
function particle(layer, size, near, frames, timing, onEnd) {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.innerHTML = pick(KINDS)();
  svg.style.width = svg.style.height = `${size}px`;
  svg.style.margin = `${-size / 2}px 0 0 ${-size / 2}px`;
  if (near < 0.25) svg.style.filter = "blur(0.7px) drop-shadow(0 1px 2px rgb(120 50 70 / 0.2))";
  layer.append(svg);
  const anim = svg.animate(frames, { fill: "backwards", ...timing });
  anim.onfinish = anim.oncancel = () => {
    svg.remove();
    onEnd();
  };
}

export function initMusicFx(button, audio) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  document.body.insertAdjacentHTML("beforeend", DEFS);

  const btnLayer = document.createElement("span");
  btnLayer.className = "music-fx";
  btnLayer.setAttribute("aria-hidden", "true");
  button.append(btnLayer);

  const sideLayer = document.createElement("div");
  sideLayer.className = "music-fx-sides";
  sideLayer.setAttribute("aria-hidden", "true");
  document.body.append(sideLayer);

  const sheet = document.querySelector(".sheet");
  const wide = matchMedia("(min-width: 768px)");

  /* ---------- button emitter */
  let btnLive = 0;
  function fromButton(delay = 0) {
    if (btnLive > 22) return;
    btnLive++;
    const size = rand(12, 24);
    const near = (size - 12) / 12;
    // Start around the rim, mostly from the top half, then rise and sway.
    const a = rand(-150, -30) * (Math.PI / 180);
    const at = `translate(${Math.cos(a) * 18}px, ${Math.sin(a) * 18}px)`;
    const rise = rand(80, 150);
    const drift = rand(-14, 34); // button sits on the left edge: lean right
    const sway = rand(8, 16) * sign();
    const spin = rand(-28, 28);
    const peak = 0.55 + near * 0.45;
    const s = 0.75 + near * 0.35;
    particle(
      btnLayer,
      size,
      near,
      [
        { transform: `${at} translate(0, 0) scale(0.2) rotate(0deg)`, opacity: 0 },
        { transform: `${at} translate(${sway * 0.4}px, ${-rise * 0.12}px) scale(${s * 1.12}) rotate(${spin * 0.2}deg)`, opacity: peak, offset: 0.12 },
        { transform: `${at} translate(${drift * 0.35 - sway}px, ${-rise * 0.42}px) scale(${s}) rotate(${-spin * 0.4}deg)`, opacity: peak, offset: 0.42 },
        { transform: `${at} translate(${drift * 0.7 + sway}px, ${-rise * 0.72}px) scale(${s * 0.95}) rotate(${spin * 0.7}deg)`, opacity: peak * 0.7, offset: 0.72 },
        { transform: `${at} translate(${drift}px, ${-rise}px) scale(${s * 0.8}) rotate(${spin}deg)`, opacity: 0 },
      ],
      { duration: rand(2400, 3400) + (1 - near) * 900, delay, easing: "cubic-bezier(.25,.6,.4,1)" },
      () => btnLive--,
    );
  }

  /* ---------- side gutters (wide screens) */
  let sideLive = 0;
  // Free width on each side of the sheet, minus a margin so nothing grazes it.
  const gutter = () => {
    const r = sheet?.getBoundingClientRect();
    return r ? { left: r.left - 24, right: innerWidth - r.right - 24, sheetRight: r.right } : null;
  };
  const sidesOn = () => {
    const g = wide.matches && gutter();
    return g && Math.min(g.left, g.right) >= 60 ? g : null;
  };

  function fromSide(g, startY) {
    if (sideLive > 70) return;
    sideLive++;
    const left = Math.random() < 0.5;
    const width = left ? g.left : g.right;
    const size = rand(14, 36);
    const near = (size - 14) / 22;
    const sway = Math.min(rand(16, 46), width * 0.22);
    // Keep the whole sway inside the gutter.
    const x0 = rand(12 + sway + size / 2, width - sway - size / 2);
    const x = left ? x0 : g.sheetRight + 24 + x0;
    const y = startY ?? innerHeight + 40;
    const travel = y + 80;
    const spin = rand(-30, 30);
    const peak = 0.4 + near * 0.55;
    const s = 0.85 + near * 0.25;
    const dir = sign();
    const at = `translate(${x}px, ${y}px)`;
    const step = (k, sx) =>
      `${at} translate(${dir * sway * sx}px, ${-travel * k}px) scale(${s}) rotate(${spin * sx}deg)`;
    particle(
      sideLayer,
      size,
      near,
      [
        { transform: `${at} scale(${s * 0.4})`, opacity: 0 },
        { transform: step(0.08, 0.5), opacity: peak, offset: 0.08 },
        { transform: step(0.3, -1), opacity: peak, offset: 0.3 },
        { transform: step(0.55, 1), opacity: peak, offset: 0.55 },
        { transform: step(0.8, -0.8), opacity: peak * 0.8, offset: 0.8 },
        { transform: step(1, 0.4), opacity: 0 },
      ],
      { duration: (travel / innerHeight) * (rand(9000, 13000) + (1 - near) * 4000), easing: "linear" },
      () => sideLive--,
    );
  }

  /* ---------- scheduling */
  let btnTimer = 0;
  let sideTimer = 0;

  function btnLoop() {
    fromButton();
    btnTimer = setTimeout(btnLoop, rand(300, 600));
  }

  function sideLoop() {
    const g = sidesOn();
    if (g) fromSide(g);
    // Roughly constant density: wider gutters get more particles.
    const area = g ? (g.left + g.right) * innerHeight : 0;
    sideTimer = setTimeout(sideLoop, area ? Math.max(90, 9e7 / area) : 1000);
  }

  function start() {
    if (btnTimer || document.hidden) return;
    for (let i = 0; i < 8; i++) fromButton(i * 70);
    btnTimer = setTimeout(btnLoop, 600);
    // Seed the gutters across the full height so they are not empty at first.
    const g = sidesOn();
    if (g) for (let i = 0; i < 18; i++) fromSide(g, rand(innerHeight * 0.2, innerHeight + 40));
    sideTimer = setTimeout(sideLoop, 200);
  }

  function stop() {
    clearTimeout(btnTimer);
    clearTimeout(sideTimer);
    btnTimer = sideTimer = 0;
  }

  audio.addEventListener("play", start);
  audio.addEventListener("pause", stop);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (!audio.paused) start();
  });
}
