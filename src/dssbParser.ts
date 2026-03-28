import * as XLSX from "xlsx";

export interface DssbTestCase {
  sheetName: string;
  subModule: string;
  useCase: string;
  testCaseId: string;
  scenarioId: string;
  flow: string;       // Positif / Negatif
  summary: string;
  testSteps: string;
  expected: string;
  actor: string;
}

export interface DssbParseResult {
  projectName: string;
  scenarioTitle: string;
  url: string;
  credentials: { role: string; name: string; userId: string; password: string }[];
  testCases: DssbTestCase[];
}

export function isDssbFormat(workbook: XLSX.WorkBook): boolean {
  // Detect DSSB format: has a "URL" sheet or sheets named "Senario ..."
  // AND at least one sheet with rows starting with "TC-" in column 1
  const hasUrlSheet = workbook.SheetNames.some(n => n.toLowerCase() === "url");
  const hasSenarioSheet = workbook.SheetNames.some(n => /senario/i.test(n));
  if (!hasUrlSheet && !hasSenarioSheet) return false;
  for (const name of workbook.SheetNames) {
    if (/senario/i.test(name) || (!hasUrlSheet && name !== "URL")) {
      const rows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[name], { header: 1, defval: "" });
      for (const row of rows) {
        if (String(row[1] ?? "").startsWith("TC-")) return true;
      }
    }
  }
  return false;
}

export function parseDssbWorkbook(workbook: XLSX.WorkBook): DssbParseResult {
  let projectName = "";
  let scenarioTitle = "";
  let url = "";
  const credentials: { role: string; name: string; userId: string; password: string }[] = [];

  // Parse URL sheet for metadata & credentials
  if (workbook.SheetNames.includes("URL")) {
    const rows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets["URL"], { header: 1, defval: "" });
    for (const row of rows) {
      const c1 = String(row[1] ?? "");
      if (c1.startsWith("Nama Projek:")) projectName = c1.replace("Nama Projek:", "").trim();
      if (c1.startsWith("Senario :") || c1.startsWith("Senario:")) scenarioTitle = c1.replace(/^Senario\s*:\s*/, "").trim();
      if (String(row[0] ?? "").toLowerCase().includes("link")) url = String(row[1] ?? "").trim();
      // Parse credential blocks (multi-line cells with Nama/Peranan/id pengguna/password)
      for (const cell of row) {
        const s = String(cell ?? "");
        if (s.includes("Peranan") && s.includes("id pengguna")) {
          const nameM = s.match(/Nama\s*:\s*(.+)/);
          const roleM = s.match(/Peranan\s*:\s*(.+)/);
          const userM = s.match(/id pengguna\s*:\s*(.+)/);
          const passM = s.match(/password\s*:\s*(.+)/i);
          if (roleM && userM) {
            credentials.push({
              role: roleM[1].trim(),
              name: nameM?.[1]?.trim() ?? "",
              userId: userM[1].trim(),
              password: passM?.[1]?.trim() ?? "",
            });
          }
        }
      }
    }
  }

  // Parse scenario sheets for test cases
  const testCases: DssbTestCase[] = [];
  const scenarioSheets = workbook.SheetNames.filter(n =>
    n.toLowerCase() !== "url" && n.toLowerCase() !== "nota" && !n.toLowerCase().includes("pengesahan")
  );

  for (const sheetName of scenarioSheets) {
    const rows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[sheetName], { header: 1, defval: "" });
    let currentSubModule = "";
    let currentUseCase = "";
    let currentActor = "";

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const c1 = String(row[1] ?? "").trim();
      const c2 = String(row[2] ?? "").trim();

      // Sub-module header (starts with "5.1")
      if (c1.match(/^5\.\d/)) {
        currentSubModule = c1.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
      }
      // Use case description
      if (c1 === "Keterangan Use Case:" || c1.startsWith("Keterangan Use Case:")) {
        currentUseCase = c2.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
      }
      // Scenario row with actor (ID Senario row that has actor info)
      if (c1.startsWith("SR-") && String(row[7] ?? "").trim()) {
        currentActor = String(row[7] ?? "").trim();
      }
      // Test case rows
      if (c1.startsWith("TC-")) {
        testCases.push({
          sheetName,
          subModule: currentSubModule,
          useCase: currentUseCase,
          testCaseId: c1,
          scenarioId: c2,
          flow: String(row[3] ?? "").trim(),
          summary: String(row[4] ?? "").replace(/\r?\n/g, " ").trim(),
          testSteps: String(row[5] ?? "").trim(),
          expected: String(row[6] ?? "").trim(),
          actor: currentActor,
        });
      }
    }
  }

  if (!projectName) projectName = scenarioTitle || "Imported Project";
  return { projectName, scenarioTitle, url, credentials, testCases };
}
