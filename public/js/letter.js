/* "Đôi Lời Gửi Trao" letter card.
   - Typing: the first time the text scrolls into view it is typed out character
     by character (spaces kept in place, so nothing reflows). Tap to finish.
   - Tilt: with a mouse, the card leans toward the pointer and a glass glare
     follows it. Touch and reduced-motion get neither. */

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

export function initLetter() {
  const card = document.querySelector(".letter-card");
  if (!card) return;
  initSign(card);
  if (reduceMotion.matches) return;
  initTyping(card);
  initTilt(card);
}

/* -------------------------------------------------------------- signature */

// "Mạnh Thắng & Kiều Oanh" on one line when it fits; otherwise three lines,
// so "&" never sits at the end of the groom's line.
function initSign(card) {
  const sign = card.querySelector(".letter-sign");
  const parts = sign?.children;
  if (!parts || parts.length < 3) return;

  let lastWidth = -1;
  const fit = (force) => {
    const width = sign.clientWidth;
    if (!force && width === lastWidth) return;
    lastWidth = width;
    sign.classList.remove("is-stacked");
    const top = parts[0].offsetTop;
    const wrapped = Array.from(parts).some((el) => el.offsetTop !== top);
    sign.classList.toggle("is-stacked", wrapped);
  };

  fit(true);
  if ("ResizeObserver" in window) new ResizeObserver(() => fit(false)).observe(sign);
  else addEventListener("resize", () => fit(false));
  // Great Vibes may arrive after the first measurement and change the width.
  document.fonts?.ready.then(() => fit(true));
}

/* ------------------------------------------------------------------ typing */

const BASE_MS = 22; // per character
const PAUSE_MS = { ",": 160, ":": 200, ".": 320, "!": 320, "?": 320 };
const PARAGRAPH_MS = 420;

function initTyping(card) {
  const body = card.querySelector("[data-type]");
  if (!body || !("IntersectionObserver" in window)) return;

  const seg =
    "Segmenter" in Intl ? new Intl.Segmenter("vi", { granularity: "grapheme" }) : null;
  const graphemes = (s) => (seg ? Array.from(seg.segment(s), (x) => x.segment) : Array.from(s));

  // Wrap every visible character in a span; record a delay before each one.
  const steps = [];
  for (const p of body.querySelectorAll("p")) {
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    let first = true;
    for (const node of nodes) {
      const text = node.nodeValue.replace(/\s+/g, " ");
      const frag = document.createDocumentFragment();
      for (const g of graphemes(text)) {
        if (g === " ") {
          frag.append(" ");
          continue;
        }
        const span = document.createElement("span");
        span.className = "ch";
        span.textContent = g;
        frag.append(span);
        const prev = steps.at(-1);
        const wait = first && steps.length ? PARAGRAPH_MS : prev ? PAUSE_MS[prev.char] ?? BASE_MS : 0;
        steps.push({ el: span, char: g, wait });
        first = false;
      }
      node.replaceWith(frag);
    }
  }
  if (!steps.length) return;

  body.classList.add("is-armed");
  card.classList.add("is-armed");

  let i = 0;
  let timer = 0;
  let caret = null;
  const setCaret = (el) => {
    caret?.classList.remove("caret");
    caret = el;
    caret?.classList.add("caret");
  };

  const finish = () => {
    clearTimeout(timer);
    for (; i < steps.length; i++) steps[i].el.classList.add("on");
    setCaret(null);
    card.classList.remove("is-armed");
    card.removeEventListener("click", finish);
  };

  const tick = () => {
    const step = steps[i];
    step.el.classList.add("on");
    setCaret(step.el);
    i++;
    if (i >= steps.length) {
      // Let the caret blink a moment, then sign the letter.
      timer = setTimeout(finish, 900);
      return;
    }
    timer = setTimeout(tick, steps[i].wait);
  };

  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      // Give the card's fade-up a head start.
      timer = setTimeout(tick, 650);
      card.addEventListener("click", finish);
    },
    { threshold: 0.35 },
  );
  io.observe(body);
}

/* -------------------------------------------------------------------- tilt */

const MAX_X = 5; // deg, around the horizontal axis (card is tall)
const MAX_Y = 8; // deg, around the vertical axis

function initTilt(card) {
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  let frame = 0;
  let px = 0.5;
  let py = 0.5;
  let rect = null;

  const apply = () => {
    frame = 0;
    card.style.setProperty("--rx", `${((0.5 - py) * 2 * MAX_X).toFixed(2)}deg`);
    card.style.setProperty("--ry", `${((px - 0.5) * 2 * MAX_Y).toFixed(2)}deg`);
    card.style.setProperty("--gx", `${(px * rect.width).toFixed(1)}px`);
    card.style.setProperty("--gy", `${(py * rect.height).toFixed(1)}px`);
  };

  // Measure the untransformed wrapper, so the tilt doesn't feed back into itself.
  const box = card.parentElement;

  card.addEventListener("pointerenter", (e) => {
    if (e.pointerType !== "mouse" || !finePointer.matches) return;
    card.classList.add("is-tilting");
  });

  card.addEventListener("pointermove", (e) => {
    if (!card.classList.contains("is-tilting")) return;
    rect = box.getBoundingClientRect();
    px = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    py = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    if (!frame) frame = requestAnimationFrame(apply);
  });

  card.addEventListener("pointerleave", () => {
    if (!card.classList.contains("is-tilting")) return;
    cancelAnimationFrame(frame);
    frame = 0;
    card.classList.remove("is-tilting");
    card.style.setProperty("--rx", "0deg");
    card.style.setProperty("--ry", "0deg");
  });
}
