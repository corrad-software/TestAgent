import "dotenv/config";
import { chromium } from "playwright";
import { runAgent } from "../src/agent";

const TARGET_URL = process.env.TARGET_URL ?? "http://localhost:3000";
const LOGIN_URL = process.env.LOGIN_URL ?? `${TARGET_URL}/login`;
const EMAIL = process.env.LOGIN_EMAIL ?? "test@example.com";
const PASSWORD = process.env.LOGIN_PASSWORD ?? "password";
const SUCCESS_URL = process.env.LOGIN_SUCCESS_URL ?? `${TARGET_URL}/dashboard`;

const goal = `
Test the login functionality on the web application.

Steps to perform:
1. Navigate to the login page at: ${LOGIN_URL}
2. Inspect the page to find the email and password input fields
3. Fill in the email field with: ${EMAIL}
4. Fill in the password field with: ${PASSWORD}
5. Submit the login form
6. Verify that login was successful by checking the URL changed to: ${SUCCESS_URL}
7. Assert that a welcome message or dashboard content is visible

Report PASS if login succeeds and the user is redirected correctly.
Report FAIL if any step fails, with a clear reason why.
`.trim();

async function main() {
  const browser = await chromium.launch({ headless: false }); // set headless: true to run silently
  const page = await browser.newPage();

  try {
    const result = await runAgent(page, goal);

    console.log("\n─────────────────────────────────");
    console.log(result.passed ? "✅  RESULT: PASS" : "❌  RESULT: FAIL");
    console.log("─────────────────────────────────");
    console.log("Summary:", result.summary);
    console.log("\nSteps executed:");
    result.steps.forEach((s) => console.log(" ", s));
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
