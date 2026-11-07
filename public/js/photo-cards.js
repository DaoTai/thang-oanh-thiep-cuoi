// Photo-card carousel: three stacked cards, the active one in front and its
// neighbours peeking from behind. Swipe (with drag-follow), tap a side card,
// the arrows or the dots to change. Loops in both directions.

export function initPhotoCards() {
  const stage = document.getElementById("pc-stage");
  if (!stage) return;
  const section = stage.closest("section");
  const cards = [...stage.querySelectorAll(".photo-card")];
  const dots = [...section.querySelectorAll("[data-pc-dot]")];
  const n = cards.length;
  let current = 0;

  function show(i) {
    current = (i + n) % n;
    cards.forEach((card, k) => {
      // Offset in -1..1 around the active card (wraps for the loop).
      let pos = (k - current + n) % n;
      if (pos > n / 2) pos -= n;
      card.dataset.pos = String(pos);
      card.style.zIndex = pos === 0 ? 3 : 2 - Math.abs(pos);
      card.toggleAttribute("aria-hidden", pos !== 0);
    });
    dots.forEach((d, k) => d.setAttribute("aria-current", String(k === current)));
  }

  section.querySelector('[data-pc="prev"]').addEventListener("click", () => show(current - 1));
  section.querySelector('[data-pc="next"]').addEventListener("click", () => show(current + 1));
  dots.forEach((d, k) => d.addEventListener("click", () => show(k)));

  /* Swipe with drag-follow on the front card; a tap on a side card brings it forward. */
  let startX = 0;
  let startY = 0;
  let dx = 0;
  let dragging = false;
  let pointer = null;

  stage.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    pointer = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    dx = 0;
    dragging = false;
  });

  stage.addEventListener("pointermove", (e) => {
    if (e.pointerId !== pointer) return;
    const mx = e.clientX - startX;
    const my = e.clientY - startY;
    if (!dragging) {
      if (Math.abs(mx) < 8 || Math.abs(mx) < Math.abs(my)) return;
      dragging = true;
      stage.classList.add("is-dragging");
      stage.setPointerCapture(pointer);
    }
    dx = mx;
    stage.style.setProperty("--dx", `${dx}px`);
  });

  function end(e) {
    if (e.pointerId !== pointer) return;
    pointer = null;
    stage.classList.remove("is-dragging");
    stage.style.removeProperty("--dx");
    if (dragging) {
      if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
      return;
    }
    const card = e.target.closest?.(".photo-card");
    if (card && card.dataset.pos !== "0") show(current + Number(card.dataset.pos));
  }

  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", (e) => {
    dragging = false;
    end(e);
  });

  show(0);
}
