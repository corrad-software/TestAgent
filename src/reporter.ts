import fs from "fs/promises";
import path from "path";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StepRecord {
  index: number;
  tool: string;
  input: Record<string, unknown>;
  output: string;
  success: boolean;
  screenshotPath?: string;
  screenshotBase64?: string;
  durationMs: number;
  timestamp: string;
}

export interface IssueRecord {
  severity: "error" | "warning";
  message: string;
  stepIndex?: number;
}

export interface TestReport {
  id: string;
  url: string;
  testType: string;
  description?: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  passed: boolean;
  summary: string;
  claudeSummary?: string;
  steps: StepRecord[];
  issues: IssueRecord[];
  screenshotPaths: string[];
}

// ─── Reporter ─────────────────────────────────────────────────────────────────

export function createReporter(params: {
  url: string;
  testType: string;
  description?: string;
}): Reporter {
  return new Reporter(params);
}

export class Reporter {
  readonly id: string;
  private url: string;
  private testType: string;
  private description?: string;
  private startedAt: string;
  private steps: StepRecord[] = [];
  private stepStartTimes: Map<number, number> = new Map();

  constructor(params: { url: string; testType: string; description?: string }) {
    const now = new Date();
    // Format: YYYYMMDD-HHMMSS-testtype
    const pad = (n: number) => String(n).padStart(2, "0");
    this.id = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${params.testType}`;
    this.url = params.url;
    this.testType = params.testType;
    this.description = params.description;
    this.startedAt = now.toISOString();
  }

  startStep(tool: string, input: Record<string, unknown>): number {
    const index = this.steps.length;
    this.stepStartTimes.set(index, Date.now());
    // Push a placeholder — we'll update it in endStep
    this.steps.push({
      index,
      tool,
      input,
      output: "",
      success: false,
      durationMs: 0,
      timestamp: new Date().toISOString(),
    });
    return index;
  }

  endStep(
    stepIndex: number,
    result: {
      success: boolean;
      output: string;
      screenshotPath?: string;
      screenshotBase64?: string;
    }
  ): void {
    const startTime = this.stepStartTimes.get(stepIndex) ?? Date.now();
    const step = this.steps[stepIndex];
    if (step) {
      step.output = result.output;
      step.success = result.success;
      step.durationMs = Date.now() - startTime;
      step.screenshotPath = result.screenshotPath;
      step.screenshotBase64 = result.screenshotBase64;
    }
  }

  finish(passed: boolean, summary: string, claudeSummary?: string): TestReport {
    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - new Date(this.startedAt).getTime();

    // Extract issues from failed steps
    const issues: IssueRecord[] = this.steps
      .filter((s) => !s.success)
      .map((s) => ({
        severity: "error" as const,
        message: s.output.slice(0, 200),
        stepIndex: s.index,
      }));

    const screenshotPaths = this.steps
      .filter((s) => s.screenshotPath)
      .map((s) => s.screenshotPath!);

    return {
      id: this.id,
      url: this.url,
      testType: this.testType,
      description: this.description,
      startedAt: this.startedAt,
      completedAt,
      durationMs,
      passed,
      summary,
      claudeSummary,
      steps: this.steps,
      issues,
      screenshotPaths,
    };
  }

  async save(report: TestReport): Promise<{ jsonPath: string; htmlPath: string }> {
    const dir = path.join(process.cwd(), "reports");
    await fs.mkdir(dir, { recursive: true });

    const jsonPath = path.join(dir, `${report.id}.json`);
    const htmlPath = path.join(dir, `${report.id}.html`);

    await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));
    await fs.writeFile(htmlPath, generateHtmlReport(report));

    return { jsonPath, htmlPath };
  }
}

// ─── HTML Generator ───────────────────────────────────────────────────────────

function generateHtmlReport(report: TestReport): string {
  const passColor = report.passed ? "#16a34a" : "#dc2626";
  const passBg = report.passed ? "#052e16" : "#2d0a0a";
  const passLabel = report.passed ? "PASS" : "FAIL";
  const passIcon = report.passed ? "✅" : "❌";

  const duration = (report.durationMs / 1000).toFixed(1);
  const date = new Date(report.startedAt).toLocaleString();

  const suiteLabels: Record<string, string> = {
    smoke: "Smoke Test",
    navigation: "Navigation Test",
    forms: "Form Test",
    responsive: "Responsive Test",
    accessibility: "Accessibility Test",
    quick: "Quick Check",
  };

  // Steps table rows
  const stepsRows = report.steps
    .map((step) => {
      const statusIcon = step.success ? "✅" : "❌";
      const inputStr = JSON.stringify(step.input).slice(0, 80);
      const outputStr = step.output
        .slice(0, 120)
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      const thumb = step.screenshotBase64
        ? `<img src="data:image/png;base64,${step.screenshotBase64}" style="width:80px;height:50px;object-fit:cover;border-radius:4px;" />`
        : "";
      return `
      <tr id="step-${step.index}" style="border-bottom:1px solid #1e293b">
        <td style="padding:8px 12px;color:#64748b;font-size:12px">${step.index + 1}</td>
        <td style="padding:8px 12px;font-size:12px">${statusIcon}</td>
        <td style="padding:8px 12px;color:#60a5fa;font-family:monospace;font-size:12px">${step.tool}</td>
        <td style="padding:8px 12px;color:#94a3b8;font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${inputStr}">${inputStr}</td>
        <td style="padding:8px 12px;color:${step.success ? "#4ade80" : "#f87171"};font-size:11px;max-width:250px">${outputStr}</td>
        <td style="padding:8px 12px;color:#64748b;font-size:11px">${step.durationMs}ms</td>
        <td style="padding:8px 12px">${thumb}</td>
      </tr>`;
    })
    .join("");

  // Issues list
  const issuesList =
    report.issues.length === 0
      ? `<p style="color:#64748b;font-style:italic">No issues found.</p>`
      : report.issues
          .map(
            (issue) => `
        <div style="background:#2d0a0a;border:1px solid #7f1d1d;border-radius:8px;padding:12px 16px;margin-bottom:8px">
          <span style="color:#f87171;font-size:12px">❌ ${issue.message.replace(/</g, "&lt;")}
          ${issue.stepIndex !== undefined ? ` <a href="#step-${issue.stepIndex}" style="color:#f97316;text-decoration:underline">→ Step ${issue.stepIndex + 1}</a>` : ""}</span>
        </div>`
          )
          .join("");

  // Screenshots gallery
  const screenshots = report.steps
    .filter((s) => s.screenshotBase64)
    .map(
      (s) => `
      <div style="text-align:center">
        <img src="data:image/png;base64,${s.screenshotBase64}" style="width:100%;border-radius:8px;border:1px solid #1e293b" />
        <p style="color:#64748b;font-size:11px;margin-top:6px">Step ${s.index + 1} — ${s.tool}</p>
      </div>`
    )
    .join("");

  const screenshotGallery = screenshots
    ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">${screenshots}</div>`
    : `<p style="color:#64748b;font-style:italic">No screenshots captured.</p>`;

  // Embed report data for export
  const reportJson = JSON.stringify(report)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TestAgent Report — ${report.url}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f1117; color: #e2e8f0; min-height: 100vh; padding: 32px 16px; }
    .container { max-width: 1100px; margin: 0 auto; }
    .card { background: #1a1f2e; border: 1px solid #1e293b; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
    h2 { font-size: 14px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid #1e293b; }
    a { color: #6366f1; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:36px;height:36px;background:#6366f1;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px">🤖</div>
        <div>
          <h1 style="font-size:18px;font-weight:700;color:#fff">TestAgent Report</h1>
          <p style="color:#64748b;font-size:13px">ID: ${report.id}</p>
        </div>
      </div>
      <button onclick="exportJson()" style="background:#1e293b;border:1px solid #334155;color:#cbd5e1;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px">⬇ Export JSON</button>
    </div>

    <!-- Summary card -->
    <div class="card">
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <div style="background:${passBg};border:1px solid ${passColor};border-radius:8px;padding:12px 24px;text-align:center;min-width:100px">
          <div style="font-size:28px">${passIcon}</div>
          <div style="font-size:16px;font-weight:700;color:${passColor};margin-top:4px">${passLabel}</div>
        </div>
        <div style="flex:1;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">
          <div><p style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.06em">URL</p><p style="font-size:13px;color:#e2e8f0;word-break:break-all">${report.url}</p></div>
          <div><p style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Test Type</p><p style="font-size:13px;color:#a78bfa">${suiteLabels[report.testType] ?? report.testType}</p></div>
          <div><p style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Date</p><p style="font-size:13px;color:#e2e8f0">${date}</p></div>
          <div><p style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Duration</p><p style="font-size:13px;color:#e2e8f0">${duration}s</p></div>
          <div><p style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Steps</p><p style="font-size:13px;color:#e2e8f0">${report.steps.length}</p></div>
          <div><p style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Issues</p><p style="font-size:13px;color:${report.issues.length > 0 ? "#f87171" : "#4ade80"}">${report.issues.length}</p></div>
        </div>
      </div>
      ${report.summary ? `<div style="margin-top:16px;padding-top:16px;border-top:1px solid #1e293b"><p style="color:#cbd5e1;font-size:14px;line-height:1.6">${report.summary.replace(/</g, "&lt;")}</p></div>` : ""}
      ${report.claudeSummary && report.claudeSummary !== report.summary ? `<div style="margin-top:12px"><p style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Claude's Analysis</p><p style="color:#94a3b8;font-size:13px;line-height:1.6;white-space:pre-wrap">${report.claudeSummary.replace(/</g, "&lt;")}</p></div>` : ""}
    </div>

    <!-- Issues -->
    <div class="card">
      <h2>Issues (${report.issues.length})</h2>
      ${issuesList}
    </div>

    <!-- Steps table -->
    <div class="card" style="overflow-x:auto">
      <h2>Steps (${report.steps.length})</h2>
      <table>
        <thead><tr>
          <th>#</th><th>Status</th><th>Tool</th><th>Input</th><th>Output</th><th>Duration</th><th>Screenshot</th>
        </tr></thead>
        <tbody style="color:#e2e8f0">${stepsRows}</tbody>
      </table>
    </div>

    <!-- Screenshots gallery -->
    <div class="card">
      <h2>Screenshots (${report.screenshotPaths.length})</h2>
      ${screenshotGallery}
    </div>
  </div>

  <script id="report-data" type="application/json">${reportJson}</script>
  <script>
    function exportJson() {
      const data = document.getElementById('report-data').textContent;
      const blob = new Blob([data], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '${report.id}.json';
      a.click();
    }
  </script>
</body>
</html>`;
}
