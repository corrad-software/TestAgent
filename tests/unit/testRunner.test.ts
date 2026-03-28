import { describe, it, expect } from "vitest";
import { buildSummary, PlaywrightJsonResults } from "../../src/testRunner";

describe("buildSummary", () => {
  it("formats all-pass results correctly", () => {
    const results: PlaywrightJsonResults = {
      stats: { expected: 5, unexpected: 0, duration: 3200 },
      suites: [{
        title: "Smoke Test",
        specs: [
          { title: "page loads", ok: true },
          { title: "has content", ok: true },
        ],
      }],
    };
    const summary = buildSummary(results);
    expect(summary).toContain("5/5 tests passed in 3.2s");
    expect(summary).toContain("✅ page loads");
    expect(summary).toContain("✅ has content");
  });

  it("formats mixed pass/fail results", () => {
    const results: PlaywrightJsonResults = {
      stats: { expected: 2, unexpected: 1, duration: 5000 },
      suites: [{
        title: "Test",
        specs: [
          { title: "passes", ok: true },
          { title: "fails", ok: false },
        ],
      }],
    };
    const summary = buildSummary(results);
    expect(summary).toContain("2/3 tests passed in 5.0s");
    expect(summary).toContain("✅ passes");
    expect(summary).toContain("❌ fails");
  });

  it("handles zero tests", () => {
    const results: PlaywrightJsonResults = {
      stats: { expected: 0, unexpected: 0, duration: 0 },
      suites: [],
    };
    const summary = buildSummary(results);
    expect(summary).toContain("0/0 tests passed in 0.0s");
  });

  it("walks nested suites", () => {
    const results: PlaywrightJsonResults = {
      stats: { expected: 3, unexpected: 0, duration: 1500 },
      suites: [{
        title: "Outer",
        suites: [{
          title: "Inner",
          specs: [
            { title: "nested test", ok: true },
          ],
        }],
        specs: [
          { title: "outer test", ok: true },
        ],
      }],
    };
    const summary = buildSummary(results);
    expect(summary).toContain("✅ outer test");
    expect(summary).toContain("✅ nested test");
  });

  it("handles suites with no specs", () => {
    const results: PlaywrightJsonResults = {
      stats: { expected: 0, unexpected: 0, duration: 100 },
      suites: [{ title: "Empty" }],
    };
    const summary = buildSummary(results);
    expect(summary).toContain("0/0 tests passed");
  });
});
