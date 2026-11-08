// Single source of truth for dates, venues and gift info used by the scripts
// (countdown, month calendar, "add to calendar" links, generated .ics files).
// The visible copy in index.html repeats some of these values: keep both in sync.
// After editing events, run `npm run assets -- calendar` to regenerate the .ics files.

export const CONFIG = {
  groom: { short: "Mạnh Thắng", full: "Đỗ Mạnh Thắng" },
  bride: { short: "Kiều Oanh", full: "Lê Thị Kiều Oanh" },

  // Times are placeholders (not confirmed yet). Always keep the +07:00 offset.
  events: [
    {
      id: "an-hoi",
      title: "Lễ Ăn Hỏi",
      start: "2026-11-28T09:00:00+07:00",
      end: "2026-11-28T11:00:00+07:00",
      venue: "Tư gia nhà gái",
      address: "Đông Yên, Yên Mạc, Ninh Bình",
    },
    {
      id: "le-cuoi",
      title: "Lễ Vu Quy & Thành Hôn",
      start: "2026-11-29T10:00:00+07:00",
      end: "2026-11-29T14:00:00+07:00",
      venue: "Hội trường Hợp tác xã dịch vụ tổng hợp Văn Phú",
      address: "Số 36 Phố Văn Phú, TDP2, Kiến Hưng, Hà Nội",
    },
  ],

  // The countdown and the month calendar follow this event.
  mainEventId: "le-cuoi",

  // Gift envelope (js/gift.js). Real accounts and QR images of the couple.
  gifts: [
    {
      id: "groom",
      label: "Chú rể",
      name: "Mạnh Thắng",
      bank: "Techcombank",
      holder: "DO MANH THANG",
      account: "19036984948013",
      qr: "assets/qr-groom.jpg",
    },
    {
      id: "bride",
      label: "Cô dâu",
      name: "Kiều Oanh",
      bank: "TPBank",
      holder: "LE THI KIEU OANH",
      account: "06688318901",
      qr: "assets/qr-bride.jpg",
    },
  ],
  // Suggested transfer memo (no diacritics: some banks strip them).
  giftMemo: "Mung cuoi Thang Oanh",

  // Optional shared guestbook backend (Google Apps Script web app URL, see
  // scripts/wishes-apps-script.gs). Empty = wishes are kept in this browser only.
  wishesEndpoint: "",
};

export const mainEvent = () => CONFIG.events.find((e) => e.id === CONFIG.mainEventId);
