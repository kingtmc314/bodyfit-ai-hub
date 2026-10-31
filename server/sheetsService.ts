import { google } from "googleapis";

const SPREADSHEET_ID = "16MzWHNx9Njww8Ml3eq5tJEspmSkHcWxmaI9I5xTqsEU";

// Sheet tab names matching kingsrunai Body Fitness data naming convention
const SHEET_TABS = {
  body: "Body Fitness",
  sleep: "Sleep",
  heartrate: "Heart Rate",
  running: "Running",
} as const;

// Column mappings for Body Fitness sheet (kingsrunai naming convention)
const BODY_COLUMNS = ["Date", "Weight (kg)", "BMI", "Body Fat %", "Fat Mass (kg)", "Muscle Mass (kg)", "BMR", "Visceral Fat", "Source", "Notes"];
const SLEEP_COLUMNS = ["Date", "Sleep Score", "Resting HR", "Body Battery", "Pulse Ox (%)", "Respiration", "HRV", "Quality", "Duration (h)", "Source"];
const HR_COLUMNS = ["Date", "Resting HR", "High HR", "HRV", "Source", "Notes"];
const RUNNING_COLUMNS = ["Date", "Running Type", "Route Type", "Running Shoes", "Distance (km)", "Duration (h)", "Duration (min)", "Duration (sec)", "Avg Pace", "Best Pace", "Avg HR", "Max HR", "Avg Cadence", "Max Cadence", "Avg Stride Length (m)", "Avg Vertical Ratio", "Vertical Oscillation (cm)", "Avg Ground Contact Time (ms)", "Calories", "Temperature (°C)", "Humidity (%)", "Notes"];

function getAuth() {
  const credJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set");
  const credentials = JSON.parse(credJson);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export async function readSheetData(type: keyof typeof SHEET_TABS): Promise<Record<string, unknown>[]> {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const sheetName = SHEET_TABS[type];

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) return [];

    const headers = rows[0].map((h: string) => String(h).trim());
    const data: Record<string, unknown>[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every((cell: string) => !cell)) continue;
      const obj: Record<string, unknown> = {};
      headers.forEach((header: string, idx: number) => {
        obj[header] = row[idx] ?? "";
      });

      // Normalize to internal field names
      if (type === "body") {
        data.push({
          date: String(obj["Date"] ?? ""),
          weight: parseFloat(String(obj["Weight (kg)"] ?? "")) || undefined,
          bmi: parseFloat(String(obj["BMI"] ?? "")) || undefined,
          bodyFatPct: parseFloat(String(obj["Body Fat %"] ?? "")) || undefined,
          fatMass: parseFloat(String(obj["Fat Mass (kg)"] ?? "")) || undefined,
          muscleMass: parseFloat(String(obj["Muscle Mass (kg)"] ?? "")) || undefined,
          bmr: parseFloat(String(obj["BMR"] ?? "")) || undefined,
          visceralFat: parseFloat(String(obj["Visceral Fat"] ?? "")) || undefined,
          notes: String(obj["Notes"] ?? "") || undefined,
          source: "sheets",
        });
      } else if (type === "sleep") {
        data.push({
          date: String(obj["Date"] ?? ""),
          score: parseFloat(String(obj["Sleep Score"] ?? "")) || undefined,
          restingHr: parseFloat(String(obj["Resting HR"] ?? "")) || undefined,
          bodyBattery: parseFloat(String(obj["Body Battery"] ?? "")) || undefined,
          pulseOx: parseFloat(String(obj["Pulse Ox (%)"] ?? "")) || undefined,
          respiration: parseFloat(String(obj["Respiration"] ?? "")) || undefined,
          hrv: parseFloat(String(obj["HRV"] ?? "")) || undefined,
          quality: String(obj["Quality"] ?? "") || undefined,
          duration: parseFloat(String(obj["Duration (h)"] ?? "")) || undefined,
          source: "sheets",
        });
      } else if (type === "heartrate") {
        data.push({
          date: String(obj["Date"] ?? ""),
          restingHr: parseFloat(String(obj["Resting HR"] ?? "")) || undefined,
          highHr: parseFloat(String(obj["High HR"] ?? "")) || undefined,
          hrv: parseFloat(String(obj["HRV"] ?? "")) || undefined,
          notes: String(obj["Notes"] ?? "") || undefined,
          source: "sheets",
        });
      }
    }

    return data.filter(d => d.date);
  } catch (err: any) {
    console.error(`[Sheets] readSheetData(${type}) error:`, err?.message);
    throw err;
  }
}

