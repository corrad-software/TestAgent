import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs/promises";
import { spawn } from "child_process";
import { chromium } from "playwright";
import multer from "multer";
import * as XLSX from "xlsx";
import { runBasicTest } from "./basicTest";
import { getAppSettings, updateAppSettings, maskSettings } from "./appSettings";
import { requireAuth, requireAdmin, hashPassword, verifyPassword, signToken, seedAdminIfNeeded, COOKIE_NAME, COOKIE_OPTS } from "./auth";
import { prisma } from "./db";
import { generateSpec, injectAuthIntoSpec } from "./specGenerator";
import { stepsToPlaywrightSpec } from "./stepsToSpec";
import { runPlaywrightTest } from "./testRunner";
import { TestType } from "./testSuites";
import type { TestReport } from "./reporter";
import {
  getProjectTree,
  getLibrary,
  createProject,
  updateProject,
  deleteProject,
  createModule,
  updateModule,
  deleteModule,
  createScenario,
  updateScenario,
  deleteScenario,
  getScenario,
  getScenarioHistory,
  addRunRecord,
  getMembers,
  createMember,
  updateMember,
  deleteMember,
  getDashboardStats,
  getDailyStats,
  getProjectRuns,
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  getEnvironments,
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
} from "./scenarioLibrary";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const app = express();
app.use(express.json());
app.use(cookieParser());

// Serve React client (built output goes to client/dist)
const clientDist = path.join(__dirname, "../client/dist");
app.get("/favicon.ico", (_req, res) => res.redirect("/favicon.svg"));
app.use(express.static(clientDist));

// Serve legacy public dir as fallback during transition
app.use(express.static(path.join(__dirname, "../public")));

// SPA catch-all: serve index.html for client-side routes (before auth middleware)
app.use((req, res, next) => {
  // Treat root and standard browser navigations as HTML even if proxies tweak Accept header
  const accept = req.headers.accept ?? "";
  const wantsHtml = accept.includes("text/html") || req.path === "/";

  if (
    req.method !== "GET" ||
    !wantsHtml ||
    req.path.startsWith("/auth/") ||
    req.path.startsWith("/library/") ||
    req.path.startsWith("/run-test") ||
    req.path.startsWith("/ai/") ||
    req.path.startsWith("/reports") ||
    req.path.startsWith("/playwright-report") ||
    req.path.includes(".")
  ) return next();

  const indexPath = path.join(clientDist, "index.html");
  fs.access(indexPath).then(() => res.sendFile(indexPath)).catch(() => next());
});

// Serve per-run Playwright HTML reports dynamically
app.use("/playwright-report/:runId", (req, res, next) => {
  const runId = req.params.runId;
  if (!/^[\w-]+$/.test(runId)) { res.status(400).send("Invalid report ID"); return; }
  express.static(path.join(process.cwd(), "playwright-reports", runId))(req, res, next);
});

// ─── Auth endpoints (public) ──────────────────────────────────────────────────
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) { res.status(400).json({ error: "Email and password required" }); return; }
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" }); return;
  }
  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl });
});

app.post("/auth/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get("/auth/me", requireAuth, async (req, res) => {
  const { userId } = (req as any).user;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, role: true, avatarUrl: true } });
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(user);
});

// Change password
app.put("/auth/password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) { res.status(400).json({ error: "Both passwords required" }); return; }
  if (newPassword.length < 6) { res.status(400).json({ error: "New password must be at least 6 characters" }); return; }
  const { userId } = (req as any).user;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    res.status(401).json({ error: "Current password is incorrect" }); return;
  }
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } });
  res.json({ ok: true });
});

// ─── Apply auth middleware to all subsequent routes ───────────────────────────
app.use(requireAuth);

// ─── User Management (admin only) ───────────────────────────────────────────
app.get("/users", requireAdmin, async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: "desc" },
  });
  // Also fetch project memberships for each user (by email match)
  const members = await prisma.member.findMany({
    select: { email: true, projectId: true, role: true, project: { select: { id: true, name: true } } },
  });
  const membersByEmail = new Map<string, { projectId: string; projectName: string; role: string }[]>();
  for (const m of members) {
    const list = membersByEmail.get(m.email) ?? [];
    list.push({ projectId: m.project.id, projectName: m.project.name, role: m.role });
    membersByEmail.set(m.email, list);
  }
  res.json(users.map(u => ({ ...u, projects: membersByEmail.get(u.email) ?? [] })));
});

app.post("/users", requireAdmin, async (req, res) => {
  const { email, name, password, role, avatarUrl } = req.body as { email?: string; name?: string; password?: string; role?: string; avatarUrl?: string };
  if (!email || !name || !password) { res.status(400).json({ error: "Email, name, and password required" }); return; }
  if (password.length < 6) { res.status(400).json({ error: "Password must be at least 6 characters" }); return; }
  const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (exists) { res.status(409).json({ error: "User with this email already exists" }); return; }
  const user = await prisma.user.create({
    data: { email: email.toLowerCase().trim(), name, passwordHash: await hashPassword(password), role: role ?? "Tester", avatarUrl: avatarUrl || null },
    select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true, updatedAt: true },
  });
  res.status(201).json(user);
});

app.put("/users/:id", requireAdmin, async (req, res) => {
  const id = req.params.id as string;
  const { name, email, role, avatarUrl } = req.body as { name?: string; email?: string; role?: string; avatarUrl?: string };
  const data: any = {};
  if (name) data.name = name;
  if (email) data.email = email.toLowerCase().trim();
  if (role) data.role = role;
  if (avatarUrl !== undefined) data.avatarUrl = avatarUrl || null;
  try {
    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true, updatedAt: true },
    });
    res.json(user);
  } catch { res.status(404).json({ error: "User not found" }); }
});

