import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { getAppSettings } from "./appSettings";

const client = new Anthropic();

// ─── Token usage tracking ────────────────────────────────────────────────────
const USAGE_PATH = path.join(process.cwd(), "data", "ai-usage.json");

interface UsageData {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  callCount: number;
}

// Pricing per model (per million tokens)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001":  { input: 0.80, output: 4.00 },
  "claude-sonnet-4-6":         { input: 3.00, output: 15.00 },
  "claude-opus-4-6":           { input: 15.00, output: 75.00 },
};

function getModelCost(model: string) {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING["claude-haiku-4-5-20251001"];
  return { input: pricing.input / 1_000_000, output: pricing.output / 1_000_000 };
}

function loadUsage(): UsageData {
  try {
    return JSON.parse(fs.readFileSync(USAGE_PATH, "utf-8"));
  } catch {
    return { totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0, callCount: 0 };
  }
}

function trackUsage(inputTokens: number, outputTokens: number, model: string) {
  const usage = loadUsage();
  const cost = getModelCost(model);
  usage.totalInputTokens += inputTokens;
  usage.totalOutputTokens += outputTokens;
  usage.totalCost += (inputTokens * cost.input) + (outputTokens * cost.output);
  usage.callCount += 1;
  try {
    fs.mkdirSync(path.dirname(USAGE_PATH), { recursive: true });
    fs.writeFileSync(USAGE_PATH, JSON.stringify(usage, null, 2));
  } catch { /* ignore write errors */ }
}

export function getUsage(): UsageData {
  return loadUsage();
}

const ASSERTION_SYSTEM = `You are a Playwright test expert. Your job is to add expect() assertions to recorded Playwright test code.

RULES:
1. Output ONLY the complete modified TypeScript code. No markdown fences, no explanations.
2. Keep ALL existing code exactly as-is. Only ADD new expect() lines after relevant actions.
3. Use web-first assertions: expect(locator).toBeVisible(), expect(locator).toHaveText(), expect(page).toHaveURL(), etc.
4. Add assertions for:
   - After navigation: expect(page).toHaveURL() or toHaveTitle()
   - After clicking: expect relevant element to be visible or changed
   - After filling forms: expect(input).toHaveValue()
   - After submit: expect success/error message to be visible
5. For negative tests (empty form, invalid data): add expect() for error messages or validation states
6. Add meaningful comments before assertions like: // Verify success message appears
7. Keep the test self-contained and valid TypeScript.`;

export async function enrichWithAssertions(
  code: string,
  url: string,
  description?: string,
  onLog?: (msg: string) => void,
): Promise<string> {
  const log = onLog ?? (() => {});
  const settings = await getAppSettings();
  const model = settings.model || "claude-haiku-4-5-20251001";
  log(`🤖 [AI] Analyzing recorded code and adding assertions (${model})...`);

  const userPrompt = `Here is a recorded Playwright test spec for ${url}:

\`\`\`typescript
${code}
\`\`\`

${description ? `Context: ${description}` : ""}

Add expect() assertions after key actions to verify the page behaves correctly. Return the complete modified code.`;

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: ASSERTION_SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
  });
  trackUsage(response.usage.input_tokens, response.usage.output_tokens, model);

  const textBlock = response.content.find(b => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("AI did not return a text response");
  }

  let enriched = textBlock.text.trim()
    .replace(/^```typescript\n?/m, "")
    .replace(/^```ts\n?/m, "")
    .replace(/^```\n?/m, "")
    .replace(/\n?```$/m, "")
    .trim();

  const originalLines = code.split("\n").length;
  const enrichedLines = enriched.split("\n").length;
  const addedLines = enrichedLines - originalLines;
  log(`✅ [AI] Added ${addedLines} assertion lines (${enrichedLines} total)`);

  return enriched;
}

export async function explainFailure(
  url: string,
  summary: string,
  logs: string,
  onLog?: (msg: string) => void,
): Promise<string> {
  const log = onLog ?? (() => {});
  const settings = await getAppSettings();
  const model = settings.model || "claude-haiku-4-5-20251001";
  log(`🤖 [AI] Analyzing test failure (${model})...`);

  // Extract relevant error lines
  const errorLines = logs.split("\n")
    .filter(l => l.includes("❌") || l.includes("Error") || l.includes("failed") || l.includes("[stderr]"))
    .slice(0, 15)
    .join("\n");

  const response = await client.messages.create({
    model,
    max_tokens: 500,
    system: "You explain test failures to beginners. Be concise, friendly, and practical in 3-5 sentences. Focus on what the user can fix.",
    messages: [{ role: "user", content: `Playwright test failed on ${url}.\nSummary: ${summary}\n\nError details:\n${errorLines || summary}\n\nExplain what went wrong and how to fix it.` }],
  });
  trackUsage(response.usage.input_tokens, response.usage.output_tokens, model);

  const textBlock = response.content.find(b => b.type === "text");
  return textBlock?.type === "text" ? textBlock.text.trim() : "Could not analyze the failure.";
}
