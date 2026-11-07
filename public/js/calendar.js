// Month calendar, countdown and "add to calendar" links. All driven by CONFIG.

import { CONFIG, mainEvent } from "./config.js";

const pad = (n) => String(n).padStart(2, "0");
const dateOf = (iso) => iso.slice(0, 10); // "2026-11-29" (venue-local date, offset kept in ISO)
const timeOf = (iso) => iso.slice(11, 16); // "11:00"
const utcStamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const WEEKDAYS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

/* --------------------------------------------------------- month calendar */

export function renderMonth() {
  const body = document.getElementById("month-body");
  if (!body) return;
  const [y, m] = dateOf(mainEvent().start).split("-").map(Number);
  const marks = new Map(CONFIG.events.map((e) => [dateOf(e.start), e]));

  const first = new Date(Date.UTC(y, m - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7; // Monday-first grid
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();

  let html = "";
  for (let cell = 0; cell < Math.ceil((offset + days) / 7) * 7; cell++) {
    if (cell % 7 === 0) html += "<tr>";
    const d = cell - offset + 1;
    if (d < 1 || d > days) {
      html += "<td></td>";
    } else {
      const ev = marks.get(`${y}-${pad(m)}-${pad(d)}`);
      if (!ev) html += `<td><span class="day">${d}</span></td>`;
      else if (ev.id === CONFIG.mainEventId)
        html += `<td><span class="day day--main" title="${ev.title}"><svg class="ico" aria-hidden="true"><use href="assets/icons.svg?v=2#i-heart-fill"/></svg>${d}<span class="sr-only">, ${ev.title}</span></span></td>`;
      else html += `<td><span class="day day--event" title="${ev.title}">${d}<span class="sr-only">, ${ev.title}</span></span></td>`;
    }
    if (cell % 7 === 6) html += "</tr>";
  }
  body.innerHTML = html;
}

/* --------------------------------------------------------------- countdown */

export function startCountdown() {
  const root = document.getElementById("countdown");
  if (!root) return;
  const target = Date.parse(mainEvent().start);
  const cells = Object.fromEntries([...root.querySelectorAll("[data-unit]")].map((el) => [el.dataset.unit, el]));
  let timer = 0;

  const tick = () => {
    const left = target - Date.now();
    if (left <= 0) {
      for (const el of Object.values(cells)) el.textContent = "00";
      document.getElementById("countdown-done").hidden = false;
      stop();
      return;
    }
    const s = Math.floor(left / 1000);
    const values = { d: Math.floor(s / 86400), h: Math.floor(s / 3600) % 24, m: Math.floor(s / 60) % 60, s: s % 60 };
    for (const [unit, el] of Object.entries(cells)) {
      const text = pad(values[unit]);
      if (el.textContent !== text) el.textContent = text;
    }
  };
  const start = () => {
    if (timer) return;
    tick();
    timer = setInterval(tick, 1000);
  };
  const stop = () => {
    clearInterval(timer);
    timer = 0;
  };

  tick();
  // Only tick while the countdown is on screen.
  new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop())).observe(root);
}

/* -------------------------------------------------------- add to calendar */

const couple = () => `${CONFIG.groom.short} & ${CONFIG.bride.short}`;

function googleUrl(e) {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: `${e.title} ${couple()}`,
    dates: `${utcStamp(e.start)}/${utcStamp(e.end)}`,
    details: `Trân trọng kính mời bạn đến chung vui cùng ${couple()}.\n${location.href.split("#")[0]}`,
    location: `${e.venue}, ${e.address}`,
    ctz: "Asia/Ho_Chi_Minh",
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

function outlookUrl(e) {
  const p = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: `${e.title} ${couple()}`,
    startdt: e.start,
    enddt: e.end,
    location: `${e.venue}, ${e.address}`,
    body: `Trân trọng kính mời bạn đến chung vui cùng ${couple()}.`,
  });
  return `https://outlook.live.com/calendar/0/action/compose?${p}`;
}

export function initRsvp() {
  const dialog = document.getElementById("rsvp-dialog");
  const summary = document.getElementById("rsvp-summary");
  const links = {
    google: document.getElementById("cal-google"),
    apple: document.getElementById("cal-apple"),
    outlook: document.getElementById("cal-outlook"),
  };

  const update = () => {
    const id = dialog.querySelector('input[name="rsvp-event"]:checked').value;
    const e = CONFIG.events.find((ev) => ev.id === id);
    const [y, m, d] = dateOf(e.start).split("-").map(Number);
    const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    summary.innerHTML = "";
    const strong = document.createElement("strong");
    strong.textContent = `${e.title}: ${timeOf(e.start)}, ${weekday} ${pad(d)}.${pad(m)}.${y}`;
    summary.append(strong, document.createElement("br"), `${e.venue}, ${e.address}`);
    links.google.href = googleUrl(e);
    links.outlook.href = outlookUrl(e);
    links.apple.href = `assets/calendar/${e.id}.ics`;
  };

  dialog.addEventListener("change", update);
  update();

  return function select(id) {
    const radio = id && dialog.querySelector(`input[name="rsvp-event"][value="${id}"]`);
    if (radio) radio.checked = true;
    update();
  };
}