app.delete("/users/:id", requireAdmin, async (req, res) => {
  const id = req.params.id as string;
  const { userId } = (req as any).user;
  if (id === userId) { res.status(400).json({ error: "Cannot delete your own account" }); return; }
  try {
    await prisma.user.delete({ where: { id } });
    res.json({ ok: true });
  } catch { res.status(404).json({ error: "User not found" }); }
});

app.put("/users/:id/password", requireAdmin, async (req, res) => {
  const id = req.params.id as string;
  const { password } = req.body as { password?: string };
  if (!password || password.length < 6) { res.status(400).json({ error: "Password must be at least 6 characters" }); return; }
  try {
    await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(password) } });
    res.json({ ok: true });
  } catch { res.status(404).json({ error: "User not found" }); }
});

// Assign user to project (creates member entry)
app.post("/users/:id/assign", requireAdmin, async (req, res) => {
  const id = req.params.id as string;
  const { projectId, role } = req.body as { projectId?: string; role?: string };
  if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }
  const user = await prisma.user.findUnique({ where: { id }, select: { name: true, email: true, avatarUrl: true } });
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  const existing = await prisma.member.findFirst({ where: { projectId, email: user.email } });
  if (existing) { res.status(409).json({ error: "User already assigned to this project" }); return; }
  const member = await prisma.member.create({
    data: { projectId, name: user.name, email: user.email, role: role ?? "Tester", avatarUrl: user.avatarUrl },
  });
  res.status(201).json(member);
});

// Unassign user from project
app.delete("/users/:id/assign/:projectId", requireAdmin, async (req, res) => {
  const id = req.params.id as string;
  const pId = req.params.projectId as string;
  const user = await prisma.user.findUnique({ where: { id }, select: { email: true } });
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  const member = await prisma.member.findFirst({ where: { projectId: pId, email: user.email } });
  if (!member) { res.status(404).json({ error: "User not assigned to this project" }); return; }
  await prisma.member.delete({ where: { id: member.id } });
  res.json({ ok: true });
});

