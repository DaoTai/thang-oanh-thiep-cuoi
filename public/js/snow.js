/* Full-screen falling snow on one fixed <canvas> (pointer-events: none).
   - Flakes have depth: bigger ones fall faster, sway wider and drift more with
     the wind, which itself changes slowly (sum of two slow sines).
   - Every flake fades in when spawned and fades out near the bottom, and the
     whole layer fades in through CSS, so nothing ever pops.
   - The paper is near-white, so each flake carries a faint rose halo to stay
     visible on it; over photos it reads as plain white.
   - Skipped entirely under prefers-reduced-motion. Stops while the tab is hidden. */

const SPRITE = 64; // px, pre-rendered once and scaled with drawImage
const CORE = 0.3; // circle radius as a fraction of the sprite size
const MAX_DPR = 2;

function makeSprite() {
  const c = document.createElement("canvas");
  c.width = c.height = SPRITE;
  const g = c.getContext("2d");
  const mid = SPRITE / 2;
  const r = SPRITE * CORE;
  // Soft rose glow behind the flake (what makes it read on white paper)...
  const glow = g.createRadialGradient(mid, mid, r * 0.6, mid, mid, mid);
  glow.addColorStop(0, "rgba(160,80,105,0.3)");
  glow.addColorStop(0.45, "rgba(160,80,105,0.1)");
  glow.addColorStop(1, "rgba(160,80,105,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, SPRITE, SPRITE);
  // ...then the white flake with a feathered edge, no outline.
  const core = g.createRadialGradient(mid, mid, 0, mid, mid, r);
  core.addColorStop(0, "rgba(255,255,255,1)");
  core.addColorStop(0.6, "rgba(255,255,255,0.95)");
  core.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = core;
  g.beginPath();
  g.arc(mid, mid, r, 0, Math.PI * 2);
  g.fill();
  return c;
}

const rand = (a, b) => a + Math.random() * (b - a);

export function initSnow() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  canvas.className = "snow";
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);

  const ctx = canvas.getContext("2d");
  const sprite = makeSprite();
  const flakes = [];
  let W = 0;
  let H = 0;
  let raf = 0;
  let last = 0;
  let time = 0;

  function spawn(f, anywhere) {
    // Mostly small flakes, a few big ones in front.
    f.r = 1.2 + Math.pow(Math.random(), 1.8) * 3.3;
    f.depth = (f.r - 1.2) / 3.3; // 0 far .. 1 near
    f.x = rand(-20, W + 20);
    f.y = anywhere ? rand(-H * 0.1, H) : rand(-40, -f.r * 4);
    f.vy = 22 + f.depth * 48 + rand(-4, 4); // px/s
    f.amp = 6 + f.depth * 22 + rand(0, 6);
    f.freq = rand(0.35, 0.9);
    f.phase = rand(0, Math.PI * 2);
    f.alpha = 0.65 + f.depth * 0.35;
    f.age = anywhere ? rand(0, 1.5) : 0;
    return f;
  }

  function targetCount() {
    // ~50 on a phone, up to ~140 on a large desktop.
    return Math.round(Math.min(140, Math.max(40, (W * H) / 6500)));
  }

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, MAX_DPR);
    W = innerWidth;
    H = innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = targetCount();
    while (flakes.length < n) flakes.push(spawn({}, true));
    flakes.length = n;
  }

  function frame(now) {
    // Clamp dt so a stalled frame never teleports the flakes.
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;

    const wind = (Math.sin(time * 0.07) * 0.6 + Math.sin(time * 0.023 + 1.3) * 0.4) * 16;
    const fadeBand = H * 0.16;

    ctx.clearRect(0, 0, W, H);
    for (const f of flakes) {
      f.age += dt;
      f.y += f.vy * dt;
      f.x += wind * (0.35 + f.depth) * dt;

      if (f.y - f.r * 4 > H) {
        spawn(f, false);
        continue;
      }
      if (f.x < -40) f.x += W + 80;
      else if (f.x > W + 40) f.x -= W + 80;

      const fadeIn = Math.min(1, f.age / 1.4);
      const fadeOut = Math.min(1, Math.max(0, (H - f.y) / fadeBand));
      const a = f.alpha * fadeIn * fadeOut;
      if (a <= 0.01) continue;

      const size = f.r / CORE;
      const sx = f.x + Math.sin(time * f.freq + f.phase) * f.amp;
      ctx.globalAlpha = a;
      ctx.drawImage(sprite, sx - size / 2, f.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  let resizeTimer = 0;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));

  resize();
  if (!document.hidden) start();
  // Next frame, so the opacity transition has a starting point.
  requestAnimationFrame(() => canvas.classList.add("is-on"));
}
