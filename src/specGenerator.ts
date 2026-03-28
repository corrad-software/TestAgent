const SPEC_SYSTEM_PROMPT = `
You are an expert Playwright test engineer. Your job is to generate a single, complete, valid TypeScript test file using @playwright/test.

STRICT RULES — follow every one:
1. Output ONLY valid TypeScript code. Do NOT include markdown fences, explanations, or prose.
2. Always start the file with: import { test, expect } from '@playwright/test';
3. Wrap all tests in a test.describe() block.
4. Use web-first assertions exclusively:
   - expect(locator).toBeVisible()
   - expect(locator).toHaveText()
   - expect(page).toHaveTitle()
   - expect(page).toHaveURL()
   - expect(locator).toBeEnabled()
   - NEVER write: expect(await locator.isVisible()).toBe(true)
5. Prefer semantic locators in this order:
   - page.getByRole('button', { name: '...' })
   - page.getByLabel('...')
   - page.getByPlaceholder('...')
   - page.getByText('...')
   - page.locator('css-selector')  ← last resort only
6. NEVER use waitForTimeout(). Web-first assertions auto-wait.
7. Take screenshots at meaningful points: await page.screenshot({ path: 'test-results/<name>.png' });
8. File must be self-contained with zero external dependencies beyond @playwright/test.
9. Do not include tests requiring real credentials, payment info, or destructive operations.
`.trim();

function buildUserPrompt(testType: string, url: string, description?: string, hasAuth?: boolean): string {
  const extra = description ? `\n\nAdditional focus from user: ${description}` : "";
  const authNote = hasAuth
    ? "\n\nIMPORTANT: The user is already logged in when tests run. Do NOT navigate to the login page or fill login credentials. Go directly to the target URL and test the authenticated experience."
    : "";

  const prompts: Record<string, string> = {
    smoke: `
Generate a smoke test spec for: ${url}

test.describe block: "Smoke Test"
Write one test "page loads and has core content" that:
1. Navigates to ${url}
2. Asserts page title is not empty using expect(page).toHaveTitle(/\\S+/)
3. Asserts the body is visible
4. Looks for an h1 and asserts it is visible (use .first() if needed — don't fail if missing, use .count() check)
5. Asserts there is at least one visible link using page.getByRole('link').first()
6. Takes a screenshot named 'test-results/smoke-loaded.png'
${extra}${authNote}`.trim(),

    navigation: `
Generate a navigation test spec for: ${url}

test.describe block: "Navigation Test"
Write these tests:
1. "homepage loads" — navigate to ${url}, assert title not empty, assert body visible
2. "navigation links respond" — find up to 5 links with page.getByRole('link'), for each: click, assert new page has a body, navigate back using page.goBack()
3. Take a screenshot after loading the homepage

Use test.beforeEach to navigate to the base URL.
${extra}${authNote}`.trim(),

    forms: `
Generate a form test spec for: ${url}

test.describe block: "Form Test"
Write tests that:
1. Navigate to ${url} and find form elements
2. Fill fields using getByLabel() or getByPlaceholder() with dummy data:
   - email → 'test@example.com'
   - password → 'TestPass123!'
   - name → 'Test User'
   - phone → '+1234567890'
   - message/textarea → 'This is an automated test message'
3. Assert fields accept input using expect(locator).toHaveValue()
4. Assert submit buttons are enabled using expect(locator).toBeEnabled()
5. Take a screenshot before and after interaction
6. Do NOT actually submit forms that could create real accounts or send real messages.
${extra}${authNote}`.trim(),

    responsive: `
Generate a responsive design test spec for: ${url}

test.describe block: "Responsive Design Test"
Write three tests using page.setViewportSize() inside each test:
1. "renders on mobile (375x812)" — setViewportSize({width:375,height:812}), navigate, assert body visible, screenshot 'test-results/responsive-mobile.png'
2. "renders on tablet (768x1024)" — setViewportSize({width:768,height:1024}), navigate, assert body visible, screenshot 'test-results/responsive-tablet.png'
3. "renders on desktop (1280x800)" — setViewportSize({width:1280,height:800}), navigate, assert body visible, screenshot 'test-results/responsive-desktop.png'
${extra}${authNote}`.trim(),

    accessibility: `
Generate an accessibility test spec for: ${url}

test.describe block: "Accessibility Test"
Write these tests:
1. "page has a main heading" — navigate, assert page.getByRole('heading', {level:1}).first() is visible (skip if count is 0 with test.skip)
2. "images have alt attributes" — get all img locators, for each assert it has an 'alt' attribute (it can be empty string but must exist)
3. "interactive elements are keyboard accessible" — press Tab multiple times, assert focused element changes
4. "page has landmark regions" — assert at least one of main/nav/header exists using page.locator('main,nav,header').first()
5. Take a screenshot for manual review
${extra}${authNote}`.trim(),
  };

  return prompts[testType] ?? `Generate a general test spec for: ${url}. Test that the page loads and core content is visible.${extra}${authNote}`;
}

