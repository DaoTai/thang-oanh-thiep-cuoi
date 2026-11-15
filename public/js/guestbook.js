// Guestbook: validated form + list of wishes.
// Storage: CONFIG.wishesEndpoint (Google Apps Script, shared by every guest) when set,
// otherwise this browser's localStorage only. SEED_WISHES are always merged in.

import { CONFIG } from "./config.js";
import { toast } from "./ui.js";
import { SEED_WISHES } from "./wishes-seed.js";

const KEY = "thang-oanh:wishes";
const MAX_NAME = 40;
const MAX_MSG = 500;

const local = {
  read() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) ?? [];
    } catch {
      return [];
    }
  },
  add(w) {
    try {
      localStorage.setItem(KEY, JSON.stringify([w, ...local.read()].slice(0, 200)));
    } catch {
      /* private mode / storage full: the wish still shows for this visit */
    }
  },
};

async function loadWishes() {
  if (!CONFIG.wishesEndpoint) return local.read();
  const res = await fetch(CONFIG.wishesEndpoint, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : data.wishes ?? [];
}

async function saveWish(w) {
  if (CONFIG.wishesEndpoint) {
    // text/plain keeps this a "simple" CORS request (no preflight), which Apps Script needs.
    const res = await fetch(CONFIG.wishesEndpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(w),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }
  local.add(w);
}

// Newest first, seed included, duplicates (same name + message) dropped.
function merge(...lists) {
  const seen = new Set();
  return lists
    .flat()
    .filter((w) => {
      if (!w?.name || !w?.message) return false;
      const k = `${w.name.trim()}\n${w.message.trim()}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => (Date.parse(b.time) || 0) - (Date.parse(a.time) || 0));
}

const p2 = (n) => String(n).padStart(2, "0");
const fmtDate = (d) => `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;

function fmtAgo(d) {
  const min = Math.round((Date.now() - d) / 60000);
  if (min < 1) return "Vừa xong";
  if (min < 60) return `${min} phút trước`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} giờ trước`;
  const days = Math.round(h / 24);
  if (days === 1) return "Hôm qua";
  if (days < 7) return `${days} ngày trước`;
  return fmtDate(d);
}

function wishEl(w, isNew = false) {
  const li = document.createElement("li");
  li.className = isNew ? "wish wish--new" : "wish";

  const body = document.createElement("div");
  body.className = "wish-body";
  const meta = document.createElement("div");
  meta.className = "wish-meta";
  const name = document.createElement("span");
  name.className = "wish-name";
  name.textContent = w.name;
  meta.append(name);
  const d = new Date(w.time);
  if (!Number.isNaN(d.getTime())) {
    const time = document.createElement("time");
    time.className = "wish-time";
    time.dateTime = d.toISOString();
    time.title = fmtDate(d);
    time.textContent = fmtAgo(d);
    meta.append(time);
  }
  const msg = document.createElement("p");
  msg.className = "wish-msg";
  msg.textContent = w.message;
  body.append(meta, msg);

  li.append(body);
  return li;
}

export function initGuestbook() {
  const form = document.getElementById("wish-form");
  const list = document.getElementById("wish-list");
  const empty = document.getElementById("wish-empty");
  const total = document.getElementById("wish-total");
  const status = document.getElementById("wish-status");
  const nameInput = form.elements.name;
  const msgInput = form.elements.message;
  const counter = document.getElementById("wish-count");
  let count = 0;

  const setCount = (n) => {
    count = n;
    total.textContent = n ? String(n) : "";
    empty.hidden = n > 0;
    list.hidden = n === 0;
  };

  loadWishes()
    .then((wishes) => merge(wishes, local.read(), SEED_WISHES))
    .catch(() => {
      status.textContent = "Chưa tải được danh sách lời chúc. Bạn vẫn có thể gửi lời chúc bình thường.";
      return merge(local.read(), SEED_WISHES);
    })
    .then((wishes) => {
      list.replaceChildren(...wishes.map((w) => wishEl(w)));
      setCount(wishes.length);
    })
    .finally(() => list.removeAttribute("aria-busy"));

  msgInput.addEventListener("input", () => {
    counter.textContent = msgInput.value.length;
  });

  const showError = (input, show) => {
    input.setAttribute("aria-invalid", String(show));
    document.getElementById(`${input.id}-err`).hidden = !show;
  };
  nameInput.addEventListener("input", () => nameInput.value.trim() && showError(nameInput, false));
  msgInput.addEventListener("input", () => msgInput.value.trim() && showError(msgInput, false));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim().slice(0, MAX_NAME);
    const message = msgInput.value.trim().slice(0, MAX_MSG);
    showError(nameInput, !name);
    showError(msgInput, !message);
    if (!name) return nameInput.focus();
    if (!message) return msgInput.focus();
    if (form.elements.website.value) return; // honeypot: bots fill every field

    const btn = form.querySelector('[type="submit"]');
    const label = btn.querySelector("span");
    btn.disabled = true;
    label.textContent = "Đang gửi...";
    status.textContent = "";

    const wish = { name, message, time: new Date().toISOString() };
    try {
      await saveWish(wish);
      list.prepend(wishEl(wish, true));
      list.scrollTop = 0;
      setCount(count + 1);
      form.reset();
      counter.textContent = "0";
      toast("Cảm ơn bạn! Lời chúc đã được gửi tới cô dâu chú rể.");
    } catch {
      status.textContent = "Chưa gửi được lời chúc, bạn kiểm tra kết nối mạng rồi thử lại giúp chúng mình nhé.";
    } finally {
      btn.disabled = false;
      label.textContent = "Gửi lời chúc";
    }
  });

  return {
    focus() {
      form.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
      setTimeout(() => nameInput.focus({ preventScroll: true }), 450);
    },
  };
}
