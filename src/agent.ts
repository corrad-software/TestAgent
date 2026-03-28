import Anthropic from "@anthropic-ai/sdk";
import { Page } from "playwright";
import { toolDefinitions, executeTool } from "./tools";
import { SYSTEM_PROMPT } from "./prompts";
import { Reporter } from "./reporter";

const client = new Anthropic();

const MAX_ITERATIONS = 20;

export interface AgentResult {
  passed: boolean;
  summary: string;
  steps: string[];
  claudeSummary?: string;
  reportId?: string;
}

export async function runAgent(
  page: Page,
  goal: string,
  onLog?: (msg: string) => void,
  options?: {
    systemPrompt?: string;
    maxIterations?: number;
    reporter?: Reporter;
  }
): Promise<AgentResult> {
  const log = (msg: string) => {
    console.log(msg);
    onLog?.(msg);
  };

  const systemPrompt = options?.systemPrompt ?? SYSTEM_PROMPT;
  const maxIterations = options?.maxIterations ?? MAX_ITERATIONS;

  log(`🤖 Agent starting — Goal: ${goal}`);

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: goal },
  ];

  const steps: string[] = [];
  let passed = false;
  let summary = "Agent did not complete";

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      tools: toolDefinitions,
      messages,
    });

    // Push assistant response into conversation
    messages.push({ role: "assistant", content: response.content });

    // Collect tool uses from the response
    const toolUses = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );

    // Print any reasoning text from Claude
    for (const text of textBlocks) {
      if (text.text.trim()) {
        log(`💬 Claude: ${text.text.trim()}`);
      }
    }

    // If no tool use → Claude is done
    if (response.stop_reason === "end_turn" || toolUses.length === 0) {
      const lastText = textBlocks.map((b) => b.text).join("\n").trim();
      summary = lastText || "Agent finished without a summary";
      passed = summary.toLowerCase().includes("pass");
      break;
    }

    // Execute all tool calls and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUses) {
      const input = toolUse.input as Record<string, unknown>;
      console.log(`🔧 Tool: ${toolUse.name}`, JSON.stringify(input));

      const stepIdx = options?.reporter?.startStep(toolUse.name, input) ?? -1;
      const result = await executeTool(page, toolUse.name, input, {
        reportId: options?.reporter?.id,
        screenshotIndex: stepIdx,
      });
      if (stepIdx >= 0) options?.reporter?.endStep(stepIdx, result);

      const stepLog = `[${result.success ? "✅" : "❌"}] ${toolUse.name}: ${result.output}`;
      steps.push(stepLog);
      log(stepLog);

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: result.output,
        is_error: !result.success,
      });
    }

    // Feed tool results back to Claude
    messages.push({ role: "user", content: toolResults });
  }

  return {
    passed,
    summary,
    steps,
    claudeSummary: summary,
    reportId: options?.reporter?.id,
  };
}
