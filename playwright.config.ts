import { defineConfig, devices } from "@playwright/test";
import path from "path";

const htmlOutputDir = process.env.PW_HTML_REPORT
  ? path.resolve(process.cwd(), process.env.PW_HTML_REPORT)
  : path.resolve(process.cwd(), "playwright-report");

export default defineConfig({
  testDir: "./generated-tests",
  retries: 0,
  workers: 1,
  timeout: 60_000,

  reporter: [
    ["line"],
    ["html", { outputFolder: htmlOutputDir, open: "never" }],
    ["json", { outputFile: "test-results/results.json" }],
  ],

  use: {
    headless: true,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "on-first-retry",
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
