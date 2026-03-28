import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { isDssbFormat, parseDssbWorkbook } from "../../src/dssbParser";

// Helper: build a workbook from sheet data
function makeWorkbook(sheets: Record<string, any[][]>): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const [name, data] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return wb;
}

describe("isDssbFormat", () => {
  it("returns true for workbook with URL sheet and TC- rows in Senario sheet", () => {
    const wb = makeWorkbook({
      URL: [["", "Nama Projek: Test"]],
      "Senario 1": [
        ["", "ID Kes Ujian", "ID Senario"],
        ["", "TC-TEST-01", "SR-TEST-01", "Positif", "Summary"],
      ],
    });
    expect(isDssbFormat(wb)).toBe(true);
  });

  it("returns true for workbook with Senario sheet only (no URL sheet)", () => {
    const wb = makeWorkbook({
      "Senario A": [
        ["", "header"],
        ["", "TC-X-01", "SR-X-01"],
      ],
    });
    expect(isDssbFormat(wb)).toBe(true);
  });

  it("returns false for plain flat Excel without Senario or URL sheets", () => {
    const wb = makeWorkbook({
      Sheet1: [
        ["Module", "Scenario Name", "URL"],
        ["Login", "Test login", "https://example.com"],
      ],
    });
    expect(isDssbFormat(wb)).toBe(false);
  });

  it("returns false for URL sheet but no TC- rows", () => {
    const wb = makeWorkbook({
      URL: [["", "Nama Projek: Test"]],
      "Senario 1": [
        ["", "No test cases here"],
      ],
    });
    expect(isDssbFormat(wb)).toBe(false);
  });
});

describe("parseDssbWorkbook", () => {
  it("extracts project name from URL sheet", () => {
    const wb = makeWorkbook({
      URL: [
        ["", "Nama Projek: My Project"],
        ["", "Senario : Login Flow"],
        ["Link:", "https://staging.example.com/"],
      ],
      "Senario 1": [],
    });
    const result = parseDssbWorkbook(wb);
    expect(result.projectName).toBe("My Project");
    expect(result.scenarioTitle).toBe("Login Flow");
    expect(result.url).toBe("https://staging.example.com/");
  });

  it("extracts credentials from multi-line cells", () => {
    const credCell = "Nama : John Doe\nPeranan : PRF_KAUNTER\nid pengguna : johnd\npassword : Pass123@";
    const wb = makeWorkbook({
      URL: [
        ["", "Nama Projek: Test"],
        ["", credCell],
      ],
      "Senario 1": [],
    });
    const result = parseDssbWorkbook(wb);
    expect(result.credentials).toHaveLength(1);
    expect(result.credentials[0]).toEqual({
      role: "PRF_KAUNTER",
      name: "John Doe",
      userId: "johnd",
      password: "Pass123@",
    });
  });

  it("extracts multiple credentials from different cells", () => {
    const cred1 = "Nama : User A\nPeranan : ADMIN\nid pengguna : usera\npassword : passA";
    const cred2 = "Nama : User B\nPeranan : TESTER\nid pengguna : userb\npassword : passB";
    const wb = makeWorkbook({
      URL: [
        ["", "Nama Projek: Test"],
        ["", cred1, cred2],
      ],
      "Senario 1": [],
    });
    const result = parseDssbWorkbook(wb);
    expect(result.credentials).toHaveLength(2);
    expect(result.credentials[0].userId).toBe("usera");
    expect(result.credentials[1].userId).toBe("userb");
  });

  it("extracts test cases from scenario sheets", () => {
    const wb = makeWorkbook({
      URL: [["", "Nama Projek: NAS"]],
      "Senario 1B": [
        ["", "5.1 Sub Modul Pendaftaran"],
        ["", "Keterangan Use Case:", "User registers via self-service"],
        ["", "SR-NAS-01-SU-01", "Main scenario", "", "", "", "", "Pemohon"],
        ["", "TC-NAS-01-SU-01", "SR-NAS-01-SU-01", "Positif", "Fill form and submit", "i. Login\nii. Fill form", "i. Success message"],
        ["", "TC-NAS-01-SA-01", "SR-NAS-01-SA-01", "Negatif", "Submit empty form", "i. Leave blank", "i. Error shown"],
      ],
    });
    const result = parseDssbWorkbook(wb);
    expect(result.testCases).toHaveLength(2);

    const tc1 = result.testCases[0];
    expect(tc1.testCaseId).toBe("TC-NAS-01-SU-01");
    expect(tc1.scenarioId).toBe("SR-NAS-01-SU-01");
    expect(tc1.flow).toBe("Positif");
    expect(tc1.summary).toBe("Fill form and submit");
    expect(tc1.actor).toBe("Pemohon");
    expect(tc1.sheetName).toBe("Senario 1B");
    expect(tc1.subModule).toContain("Sub Modul Pendaftaran");
    expect(tc1.useCase).toBe("User registers via self-service");

    const tc2 = result.testCases[1];
    expect(tc2.testCaseId).toBe("TC-NAS-01-SA-01");
    expect(tc2.flow).toBe("Negatif");
  });

  it("skips URL, Nota, and Pengesahan sheets when parsing test cases", () => {
    const wb = makeWorkbook({
      URL: [["", "Nama Projek: Test"]],
      Nota: [["", "TC-SHOULD-NOT-APPEAR", "SR-X"]],
      "PENGESAHAN PENGUJIAN": [["", "TC-ALSO-NOT", "SR-Y"]],
      "Senario 1": [
        ["", "TC-VALID-01", "SR-VALID-01", "Positif", "Valid test"],
      ],
    });
    const result = parseDssbWorkbook(wb);
    expect(result.testCases).toHaveLength(1);
    expect(result.testCases[0].testCaseId).toBe("TC-VALID-01");
  });

  it("uses fallback project name when Nama Projek is missing", () => {
    const wb = makeWorkbook({
      URL: [["", "Senario : Fallback Title"]],
      "Senario 1": [],
    });
    const result = parseDssbWorkbook(wb);
    expect(result.projectName).toBe("Fallback Title");
  });

  it("uses 'Imported Project' when no metadata at all", () => {
    const wb = makeWorkbook({
      "Senario 1": [
        ["", "TC-BARE-01", "SR-BARE-01", "Positif", "Bare test"],
      ],
    });
    const result = parseDssbWorkbook(wb);
    expect(result.projectName).toBe("Imported Project");
  });
});
