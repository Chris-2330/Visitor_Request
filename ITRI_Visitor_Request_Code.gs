/**
 * ITRI 展覽參觀者需求表單 → Google Sheet
 * FOUP Type EUV Dose Wafer Meter
 *
 * 使用方式：
 * 1. 在目標 Google Sheet 中開啟「擴充功能 → Apps Script」。
 * 2. 將本檔完整貼入 Code.gs。
 * 3. 在「專案設定 → 指令碼屬性」新增 SYNC_TOKEN，使用至少 32 字元的隨機字串。
 * 4. 執行 setupSheet() 一次並完成授權。
 * 5. 部署為「網頁應用程式」：執行身分選「我」，存取權依展場需求選擇。
 * 6. 僅將部署後的 /exec 網址與相同 SYNC_TOKEN 設為 Vercel 伺服器環境變數；不要寫入前端 HTML。
 */

const CONFIG = Object.freeze({
  // 若本程式是從目標 Google Sheet 內建立，請保留空白。
  // 若使用獨立 Apps Script 專案，請填入 Google Sheet ID。
  SPREADSHEET_ID: '',
  SHEET_NAME: 'Visitor_Requests'
});

const HEADERS = [
  '登記編號 Reference Number',
  '表單送出時間 Submitted At',
  'Google Sheet 接收時間 Received At',
  '表單語言 Form Language',
  '展品 Exhibit',
  '索取資訊 Requested Information',
  '索取項目代碼 Request IDs',
  '其他需求 Other Request',
  '留言 Message',
  '姓名 Name',
  '公司／機構 Organization',
  '部門 Department',
  '職稱 Job Title',
  '電子郵件 Email',
  '電話 Phone',
  '偏好聯絡方式 Preferred Contact',
  '期望回覆時間 Preferred Response Time',
  '個資同意 Consent',
  '個資告知版本 Privacy Notice Version',
  '個資同意文字 Consent Text',
  '前端同步時間 Client Sync Time',
  '瀏覽器 User Agent',
  '原始資料 Raw JSON'
];

/** 手動執行一次：建立工作表、欄位名稱與基本格式。 */
function setupSheet() {
  const sheet = getOrCreateSheet_();
  formatSheet_(sheet);
  SpreadsheetApp.flush();
  return {
    spreadsheetUrl: sheet.getParent().getUrl(),
    sheetName: sheet.getName(),
    message: 'Setup completed. Deploy this project as a web app.'
  };
}

/** 網頁應用程式狀態檢查。 */
function doGet() {
  return jsonResponse_({
    ok: true,
    service: 'ITRI Exhibition Visitor Request',
    sheetName: CONFIG.SHEET_NAME,
    time: new Date().toISOString()
  });
}

