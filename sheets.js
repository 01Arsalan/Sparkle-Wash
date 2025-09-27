import { google } from "googleapis";

let sheetsClient;

export async function initSheets() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        type: "service_account",
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_ID,
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const client = await auth.getClient();
    sheetsClient = google.sheets({ version: "v4", auth: client });
    console.log("✅ Google Sheets initialized.");
  } catch (err) {
    console.error("❌ Error initializing Google Sheets:", err);
  }
}

export async function appendRow(values) {
  if (!sheetsClient) {
    throw new Error("Sheets client not initialized.");
  }

  const sheetId = process.env.SHEET_ID;
  const range = "Sheet1!A:Z"; // change if your sheet/tab name differs

  await sheetsClient.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });
}
