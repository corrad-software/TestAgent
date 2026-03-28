import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function explainFailure(
  url: string,
  testType: string,
  summary: string,
  steps: string[],
  onChunk: (text: string) => void
): Promise<void> {
  const failedSteps = steps
    .filter(s => s.includes("❌") || s.includes("failed") || s.includes("[stderr]") || s.includes("Error"))
    .slice(0, 10);

  const prompt = `A Playwright test just failed on: ${url}
Test type: ${testType}
Summary: ${summary}

What went wrong:
${failedSteps.length > 0 ? failedSteps.join("\n") : summary}

Explain in 3–5 plain sentences:
1. What failed and why it likely happened
2. What the user should check or fix

Keep it simple — the user has no testing experience. Be friendly and specific.`;

  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 400,
    system: "You explain test failures to beginners. Be concise, friendly, and practical. Avoid technical jargon. Focus on what the user can actually do to fix it.",
    messages: [{ role: "user", content: prompt }],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      onChunk(event.delta.text);
    }
  }
}
