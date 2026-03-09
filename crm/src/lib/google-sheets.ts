import { google } from "googleapis";
import path from "path";
import fs from "fs";

const SPREADSHEET_ID = "19J-zTNRNeDuK0Oi-LgJ3Z4BTIKq5L8TPl4PAyKGztLU";
const SHEET_NAME = "ALL";

function getAuth() {
  const keyPath =
    process.env.GOOGLE_SERVICE_ACCOUNT_PATH ||
    path.join(process.cwd(), "google-service-account.json");

  if (!fs.existsSync(keyPath)) {
    throw new Error(`Service account key not found at ${keyPath}`);
  }

  const credentials = JSON.parse(fs.readFileSync(keyPath, "utf-8"));

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheets() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

export async function getSheetHeaders(): Promise<string[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!1:1`,
  });
  return (res.data.values?.[0] as string[]) ?? [];
}

export async function readAllSheet(): Promise<{
  headers: string[];
  rows: string[][];
}> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}`,
  });

  const values = res.data.values ?? [];
  if (values.length === 0) return { headers: [], rows: [] };

  const headers = values[0] as string[];
  const rows = values.slice(1) as string[][];
  return { headers, rows };
}

export async function updateSheetCells(
  updates: { range: string; value: string }[],
): Promise<void> {
  if (updates.length === 0) return;

  const sheets = getSheets();
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: updates.map((u) => ({
        range: `${SHEET_NAME}!${u.range}`,
        values: [[u.value]],
      })),
    },
  });
}

/**
 * Find row number (1-based) for a given UniqueKey value.
 * Returns null if not found.
 */
export async function findRowByUniqueKey(
  uniqueKey: string,
): Promise<number | null> {
  const { headers, rows } = await readAllSheet();
  const ukIdx = headers.findIndex(
    (h) => h.toLowerCase().replace(/[_\s]/g, "") === "uniquekey",
  );
  if (ukIdx === -1) return null;

  for (let i = 0; i < rows.length; i++) {
    if (rows[i][ukIdx] === uniqueKey) {
      return i + 2; // +2 because header is row 1, data starts at row 2
    }
  }
  return null;
}

/**
 * Convert column index (0-based) to Sheets column letter (A, B, ..., Z, AA, ...)
 */
export function colIndexToLetter(idx: number): string {
  let letter = "";
  let n = idx;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}
