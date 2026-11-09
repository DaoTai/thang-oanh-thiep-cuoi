// Guest link builder (unlisted page). Each guest gets `<base>?to=<name>`;
// the invitation reads `to` and shows the "Thân mời …" cover.
// State lives in localStorage only: nothing is sent anywhere.

const PARAM = "to";
const KEY = "guest-links:v1";
const MAX_NAME = 60;

const $ = (s, el = document) => el.querySelector(s);
const els = {
  form: $("#add-form"),
  names: $("#names"),
  csv: $("#csv"),
  drop: $("#drop"),
  sample: $("#sample"),
  list: $("#list"),
  empty: $("#empty"),
  count: $("#count"),
  filter: $("#filter"),
  bulk: $("#bulk"),
  toast: $("#toast"),
};

/* ------------------------------------------------------------------ state */

// Links point at the invitation home page on the same domain as this tool.
const BASE = new URL("../", location.href).href;

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.guests)) return { guests: s.guests };
  } catch {}
  return { guests: [] };
}

const state = load();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

/* ---------------------------------------------------------------- helpers */

const cleanName = (s) =>
  String(s ?? "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME);

const keyOf = (name) => name.toLocaleLowerCase("vi");

// Lowercase, strip Vietnamese diacritics: for matching CSV headers.
const fold = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function linkFor(name) {
  const url = new URL(BASE);
  url.searchParams.set(PARAM, name);
  return url.href;
}

let toastTimer;
function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add("is-on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("is-on"), 2000);
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for http:// on LAN or older browsers.
    const ta = Object.assign(document.createElement("textarea"), { value: text });
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* -------------------------------------------------------------------- CSV */

// RFC 4180-ish parser; delimiter auto-detected from the first line (, ; or tab).
function parseCSV(text) {
  text = text.replace(/^﻿/, "");
  const first = text.split(/\r?\n/, 1)[0];
  const delim = [",", ";", "\t"].reduce((a, d) => (first.split(d).length > first.split(a).length ? d : a), ",");
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === delim) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const NAME_HEADERS = ["ten", "ho ten", "ho va ten", "ten khach", "khach", "khach moi", "name", "guest", "full name"];
const TITLE_HEADERS = ["xung ho", "danh xung", "cach goi", "goi", "title", "prefix"];

function namesFromCSV(text) {
  const rows = parseCSV(text);
  if (!rows.length) return [];
  const head = rows[0].map(fold);
  const nameCol = head.findIndex((h) => NAME_HEADERS.includes(h));
  const titleCol = head.findIndex((h) => TITLE_HEADERS.includes(h));
  if (nameCol === -1) return rows.map((r) => r[0]);
  return rows.slice(1).map((r) => [titleCol >= 0 ? r[titleCol] : "", r[nameCol]].map(cleanName).filter(Boolean).join(" "));
}

/* ------------------------------------------------------------------ add */

function addNames(raw) {
  const seen = new Set(state.guests.map((g) => keyOf(g.name)));
  let added = 0;
  let dup = 0;
  for (const r of raw) {
    const name = cleanName(r);
    if (!name) continue;
    const k = keyOf(name);
    if (seen.has(k)) {
      dup++;
      continue;
    }
    seen.add(k);
    state.guests.push({ id: crypto.randomUUID?.() ?? String(Date.now() + Math.random()), name, copied: false });
    added++;
  }
  save();
  render();
  const msg = [added && `Đã thêm ${added} khách`, dup && `bỏ qua ${dup} tên trùng`].filter(Boolean).join(", ");
  toast(msg || "Không có tên mới");
  return added;
}

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (addNames(els.names.value.split(/\r?\n/))) els.names.value = "";
  els.names.focus();
});

// Ctrl/Cmd + Enter submits from the textarea.
els.names.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) els.form.requestSubmit();
});

async function importFile(file) {
  if (!file) return;
  const text = await file.text();
  const names = namesFromCSV(text);
  if (!names.length) return toast("File không có tên nào");
  addNames(names);
}

els.csv.addEventListener("change", () => {
  importFile(els.csv.files[0]);
  els.csv.value = "";
});

for (const t of ["dragenter", "dragover"])
  els.drop.addEventListener(t, (e) => {
    e.preventDefault();
    els.drop.classList.add("is-over");
  });