// ─── Run ID generator ─────────────────────────────────────────────────────────
function makeRunId(testType: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${testType}`;
}

// ─── Run one test type (shared logic) ────────────────────────────────────────
// ─── Pre-flight login check ──────────────────────────────────────────────────
async function checkLogin(
  authConfig: { loginUrl: string; email: string; password: string },
  onLog: (msg: string) => void,
  headed = false
): Promise<boolean> {
  onLog(`🔐 [AUTH] Checking login at ${authConfig.loginUrl}…`);
  const browser = await chromium.launch({ headless: !headed });
  const page = await browser.newPage();
  try {
    await page.goto(authConfig.loginUrl, { timeout: 20000 });
    onLog(`🔐 [AUTH] Login page loaded`);

    // Find email/username field
    const emailSelectors = [
      'input[type="email"]', 'input[name="email"]', 'input[name="username"]',
      'input[name="userId"]', 'input[id*="email"]', 'input[id*="user"]', 'input[id*="login"]',
    ];
    let emailField = null;
    for (const sel of emailSelectors) {
      const el = page.locator(sel).first();
      if (await el.count() > 0) { emailField = el; break; }
    }
    if (!emailField) {
      onLog(`❌ [AUTH] Could not find email/username field on login page`);
      return false;
    }

    await emailField.fill(authConfig.email);
    onLog(`🔐 [AUTH] Filled username: ${authConfig.email}`);

    // Password field
    const passField = page.locator('input[type="password"]').first();
    if (await passField.count() === 0) {
      onLog(`❌ [AUTH] Could not find password field on login page`);
      return false;
    }
    await passField.fill(authConfig.password);
    onLog(`🔐 [AUTH] Filled password`);

    // Submit
    const submitBtn = page.locator('button[type="submit"]').first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
    } else {
      const roleBtn = page.getByRole('button', { name: /sign.?in|log.?in|login|submit|masuk/i }).first();
      if (await roleBtn.count() > 0) {
        await roleBtn.click();
      } else {
        onLog(`❌ [AUTH] Could not find login/submit button`);
        return false;
      }
    }
    onLog(`🔐 [AUTH] Clicked login button, waiting for redirect…`);

    // Wait for URL to change
    await page.waitForURL(u => u.href !== authConfig.loginUrl, { timeout: 15000 });
    const newUrl = page.url();
    onLog(`✅ [AUTH] Login successful! Redirected to: ${newUrl}`);

    // Save session for Playwright tests
    await fs.mkdir(".auth", { recursive: true });
    await page.context().storageState({ path: ".auth/state.json" });
    onLog(`🔐 [AUTH] Session saved`);
    return true;
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("Timeout") || msg.includes("timeout")) {
      onLog(`❌ [AUTH] Login failed — page did not redirect after login (timeout). Check credentials or login URL.`);
    } else {
      onLog(`❌ [AUTH] Login failed — ${msg}`);
    }
    return false;
  } finally {
    await browser.close();
  }
}

async function runOneType(
  testType: TestType,
  url: string,
  description: string | undefined,
  authConfig: { loginUrl: string; email: string; password: string } | undefined,
  send: (data: object) => void,
  onLog: (msg: string) => void,
  headed = false,
  customSpec?: string,
): Promise<void> {
  // Pre-flight login check
  if (authConfig) {
    const loginOk = await checkLogin(authConfig, onLog, headed);
    if (!loginOk) {
      send({ type: "result", passed: false, summary: "Login failed — test skipped", steps: [], reportId: null, reportUrl: null, testType });
      return;
    }
  }

  if (testType === "quick") {
    const browser = await chromium.launch({ headless: !headed });
    const page = await browser.newPage();
    try {
      const result = await runBasicTest(page, url, onLog);
      send({ type: "result", passed: result.passed, summary: result.summary, steps: result.steps, reportId: null, reportUrl: null, testType });
    } finally {
      await browser.close();
    }
  } else {
    const runId = makeRunId(testType);
    let specContent: string;
    if (customSpec) {
      onLog(`📝 Using recorded spec (custom)`);
      specContent = customSpec;
      if (authConfig) {
        specContent = injectAuthIntoSpec(specContent, authConfig);
      }
    } else {
      specContent = await generateSpec({ testType, url, description, authConfig, onLog });
    }
    const specDir = path.join(process.cwd(), "generated-tests");
    await fs.mkdir(specDir, { recursive: true });
    const specPath = path.join(specDir, `${runId}.spec.ts`);
    await fs.writeFile(specPath, specContent, "utf-8");
    onLog(`🔧 Spec saved: generated-tests/${runId}.spec.ts`);
    onLog(`🔧 Launching Playwright test runner…`);
    const result = await runPlaywrightTest({ specPath, runId, onLog, headed });
    send({ type: "result", passed: result.passed, summary: result.summary, steps: result.steps, reportId: runId, reportUrl: result.reportUrl, testType });
  }
}

// ─── POST /run-test ───────────────────────────────────────────────────────────
app.post("/run-test", async (req, res) => {
  const { url, description, testTypes: rawTestTypes, testType: rawTestType, demo, loginUrl, email, password, headed, record, enrich, customSpec } = req.body as {
    url: string; description?: string; testTypes?: string[]; testType?: string;
    demo?: boolean; loginUrl?: string; email?: string; password?: string; headed?: boolean;
    record?: boolean; enrich?: boolean; customSpec?: string;
  };

  if (!url) { res.status(400).json({ error: "url is required" }); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  const onLog = (msg: string) => send({ type: "log", message: msg });

  try {
    // ── Record mode ──────────────────────────────────────────────────────
    if (record) {
      const { spawn } = await import("child_process");
      const tmpDir = path.join(process.cwd(), "generated-tests");
      await fs.mkdir(tmpDir, { recursive: true });
      const specPath = path.join(tmpDir, `quick-record-${Date.now()}.spec.ts`);
      const args = ["playwright", "codegen", url, "-o", specPath, "--target", "playwright-test"];
      onLog(`🎬 Launching Playwright Codegen for ${url}`);
      const proc = spawn("npx", args, { cwd: process.cwd(), env: { ...process.env, FORCE_COLOR: "0" }, stdio: ["ignore", "pipe", "pipe"], shell: true });
      proc.stdout.on("data", d => onLog(d.toString().trim()));
      proc.stderr.on("data", d => onLog(d.toString().trim()));

      // Send heartbeat every 15s to keep SSE connection alive through proxies
      const heartbeat = setInterval(() => res.write(":heartbeat\n\n"), 15_000);
      req.on("close", () => { clearInterval(heartbeat); proc.kill(); });

      await new Promise<void>(resolve => proc.on("close", () => { clearInterval(heartbeat); resolve(); }));
      try {
        const code = await fs.readFile(specPath, "utf-8");
        send({ type: "recordEnd", code });
        await fs.unlink(specPath).catch(() => {});
      } catch {
        send({ type: "error", message: "No code was recorded. Did you close the browser without performing actions?" });
      }
      res.end();
      return;
    }

    // ── Enrich mode ──────────────────────────────────────────────────────
    if (enrich && customSpec) {
      const { enrichWithAssertions } = await import("./aiAssist");
      const enriched = await enrichWithAssertions(customSpec, url, description, onLog);
      send({ type: "enriched", code: enriched });
      res.end();
      return;
    }

    // ── Normal run ───────────────────────────────────────────────────────
    const testTypes: TestType[] = demo
      ? ["quick"]
      : rawTestTypes?.length ? rawTestTypes as TestType[]
      : [(rawTestType as TestType) ?? "smoke"];

    const authConfig = (loginUrl && email && password) ? { loginUrl, email, password } : undefined;

    for (let i = 0; i < testTypes.length; i++) {
      if (i > 0) send({ type: "separator", testType: testTypes[i] });
      await runOneType(testTypes[i], url, description, authConfig, send, onLog, headed, customSpec);
    }
  } catch (err) {
    send({ type: "error", message: (err as Error).message });
  } finally {
    res.end();
  }
});

// ─── GET /reports — legacy Quick Check JSON reports ───────────────────────────
app.get("/reports", async (_req, res) => {
  const dir = path.join(process.cwd(), "reports");
  try {
    const files = await fs.readdir(dir);
    const reports = await Promise.all(
      files.filter(f => f.endsWith(".json")).map(async f => {
        const r = JSON.parse(await fs.readFile(path.join(dir, f), "utf-8")) as TestReport;
        return { id: r.id, url: r.url, testType: r.testType, passed: r.passed, startedAt: r.startedAt, durationMs: r.durationMs, summary: r.summary, issueCount: r.issues.length, stepCount: r.steps.length };
      })
    );
    reports.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    res.json(reports);
  } catch { res.json([]); }
});

app.get("/reports/:id", async (req, res) => {
  const p = path.join(process.cwd(), "reports", `${req.params.id}.html`);
  try { await fs.access(p); res.sendFile(p); } catch { res.status(404).send("Not found"); }
});
app.get("/reports/:id/json", async (req, res) => {
  const p = path.join(process.cwd(), "reports", `${req.params.id}.json`);
  try { await fs.access(p); res.download(p); } catch { res.status(404).send("Not found"); }
});

// ─── App Settings (Admin only) ────────────────────────────────────────────────
app.get("/app-settings",  requireAdmin, async (_req, res) => {
  try { res.json(maskSettings(await getAppSettings())); }
  catch (e) { res.status(500).json({ error: String(e) }); }
});

app.put("/app-settings", requireAdmin, async (req, res) => {
  try { res.json(maskSettings(await updateAppSettings(req.body))); }
  catch (e) { res.status(500).json({ error: String(e) }); }
});

// ─── Library: Projects ────────────────────────────────────────────────────────
app.get("/library/projects", async (req, res) => {
  try {
    const { email, role } = (req as any).user as { email: string; role: string };
    const all = await getProjectTree();
    // Admins see everything; others see only projects they're a member of
    if (role === "Admin") { res.json(all); return; }
    const filtered = all.filter(p => p.members?.some((m: any) => m.email === email));
    res.json(filtered);
  } catch (err) { res.status(500).json({ error: (err as Error).message }); }
});
app.post("/library/projects",     requireAdmin, async (req, res) => {
  try { res.json(await createProject(req.body)); }
  catch (err) { res.status(400).json({ error: (err as Error).message }); }
});
app.put("/library/projects/:id",  requireAdmin, async (req, res) => {
  try { res.json(await updateProject(req.params.id as string, req.body)); }
  catch (err) { res.status(400).json({ error: (err as Error).message }); }
});
app.delete("/library/projects/:id", requireAdmin, async (req, res) => {
  try { await deleteProject(req.params.id as string); res.json({ ok: true }); }
  catch (err) { res.status(400).json({ error: (err as Error).message }); }
});

// ─── Library: Modules ────────────────────────────────────────────────────────
app.post("/library/modules",     requireAdmin, async (req, res) => {
  try { res.json(await createModule(req.body)); }
  catch (err) { res.status(400).json({ error: (err as Error).message }); }
});
app.put("/library/modules/:id",  requireAdmin, async (req, res) => {
  try { res.json(await updateModule(req.params.id as string, req.body)); }
  catch (err) { res.status(400).json({ error: (err as Error).message }); }
});
app.delete("/library/modules/:id", requireAdmin, async (req, res) => {
  try { await deleteModule(req.params.id as string); res.json({ ok: true }); }
  catch (err) { res.status(400).json({ error: (err as Error).message }); }
});

// ─── Library: Scenarios ──────────────────────────────────────────────────────
app.get("/library/scenarios", async (_req, res) => {
  try { res.json((await getLibrary()).scenarios); }
  catch (err) { res.status(500).json({ error: (err as Error).message }); }
});
app.post("/library/scenarios", async (req, res) => {
  try { res.json(await createScenario(req.body)); }
  catch (err) { res.status(400).json({ error: (err as Error).message }); }
});
app.put("/library/scenarios/:id", async (req, res) => {
  try { res.json(await updateScenario(req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: (err as Error).message }); }
});
app.delete("/library/scenarios/:id", async (req, res) => {
  try { await deleteScenario(req.params.id); res.json({ ok: true }); }
  catch (err) { res.status(400).json({ error: (err as Error).message }); }
});
app.get("/library/scenarios/:id/history", async (req, res) => {
  try { res.json(await getScenarioHistory(req.params.id)); }
  catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

// ─── Library: Run a saved scenario (SSE) ─────────────────────────────────────
app.post("/library/scenarios/:id/run", async (req, res) => {
  const scenario = await getScenario(req.params.id);
  if (!scenario) { res.status(404).json({ error: "Scenario not found" }); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  const runLogs: string[] = [];
  const onLog = (msg: string) => { runLogs.push(msg); send({ type: "log", message: msg }); };
  const startedAt = Date.now();

  try {
    let { url, description, authConfig, customSpec, testSteps } = scenario;
    const headed: boolean = req.body?.headed === true;
    const useCustomSpec: boolean = req.body?.useCustomSpec === true && !!customSpec;
    const useTestSteps: boolean = req.body?.useTestSteps === true && !!testSteps?.length;

    // Environment override
    const envId: string | undefined = req.body?.environmentId;
    if (envId) {
      try {
        const envRow = await prisma.environment.findUnique({ where: { id: envId } });
        if (envRow) {
          try {
            const origHost = new URL(url).origin;
            url = url.replace(origHost, envRow.baseUrl.replace(/\/$/, ""));
          } catch { url = envRow.baseUrl; }
          onLog(`🌍 Environment: ${envRow.name} → ${envRow.baseUrl}`);
          if (envRow.authConfig) {
            authConfig = JSON.parse(envRow.authConfig);
            onLog(`🔐 Using ${envRow.name} credentials`);
          }
        }
      } catch { /* ignore env lookup errors */ }
    }
    const testTypes: TestType[] = scenario.testTypes?.length ? scenario.testTypes : ["smoke"];

    for (let i = 0; i < testTypes.length; i++) {
      if (i > 0) send({ type: "separator", testType: testTypes[i] });
      let lastPassed = true, lastSummary = "", lastReportId: string | undefined;
      let bufferedResult: object | null = null;
      const wrappedSend = (data: any) => {
        if (data.type === "result") {
          lastPassed = data.passed; lastSummary = data.summary; lastReportId = data.reportId;
          runLogs.push(lastPassed ? "✅ Test Passed" : "❌ Test Failed");
          bufferedResult = data;
        } else { send(data); }
      };
      const specOverride = useTestSteps
        ? stepsToPlaywrightSpec(testSteps!, scenario.name, url)
        : useCustomSpec ? customSpec : undefined;
      await runOneType(testTypes[i], url, description, authConfig, wrappedSend, onLog, headed, specOverride);
      const userName = (req as any).user?.email ?? (req as any).user?.name ?? "unknown";
      await addRunRecord({ scenarioId: scenario.id, runAt: new Date().toISOString(),
                           passed: lastPassed, summary: lastSummary,
                           reportId: lastReportId, durationMs: Date.now() - startedAt,
                           logs: runLogs.join("\n"), runBy: userName });
      if (bufferedResult) send(bufferedResult);
    }
  } catch (err) {
    send({ type: "error", message: (err as Error).message });
  } finally {
    res.end();
  }
});

// ─── Library: Record a scenario (Playwright Codegen via SSE) ────────────────
app.post("/library/scenarios/:id/record", async (req, res) => {
  const scenario = await getScenario(req.params.id);
  if (!scenario) { res.status(404).json({ error: "Scenario not found" }); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const specDir = path.join(process.cwd(), "generated-tests");
    await fs.mkdir(specDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
    const specPath = path.join(specDir, `record-${timestamp}.spec.ts`);

    // If scenario has auth config, start recording at login URL so user can log in first
    let startUrl = scenario.url;
    if (scenario.authConfig?.loginUrl) {
      startUrl = scenario.authConfig.loginUrl;
    }

    send({ type: "recordStart", message: "Opening browser with Playwright Recorder..." });
    if (startUrl !== scenario.url) {
      send({ type: "log", message: `🔐 Opening login page: ${startUrl}` });
      send({ type: "log", message: `After logging in, navigate to: ${scenario.url}` });
    } else {
      send({ type: "log", message: `🎬 Recording for: ${scenario.url}` });
    }
    send({ type: "log", message: "Perform your actions in the browser. Close the browser when done." });

    const args = ["playwright", "codegen", startUrl, "-o", specPath, "--target", "playwright-test"];
    const proc = spawn("npx", args, {
      cwd: process.cwd(),
      env: { ...process.env, FORCE_COLOR: "0" },
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });

    // Send heartbeat every 15s to keep SSE connection alive through proxies
    const heartbeat = setInterval(() => res.write(":heartbeat\n\n"), 15_000);
    req.on("close", () => { clearInterval(heartbeat); proc.kill(); });

    proc.stdout.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n").filter(l => l.trim());
      for (const line of lines) send({ type: "log", message: line });
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n").filter(l => l.trim());
      for (const line of lines) {
        if (!line.includes("Browsing context") && !line.includes("bidi")) {
          send({ type: "log", message: `[recorder] ${line}` });
        }
      }
    });

    proc.on("close", async (code) => {
      clearInterval(heartbeat);
      try {
        const specContent = await fs.readFile(specPath, "utf-8");
        if (specContent.trim().length > 0) {
          send({ type: "log", message: `✅ Recording complete (${specContent.split("\n").length} lines)` });
          send({ type: "codeGenerated", code: specContent });
        } else {
          send({ type: "log", message: "⚠️ No actions recorded — file is empty" });
          send({ type: "codeGenerated", code: "" });
        }
      } catch {
        send({ type: "log", message: code === 0
          ? "⚠️ Browser closed but no code was generated"
          : `❌ Recorder exited with code ${code}` });
        send({ type: "codeGenerated", code: "" });
      }
      send({ type: "recordEnd" });
      res.end();
    });

    proc.on("error", (err) => {
      send({ type: "log", message: `❌ Recorder error: ${err.message}` });
      send({ type: "recordEnd" });
      res.end();
    });
  } catch (err) {
    send({ type: "error", message: (err as Error).message });
    res.end();
  }
});

// ─── AI usage tracking ──────────────────────────────────────────────────────
app.get("/ai/usage", async (_req, res) => {
  try {
    const { getUsage } = await import("./aiAssist");
    res.json(getUsage());
  } catch { res.json({ totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0, callCount: 0 }); }
});

// ─── Library: AI-assist endpoints ────────────────────────────────────────────
app.post("/library/scenarios/:id/enrich", async (req, res) => {
  const scenario = await getScenario(req.params.id);
  if (!scenario) { res.status(404).json({ error: "Scenario not found" }); return; }
  if (!scenario.customSpec) { res.status(400).json({ error: "No recorded spec to enrich" }); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const { enrichWithAssertions } = await import("./aiAssist");
    const enriched = await enrichWithAssertions(
      scenario.customSpec, scenario.url, scenario.description,
      (msg) => send({ type: "log", message: msg }),
    );
    await updateScenario(scenario.id, { customSpec: enriched } as any);
    send({ type: "enriched", code: enriched });
  } catch (err) {
    send({ type: "error", message: (err as Error).message });
  } finally {
    res.end();
  }
});

app.post("/library/scenarios/:id/explain-failure", async (req, res) => {
  const scenario = await getScenario(req.params.id);
  if (!scenario) { res.status(404).json({ error: "Scenario not found" }); return; }
  const { summary, logs } = req.body as { summary: string; logs: string };
  try {
    const { explainFailure } = await import("./aiAssist");
    const explanation = await explainFailure(scenario.url, summary, logs);
    res.json({ explanation });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Library: Save / Delete custom spec ─────────────────────────────────────
app.put("/library/scenarios/:id/custom-spec", async (req, res) => {
  try {
    const s = await updateScenario(req.params.id, { customSpec: req.body.customSpec });
    res.json(s);
  } catch (err) { res.status(400).json({ error: (err as Error).message }); }
});
app.delete("/library/scenarios/:id/custom-spec", async (req, res) => {
  try {
    await updateScenario(req.params.id, { customSpec: undefined } as any);
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: (err as Error).message }); }
});

// ─── Library: Save / Delete test steps ──────────────────────────────────────
app.put("/library/scenarios/:id/test-steps", async (req, res) => {
  try {
    const s = await updateScenario(req.params.id, { testSteps: req.body.testSteps });
    res.json(s);
  } catch (err) { res.status(400).json({ error: (err as Error).message }); }
});
app.delete("/library/scenarios/:id/test-steps", async (req, res) => {
  try {
    await updateScenario(req.params.id, { testSteps: undefined } as any);
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: (err as Error).message }); }
});

// ─── Library: Preview steps as Playwright code ──────────────────────────────
app.post("/library/scenarios/:id/steps-preview", async (req, res) => {
  try {
    const scenario = await getScenario(req.params.id);
    if (!scenario) { res.status(404).json({ error: "Not found" }); return; }
    const steps = req.body.testSteps ?? scenario.testSteps ?? [];
    const code = stepsToPlaywrightSpec(steps, scenario.name, scenario.url);
    res.json({ code });
  } catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

// ─── Projects: Members ───────────────────────────────────────────────────────
app.get("/library/projects/:id/members", async (req, res) => {
  try { res.json(await getMembers(req.params.id)); }
  catch (err) { res.status(500).json({ error: (err as Error).message }); }
});
app.post("/library/projects/:id/members", async (req, res) => {
  try { res.json(await createMember({ ...req.body, projectId: req.params.id })); }
  catch (err) { res.status(400).json({ error: (err as Error).message }); }
});
app.put("/library/members/:id", async (req, res) => {
  try { res.json(await updateMember(req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: (err as Error).message }); }
});
app.delete("/library/members/:id", async (req, res) => {
  try { await deleteMember(req.params.id); res.json({ ok: true }); }
  catch (err) { res.status(400).json({ error: (err as Error).message }); }
});

// ─── Projects: Roles ─────────────────────────────────────────────────────────
app.get("/library/projects/:id/roles", async (req, res) => {
  try { res.json(await getRoles(req.params.id)); }
  catch (err) { res.status(500).json({ error: (err as Error).message }); }
});
app.post("/library/projects/:id/roles", requireAdmin, async (req, res) => {
  try { res.json(await createRole({ projectId: req.params.id, ...req.body })); }
  catch (err) { res.status(400).json({ error: (err as Error).message }); }
});
app.put("/library/roles/:id", requireAdmin, async (req, res) => {
  try { res.json(await updateRole(req.params.id as string, req.body)); }
  catch (err) { res.status(400).json({ error: (err as Error).message }); }
});
app.delete("/library/roles/:id", requireAdmin, async (req, res) => {
  try { await deleteRole(req.params.id as string); res.json({ ok: true }); }
  catch (err) { res.status(400).json({ error: (err as Error).message }); }
});

// ─── Projects: Environments ─────────────────────────────────────────────────
app.get("/library/projects/:id/environments", async (req, res) => {
  try { res.json(await getEnvironments(req.params.id)); }
  catch (err) { res.status(500).json({ error: (err as Error).message }); }
});
app.post("/library/projects/:id/environments", async (req, res) => {
  try { res.json(await createEnvironment({ ...req.body, projectId: req.params.id })); }
  catch (err) { res.status(400).json({ error: (err as Error).message }); }
});
app.put("/library/environments/:id", async (req, res) => {
  try { res.json(await updateEnvironment(req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: (err as Error).message }); }
});
app.delete("/library/environments/:id", async (req, res) => {
  try { await deleteEnvironment(req.params.id); res.json({ ok: true }); }
  catch (err) { res.status(400).json({ error: (err as Error).message }); }
});

// ─── Projects: Dashboard Stats ───────────────────────────────────────────────
app.get("/library/projects/:id/stats", async (req, res) => {
  try { res.json(await getDashboardStats(req.params.id)); }
  catch (err) { res.status(500).json({ error: (err as Error).message }); }
});
// Global stats (all projects)
app.get("/library/stats", async (_req, res) => {
  try { res.json(await getDashboardStats()); }
  catch (err) { res.status(500).json({ error: (err as Error).message }); }
});
// Daily stats (time-series)
app.get("/library/projects/:id/daily-stats", async (req, res) => {
  try { res.json(await getDailyStats(req.params.id)); }
  catch (err) { res.status(500).json({ error: (err as Error).message }); }
});
app.get("/library/daily-stats", async (_req, res) => {
  try { res.json(await getDailyStats()); }
  catch (err) { res.status(500).json({ error: (err as Error).message }); }
});
// Project runs (for report history page)
app.get("/library/projects/:id/runs", async (req, res) => {
  try { res.json(await getProjectRuns(req.params.id)); }
  catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

// ─── Screenshots gallery ────────────────────────────────────────────────────
app.get("/screenshots", async (_req, res) => {
  const reportsDir = path.join(process.cwd(), "playwright-reports");
  const testResultsDir = path.join(process.cwd(), "test-results");
  const screenshots: { url: string; runId: string; testType: string; filename: string; createdAt: string }[] = [];

  try {
    // Scan playwright-reports for screenshots
    const reportDirs = await fs.readdir(reportsDir).catch(() => [] as string[]);
    for (const runId of reportDirs) {
      const dataDir = path.join(reportsDir, runId, "data");
      try {
        const files = await fs.readdir(dataDir);
        for (const file of files) {
          if (file.endsWith(".png") || file.endsWith(".jpg")) {
            const stat = await fs.stat(path.join(dataDir, file));
            const parts = runId.split("-");
            const testType = parts.slice(2).join("-") || "unknown";
            screenshots.push({
              url: `/playwright-report/${runId}/data/${file}`,
              runId,
              testType,
              filename: file,
              createdAt: stat.mtime.toISOString(),
            });
          }
        }
      } catch { /* skip dirs without data/ */ }
    }

    // Scan test-results for auth screenshots
    try {
      const trFiles = await fs.readdir(testResultsDir);
      for (const file of trFiles) {
        if (file.endsWith(".png") || file.endsWith(".jpg")) {
          const stat = await fs.stat(path.join(testResultsDir, file));
          screenshots.push({
            url: `/test-results/${file}`,
            runId: "test-results",
            testType: file.includes("auth") ? "auth" : "test",
            filename: file,
            createdAt: stat.mtime.toISOString(),
          });
        }
      }
    } catch { /* no test-results dir */ }

    screenshots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(screenshots);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
// Serve test-results static files
app.use("/test-results", express.static(path.join(process.cwd(), "test-results")));

// ─── Library: Import from Excel/CSV ──────────────────────────────────────────
app.get("/library/import/template", (_req, res) => {
  const rows = [
    ["Module", "Scenario Name", "URL", "Test Types", "Description", "Tags", "Login URL", "Login Email", "Login Password"],
    ["Authentication", "Login page loads", "https://app.example.com/login", "smoke", "Check login form renders correctly", "auth,critical", "", "", ""],
    ["Authentication", "Login form submit", "https://app.example.com/login", "smoke,forms", "Fill and submit the login form", "auth", "https://app.example.com/login", "user@example.com", "secret123"],
    ["Dashboard", "Dashboard navigation", "https://app.example.com/dashboard", "smoke,navigation", "Test main nav links", "regression", "", "", ""],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [20, 30, 40, 25, 40, 25, 35, 25, 20].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, "Scenarios");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=\"scenario-import-template.xlsx\"");
  res.send(buf);
});

// ─── Katalon .tc XML helpers ──────────────────────────────────────────────────
function parseTcXml(content: string): { name: string; description: string; tags: string[] } {
  const extract = (tag: string) => {
    const m = content.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
    return m ? m[1].trim() : "";
  };
  const tagStr = extract("tag");
  return {
    name:        extract("name"),
    description: extract("description"),
    tags: tagStr ? tagStr.split(",").map(t => t.trim()).filter(Boolean) : [],
  };
}
function extractGroovyUrl(content: string): string {
  const m = content.match(/WebUI\.navigateToUrl\(['"](.+?)['"]\)/);
  return m ? m[1] : "";
}
function extractGroovyAuth(content: string): { loginUrl: string; email: string; password: string } | undefined {
  const urlM    = content.match(/WebUI\.navigateToUrl\(['"](.+?)['"]\)/);
  const userM   = content.match(/WebUI\.setText\([^,]+,\s*['"](.+?)['"]\)/);
  if (!urlM || !userM) return undefined;
  return { loginUrl: urlM[1], email: userM[1], password: "" };
}
import { isDssbFormat, parseDssbWorkbook, DssbTestCase } from "./dssbParser";

// ─────────────────────────────────────────────────────────────────────────────

app.post("/library/import", upload.array("files", 100), async (req, res) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files?.length) { res.status(400).json({ error: "No file uploaded" }); return; }

  const created: string[] = [];
  const errors: { row: number; error: string }[] = [];
  const moduleCache = new Map<string, string>();
  const VALID_TYPES = new Set(["smoke", "navigation", "forms", "responsive", "accessibility", "quick"]);

  const lib = await getLibrary();
  for (const m of lib.modules) moduleCache.set(m.name.toLowerCase(), m.id);

  // Helper: resolve or create module by name
  async function resolveModule(moduleName: string): Promise<string> {
    const key = moduleName.toLowerCase();
    if (moduleCache.has(key)) return moduleCache.get(key)!;
    const freshLib = await getLibrary();
    let projectId = freshLib.projects[0]?.id;
    if (!projectId) { const p = await createProject({ name: "Default" }); projectId = p.id; }
    const mod = await createModule({ projectId, name: moduleName });
    moduleCache.set(key, mod.id);
    return mod.id;
  }

  // ── Separate files by type ──────────────────────────────────────────────
  const tcFiles     = files.filter(f => f.originalname.toLowerCase().endsWith(".tc"));
  const groovyFiles = files.filter(f => f.originalname.toLowerCase().endsWith(".groovy"));
  const xlsxFiles   = files.filter(f => /\.(xlsx?|csv)$/i.test(f.originalname));

  // Build groovy lookup: base-name (no ext, lower) → content
  const groovyMap = new Map<string, string>();
  for (const g of groovyFiles) {
    const base = g.originalname.replace(/\.groovy$/i, "").toLowerCase();
    groovyMap.set(base, g.buffer.toString("utf-8"));
  }

  // ── Process Katalon .tc files ───────────────────────────────────────────
  for (let i = 0; i < tcFiles.length; i++) {
    const file = tcFiles[i];
    try {
      const content = file.buffer.toString("utf-8");
      const parsed  = parseTcXml(content);
      if (!parsed.name) { errors.push({ row: i + 1, error: `${file.originalname}: could not parse <name>` }); continue; }

      // Try to find companion .groovy — by name match first, then any uploaded groovy
      const base         = file.originalname.replace(/\.tc$/i, "").toLowerCase();
      const parsedName   = parsed.name.toLowerCase();
      const groovy       = groovyMap.get(base)
                        ?? groovyMap.get(parsedName)
                        ?? (groovyFiles.length === 1 ? groovyFiles[0].buffer.toString("utf-8") : "")
                        ?? [...groovyMap.values()].find(g => extractGroovyUrl(g)) ?? "";
      const url          = extractGroovyUrl(groovy) || (req.body?.defaultUrl as string) || "";
      const auth         = groovy ? extractGroovyAuth(groovy) : undefined;

      // Infer module from original folder path if available (multipart fieldname), else use "Katalon Import"
      const moduleName = (req.body?.module as string) || "Katalon Import";
      const moduleId   = await resolveModule(moduleName);

      await createScenario({
        moduleId, name: parsed.name, url,
        testTypes: ["smoke"] as TestType[],
        description: parsed.description || `Imported from Katalon: ${file.originalname}`,
        tags: [...parsed.tags, "katalon"],
        authConfig: auth,
      });
      created.push(parsed.name);
    } catch (err) {
      errors.push({ row: i + 1, error: `${file.originalname}: ${(err as Error).message}` });
    }
  }

  // ── Process Excel / CSV files ───────────────────────────────────────────
  for (const xlsxFile of xlsxFiles) {
    try {
      const workbook = XLSX.read(xlsxFile.buffer, { type: "buffer" });

      // ── DSSB formal test-script format ───────────────────────────────
      if (isDssbFormat(workbook)) {
        const dssb = parseDssbWorkbook(workbook);

        // Resolve or create project
        const targetProjectId = req.body?.projectId as string | undefined;
        let projectId: string;
        if (targetProjectId) {
          projectId = targetProjectId;
        } else {
          const freshLib = await getLibrary();
          const existing = freshLib.projects.find(p => p.name.toLowerCase() === dssb.projectName.toLowerCase());
          if (existing) {
            projectId = existing.id;
          } else {
            const p = await createProject({ name: dssb.projectName, description: dssb.scenarioTitle });
            projectId = p.id;
          }
        }

        // Group test cases by sheet (each sheet = a module)
        const sheetGroups = new Map<string, DssbTestCase[]>();
        for (const tc of dssb.testCases) {
          const arr = sheetGroups.get(tc.sheetName) ?? [];
          arr.push(tc);
          sheetGroups.set(tc.sheetName, arr);
        }

        for (const [sheetName, tcs] of sheetGroups) {
          // Create module for each sheet
          const moduleName = sheetName;
          const key = `${projectId}:${moduleName.toLowerCase()}`;
          let moduleId: string;
          if (moduleCache.has(key)) {
            moduleId = moduleCache.get(key)!;
          } else {
            const mod = await createModule({ projectId, name: moduleName });
            moduleId = mod.id;
            moduleCache.set(key, moduleId);
          }

          for (const tc of tcs) {
            try {
              // Build rich description from test steps + expected results
              const descParts: string[] = [];
              if (tc.summary) descParts.push(tc.summary);
              if (tc.testSteps) descParts.push(`\n**Langkah Ujian:**\n${tc.testSteps}`);
              if (tc.expected) descParts.push(`\n**Jangkaan Hasil:**\n${tc.expected}`);
              if (tc.useCase) descParts.push(`\n**Use Case:** ${tc.useCase}`);

              // Determine test type from flow
              const testTypes: TestType[] = tc.flow === "Negatif" ? ["forms"] : ["smoke"];

              // Build tags
              const tags: string[] = ["dssb", tc.flow.toLowerCase()];
              if (tc.actor) tags.push(tc.actor.toLowerCase().replace(/\s+/g, "-"));
              if (tc.scenarioId) tags.push(tc.scenarioId);

              // Try to match credentials by actor
              let authConfig: { loginUrl: string; email: string; password: string } | undefined;
              if (dssb.url && dssb.credentials.length) {
                const cred = dssb.credentials.find(c =>
                  tc.actor && c.role.toLowerCase().includes(tc.actor.toLowerCase().split(" ")[0])
                ) ?? dssb.credentials[0];
                if (cred?.password) {
                  authConfig = { loginUrl: dssb.url, email: cred.userId, password: cred.password };
                }
              }

              await createScenario({
                moduleId,
                testCaseId: tc.testCaseId || undefined,
                scenarioRefId: tc.scenarioId || undefined,
                name: tc.summary || tc.testCaseId,
                url: dssb.url || "https://example.com",
                testTypes,
                description: descParts.join("\n") || undefined,
                tags,
                authConfig,
              });
              created.push(tc.testCaseId);
            } catch (err) {
              errors.push({ row: 0, error: `${tc.testCaseId}: ${(err as Error).message}` });
            }
          }
        }
        continue; // Skip standard Excel processing for this file
      }

      // ── Standard flat Excel/CSV format ─────────────────────────────────
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(
        workbook.Sheets[workbook.SheetNames[0]], { defval: "" }
      );
      const norm   = (k: string) => String(k).toLowerCase().trim().replace(/[\s_\-]+/g, " ");
      const getCol = (row: Record<string, string>, ...keys: string[]) => {
        for (const [k, v] of Object.entries(row)) {
          if (keys.includes(norm(k))) return String(v ?? "").trim();
        }
        return "";
      };

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;
        const moduleName = getCol(row, "module");
        const name       = getCol(row, "scenario name", "scenario", "name");
        const url        = getCol(row, "url");
        if (!moduleName || !name || !url) {
          errors.push({ row: rowNum, error: `Missing: ${[!moduleName && "Module", !name && "Scenario Name", !url && "URL"].filter(Boolean).join(", ")}` });
          continue;
        }
        const moduleId = await resolveModule(moduleName);
        const rawTypes = getCol(row, "test types", "test type", "type", "types");
        const testTypes = (rawTypes || "smoke").split(",").map(t => t.trim().toLowerCase())
          .filter(t => VALID_TYPES.has(t)) as TestType[];
        if (!testTypes.length) { errors.push({ row: rowNum, error: `Invalid test types: "${rawTypes}"` }); continue; }
        const loginUrl = getCol(row, "login url", "loginurl");
        const loginEmail = getCol(row, "login email", "email");
        const loginPassword = getCol(row, "login password", "password");
        const authConfig = (loginUrl && loginEmail && loginPassword) ? { loginUrl, email: loginEmail, password: loginPassword } : undefined;
        try {
          await createScenario({
            moduleId, name, url, testTypes,
            description: getCol(row, "description", "desc") || undefined,
            tags: (getCol(row, "tags", "tag") || "").split(",").map(t => t.trim()).filter(Boolean),
            authConfig,
          });
          created.push(name);
        } catch (err) {
          errors.push({ row: rowNum, error: (err as Error).message });
        }
      }
    } catch (err) {
      errors.push({ row: 0, error: `${xlsxFile.originalname}: ${(err as Error).message}` });
    }
  }

  res.json({ created: created.length, createdNames: created, errors });
});

const PORT = Number(process.env.PORT ?? 4000);
seedAdminIfNeeded(prisma).then(() => {
  app.listen(PORT, () => console.log(`TestAgent API → http://localhost:${PORT}`));
});
