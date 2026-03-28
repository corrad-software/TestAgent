import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";

export interface RunnerResult {
  passed: boolean;
  exitCode: number;
  reportUrl: string;
  summary: string;
  steps: string[];
}

export interface TestRunnerOptions {
  specPath: string;
  runId: string;
  onLog: (msg: string) => void;
  headed?: boolean;
}

export async function runPlaywrightTest(options: TestRunnerOptions): Promise<RunnerResult> {
  const { specPath, runId, onLog, headed } = options;
  const cwd = process.cwd();

  const reportDirRelative = `playwright-reports/${runId}`;
  const jsonResultsPath = path.join(cwd, "test-results", "results.json");

  // Remove stale JSON results
  try { await fs.rm(jsonResultsPath, { force: true }); } catch { /* ok */ }

  const steps: string[] = [];
  const log = (msg: string) => { steps.push(msg); onLog(msg); };

  const modeLabel = headed ? "headed (visible browser)" : "headless";
  log(`🔧 Running: npx playwright test ${path.basename(specPath)} [${modeLabel}]`);

  const args = ["playwright", "test", specPath];
  if (headed) args.push("--headed");

  const exitCode = await new Promise<number>((resolve) => {
    const proc = spawn("npx", args, {
      cwd,
      env: {
        ...process.env,
        PW_HTML_REPORT: reportDirRelative,
        FORCE_COLOR: "0",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdoutBuf = "";
    proc.stdout.on("data", (chunk: Buffer) => {
      stdoutBuf += chunk.toString();
      const lines = stdoutBuf.split("\n");
      stdoutBuf = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) log(line);
      }
    });

    let stderrBuf = "";
    proc.stderr.on("data", (chunk: Buffer) => {
      stderrBuf += chunk.toString();
      const lines = stderrBuf.split("\n");
      stderrBuf = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) log(`[stderr] ${line}`);
      }
    });

    proc.on("close", (code) => {
      if (stdoutBuf.trim()) log(stdoutBuf.trim());
      if (stderrBuf.trim()) log(`[stderr] ${stderrBuf.trim()}`);
      resolve(code ?? 1);
    });

    proc.on("error", (err) => {
      log(`[runner error] ${err.message}`);
      resolve(1);
    });
  });

  const passed = exitCode === 0;
  let summary = passed ? "All tests passed" : "One or more tests failed";

  try {
    const jsonRaw = await fs.readFile(jsonResultsPath, "utf-8");
    const jsonResults = JSON.parse(jsonRaw) as PlaywrightJsonResults;
    summary = buildSummary(jsonResults);
  } catch { /* use default summary */ }

  return {
    passed,
    exitCode,
    reportUrl: `/playwright-report/${runId}`,
    summary,
    steps,
  };
}

// ─── Playwright JSON result types ─────────────────────────────────────────────

export interface PlaywrightJsonResults {
  stats: { expected: number; unexpected: number; duration: number };
  suites: PlaywrightSuite[];
}

export interface PlaywrightSuite {
  title: string;
  suites?: PlaywrightSuite[];
  specs?: PlaywrightSpec[];
}

export interface PlaywrightSpec {
  title: string;
  ok: boolean;
}

export function buildSummary(results: PlaywrightJsonResults): string {
  const { expected, unexpected, duration } = results.stats;
  const total = expected + unexpected;
  const durationSec = (duration / 1000).toFixed(1);

  const lines: string[] = [];
  function walkSuite(suite: PlaywrightSuite) {
    for (const spec of suite.specs ?? []) {
      lines.push(`${spec.ok ? "✅" : "❌"} ${spec.title}`);
    }
    for (const child of suite.suites ?? []) walkSuite(child);
  }
  for (const suite of results.suites) walkSuite(suite);

  const header = `${expected}/${total} tests passed in ${durationSec}s`;
  return lines.length > 0 ? `${header}\n${lines.join("\n")}` : header;
}