// ─── Auth injection ───────────────────────────────────────────────────────────

function buildAuthBeforeAll(): string {
  return `
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    console.log('[AUTH] Navigating to login page:', AUTH_LOGIN_URL);
    await page.goto(AUTH_LOGIN_URL);
    await page.screenshot({ path: 'test-results/auth-01-login-page.png' });

    // Find email/username field — try common selectors in priority order
    const emailSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[name="username"]',
      'input[name="userId"]',
      'input[id*="email"]',
      'input[id*="user"]',
      'input[id*="login"]',
    ];
    let emailField = null;
    for (const sel of emailSelectors) {
      const el = page.locator(sel).first();
      if (await el.count() > 0) { emailField = el; break; }
    }
    if (!emailField) {
      await page.screenshot({ path: 'test-results/auth-error-no-email-field.png' });
      throw new Error('Could not find email/username field on login page');
    }
    console.log('[AUTH] Filling credentials for:', AUTH_EMAIL);
    await emailField.fill(AUTH_EMAIL);

    // Password field
    const passField = page.locator('input[type="password"]').first();
    if (await passField.count() === 0) {
      await page.screenshot({ path: 'test-results/auth-error-no-password-field.png' });
      throw new Error('Could not find password field on login page');
    }
    await passField.fill(AUTH_PASSWORD);

    await page.screenshot({ path: 'test-results/auth-02-credentials-filled.png' });

    // Submit form
    const submitBtn = page.locator('button[type="submit"]').first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
    } else {
      await page.getByRole('button', { name: /sign.?in|log.?in|login|submit|masuk/i }).first().click();
    }

    console.log('[AUTH] Submitted login form, waiting for redirect...');

    // Wait for navigation away from login page
    await page.waitForURL(url => url.href !== AUTH_LOGIN_URL, { timeout: 15000 });

    const postLoginUrl = page.url();
    console.log('[AUTH] Login successful! Redirected to:', postLoginUrl);
    await page.screenshot({ path: 'test-results/auth-03-logged-in.png' });

    // Save authenticated session
    const fs = require('fs');
    if (!fs.existsSync('.auth')) fs.mkdirSync('.auth', { recursive: true });
    await page.context().storageState({ path: '.auth/state.json' });
    await page.close();
  });

  test.use({ storageState: '.auth/state.json' });`.trim();
}

