// Gift envelope. The page shows only a sealed envelope; tapping it opens the flap,
// lifts the card and then opens #gift-dialog (a bottom sheet on phones) with the
// QR and account details, rendered from CONFIG.gifts so they live in one place.
import { CONFIG } from "./config.js";
import { openDialog, reduceMotion, toast } from "./ui.js";

const ICON = (name) =>
  `<svg class="ico" aria-hidden="true"><use href="assets/icons.svg?v=2#i-${name}"/></svg>`;

// 100871060908 -> "1008 7106 0908" (easier to read aloud and to check by eye).
const group = (n) => n.replace(/\s+/g, "").replace(/(\d{4})(?=\d)/g, "$1 ");

export async function copyText(text) {
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
}

// Brief in-place confirmation on the button itself (a toast alone is easy to miss).
function confirm(btn, label = "Đã sao chép") {
  const html = btn.dataset.html ?? (btn.dataset.html = btn.innerHTML);
  btn.classList.add("is-done");
  btn.innerHTML = `${ICON("check")}<span>${label}</span>`;
  clearTimeout(btn._t);
  btn._t = setTimeout(() => {
    btn.classList.remove("is-done");
    btn.innerHTML = html;
  }, 1800);
}

// Phones: the share sheet offers "Save image" (a downloaded file is hard to find
// on iOS). Desktop: a plain download.
async function saveQr(gift) {
  const filename = `qr-mung-cuoi-${gift.id}.jpg`;
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare) {
    try {
      const blob = await (await fetch(gift.qr)).blob();
      const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch (err) {
      if (err?.name === "AbortError") return; // guest closed the share sheet
    }
  }
  const a = Object.assign(document.createElement("a"), { href: gift.qr, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  toast("Đã lưu mã QR");
}

function render(slot) {
  const gifts = CONFIG.gifts;
  slot.innerHTML = `
    <div class="gift-tabs" role="tablist" aria-label="Gửi tới">
      ${gifts
        .map(
          (g, i) => `
        <button type="button" role="tab" class="gift-tab" id="gift-tab-${g.id}"
          aria-controls="gift-panel" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}"
          data-gift="${g.id}">
          <span>${g.label}</span><small>${g.name}</small>
        </button>`,
        )
        .join("")}
      <span class="gift-tabs-pill" aria-hidden="true"></span>
    </div>
    <div class="gift-panel" id="gift-panel" role="tabpanel" tabindex="-1"></div>`;
}

function panelHtml(g) {
  return `
    <figure class="gift-qr-frame">
      <img class="gift-qr" src="${g.qr}" width="674" height="814" decoding="async"
        alt="Mã QR chuyển khoản mừng ${g.label.toLowerCase()} ${g.name}" />
      <figcaption>Quét bằng app ngân hàng</figcaption>
    </figure>
    <dl class="gift-rows">
      <div class="gift-row gift-row--pair">
        <div><dt>Ngân hàng</dt><dd>${g.bank}</dd></div>
        <div><dt>Chủ tài khoản</dt><dd>${g.holder}</dd></div>
      </div>
      <div class="gift-row gift-row--acc">
        <dt>Số tài khoản</dt>
        <dd>
          <span class="gift-acc">${group(g.account)}</span>
          <button type="button" class="gift-chip" data-copy="${g.account}"
            aria-label="Sao chép số tài khoản ${g.account}">${ICON("copy")}<span>Sao chép</span></button>
        </dd>
      </div>
      <div class="gift-row">
        <dt>Lời nhắn gợi ý</dt>
        <dd>
          <span class="gift-memo">${CONFIG.giftMemo}</span>
          <button type="button" class="gift-chip" data-copy="${CONFIG.giftMemo}"
            aria-label="Sao chép lời nhắn">${ICON("copy")}<span>Sao chép</span></button>
        </dd>
      </div>
    </dl>
    <button type="button" class="btn btn--solid btn--block" data-save-qr="${g.id}">
      ${ICON("download-simple")}<span>Lưu mã QR vào máy</span>
    </button>
    <p class="gift-tip">Mẹo: lưu mã QR, rồi chọn <strong>quét từ ảnh</strong> trong ứng dụng ngân hàng.</p>`;
}

export function initGift() {
  const dialog = document.getElementById("gift-dialog");
  const slot = document.getElementById("gift-slot");
  const envelope = document.getElementById("envelope");
  if (!dialog || !slot) return { open: () => {} };

  render(slot);
  const tabs = [...slot.querySelectorAll(".gift-tab")];
  const panel = slot.querySelector(".gift-panel");
  const byId = new Map(CONFIG.gifts.map((g) => [g.id, g]));

  const select = (id, focus = false) => {
    const i = tabs.findIndex((t) => t.dataset.gift === id);
    tabs.forEach((t, j) => {
      t.setAttribute("aria-selected", String(j === i));
      t.tabIndex = j === i ? 0 : -1;
    });
    slot.querySelector(".gift-tabs").style.setProperty("--i", i);
    panel.setAttribute("aria-labelledby", tabs[i].id);
    panel.innerHTML = panelHtml(byId.get(id));
    if (!reduceMotion()) {
      panel.classList.remove("is-swap");
      void panel.offsetWidth;
      panel.classList.add("is-swap");
    }
    if (focus) tabs[i].focus();
  };
  select(CONFIG.gifts[0].id);

  slot.addEventListener("click", (e) => {
    const tab = e.target.closest(".gift-tab");
    if (tab) return select(tab.dataset.gift);
    const save = e.target.closest("[data-save-qr]");
    if (save) saveQr(byId.get(save.dataset.saveQr));
  });

  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  slot.querySelector(".gift-tabs").addEventListener("keydown", (e) => {
    const dir = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!dir) return;
    const i = tabs.indexOf(document.activeElement);
    const next = tabs[(i + dir + tabs.length) % tabs.length];
    select(next.dataset.gift, true);
  });

  // Copy buttons inside the sheet confirm in place.
  slot.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-copy]");
    if (!btn) return;
    e.stopPropagation();
    await copyText(btn.dataset.copy);
    confirm(btn, "Đã chép");
    if (navigator.vibrate) navigator.vibrate(12);
  });

  dialog.addEventListener("close", () => envelope?.classList.remove("is-open"));

  // From the envelope: open the flap first, then the sheet. Elsewhere (dock, hero): straight to the sheet.
  let opening = false;
  const open = (btn) => {
    if (btn === envelope && envelope && !reduceMotion()) {
      if (opening) return;
      opening = true;
      envelope.classList.add("is-open");
      setTimeout(() => {
        opening = false;
        openDialog(dialog);
      }, 720);
      return;
    }
    openDialog(dialog);
  };

  return { open };
}