/** 接收離線 HTML 傳來的表單資料。 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const payload = parsePayload_(e);
    validateToken_(payload.token);

    const record = payload.record || payload;
    validateRecord_(record);

    const sheet = getOrCreateSheet_();
    const referenceNumber = cleanText_(record.referenceNumber);

    // 同一登記編號只寫入一次；離線重送不會產生重複列。
    if (hasReferenceNumber_(sheet, referenceNumber)) {
      return jsonResponse_({
        ok: true,
        duplicate: true,
        referenceNumber: referenceNumber
      });
    }

    const row = [
      referenceNumber,
      safeCell_(record.submittedAt),
      new Date(),
      safeCell_(record.language),
      safeCell_(record.exhibit),
      safeCell_(record.requestedInformation),
      safeCell_(normalizeArray_(record.requestIds).join(' | ')),
      safeCell_(record.otherRequest),
      safeCell_(record.message),
      safeCell_(record.name),
      safeCell_(record.organization),
      safeCell_(record.department),
      safeCell_(record.jobTitle),
      safeCell_(record.email),
      safeCell_(record.phone),
      safeCell_(record.preferredContactMethod),
      safeCell_(record.preferredResponseTime),
      record.consent === true,
      safeCell_(record.privacyNoticeVersion),
      safeCell_(record.consentText),
      safeCell_(record.clientSyncTime),
      safeCell_(record.userAgent),
      safeCell_(JSON.stringify(record))
    ];

    sheet.appendRow(row);
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 2).setNumberFormat('@');
    sheet.getRange(lastRow, 3).setNumberFormat('yyyy-mm-dd hh:mm:ss');
    sheet.getRange(lastRow, 14, 1, 2).setNumberFormat('@');
    SpreadsheetApp.flush();

    return jsonResponse_({
      ok: true,
      duplicate: false,
      referenceNumber: referenceNumber,
      row: lastRow
    });
  } catch (error) {
    console.error(error);
    return jsonResponse_({
      ok: false,
      error: error && error.message ? error.message : String(error)
    });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function getSpreadsheet_() {
  if (CONFIG.SPREADSHEET_ID) {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  }
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error('No active spreadsheet. Set CONFIG.SPREADSHEET_ID or bind this script to a Google Sheet.');
  }
  return spreadsheet;
}

function getOrCreateSheet_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    formatSheet_(sheet);
  } else {
    const currentHeaders = sheet.getRange(1, 1, 1, HEADERS.length).getDisplayValues()[0];
    if (currentHeaders.every(value => !value)) {
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      formatSheet_(sheet);
    }
  }
  return sheet;
}

function formatSheet_(sheet) {
  const header = sheet.getRange(1, 1, 1, HEADERS.length);
  header
    .setValues([HEADERS])
    .setBackground('#078EA3')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setWrap(true);

  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 48);
  sheet.setColumnWidth(1, 185);
  sheet.setColumnWidth(2, 170);
  sheet.setColumnWidth(3, 170);
  sheet.setColumnWidth(4, 115);
  sheet.setColumnWidth(5, 230);
  sheet.setColumnWidth(6, 300);
  sheet.setColumnWidth(7, 190);
  sheet.setColumnWidth(8, 230);
  sheet.setColumnWidth(9, 320);
  sheet.setColumnWidth(10, 130);
  sheet.setColumnWidth(11, 210);
  sheet.setColumnWidth(12, 140);
  sheet.setColumnWidth(13, 140);
  sheet.setColumnWidth(14, 220);
  sheet.setColumnWidth(15, 160);
  sheet.setColumnWidth(16, 180);
  sheet.setColumnWidth(17, 180);
  sheet.setColumnWidth(18, 105);
  sheet.setColumnWidth(19, 150);
  sheet.setColumnWidth(20, 360);
  sheet.setColumnWidth(21, 180);
  sheet.setColumnWidth(22, 300);
  sheet.setColumnWidth(23, 420);
  sheet.getDataRange().setVerticalAlignment('middle');
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Empty request body.');
  }
  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    throw new Error('Invalid JSON request body.');
  }
}

function validateToken_(token) {
  const expectedToken = PropertiesService.getScriptProperties().getProperty('SYNC_TOKEN');
  if (!expectedToken) {
    throw new Error('SYNC_TOKEN has not been configured in Script Properties.');
  }
  if (String(token || '') !== expectedToken) {
    throw new Error('Invalid sync token.');
  }
}

function validateRecord_(record) {
  if (!record || typeof record !== 'object') throw new Error('Missing record object.');
  if (!cleanText_(record.referenceNumber)) throw new Error('Missing reference number.');
  if (!cleanText_(record.name)) throw new Error('Missing visitor name.');
  if (!record.email && !record.phone) throw new Error('Email or phone is required.');
  if (record.consent !== true) throw new Error('Personal data consent is required.');
}

function hasReferenceNumber_(sheet, referenceNumber) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  return Boolean(
    sheet
      .getRange(2, 1, lastRow - 1, 1)
      .createTextFinder(referenceNumber)
      .matchEntireCell(true)
      .findNext()
  );
}

function normalizeArray_(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function cleanText_(value) {
  return String(value == null ? '' : value).trim();
}

/** 防止使用者輸入被 Google Sheets 解讀為公式。 */
function safeCell_(value) {
  const text = cleanText_(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function jsonResponse_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
