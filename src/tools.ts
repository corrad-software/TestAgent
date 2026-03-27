import { Page } from "playwright";
import Anthropic from "@anthropic-ai/sdk";

// ─── Tool Schemas (sent to Claude) ───────────────────────────────────────────

export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: "navigate",
    description: "Navigate the browser to a URL",
    input_schema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "The URL to navigate to" },
      },
      required: ["url"],
    },
  },
  {
    name: "click",
    description: "Click on an element by CSS selector or visible text",
    input_schema: {
      type: "object" as const,
      properties: {
        selector: {
          type: "string",
          description:
            "CSS selector or text to click (e.g. 'button[type=submit]', 'text=Login')",
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "type",
    description: "Type text into an input field",
    input_schema: {
      type: "object" as const,
      properties: {
        selector: {
          type: "string",
          description: "CSS selector for the input field",
        },
        text: { type: "string", description: "Text to type" },
      },
      required: ["selector", "text"],
    },
  },
  {
    name: "get_page_content",
    description:
      "Get the current page URL and visible text content to understand the page state",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "wait_for_selector",
    description: "Wait for an element to appear on the page",
    input_schema: {
      type: "object" as const,
      properties: {
        selector: { type: "string", description: "CSS selector to wait for" },
        timeout: {
          type: "number",
          description: "Max wait time in milliseconds (default: 5000)",
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "assert_url",
    description: "Assert that the current URL contains an expected substring",
    input_schema: {
      type: "object" as const,
      properties: {
        expected: {
          type: "string",
          description: "The substring the URL should contain",
        },
      },
      required: ["expected"],
    },
  },
  {
    name: "assert_text_visible",
    description: "Assert that a specific text is visible on the current page",
    input_schema: {
      type: "object" as const,
      properties: {
        text: {
          type: "string",
          description: "The text that should be visible on the page",
        },
      },
      required: ["text"],
    },
  },
];

// ─── Tool Handlers (execute against Playwright) ───────────────────────────────

export type ToolResult = { success: boolean; output: string };

export async function executeTool(
  page: Page,
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case "navigate": {
        const url = toolInput.url as string;
        await page.goto(url, { waitUntil: "domcontentloaded" });
        return { success: true, output: `Navigated to ${url}` };
      }

      case "click": {
        const selector = toolInput.selector as string;
        if (selector.startsWith("text=")) {
          await page.getByText(selector.replace("text=", "")).first().click();
        } else {
          await page.click(selector);
        }
        await page.waitForLoadState("domcontentloaded");
        return { success: true, output: `Clicked on "${selector}"` };
      }

      case "type": {
        const selector = toolInput.selector as string;
        const text = toolInput.text as string;
        await page.fill(selector, text);
        return { success: true, output: `Typed "${text}" into "${selector}"` };
      }

      case "get_page_content": {
        const url = page.url();
        const title = await page.title();
        const bodyText = await page.evaluate(() =>
          document.body.innerText.slice(0, 2000)
        );
        const inputs = await page.evaluate(() =>
          Array.from(document.querySelectorAll("input, button, a")).map((el) => ({
            tag: el.tagName,
            type: (el as HTMLInputElement).type || "",
            name: (el as HTMLInputElement).name || "",
            id: el.id || "",
            text: el.textContent?.trim().slice(0, 50) || "",
          }))
        );
        return {
          success: true,
          output: JSON.stringify({ url, title, bodyText, inputs }, null, 2),
        };
      }

      case "wait_for_selector": {
        const selector = toolInput.selector as string;
        const timeout = (toolInput.timeout as number) ?? 5000;
        await page.waitForSelector(selector, { timeout });
        return { success: true, output: `Element "${selector}" is visible` };
      }

      case "assert_url": {
        const expected = toolInput.expected as string;
        const current = page.url();
        if (!current.includes(expected)) {
          return {
            success: false,
            output: `FAIL: Expected URL to contain "${expected}" but got "${current}"`,
          };
        }
        return {
          success: true,
          output: `PASS: URL contains "${expected}" (current: ${current})`,
        };
      }

      case "assert_text_visible": {
        const text = toolInput.text as string;
        const visible = await page.getByText(text).first().isVisible();
        if (!visible) {
          return {
            success: false,
            output: `FAIL: Text "${text}" is not visible on the page`,
          };
        }
        return { success: true, output: `PASS: Text "${text}" is visible` };
      }

      default:
        return { success: false, output: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    return {
      success: false,
      output: `ERROR in ${toolName}: ${(err as Error).message}`,
    };
  }
}