for (const t of ["dragleave", "drop"])
  els.drop.addEventListener(t, () => els.drop.classList.remove("is-over"));
els.drop.addEventListener("drop", (e) => {
  e.preventDefault();
  importFile(e.dataTransfer.files[0]);
});

els.sample.addEventListener("click", () => {
  const csv = "Xưng hô,Tên\nBạn,Tài\nAnh chị,Hùng Lan\nGia đình chú,Ba\n";
  download("danh-sach-khach-mau.csv", "﻿" + csv, "text/csv;charset=utf-8");
});

/* ----------------------------------------------------------------- render */

const ICON = (id) => `<svg class="ico" aria-hidden="true"><use href="../assets/icons.svg?v=2#i-${id}"/></svg>`;

function rowHTML(g, i) {
  const li = document.createElement("li");
  li.className = "item" + (g.copied ? " is-sent" : "");
  li.dataset.id = g.id;
  const link = linkFor(g.name);
  li.innerHTML = `
    <span class="num">${i + 1}</span>
    <div class="who">
      <span class="name"></span>
      <a class="url" target="_blank" rel="noopener"></a>
    </div>
    <div class="acts">
      <button class="btn btn--sm btn--primary" type="button" data-act="copy">${ICON("copy")}<span>Copy link</span></button>
      <button class="icon-btn" type="button" data-act="remove" aria-label="Xoá">${ICON("x")}</button>
    </div>`;
  $(".name", li).textContent = g.name;
  const a = $(".url", li);
  a.href = link;
  a.textContent = `${link.split("?")[0]}?${PARAM}=${g.name}`; // readable; the copied link stays encoded
  a.title = "Mở thử link";
  if (g.copied) $(".name", li).insertAdjacentHTML("beforeend", ` <span class="tag">${ICON("check")}đã copy</span>`);
  return li;
}

function render() {
  const q = fold(els.filter.value);
  const items = state.guests
    .map((g, i) => [g, i])
    .filter(([g]) => !q || fold(g.name).includes(q));
  els.list.replaceChildren(...items.map(([g, i]) => rowHTML(g, i)));
  els.count.textContent = state.guests.length;
  els.empty.hidden = state.guests.length > 0;
  if (state.guests.length && !items.length) {
    els.empty.hidden = false;
    els.empty.textContent = "Không tìm thấy tên phù hợp.";
  } else els.empty.textContent = "Chưa có khách nào. Thêm tên ở bước 1.";
  for (const b of els.bulk.querySelectorAll("button")) b.disabled = !state.guests.length;
}

els.filter.addEventListener("input", render);

els.list.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const id = btn.closest(".item").dataset.id;
  const g = state.guests.find((x) => x.id === id);
  if (!g) return;
  const act = btn.dataset.act;
  if (act === "remove") {
    state.guests = state.guests.filter((x) => x !== g);
    save();
    render();
    return toast(`Đã xoá ${g.name}`);
  }
  if (!(await copy(linkFor(g.name)))) return toast("Không copy được, hãy copy thủ công");
  g.copied = true;
  save();
  render();
  toast(`Đã copy link cho ${g.name}`);
});

els.bulk.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-bulk]")?.dataset.bulk;
  if (!b || !state.guests.length) return;
  if (b === "copy-links") {
    const text = state.guests.map((g) => `${g.name}: ${linkFor(g.name)}`).join("\n");
    toast((await copy(text)) ? `Đã copy ${state.guests.length} link` : "Không copy được");
  } else if (b === "export") {
    const esc = (s) => `"${String(s).replaceAll('"', '""')}"`;
    const csv = [["STT", "Tên", "Link", "Đã copy"], ...state.guests.map((g, i) => [i + 1, g.name, linkFor(g.name), g.copied ? "x" : ""])]
      .map((r) => r.map(esc).join(","))
      .join("\r\n");
    // BOM so Excel opens Vietnamese text as UTF-8.
    download("link-khach-moi.csv", "﻿" + csv, "text/csv;charset=utf-8");
  } else if (b === "clear") {
    if (!confirm(`Xoá toàn bộ ${state.guests.length} khách khỏi danh sách?`)) return;
    state.guests = [];
    save();
    render();
    toast("Đã xoá danh sách");
  }
});

render();
