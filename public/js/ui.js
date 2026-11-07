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
  }
}

let toastTimer;
export function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("is-on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("is-on"), 2600);
}
