import { Page } from "playwright";
import { AgentResult } from "./agent";

export async function runBasicTest(
  page: Page,
  url: string,
  onLog: (msg: string) => void
): Promise<AgentResult> {
  const steps: string[] = [];
  const log = (msg: string) => { onLog(msg); steps.push(msg); };

  log(`🔧 navigate: ${url}`);
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    const status = response?.status() ?? 0;

    if (!response || status >= 400) {
      log(`[❌] navigate: HTTP ${status}`);
      return { passed: false, summary: `Page returned HTTP ${status}`, steps };
    }
    log(`[✅] navigate: HTTP ${status} — page loaded`);
  } catch (err) {
    log(`[❌] navigate: ${(err as Error).message}`);
    return { passed: false, summary: `Failed to reach ${url}`, steps };
  }

  // Page title
  const title = await page.title();
  log(`[✅] title: "${title}"`);

  // Current URL (check for redirects)
  const finalUrl = page.url();
  if (finalUrl !== url) {
    log(`[✅] redirect: → ${finalUrl}`);
  }

  // Page text length
  const bodyText = await page.evaluate(() => document.body?.innerText?.length ?? 0);
  if (bodyText < 50) {
    log(`[⚠️] content: Page body is very short (${bodyText} chars) — may be empty`);
  } else {
    log(`[✅] content: Page has content (${bodyText} chars)`);
  }

  // Check for console errors
  const jsErrors: string[] = [];
  page.on("pageerror", (err) => jsErrors.push(err.message));

  // Check for broken images
  const brokenImages = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll("img")) as HTMLImageElement[];
    return imgs.filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src);
  });
  if (brokenImages.length > 0) {
    log(`[⚠️] images: ${brokenImages.length} broken image(s) found`);
  } else {
    const imgCount = await page.evaluate(() => document.querySelectorAll("img").length);
    log(`[✅] images: ${imgCount} image(s), none broken`);
  }

  // Check interactive elements
  const elements = await page.evaluate(() => ({
    links:   document.querySelectorAll("a[href]").length,
    buttons: document.querySelectorAll("button").length,
    inputs:  document.querySelectorAll("input, textarea, select").length,
  }));
  log(`[✅] elements: ${elements.links} links, ${elements.buttons} buttons, ${elements.inputs} inputs`);

  // JS errors (wait a moment)
  await page.waitForTimeout(1000);
  if (jsErrors.length > 0) {
    log(`[⚠️] js errors: ${jsErrors.slice(0, 3).join(" | ")}`);
  } else {
    log(`[✅] js errors: none detected`);
  }

  // Screenshot (base64, for future use)
  log(`[✅] screenshot: captured`);
  await page.screenshot({ path: "/tmp/testagent-last.png" });

  const warnings = steps.filter(s => s.includes("⚠️")).length;
  const passed = true; // page loaded = basic pass; warnings are informational
  const summary = warnings > 0
    ? `Page loaded successfully with ${warnings} warning(s). Title: "${title}"`
    : `Page loaded successfully. Title: "${title}"`;

  return { passed, summary, steps };
}
