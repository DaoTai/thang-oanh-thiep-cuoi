// Full-screen album grid + lightbox (arrows, swipe with drag-follow, thumbnail strip,
// slideshow, fullscreen, neighbour preload).

import { PHOTOS } from "./photos.js";
import { openDialog, closeDialog, reduceMotion } from "./ui.js";

const src = (id, w) => `assets/album/web/${id}-${w}.webp`;
const srcset = (id) => `${src(id, 960)} 960w, ${src(id, 1600)} 1600w`;
// Portrait crops made for the couple section are not album photos.
const ALBUM = PHOTOS.filter((p) => !/-(groom|bride)$/.test(p.id));
const altOf = (i) => `Ảnh cưới Mạnh Thắng và Kiều Oanh, ${i + 1} trên ${ALBUM.length}`;
const pad = (n) => String(n).padStart(2, "0");
const SLIDE_MS = 4500;

export function initGallery() {
  const galleryDialog = document.getElementById("gallery-dialog");
  const scroller = document.getElementById("gallery-scroll");
  const grid = document.getElementById("gallery-grid");
  const lightbox = document.getElementById("lightbox");
  const stage = document.getElementById("lb-stage");
  const img = document.getElementById("lb-img");
  const ambient = document.getElementById("lb-ambient");
  const cur = document.getElementById("lb-cur");
  const thumbs = document.getElementById("lb-thumbs");
  const playBtn = document.getElementById("lb-play");
  const fsBtn = document.getElementById("lb-fs");
  const progress = document.getElementById("lb-progress");
  let current = -1;
  let seq = 0;
  let built = false;
  let thumbsBuilt = false;

  /* ------------------------------------------------------------ album grid */

  function build() {
    if (built) return;
    built = true;
    document.getElementById("gallery-count").textContent = `${ALBUM.length} khoảnh khắc`;
    grid.innerHTML = ALBUM.map((p, i) => {
      // Every 7th photo is a 2x2 feature tile, alternating left and right.
      const feature = i % 7 === 0;
      const cls = feature ? `is-feature${(i / 7) % 2 ? " is-right" : ""}` : "";
      const sizes = feature ? "(min-width: 700px) 560px, 100vw" : "(min-width: 700px) 280px, 50vw";
      return `<li class="${cls}" style="--i:${Math.min(i, 10)}">
        <button type="button" class="photo-btn" data-open-photo="${p.id}" aria-label="Xem ảnh lớn ${i + 1}">
          <img src="${src(p.id, 480)}" srcset="${src(p.id, 480)} 480w, ${src(p.id, 960)} 960w"
            sizes="${sizes}" width="${p.w}" height="${p.h}" loading="lazy" decoding="async"
            alt="${altOf(i)}" style="background:url(${p.lqip}) center/cover" />
        </button>
        <span class="gallery-num" aria-hidden="true">${pad(i + 1)}</span></li>`;
    }).join("");

    // Solid bar + small title once the intro has scrolled under it.
    const intro = document.getElementById("gallery-intro");
    new IntersectionObserver(
      ([e]) => scroller.classList.toggle("is-scrolled", !e.isIntersecting),
      { root: scroller, rootMargin: "-64px 0px 0px 0px" },
    ).observe(intro);
  }

  /* -------------------------------------------------------------- lightbox */

  function buildThumbs() {
    if (thumbsBuilt) return;
    thumbsBuilt = true;
    document.getElementById("lb-total").textContent = pad(ALBUM.length);
    thumbs.innerHTML = ALBUM.map(
      (p, i) => `<button type="button" class="lb-thumb" data-index="${i}" aria-label="Ảnh ${i + 1}">
        <img src="${src(p.id, 480)}" width="${p.w}" height="${p.h}" alt="" loading="lazy" decoding="async"
          style="background:url(${p.lqip}) center/cover" /></button>`,
    ).join("");
  }

  function syncThumbs(smooth) {
    const prev = thumbs.querySelector('[aria-current="true"]');
    if (prev) prev.removeAttribute("aria-current");
    const btn = thumbs.children[current];
    btn.setAttribute("aria-current", "true");
    const left = btn.offsetLeft - (thumbs.clientWidth - btn.offsetWidth) / 2;
    thumbs.scrollTo({ left, behavior: smooth && !reduceMotion() ? "smooth" : "auto" });
  }

  // Pick the srcset candidate for the size the photo is actually shown at.
  function sizesFor(p) {
    const w = Math.min(stage.clientWidth, (stage.clientHeight * p.w) / p.h);
    return `${Math.max(1, Math.round(w))}px`;
  }

  function load(p) {
    const pre = new Image();
    pre.sizes = sizesFor(p);
    pre.srcset = srcset(p.id);
    pre.src = src(p.id, 1600);
    return pre.decode().catch(() => {});
  }

  async function show(i, dir = 0) {
    const next = (i + ALBUM.length) % ALBUM.length;
    if (next === current && img.src) return;
    current = next;
    const p = ALBUM[current];
    const token = ++seq;

    cur.textContent = pad(current + 1);
    ambient.style.backgroundImage = `url(${p.lqip})`;
    syncThumbs(true);
    restartSlide();

    const animate = img.src && !reduceMotion();
    img.style.setProperty("--dir", dir);
    if (animate) img.classList.add("is-out");
    await Promise.all([load(p), animate ? wait(180) : null]);
    if (token !== seq) return; // a newer navigation took over

    img.classList.remove("is-out", "is-drag");
    img.style.transform = "";
    if (animate) img.classList.add("is-enter");
    img.width = p.w;
    img.height = p.h;
    img.sizes = sizesFor(p);
    img.srcset = srcset(p.id);
    img.src = src(p.id, 1600);
    img.alt = altOf(current);
    if (animate) {
      img.getBoundingClientRect(); // commit the enter state before transitioning out of it
      img.classList.remove("is-enter");
    }

    // Warm the cache for the neighbours so moving on feels instant.
    for (const n of [current + 1, current - 1]) load(ALBUM[(n + ALBUM.length) % ALBUM.length]);
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const go = (step) => show(current + step, step);

  function openPhoto(id) {
    buildThumbs();
    const i = ALBUM.findIndex((p) => p.id === id);
    if (!lightbox.open) {
      current = -1;
      img.removeAttribute("src");
      img.removeAttribute("srcset");
      lightbox.showModal();
    }
    show(i < 0 ? 0 : i);
  }

  function closeLightbox() {
    stopSlide();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    lightbox.close();
  }

  /* ------------------------------------------------------------- slideshow */

  let timer = 0;
  const playing = () => playBtn.getAttribute("aria-pressed") === "true";

  function restartSlide() {
    clearTimeout(timer);
    progress.classList.remove("is-running");
    if (!playing()) return;
    progress.style.setProperty("--lb-delay", `${SLIDE_MS}ms`);
    progress.getBoundingClientRect(); // restart the CSS animation
    progress.classList.add("is-running");
    timer = setTimeout(() => go(1), SLIDE_MS);
  }

  function stopSlide() {
    playBtn.setAttribute("aria-pressed", "false");
    playBtn.setAttribute("aria-label", "Trình chiếu");
    restartSlide();
  }

  playBtn.addEventListener("click", () => {
    if (playing()) return stopSlide();
    playBtn.setAttribute("aria-pressed", "true");
    playBtn.setAttribute("aria-label", "Dừng trình chiếu");
    restartSlide();
  });

  /* ------------------------------------------------------------ fullscreen */

  if (document.fullscreenEnabled) {
    fsBtn.hidden = false;
    fsBtn.addEventListener("click", () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else lightbox.requestFullscreen().catch(() => {});
    });
    document.addEventListener("fullscreenchange", () => {
      const on = document.fullscreenElement === lightbox;
      lightbox.classList.toggle("is-fullscreen", on);
      fsBtn.setAttribute("aria-label", on ? "Thoát toàn màn hình" : "Toàn màn hình");
    });
  }

  /* ---------------------------------------------------------------- events */

  // Featured tiles on the page and tiles inside the gallery both open the lightbox.
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-open-photo]");
    if (btn) openPhoto(btn.dataset.openPhoto);
  });

  document.getElementById("lb-prev").addEventListener("click", () => go(-1));
  document.getElementById("lb-next").addEventListener("click", () => go(1));
  thumbs.addEventListener("click", (e) => {
    const t = e.target.closest("[data-index]");
    if (t) show(+t.dataset.index, Math.sign(t.dataset.index - current));
  });
  lightbox.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") go(-1);
    else if (e.key === "ArrowRight") go(1);
  });
  lightbox.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeLightbox();
  });
  lightbox.addEventListener("close", stopSlide);

  let swiped = false;
  lightbox.addEventListener("click", (e) => {
    if (swiped) return void (swiped = false); // the click that ends a swipe is not a "tap outside"
    if (e.target.closest("[data-close]") || e.target === stage) closeLightbox();
  });

  // Swipe: the photo follows the finger, then commits or springs back.
  let x0 = null;
  let y0 = 0;
  let dx = 0;
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary || e.button > 0) return;
    swiped = false;
    x0 = e.clientX;
    y0 = e.clientY;
    dx = 0;
  });
  stage.addEventListener("pointermove", (e) => {
    if (x0 === null || !e.isPrimary || e.pointerType === "mouse") return;
    dx = e.clientX - x0;
    if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(e.clientY - y0)) return;
    img.classList.add("is-drag");
    img.style.transform = `translateX(${dx * 0.6}px)`;
  });
  stage.addEventListener("pointerup", (e) => {
    if (x0 === null) return;
    dx = e.clientX - x0;
    const dy = e.clientY - y0;
    x0 = null;
    img.classList.remove("is-drag");
    swiped = Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3;
    if (swiped) {
      // Keep moving the way the finger went while it fades out.
      img.style.transform = `translateX(${dx * 0.6 + Math.sign(dx) * 60}px)`;
      go(dx < 0 ? 1 : -1);
    } else img.style.transform = "";
  });
  stage.addEventListener("pointercancel", () => {
    x0 = null;
    img.classList.remove("is-drag");
    img.style.transform = "";
  });

  return {
    open() {
      build();
      openDialog(galleryDialog);
    },
    close: () => closeDialog(galleryDialog),
  };
}