export async function writeRowToSheet(type: keyof typeof SHEET_TABS, rowData: Record<string, unknown>): Promise<void> {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const sheetName = SHEET_TABS[type];

    let values: (string | number | undefined)[];

    if (type === "body") {
      values = [
        String(rowData.date ?? ""),
        rowData.weight !== undefined ? Number(rowData.weight) : "",
        rowData.bmi !== undefined ? Number(rowData.bmi) : "",
        rowData.bodyFatPct !== undefined ? Number(rowData.bodyFatPct) : "",
        rowData.fatMass !== undefined ? Number(rowData.fatMass) : "",
        rowData.muscleMass !== undefined ? Number(rowData.muscleMass) : "",
        rowData.bmr !== undefined ? Number(rowData.bmr) : "",
        rowData.visceralFat !== undefined ? Number(rowData.visceralFat) : "",
        String(rowData.source ?? "app"),
        String(rowData.notes ?? ""),
      ];
    } else if (type === "sleep") {
      values = [
        String(rowData.date ?? ""),
        rowData.score !== undefined ? Number(rowData.score) : "",
        rowData.restingHr !== undefined ? Number(rowData.restingHr) : "",
        rowData.bodyBattery !== undefined ? Number(rowData.bodyBattery) : "",
        rowData.pulseOx !== undefined ? Number(rowData.pulseOx) : "",
        rowData.respiration !== undefined ? Number(rowData.respiration) : "",
        rowData.hrv !== undefined ? Number(rowData.hrv) : "",
        String(rowData.quality ?? ""),
        rowData.duration !== undefined ? Number(rowData.duration) : "",
        String(rowData.source ?? "app"),
      ];
    } else if (type === "heartrate") {
      values = [
        String(rowData.date ?? ""),
        rowData.restingHr !== undefined ? Number(rowData.restingHr) : "",
        rowData.highHr !== undefined ? Number(rowData.highHr) : "",
        rowData.hrv !== undefined ? Number(rowData.hrv) : "",
        String(rowData.source ?? "app"),
        String(rowData.notes ?? ""),
      ];
    } else {
      values = [
        String(rowData.date ?? ""),
        String(rowData.runningType ?? ""),
        String(rowData.routeType ?? ""),
        String(rowData.runningShoes ?? ""),
        rowData.distanceKm !== undefined ? Number(rowData.distanceKm) : "",
        rowData.hour !== undefined ? Number(rowData.hour) : "",
        rowData.minutes !== undefined ? Number(rowData.minutes) : "",
        rowData.second !== undefined ? Number(rowData.second) : "",
        String(rowData.averagePace ?? ""),
        String(rowData.bestPace ?? ""),
        rowData.averageHeartRate !== undefined ? Number(rowData.averageHeartRate) : "",
        rowData.maximumHeartRate !== undefined ? Number(rowData.maximumHeartRate) : "",
        rowData.averageCadence !== undefined ? Number(rowData.averageCadence) : "",
        rowData.maxCadence !== undefined ? Number(rowData.maxCadence) : "",
        rowData.avgStrideLengthM !== undefined ? Number(rowData.avgStrideLengthM) : "",
        rowData.avgVerticalRatio !== undefined ? Number(rowData.avgVerticalRatio) : "",
        rowData.verticalOscillationCm !== undefined ? Number(rowData.verticalOscillationCm) : "",
        rowData.avgGroundContactTimeMs !== undefined ? Number(rowData.avgGroundContactTimeMs) : "",
        rowData.calories !== undefined ? Number(rowData.calories) : "",
        rowData.temperature !== undefined ? Number(rowData.temperature) : "",
        rowData.humidity !== undefined ? Number(rowData.humidity) : "",
        String(rowData.notes ?? ""),
      ];
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:Z`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [values],
      },
    });
  } catch (err: any) {
    console.error(`[Sheets] writeRowToSheet(${type}) error:`, err?.message);
    throw err;
  }
}

export async function ensureSheetHeaders(type: keyof typeof SHEET_TABS): Promise<void> {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const sheetName = SHEET_TABS[type];

    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A1:Z1`,
      });
      const firstRow = response.data.values?.[0];
      if (firstRow && firstRow.length > 0) return;
    } catch {
      // The Running tab is created on demand, so a new app install can begin
      // synchronizing full running metrics without manual Sheet preparation.
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] },
      }).catch(() => undefined);
    }

    // Write headers
    const headers = type === "body" ? BODY_COLUMNS : type === "sleep" ? SLEEP_COLUMNS : type === "heartrate" ? HR_COLUMNS : RUNNING_COLUMNS;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [headers] },
    });
  } catch (err: any) {
    // Sheet tab may not exist yet — silently skip
    console.warn(`[Sheets] ensureSheetHeaders(${type}):`, err?.message);
  }
}
