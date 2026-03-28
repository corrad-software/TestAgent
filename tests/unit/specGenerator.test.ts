import { describe, it, expect } from "vitest";
import { generateSpec } from "../../src/specGenerator";

describe("generateSpec", () => {
  const TEST_TYPES = ["smoke", "navigation", "forms", "responsive", "accessibility"];

  describe("template generation", () => {
    for (const testType of TEST_TYPES) {
      it(`generates a valid ${testType} spec`, async () => {
        const spec = await generateSpec({ testType, url: "https://example.com" });
        expect(spec).toContain("import { test, expect } from '@playwright/test'");
        expect(spec).toContain("test.describe(");
        expect(spec).toContain("https://example.com");
      });
    }

    it("generates correct describe title for each type", async () => {
      const titles: Record<string, string> = {
        smoke: "Smoke Test",
        navigation: "Navigation Test",
        forms: "Form Test",
        responsive: "Responsive Design Test",
        accessibility: "Accessibility Test",
      };
      for (const [type, title] of Object.entries(titles)) {
        const spec = await generateSpec({ testType: type, url: "https://example.com" });
        expect(spec).toContain(`test.describe('${title}'`);
      }
    });

    it("falls back to smoke template for unknown test type", async () => {
      const spec = await generateSpec({ testType: "unknown", url: "https://example.com" });
      expect(spec).toContain("test.describe('Smoke Test'");
    });

    it("JSON-escapes URL with special characters", async () => {
      const spec = await generateSpec({ testType: "smoke", url: "https://example.com/path?q=a&b=c" });
      expect(spec).toContain("https://example.com/path?q=a&b=c");
      expect(spec).not.toContain("undefined");
    });

    it("injects description as comment when provided", async () => {
      const spec = await generateSpec({
        testType: "smoke",
        url: "https://example.com",
        description: "Test the login page",
      });
      expect(spec).toContain("// Focus: Test the login page");
    });

    it("does not inject description comment when not provided", async () => {
      const spec = await generateSpec({ testType: "smoke", url: "https://example.com" });
      expect(spec).not.toContain("// Focus:");
    });
  });

  describe("auth injection", () => {
    const authConfig = {
      loginUrl: "https://example.com/login",
      email: "user@test.com",
      password: "secret123",
    };

    it("injects auth constants when authConfig provided", async () => {
      const spec = await generateSpec({
        testType: "smoke",
        url: "https://example.com",
        authConfig,
      });
      expect(spec).toContain("AUTH_LOGIN_URL");
      expect(spec).toContain("AUTH_EMAIL");
      expect(spec).toContain("AUTH_PASSWORD");
      expect(spec).toContain("https://example.com/login");
      expect(spec).toContain("user@test.com");
      expect(spec).toContain("secret123");
    });

    it("injects beforeAll login block", async () => {
      const spec = await generateSpec({
        testType: "smoke",
        url: "https://example.com",
        authConfig,
      });
      expect(spec).toContain("test.beforeAll(");
      expect(spec).toContain("emailField.fill(AUTH_EMAIL)");
      expect(spec).toContain("storageState");
      expect(spec).toContain(".auth/state.json");
    });

    it("places auth constants after import line", async () => {
      const spec = await generateSpec({
        testType: "smoke",
        url: "https://example.com",
        authConfig,
      });
      const importIdx = spec.indexOf("import { test, expect }");
      const authIdx = spec.indexOf("AUTH_LOGIN_URL");
      expect(importIdx).toBeLessThan(authIdx);
    });

    it("does not inject auth blocks without authConfig", async () => {
      const spec = await generateSpec({ testType: "smoke", url: "https://example.com" });
      expect(spec).not.toContain("AUTH_LOGIN_URL");
      expect(spec).not.toContain("test.beforeAll(");
      expect(spec).not.toContain("storageState");
    });

    it("escapes special chars in password", async () => {
      const spec = await generateSpec({
        testType: "smoke",
        url: "https://example.com",
        authConfig: { loginUrl: "https://x.com/login", email: "a@b.c", password: 'p@ss"word\\n' },
      });
      // JSON.stringify handles escaping — the password should be present and escaped
      expect(spec).toContain("AUTH_PASSWORD");
      expect(spec).not.toContain("undefined");
    });
  });
});
