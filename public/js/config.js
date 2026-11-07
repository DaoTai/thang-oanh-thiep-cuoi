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
      address: "35 P. Tràng An, Ninh Bình",
    },
    {
      id: "le-cuoi",
      title: "Lễ Thành Hôn",
      start: "2026-11-29T11:00:00+07:00",
      end: "2026-11-29T14:00:00+07:00",
      venue: "Nhà Văn Hóa Văn Phú (nhà trai)",
      address: "36 P. Văn Phú, Khu đô thị Văn Phú, Kiến Hưng, Hà Nội",
    },
  ],

  // The countdown and the month calendar follow this event.
  mainEventId: "le-cuoi",

  // Gift envelope (js/gift.js). PLACEHOLDERS: the QR image and account below come
  // from the earlier site and the holder is not the couple. Replace before sharing.
  gifts: [
    {
      id: "groom",
      label: "Chú rể",
      name: "Mạnh Thắng",
      bank: "VietinBank",
      holder: "DAO DUC TAI",
      account: "100871060908",
      qr: "assets/qr-example.jpg",
    },
    {
      id: "bride",
      label: "Cô dâu",
      name: "Kiều Oanh",
      bank: "VietinBank",
      holder: "DAO DUC TAI",
      account: "100871060908",
      qr: "assets/qr-example.jpg",
    },
  ],
  // Suggested transfer memo (no diacritics: some banks strip them).
  giftMemo: "Mung cuoi Thang Oanh",

  // Optional shared guestbook backend (Google Apps Script web app URL, see
  // scripts/wishes-apps-script.gs). Empty = wishes are kept in this browser only.
  wishesEndpoint: "",
};

export const mainEvent = () => CONFIG.events.find((e) => e.id === CONFIG.mainEventId);
