/**
 * Code.gs -- Google Apps Script backend for the Intern Management
 * System. Deploy as a Web App (Deploy -> New deployment -> Web app,
 * execute as yourself, access: anyone) and paste the resulting URL
 * into index.html's SCRIPT_URL constant.
 *
 * Data store: a single Google Sheet ("Inventory") with these columns
 * (order doesn't matter -- see HEADER_ALIASES below):
 *   ID | Item Name | Assigned To | Status | Updated At
 *
 * Architecture: doGet handles reads (list, export), doPost handles
 * writes (add, update) -- a simple branching dispatch on the `action`
 * parameter, the standard pattern for an Apps Script Web App acting as
 * a lightweight REST-ish backend without a real router.
 */

const SHEET_NAME = "Inventory";

/**
 * Real-world spreadsheets drift: someone renames "Item Name" to
 * "ItemName" or "Name" by hand, and a backend that hardcodes exact
 * header strings breaks silently. HEADER_ALIASES maps every reasonable
 * variant back to the CANONICAL field name the backend code actually
 * uses, so sync logic tolerates header drift instead of failing.
 */
const HEADER_ALIASES = {
  id: ["id", "itemid", "item id"],
  name: ["item name", "itemname", "name", "item"],
  assignedTo: ["assigned to", "assignedto", "assigned", "intern", "intern name"],
  status: ["status", "state"],
  updatedAt: ["updated at", "updatedat", "last updated", "timestamp"],
};

function _canonicalizeHeader(rawHeader) {
  const normalized = String(rawHeader).trim().toLowerCase();
  for (const canonical in HEADER_ALIASES) {
    if (HEADER_ALIASES[canonical].indexOf(normalized) !== -1) {
      return canonical;
    }
  }
  return null; // unrecognized column -- ignored, not an error
}

function _getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(["ID", "Item Name", "Assigned To", "Status", "Updated At"]);
  }
  return sheet;
}

function _readAllItems() {
  const sheet = _getSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headerRow = data[0];
  const columnMap = {}; // canonical field name -> column index
  headerRow.forEach(function (h, idx) {
    const canonical = _canonicalizeHeader(h);
    if (canonical) columnMap[canonical] = idx;
  });

  const items = [];
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (columnMap.id === undefined || !row[columnMap.id]) continue; // skip blank rows
    items.push({
      id: String(row[columnMap.id]),
      name: columnMap.name !== undefined ? row[columnMap.name] : "",
      assignedTo: columnMap.assignedTo !== undefined ? row[columnMap.assignedTo] : "",
      status: columnMap.status !== undefined ? row[columnMap.status] : "In Stock",
      updatedAt: columnMap.updatedAt !== undefined ? row[columnMap.updatedAt] : "",
    });
  }
  return items;
}

function _appendItem(item) {
  const sheet = _getSheet();
  const id = Utilities.getUuid();
  const now = new Date().toISOString();
  sheet.appendRow([id, item.name, item.assignedTo || "", item.status || "In Stock", now]);
  return { id: id, name: item.name, assignedTo: item.assignedTo || "", status: item.status || "In Stock", updatedAt: now };
}

function _updateItem(item) {
  const sheet = _getSheet();
  const data = sheet.getDataRange().getValues();
  const headerRow = data[0];
  const columnMap = {};
  headerRow.forEach(function (h, idx) {
    const canonical = _canonicalizeHeader(h);
    if (canonical) columnMap[canonical] = idx;
  });

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][columnMap.id]) === String(item.id)) {
      const now = new Date().toISOString();
      if (columnMap.name !== undefined) sheet.getRange(r + 1, columnMap.name + 1).setValue(item.name);
      if (columnMap.assignedTo !== undefined) sheet.getRange(r + 1, columnMap.assignedTo + 1).setValue(item.assignedTo || "");
      if (columnMap.status !== undefined) sheet.getRange(r + 1, columnMap.status + 1).setValue(item.status);
      if (columnMap.updatedAt !== undefined) sheet.getRange(r + 1, columnMap.updatedAt + 1).setValue(now);
      return { id: item.id, name: item.name, assignedTo: item.assignedTo, status: item.status, updatedAt: now };
    }
  }
  throw new Error("Item with id " + item.id + " not found");
}

/** GET handles reads: ?action=list (JSON) and ?action=export (redirects
 * to the underlying spreadsheet, since "export" here just means giving
 * the user a link to the live sheet -- no separate export file needs
 * to be generated). */
function doGet(e) {
  const action = (e.parameter.action || "list").toLowerCase();

  if (action === "export") {
    const url = SpreadsheetApp.getActiveSpreadsheet().getUrl();
    return HtmlService.createHtmlOutput('<script>window.location = "' + url + '";</script>');
  }

  const items = _readAllItems();
  return ContentService.createTextOutput(JSON.stringify(items))
    .setMimeType(ContentService.MimeType.JSON);
}

/** POST handles writes: {action: "add"|"update", item: {...}} */
function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: "invalid JSON body" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    let result;
    if (body.action === "add") {
      result = _appendItem(body.item);
    } else if (body.action === "update") {
      result = _updateItem(body.item);
    } else {
      throw new Error("unknown action: " + body.action);
    }
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
