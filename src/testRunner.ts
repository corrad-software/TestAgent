import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";

export interface RunnerResult {
  passed: boolean;
  exitCode: number;
  reportUrl: string;
  summary: string;
  steps: string[];
  screenshotUrl?: string;
}

export interface TestRunnerOptions {
  specPath: string;
  runId: string;
  onLog: (msg: string) => void;
}

export async function runPlaywrightTest(options: TestRunnerOptions): Promise<RunnerResult> {
  const { specPath, runId, onLog } = options;
  const cwd = process.cwd();

  const reportDirAbs = path.join(cwd, "playwright-reports", runId).replace(/\\/g, "/");
  const jsonResultsPath = path.join(cwd, "test-results", "results.json");

  try { await fs.rm(jsonResultsPath, { force: true }); } catch { /* ok */ }

  const steps: string[] = [];
  const log = (msg: string) => { steps.push(msg); onLog(msg); };

  const basename = path.basename(specPath);
  log(`🔧 Running: npx playwright test ${basename} [headless]`);

  // Write a per-run config so testDir is locked to generated-tests and
  // the reporter output path is set correctly. This avoids all CLI
  // pattern-matching issues across different Playwright versions.
  const tmpConfigPath = path.join(cwd, `pw-run-${runId}.config.ts`);
  const jsonOutputPath = path.join(cwd, "test-results", "results.json").replace(/\\/g, "/");

  await fs.writeFile(tmpConfigPath, `import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./generated-tests",
  retries: 0,
  workers: 1,
  timeout: 60_000,
  reporter: [
    ["line"],
    ["html", { outputFolder: ${JSON.stringify(reportDirAbs)}, open: "never" }],
    ["json", { outputFile: ${JSON.stringify(jsonOutputPath)} }],
  ],
  use: {
    headless: true,
    screenshot: "on",
    trace: "on-first-retry",
    video: "on-first-retry",
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
`);

  // Pass the basename — with testDir pointing at generated-tests, Playwright
  // matches it correctly without any path ambiguity.
  const args = ["playwright", "test", "--config", tmpConfigPath, basename];

  const exitCode = await new Promise<number>((resolve) => {
    const proc = spawn("npx", args, {
      cwd,
      shell: true,
      env: { ...process.env, FORCE_COLOR: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdoutBuf = "";
    proc.stdout.on("data", (chunk: Buffer) => {
      stdoutBuf += chunk.toString();
      const lines = stdoutBuf.split("\n");
      stdoutBuf = lines.pop() ?? "";
      for (const line of lines) { if (line.trim()) log(line); }
    });

    let stderrBuf = "";
    proc.stderr.on("data", (chunk: Buffer) => {
      stderrBuf += chunk.toString();
      const lines = stderrBuf.split("\n");
      stderrBuf = lines.pop() ?? "";
      for (const line of lines) { if (line.trim()) log(`[stderr] ${line}`); }
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

  await fs.rm(tmpConfigPath, { force: true }).catch(() => {});
  await fs.rm(specPath, { force: true }).catch(() => {});

  const passed = exitCode === 0;
  let summary = passed ? "All tests passed" : "One or more tests failed";
  let screenshotUrl: string | undefined;

  try {
    const jsonRaw = await fs.readFile(jsonResultsPath, "utf-8");
    const jsonResults = JSON.parse(jsonRaw) as PlaywrightJsonResults;
    summary = buildSummary(jsonResults);
    screenshotUrl = await collectScreenshot(jsonResults, reportDirAbs, runId);
  } catch { /* use default summary */ }

  return {
    passed,
    exitCode,
    reportUrl: `/playwright-report/${runId}`,
    summary,
    steps,
    screenshotUrl,
  };
}

async function collectScreenshot(
  results: PlaywrightJsonResults,
  reportDirAbs: string,
  runId: string,
): Promise<string | undefined> {
  const paths: string[] = [];
  function walkSuite(suite: PlaywrightSuite) {
    for (const spec of suite.specs ?? []) {
      for (const result of spec.tests?.[0]?.results ?? []) {
        for (const att of result.attachments ?? []) {
          if (att.contentType === "image/png" && att.path) paths.push(att.path);
        }
      }
    }
    for (const child of suite.suites ?? []) walkSuite(child);
  }
  for (const suite of results.suites) walkSuite(suite);

  if (!paths.length) return undefined;

  // Prefer failure screenshot; fall back to last (final state)
  const src = paths.find(p => p.includes("failed")) ?? paths[paths.length - 1];
  const dest = path.join(reportDirAbs, "screenshot.jpg");
  try {
    await fs.mkdir(reportDirAbs, { recursive: true });
    await compressScreenshot(src, dest);
    return `/playwright-report/${runId}/screenshot.jpg`;
  } catch {
    return undefined;
  }
}

async function compressScreenshot(src: string, dest: string): Promise<void> {
  const sharp = (await import("sharp")).default;
  // Start at quality 80, reduce until under 100 KB
  const TARGET_BYTES = 100 * 1024;
  for (const quality of [80, 65, 50, 35]) {
    const buf = await sharp(src)
      .resize({ width: 1280, withoutEnlargement: true })
      .jpeg({ quality, progressive: true })
      .toBuffer();
    if (buf.length <= TARGET_BYTES || quality === 35) {
      await fs.writeFile(dest, buf);
      return;
    }
  }
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
  tests?: Array<{
    results?: Array<{
      attachments?: Array<{ name: string; contentType: string; path?: string }>;
    }>;
  }>;
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
