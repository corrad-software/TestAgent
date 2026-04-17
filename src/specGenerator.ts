// ─── Auth injection ───────────────────────────────────────────────────────────

function buildAuthBeforeAll(): string {
  return `
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    console.log('[AUTH] Navigating to login page:', AUTH_LOGIN_URL);
    await page.goto(AUTH_LOGIN_URL, { waitUntil: 'networkidle' });
    await page.screenshot({ path: 'test-results/auth-01-login-page.png' });

    // Wait for any input to appear (SPA may render form after JS loads)
    await page.waitForSelector('input', { timeout: 10000 });

    // Find email/username field — try common selectors in priority order
    const emailSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[name="username"]',
      'input[name="userId"]',
      'input[id*="email"]',
      'input[id*="user"]',
      'input[id*="login"]',
      'input[type="text"]',
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

export function injectAuthIntoSpec(
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
    /(test\.describe\s*\(.+?=>\s*\{)/,
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
  test('form fields accept input (positive)', async ({ page }) => {
    await page.goto(${JSON.stringify(url)});
    await page.screenshot({ path: 'test-results/forms-before.png' });

    // Fill text inputs with valid data
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

  test('empty form submission shows validation (negative)', async ({ page }) => {
    await page.goto(${JSON.stringify(url)});

    // Find required fields and clear them
    const requiredInputs = page.locator('input[required]:visible, textarea[required]:visible, select[required]:visible');
    const reqCount = await requiredInputs.count();
    if (reqCount === 0) test.skip(true, 'No required fields found');

    for (let i = 0; i < reqCount; i++) {
      try { await requiredInputs.nth(i).clear(); } catch {}
    }

    // Try to submit empty form
    const submitBtn = page.locator('button[type="submit"], input[type="submit"]').first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
    }

    // Check for validation errors — look for common error patterns
    const errorIndicators = page.locator(
      '[class*="error"], [class*="invalid"], [class*="danger"], [role="alert"], ' +
      '.field-error, .form-error, .validation-error, .text-red, .text-danger, ' +
      ':invalid, [aria-invalid="true"]'
    );
    const errorCount = await errorIndicators.count();

    // Also check native HTML5 validation
    const invalidFields = page.locator(':invalid');
    const invalidCount = await invalidFields.count();

    expect(errorCount + invalidCount).toBeGreaterThan(0);
    await page.screenshot({ path: 'test-results/forms-validation-error.png' });
  });

  test('invalid email format shows error (negative)', async ({ page }) => {
    await page.goto(${JSON.stringify(url)});

    const emailInput = page.locator('input[type="email"]:visible, input[name*="email"]:visible').first();
    if (await emailInput.count() === 0) test.skip(true, 'No email field found');

    await emailInput.fill('not-an-email');

    const submitBtn = page.locator('button[type="submit"], input[type="submit"]').first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
    }

    // Email field should be invalid (HTML5 validation or custom)
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    const hasAriaInvalid = await emailInput.getAttribute('aria-invalid');
    expect(isInvalid || hasAriaInvalid === 'true').toBeTruthy();

    await page.screenshot({ path: 'test-results/forms-invalid-email.png' });
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
    if (count === 0) test.skip(true, 'No images found on page');
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
    const landmarks = page.locator('main, nav, header, [role="main"], [role="navigation"], [role="banner"]');
    const count = await landmarks.count();
    if (count === 0) {
      test.skip(true, 'No landmark regions found — page uses non-semantic layout');
    }
    await expect(landmarks.first()).toBeVisible();
    await page.screenshot({ path: 'test-results/a11y-landmarks.png' });
  });
});`,
  };

  return templates[testType] ?? templates["smoke"];
}