function injectAuthIntoSpec(
  spec: string,
  authConfig: { loginUrl: string; email: string; password: string }
): string {
  // 1. Inject auth constants after the import line
  const constants = [
    "",
    `const AUTH_LOGIN_URL = ${JSON.stringify(authConfig.loginUrl)};`,
    `const AUTH_EMAIL    = ${JSON.stringify(authConfig.email)};`,
    `const AUTH_PASSWORD = ${JSON.stringify(authConfig.password)};`,
    "",
  ].join("\n");

  spec = spec.replace(
    /^(import \{ test, expect \} from '@playwright\/test';)/m,
    `$1\n${constants}`
  );

  // 2. Inject beforeAll + test.use right after the describe opening brace
  const authBlock = buildAuthBeforeAll()
    .split("\n")
    .map(l => `  ${l}`)
    .join("\n");

  spec = spec.replace(
    /(test\.describe\s*\([^)]+\)\s*,?\s*(?:async\s*)?\(\s*\)\s*=>\s*\{)/,
    `$1\n\n${authBlock}\n`
  );

  return spec;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface AuthConfig {
  loginUrl: string;
  email: string;
  password: string;
}

export interface SpecGeneratorOptions {
  testType: string;
  url: string;
  description?: string;
  authConfig?: AuthConfig;
  onLog?: (msg: string) => void;
}

export async function generateSpec(options: SpecGeneratorOptions): Promise<string> {
  const { testType, url, description, authConfig, onLog } = options;
  const log = (msg: string) => { console.log(msg); onLog?.(msg); };

  // Use template-based generation (no API needed)
  const authLabel = authConfig ? " (with login)" : "";
  log(`🔧 Generating ${testType} spec template for ${url}${authLabel}…`);

  let spec = buildTemplateSpec(testType, url, description);

  if (authConfig) {
    log(`🔐 Injecting login setup (${authConfig.loginUrl})…`);
    spec = injectAuthIntoSpec(spec, authConfig);
  }

  log(`✅ Spec generated (${spec.split("\n").length} lines)`);
  return spec;
}

// ─── Template-based spec generation (no AI) ─────────────────────────────────

function buildTemplateSpec(testType: string, url: string, description?: string): string {
  const descComment = description ? `\n  // Focus: ${description.split("\n")[0].substring(0, 120)}` : "";

  const templates: Record<string, string> = {
    smoke: `import { test, expect } from '@playwright/test';

test.describe('Smoke Test', () => {${descComment}
  test('page loads and has core content', async ({ page }) => {
    await page.goto(${JSON.stringify(url)});
    await expect(page).toHaveTitle(/\\S+/);
    await expect(page.locator('body')).toBeVisible();

    const h1 = page.locator('h1').first();
    if (await h1.count() > 0) {
      await expect(h1).toBeVisible();
    }

    const firstLink = page.getByRole('link').first();
    if (await firstLink.count() > 0) {
      await expect(firstLink).toBeVisible();
    }

    await page.screenshot({ path: 'test-results/smoke-loaded.png' });
  });
});`,

    navigation: `import { test, expect } from '@playwright/test';

test.describe('Navigation Test', () => {${descComment}
  test.beforeEach(async ({ page }) => {
    await page.goto(${JSON.stringify(url)});
  });

  test('homepage loads', async ({ page }) => {
    await expect(page).toHaveTitle(/\\S+/);
    await expect(page.locator('body')).toBeVisible();
    await page.screenshot({ path: 'test-results/nav-homepage.png' });
  });

  test('navigation links respond', async ({ page }) => {
    const links = page.getByRole('link');
    const count = Math.min(await links.count(), 5);
    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      const href = await link.getAttribute('href');
      if (!href || href === '#' || href.startsWith('javascript:') || href.startsWith('mailto:')) continue;
      await link.click();
      await expect(page.locator('body')).toBeVisible();
      await page.goBack();
    }
  });
});`,

    forms: `import { test, expect } from '@playwright/test';

test.describe('Form Test', () => {${descComment}
  test('form fields accept input', async ({ page }) => {
    await page.goto(${JSON.stringify(url)});
    await page.screenshot({ path: 'test-results/forms-before.png' });

    // Fill text inputs
    const inputs = page.locator('input:visible:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"])');
    const inputCount = Math.min(await inputs.count(), 10);
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const type = await input.getAttribute('type') ?? 'text';
      const name = await input.getAttribute('name') ?? '';
      try {
        if (type === 'email' || name.includes('email')) {
          await input.fill('test@example.com');
        } else if (type === 'password') {
          await input.fill('TestPass123!');
        } else if (type === 'tel' || name.includes('phone')) {
          await input.fill('+1234567890');
        } else if (type === 'number') {
          await input.fill('42');
        } else {
          await input.fill('Test Value');
        }
      } catch { /* skip readonly/disabled */ }
    }

    // Fill textareas
    const textareas = page.locator('textarea:visible');
    const taCount = Math.min(await textareas.count(), 3);
    for (let i = 0; i < taCount; i++) {
      try { await textareas.nth(i).fill('Automated test message'); } catch {}
    }

    // Check submit buttons exist and are enabled
    const submitBtn = page.locator('button[type="submit"], input[type="submit"]').first();
    if (await submitBtn.count() > 0) {
      await expect(submitBtn).toBeEnabled();
    }

    await page.screenshot({ path: 'test-results/forms-filled.png' });
  });
});`,

    responsive: `import { test, expect } from '@playwright/test';

test.describe('Responsive Design Test', () => {${descComment}
  test('renders on mobile (375x812)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(${JSON.stringify(url)});
    await expect(page.locator('body')).toBeVisible();
    await page.screenshot({ path: 'test-results/responsive-mobile.png' });
  });

  test('renders on tablet (768x1024)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(${JSON.stringify(url)});
    await expect(page.locator('body')).toBeVisible();
    await page.screenshot({ path: 'test-results/responsive-tablet.png' });
  });

  test('renders on desktop (1280x800)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(${JSON.stringify(url)});
    await expect(page.locator('body')).toBeVisible();
    await page.screenshot({ path: 'test-results/responsive-desktop.png' });
  });
});`,

    accessibility: `import { test, expect } from '@playwright/test';

test.describe('Accessibility Test', () => {${descComment}
  test.beforeEach(async ({ page }) => {
    await page.goto(${JSON.stringify(url)});
  });

  test('page has a main heading', async ({ page }) => {
    const h1 = page.getByRole('heading', { level: 1 }).first();
    if (await h1.count() === 0) test.skip();
    await expect(h1).toBeVisible();
  });

  test('images have alt attributes', async ({ page }) => {
    const images = page.locator('img');
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute('alt');
      expect(alt).not.toBeNull();
    }
  });

  test('interactive elements are keyboard accessible', async ({ page }) => {
    await page.keyboard.press('Tab');
    const first = await page.evaluate(() => document.activeElement?.tagName);
    await page.keyboard.press('Tab');
    const second = await page.evaluate(() => document.activeElement?.tagName);
    expect(first || second).toBeTruthy();
  });

  test('page has landmark regions', async ({ page }) => {
    const landmarks = page.locator('main, nav, header, [role="main"], [role="navigation"], [role="banner"]').first();
    await expect(landmarks).toBeVisible();
    await page.screenshot({ path: 'test-results/a11y-landmarks.png' });
  });
});`,
  };

  return templates[testType] ?? templates["smoke"];
}
