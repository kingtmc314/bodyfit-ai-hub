import { describe, expect, it } from "vitest";
import { normaliseServiceAccountKey, sheetRangeFor } from "./sheetsService";

describe("Google Sheets service compatibility", () => {
  it("quotes every sheet range and targets the connected Body tab", () => {
    expect(sheetRangeFor("body", "A:ZZ")).toBe("'Body'!A:ZZ");
    expect(sheetRangeFor("heartrate", "A2:A")).toBe("'Heart Rate'!A2:A");
    expect(sheetRangeFor("sleep", "A1:ZZ1")).toBe("'Sleep'!A1:ZZ1");
  });

  it("repairs space-stripped PKCS#8 service-account PEM separators", () => {
    const source = "-----BEGINPRIVATEKEY-----\nabc\n-----ENDPRIVATEKEY-----";
    expect(normaliseServiceAccountKey(source)).toBe("-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----");
  });
});
