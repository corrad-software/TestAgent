import path from "path";
import fs from "fs/promises";
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
  {
    name: "hover",
    description: "Hover over an element by CSS selector",
    input_schema: {
      type: "object" as const,
      properties: {
        selector: {
          type: "string",
          description: "CSS selector for the element to hover over",
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "scroll_to",
    description:
      "Scroll to an element or to the bottom of the page if no selector is provided",
    input_schema: {
      type: "object" as const,
      properties: {
        selector: {
          type: "string",
          description:
            "CSS selector of the element to scroll into view. Omit to scroll to the bottom of the page.",
        },
      },
      required: [],
    },
  },
  {
    name: "double_click",
    description: "Double-click on an element by CSS selector",
    input_schema: {
      type: "object" as const,
      properties: {
        selector: {
          type: "string",
          description: "CSS selector for the element to double-click",
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "select_option",
    description: "Select an option from a <select> element",
    input_schema: {
      type: "object" as const,
      properties: {
        selector: {
          type: "string",
          description: "CSS selector for the <select> element",
        },
        value: {
          type: "string",
          description: "The value to select",
        },
      },
      required: ["selector", "value"],
    },
  },
  {
    name: "keyboard_press",
    description: "Press a keyboard key (e.g. Enter, Tab, Escape)",
    input_schema: {
      type: "object" as const,
      properties: {
        key: {
          type: "string",
          description:
            "Key to press (e.g. 'Enter', 'Tab', 'Escape', 'ArrowDown')",
        },
      },
      required: ["key"],
    },
  },
  {
    name: "screenshot",
    description: "Take a screenshot of the current page and save it as a PNG",
    input_schema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description:
            "Optional name for the screenshot file (default: 'screenshot')",
        },
      },
      required: [],
    },
  },
  {
    name: "get_attribute",
    description: "Get the value of an attribute on a DOM element",
    input_schema: {
      type: "object" as const,
      properties: {
        selector: {
          type: "string",
          description: "CSS selector for the element",
        },
        attribute: {
          type: "string",
          description: "Attribute name to retrieve (e.g. 'href', 'value')",
        },
      },
      required: ["selector", "attribute"],
    },
  },
  {
    name: "execute_js",
    description: "Execute arbitrary JavaScript in the browser page context",
    input_schema: {
      type: "object" as const,
      properties: {
        script: {
          type: "string",
          description: "JavaScript expression or statement(s) to evaluate",
        },
      },
      required: ["script"],
    },
  },
  {
    name: "wait_for_navigation",
    description: "Wait for the page network to become idle",
    input_schema: {
      type: "object" as const,
      properties: {
        timeout: {
          type: "number",
          description: "Max wait time in milliseconds (default: 10000)",
        },
      },
      required: [],
    },
  },
  {
    name: "set_viewport",
    description: "Set the browser viewport size",
    input_schema: {
      type: "object" as const,
      properties: {
        width: { type: "number", description: "Viewport width in pixels" },
        height: { type: "number", description: "Viewport height in pixels" },
      },
      required: ["width", "height"],
    },
  },
  {
    name: "check_accessibility",
    description:
      "Run axe-core accessibility checks on the current page and return violations",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "fill_form",
    description: "Fill multiple form fields in a single call",
    input_schema: {
      type: "object" as const,
      properties: {
        fields: {
          type: "array",
          description: "Array of {selector, value} pairs to fill",
          items: {
            type: "object",
            properties: {
              selector: { type: "string" },
              value: { type: "string" },
            },
            required: ["selector", "value"],
          },
        },
      },
      required: ["fields"],
    },
  },
];

// ─── Tool Handlers (execute against Playwright) ───────────────────────────────

export type ToolResult = {
  success: boolean;
  output: string;
  screenshotPath?: string;
  screenshotBase64?: string;
};

export async function executeTool(
  page: Page,
  toolName: string,
  toolInput: Record<string, unknown>,
  context?: { reportId?: string; screenshotIndex?: number }
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

      case "hover": {
        const selector = toolInput.selector as string;
        await page.hover(selector);
        await page.waitForLoadState("domcontentloaded");
        return { success: true, output: `Hovered over "${selector}"` };
      }

      case "scroll_to": {
        const selector = toolInput.selector as string | undefined;
        if (selector) {
          await page.locator(selector).scrollIntoViewIfNeeded();
          return { success: true, output: `Scrolled "${selector}" into view` };
        } else {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          return { success: true, output: "Scrolled to bottom of page" };
        }
      }

      case "double_click": {
        const selector = toolInput.selector as string;
        await page.dblclick(selector);
        await page.waitForLoadState("domcontentloaded");
        return { success: true, output: `Double-clicked on "${selector}"` };
      }

      case "select_option": {
        const selector = toolInput.selector as string;
        const value = toolInput.value as string;
        const selected = await page.selectOption(selector, value);
        return {
          success: true,
          output: `Selected "${selected.join(", ")}" in "${selector}"`,
        };
      }

      case "keyboard_press": {
        const key = toolInput.key as string;
        await page.keyboard.press(key);
        return { success: true, output: `Pressed key "${key}"` };
      }

      case "screenshot": {
        const name = (toolInput.name as string) ?? "screenshot";
        const reportId = context?.reportId ?? "manual";
        const idx = context?.screenshotIndex ?? 0;
        const screenshotsDir = path.join(process.cwd(), "reports", "screenshots");
        await fs.mkdir(screenshotsDir, { recursive: true });
        const filename = `${reportId}-${idx}-${name.replace(/[^a-z0-9]/gi, "_")}.png`;
        const screenshotPath = path.join(screenshotsDir, filename);
        const buffer = await page.screenshot({ path: screenshotPath, type: "png" });
        const screenshotBase64 = buffer.toString("base64");
        return {
          success: true,
          output: `Screenshot saved: ${filename}`,
          screenshotPath,
          screenshotBase64,
        };
      }

      case "get_attribute": {
        const selector = toolInput.selector as string;
        const attribute = toolInput.attribute as string;
        const value = await page.getAttribute(selector, attribute);
        return {
          success: true,
          output: value !== null ? value : "null",
        };
      }

      case "execute_js": {
        const script = toolInput.script as string;
        const result = await page.evaluate((s) => {
          // eslint-disable-next-line no-eval
          return eval(s);
        }, script);
        const output = JSON.stringify(result, null, 2);
        return { success: true, output: output.slice(0, 2000) };
      }

      case "wait_for_navigation": {
        const timeout = (toolInput.timeout as number) ?? 10000;
        await page.waitForLoadState("networkidle", { timeout });
        return { success: true, output: "Page reached network idle state" };
      }

      case "set_viewport": {
        const width = toolInput.width as number;
        const height = toolInput.height as number;
        await page.setViewportSize({ width, height });
        return {
          success: true,
          output: `Viewport set to ${width}x${height}`,
        };
      }

      case "check_accessibility": {
        await page.addScriptTag({
          url: "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.1/axe.min.js",
        });
        const violations = await page.evaluate(async () => {
          const results = await (window as any).axe.run();
          return results.violations.slice(0, 20).map((v: any) => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
            nodes: v.nodes.length,
          }));
        });
        const output =
          violations.length === 0
            ? "No accessibility violations found"
            : JSON.stringify(violations, null, 2);
        return { success: violations.length === 0, output };
      }

      case "fill_form": {
        const fields = toolInput.fields as Array<{ selector: string; value: string }>;
        const results: string[] = [];
        for (const field of fields) {
          await page.fill(field.selector, field.value);
          results.push(`Filled "${field.selector}" with "${field.value}"`);
        }
        return { success: true, output: results.join("\n") };
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
