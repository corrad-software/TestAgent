// ─── Convert structured TestSteps to a Playwright spec ──────────────────────
import type { TestStep } from "./scenarioLibrary";

export function stepsToPlaywrightSpec(
  steps: TestStep[],
  scenarioName: string,
  baseUrl: string,
): string {
  const lines: string[] = [];

  lines.push(`import { test, expect } from '@playwright/test';`);
  lines.push(``);
  lines.push(`test.describe('${escStr(scenarioName)}', () => {`);
  lines.push(`  test('execute test steps', async ({ page }) => {`);
  lines.push(`    // Navigate to base URL`);
  lines.push(`    await page.goto(${JSON.stringify(baseUrl)});`);
  lines.push(``);

  for (const step of steps) {
    const comment = step.description ? `    // ${step.description}\n` : "";
    lines.push(comment + stepToCode(step));
  }

  lines.push(`    await page.screenshot({ path: 'test-results/steps-final.png' });`);
  lines.push(`  });`);
  lines.push(`});`);

  return lines.join("\n");
}

function stepToCode(step: TestStep): string {
  const t = step.target ? step.target : "";
  const v = step.input ?? "";
  const indent = "    ";

  switch (step.action) {
    case "navigate":
      return `${indent}await page.goto(${JSON.stringify(v || t)});`;

    case "click":
      return `${indent}await page.locator(${JSON.stringify(t)}).click();`;

    case "fill":
      return `${indent}await page.locator(${JSON.stringify(t)}).fill(${JSON.stringify(v)});`;

    case "select":
      return `${indent}await page.locator(${JSON.stringify(t)}).selectOption(${JSON.stringify(v)});`;

    case "check":
      return `${indent}await page.locator(${JSON.stringify(t)}).check();`;

    case "uncheck":
      return `${indent}await page.locator(${JSON.stringify(t)}).uncheck();`;

    case "hover":
      return `${indent}await page.locator(${JSON.stringify(t)}).hover();`;

    case "wait":
      return `${indent}await page.waitForTimeout(${parseInt(v) || 1000});`;

    case "screenshot":
      return `${indent}await page.screenshot({ path: ${JSON.stringify(v || "test-results/step-screenshot.png")} });`;

    case "assert_visible":
      return `${indent}await expect(page.locator(${JSON.stringify(t)})).toBeVisible();`;

    case "assert_text":
      return `${indent}await expect(page.locator(${JSON.stringify(t)})).toContainText(${JSON.stringify(v)});`;

    case "assert_url":
      return `${indent}await expect(page).toHaveURL(${JSON.stringify(v || t)});`;

    case "custom":
      return `${indent}${v || `// Custom step: ${step.description ?? "TODO"}`}`;

    default:
      return `${indent}// Unknown action: ${step.action}`;
  }
}

function escStr(s: string): string {
  return s.replace(/'/g, "\\'");
}
