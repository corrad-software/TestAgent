import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

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
  log("🤖 [AI] Analyzing recorded code and adding assertions...");

  const userPrompt = `Here is a recorded Playwright test spec for ${url}:

\`\`\`typescript
${code}
\`\`\`

${description ? `Context: ${description}` : ""}

Add expect() assertions after key actions to verify the page behaves correctly. Return the complete modified code.`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    system: ASSERTION_SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
  });

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
  log("🤖 [AI] Analyzing test failure...");

  // Extract relevant error lines
  const errorLines = logs.split("\n")
    .filter(l => l.includes("❌") || l.includes("Error") || l.includes("failed") || l.includes("[stderr]"))
    .slice(0, 15)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    system: "You explain test failures to beginners. Be concise, friendly, and practical in 3-5 sentences. Focus on what the user can fix.",
    messages: [{ role: "user", content: `Playwright test failed on ${url}.\nSummary: ${summary}\n\nError details:\n${errorLines || summary}\n\nExplain what went wrong and how to fix it.` }],
  });

  const textBlock = response.content.find(b => b.type === "text");
  return textBlock?.type === "text" ? textBlock.text.trim() : "Could not analyze the failure.";
}
