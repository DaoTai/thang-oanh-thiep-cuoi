import { PHOTOS } from "./photos.js";
import { wireDialogs, openDialog, toast } from "./ui.js";
import { renderMonth, startCountdown, initRsvp } from "./calendar.js";
import { initGallery } from "./gallery.js";
import { initGuestbook } from "./guestbook.js";
import { initNav } from "./nav.js";
import { initSnow } from "./snow.js";
import { initPhotoCards } from "./photo-cards.js";
import { initLetter } from "./letter.js";
import { initGift, copyText } from "./gift.js";

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

/* Couple heart: loops only while on screen. It bursts small hearts outward on tap,
   and on its own every 4s while visible (the timer restarts after a tap). */
const heart = document.querySelector(".couple-heart");
if (heart) {
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const sprite = heart.querySelector("use").getAttribute("href");
  let timer = 0;

  const burst = () => {
    heart.classList.remove("is-pop");
    void heart.offsetWidth; // restart the pop animation
    heart.classList.add("is-pop");
    const n = 10;
    for (let i = 0; i < n; i++) {
      const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      s.setAttribute("class", "ico heart-burst");
      s.innerHTML = `<use href="${sprite}"/>`;
      s.style.setProperty("--a", `${(360 / n) * i + Math.random() * 20 - 10}deg`);
      s.style.setProperty("--r", `${34 + Math.random() * 24}px`);
      s.style.fontSize = `${7 + Math.random() * 6}px`;
      s.addEventListener("animationend", () => s.remove(), { once: true });
      heart.append(s);
    }
  };

  const schedule = (on) => {
    clearInterval(timer);
    timer = on && !still.matches ? setInterval(burst, 4000) : 0;
  };

  new IntersectionObserver(([e]) => {
    heart.classList.toggle("is-live", e.isIntersecting);
    schedule(e.isIntersecting);
  }).observe(heart);

  heart.addEventListener("click", () => {
    if (still.matches) return;
    burst();
    schedule(heart.classList.contains("is-live"));
  });
}

/* Sections */
wireDialogs();
initNav();
renderMonth();
startCountdown();
initPhotoCards();
initLetter();
const selectEvent = initRsvp();
const gallery = initGallery();
const guestbook = initGuestbook();
const gift = initGift();

/* Snow starts after load so it never competes with the hero photo (LCP). */
if (document.readyState === "complete") initSnow();
else addEventListener("load", initSnow, { once: true });

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
  gift: (btn) => gift.open(btn),
  gallery: () => gallery.open(),
};
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  setDock(false);
  actions[btn.dataset.action]?.(btn);
});

/* Copy buttons outside the gift sheet (the sheet handles its own). */
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-copy]");
  if (!btn) return;
  await copyText(btn.dataset.copy);
  toast("Đã sao chép");
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
