// Small shared UI helpers: dialogs with enter/exit animation, toast.

export const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function openDialog(dialog) {
  if (dialog.open) return;
  dialog.classList.remove("is-closing");
  dialog.showModal();
}

export function closeDialog(dialog) {
  if (!dialog.open || dialog.classList.contains("is-closing")) return;
  const body = dialog.querySelector(".modal-body");
  if (reduceMotion() || !body) return dialog.close();
  dialog.classList.add("is-closing");
  body.addEventListener(
    "animationend",
    () => {
      dialog.classList.remove("is-closing");
      dialog.close();
    },
    { once: true },
  );
}

// Close on [data-close], backdrop click and Esc (animated) for every dialog.
export function wireDialogs() {
  for (const dialog of document.querySelectorAll("dialog")) {
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      closeDialog(dialog);
    });
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog || e.target.closest("[data-close]")) closeDialog(dialog);
    });
    if (!dialog.classList.contains("modal--full")) swipeToClose(dialog);
  }
}

// Phones: bottom sheets follow a downward drag that starts while the sheet is
// scrolled to the top, and close past a threshold (or on a quick flick).
const sheetMode = matchMedia("(max-width: 600px)");
function swipeToClose(dialog) {
  const body = dialog.querySelector(".modal-body");
  if (!body) return;
  let y0 = 0, x0 = 0, t0 = 0, dy = 0, state = "idle"; // idle | maybe | drag

  body.addEventListener(
    "touchstart",
    (e) => {
      if (!sheetMode.matches || e.touches.length > 1 || body.scrollTop > 0) return;
      ({ clientY: y0, clientX: x0 } = e.touches[0]);
      t0 = e.timeStamp;
      dy = 0;
      state = "maybe";
    },
    { passive: true },
  );

  body.addEventListener(
    "touchmove",
    (e) => {
      if (state === "idle") return;
      const t = e.touches[0];
      dy = t.clientY - y0;
      if (state === "maybe") {
        if (Math.abs(dy) < 8 && Math.abs(t.clientX - x0) < 8) return;
        // Only a mostly-vertical downward drag becomes a sheet drag.
        if (dy <= 0 || Math.abs(t.clientX - x0) > dy) return void (state = "idle");
        state = "drag";
        body.style.transition = "none";
      }
      e.preventDefault();
      body.style.transform = `translateY(${Math.max(0, dy)}px)`;
    },
    { passive: false },
  );

  const end = (e) => {
    if (state !== "drag") return void (state = "idle");
    state = "idle";
    const fast = dy / Math.max(1, e.timeStamp - t0) > 0.6;
    body.style.transition = "transform 0.3s var(--ease)";
    if (dy > Math.min(140, body.offsetHeight * 0.3) || (fast && dy > 40)) {
      body.style.transform = "translateY(100%)";
      body.addEventListener(
        "transitionend",
        () => {
          dialog.close();
          body.style.transition = body.style.transform = "";
        },
        { once: true },
      );
    } else {
      body.style.transform = "";
      body.addEventListener("transitionend", () => (body.style.transition = ""), { once: true });
    }
  };
  body.addEventListener("touchend", end);
  body.addEventListener("touchcancel", end);
}

let toastTimer;
export function toast(message) {
  const el = document.getElementById("toast");
  // An open modal dialog sits in the top layer, above any z-index: show the toast inside it.
  const host = document.querySelector("dialog[open]") ?? document.body;
  if (el.parentElement !== host) host.append(el);
  el.textContent = message;
  el.classList.add("is-on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("is-on"), 2600);
}
