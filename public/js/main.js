import { PHOTOS } from "./photos.js";
import { wireDialogs, openDialog, toast } from "./ui.js";
import { renderMonth, startCountdown, initRsvp } from "./calendar.js";
import { initGallery } from "./gallery.js";
import { initGuestbook } from "./guestbook.js";
import { initNav } from "./nav.js";
import { initSnow } from "./snow.js";

/* Blur-up placeholders behind every photo until the real file paints. */
const lqip = new Map(PHOTOS.map((p) => [p.id, p.lqip]));
for (const img of document.querySelectorAll("img[data-photo]")) {
  const ph = lqip.get(img.dataset.photo);
  if (ph && !img.complete) img.style.backgroundImage = `url(${ph})`;
}

/* Scroll reveal (fade-up), once per element. */
const revealer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-in");
      revealer.unobserve(entry.target);
    }
  },
  { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
);
document.querySelectorAll("[data-reveal]").forEach((el) => revealer.observe(el));

/* Sections */
wireDialogs();
initNav();
renderMonth();
startCountdown();
const selectEvent = initRsvp();
const gallery = initGallery();
const guestbook = initGuestbook();

/* Snow starts after load so it never competes with the hero photo (LCP). */
if (document.readyState === "complete") initSnow();
else addEventListener("load", initSnow, { once: true });

/* Gift dialog reuses the gift cards from the page (one copy of the account data). */
const giftDialog = document.getElementById("gift-dialog");
const giftSlot = document.getElementById("gift-dialog-slot");
function openGift() {
  if (!giftSlot.firstChild) {
    const clone = document.getElementById("gift-grid").cloneNode(true);
    clone.removeAttribute("id");
    clone.querySelectorAll("img").forEach((img) => img.removeAttribute("loading"));
    giftSlot.append(clone);
  }
  openDialog(giftDialog);
}

/* Floating dock: a speed-dial on phones, a plain column on desktop. */
const dock = document.getElementById("dock");
const dockToggle = document.getElementById("dock-toggle");
const setDock = (open) => {
  dock.toggleAttribute("data-open", open);
  dockToggle.setAttribute("aria-expanded", String(open));
  dockToggle.setAttribute("aria-label", open ? "Đóng tiện ích" : "Mở tiện ích");
};
dockToggle.addEventListener("click", () => setDock(!dock.hasAttribute("data-open")));
document.addEventListener("click", (e) => {
  if (dock.hasAttribute("data-open") && !dock.contains(e.target)) setDock(false);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && dock.hasAttribute("data-open")) {
    setDock(false);
    dockToggle.focus();
  }
});

/* Every [data-action] button on the page (hero, dock, event cards). */
const actions = {
  wish: () => guestbook.focus(),
  rsvp: (btn) => {
    selectEvent(btn.dataset.event);
    openDialog(document.getElementById("rsvp-dialog"));
  },
  gift: openGift,
  gallery: () => gallery.open(),
};
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  setDock(false);
  actions[btn.dataset.action]?.(btn);
});

/* Copy account number. */
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-copy]");
  if (!btn) return;
  const text = btn.dataset.copy;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = Object.assign(document.createElement("textarea"), { value: text });
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.append(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  toast(`Đã sao chép số tài khoản ${text}`);
});

/* Background music.
   Browsers block autoplay, so music starts on the guest's first tap anywhere,
   unless they used the music button themselves. Pauses while the tab is hidden. */
const audio = document.getElementById("bg-music");
const musicBtn = document.getElementById("music-btn");
let wantMusic = true;
let userChose = false;

const syncMusic = () => {
  const on = !audio.paused;
  musicBtn.setAttribute("aria-pressed", String(on));
  musicBtn.setAttribute("aria-label", on ? "Tắt nhạc nền" : "Bật nhạc nền");
};
audio.addEventListener("play", syncMusic);
audio.addEventListener("pause", syncMusic);
audio.volume = 0.6;

const play = () => audio.play().catch(() => {});
musicBtn.addEventListener("click", () => {
  userChose = true;
  wantMusic = audio.paused;
  wantMusic ? play() : audio.pause();
});

// Only click / touchend / keydown count as user activation on mobile browsers.
// Keep listening until playback actually starts (a scroll-touch is not a gesture).
const GESTURES = ["click", "touchend", "keydown"];
const stopListening = () => GESTURES.forEach((t) => removeEventListener(t, firstGesture, true));
function firstGesture(e) {
  if (userChose) return stopListening();
  if (e.target.closest?.("#music-btn") || !wantMusic) return;
  audio.play().then(stopListening, () => {});
}
GESTURES.forEach((t) => addEventListener(t, firstGesture, true));

document.addEventListener("visibilitychange", () => {
  if (document.hidden) audio.pause();
  else if (wantMusic && audio.currentTime > 0) play();
});
