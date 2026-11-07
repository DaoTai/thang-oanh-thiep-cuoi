/**
 * Optional shared guestbook backend (Google Sheets + Apps Script). Free, no server.
 *
 * Setup:
 *  1. Create a Google Sheet, then Extensions > Apps Script, and paste this file.
 *  2. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.
 *  3. Copy the /exec URL into CONFIG.wishesEndpoint in public/js/config.js.
 *
 * The sheet gets columns: time | name | message. Delete a row to hide a wish.
 */

const SHEET_NAME = "wishes";
const MAX_NAME = 40;
const MAX_MSG = 500;

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  const rows = sheet_().getDataRange().getValues();
  const wishes = rows
    .filter((r) => r[1] && r[2])
    .map((r) => ({ time: new Date(r[0]).toISOString(), name: String(r[1]), message: String(r[2]) }))
    .reverse();
  return json_(wishes);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const name = String(body.name || "").trim().slice(0, MAX_NAME);
    const message = String(body.message || "").trim().slice(0, MAX_MSG);
    if (!name || !message) return json_({ ok: false, error: "empty" });
    const lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
      sheet_().appendRow([new Date(), name, message]);
    } finally {
      lock.releaseLock();
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}
