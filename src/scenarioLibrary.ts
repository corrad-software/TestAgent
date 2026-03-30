import { prisma } from "./db";
import type { TestType } from "./testSuites";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseJson = <T>(s: string | null | undefined, fallback: T): T => {
  try { return s ? JSON.parse(s) as T : fallback; } catch { return fallback; }
};

// ─── Types (API surface, same shape as before) ────────────────────────────────

export interface Project {
  id: string; name: string; description?: string;
  createdAt: string; updatedAt: string;
}
export interface Module {
  id: string; projectId: string; name: string; description?: string;
  createdAt: string; updatedAt: string;
}
export interface ScenarioAuthConfig { loginUrl: string; email: string; password: string; }
export interface ProjectRole {
  id: string; projectId: string; name: string; color: string; createdAt: string;
}
export interface TestStep {
  id: string;
  action: "navigate" | "click" | "fill" | "select" | "check" | "uncheck" | "hover" | "wait" | "screenshot" | "assert_visible" | "assert_text" | "assert_url" | "custom";
  target?: string;
  input?: string;
  expected?: string;
  description?: string;
}
export interface Scenario {
  id: string; moduleId: string; assigneeId?: string; roleId?: string;
  testCaseId?: string; scenarioRefId?: string;
  name: string; url: string; testTypes: TestType[];
  description?: string; tags: string[]; authConfig?: ScenarioAuthConfig;
  customSpec?: string; testSteps?: TestStep[];
  createdAt: string; updatedAt: string;
}
export interface RunRecord {
  id: string; scenarioId: string; runAt: string; passed: boolean;
  summary: string; reportId?: string; durationMs: number; logs?: string; runBy?: string;
}
export interface Member {
  id: string; projectId: string; name: string; email: string;
  role: string; avatarUrl?: string; createdAt: string;
}
export type ModuleWithScenarios = Module & { scenarios: Scenario[] };
export type ProjectWithModules  = Project & { modules: ModuleWithScenarios[]; members?: { id: string; name: string; email: string; role: string; avatarUrl: string | null }[] };

// ─── Row mappers ──────────────────────────────────────────────────────────────

function mapProject(p: any): Project {
  return { id: p.id, name: p.name, description: p.description ?? undefined,
           createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
           updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : p.updatedAt };
}
function mapModule(m: any): Module {
  return { id: m.id, projectId: m.projectId, name: m.name,
           description: m.description ?? undefined,
           createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
           updatedAt: m.updatedAt instanceof Date ? m.updatedAt.toISOString() : m.updatedAt };
}
function mapRole(r: any): ProjectRole {
  return { id: r.id, projectId: r.projectId, name: r.name, color: r.color,
           createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt };
}
function mapScenario(s: any): Scenario {
  return { id: s.id, moduleId: s.moduleId, assigneeId: s.assigneeId ?? undefined,
           roleId: s.roleId ?? undefined,
           testCaseId: s.testCaseId ?? undefined, scenarioRefId: s.scenarioRefId ?? undefined,
           name: s.name, url: s.url,
           testTypes: parseJson<TestType[]>(s.testTypes, ["smoke"]),
           description: s.description ?? undefined,
           tags: parseJson<string[]>(s.tags, []),
           authConfig: parseJson<ScenarioAuthConfig | undefined>(s.authConfig, undefined),
           customSpec: s.customSpec ?? undefined,
           testSteps: parseJson<TestStep[] | undefined>(s.testSteps, undefined),
           createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
           updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt };
}
function mapRun(r: any): RunRecord {
  return { id: r.id, scenarioId: r.scenarioId,
           runAt: r.runAt instanceof Date ? r.runAt.toISOString() : r.runAt,
           passed: r.passed, summary: r.summary,
           reportId: r.reportId ?? undefined, durationMs: r.durationMs,
           logs: r.logs ?? undefined, runBy: r.runBy ?? undefined };
}
function mapMember(m: any): Member {
  return { id: m.id, projectId: m.projectId, name: m.name, email: m.email,
           role: m.role, avatarUrl: m.avatarUrl ?? undefined,
           createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt };
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function getProjectTree(): Promise<ProjectWithModules[]> {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      modules: { orderBy: { createdAt: "asc" },
        include: { scenarios: { orderBy: { createdAt: "asc" } } } },
      members: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true, role: true, avatarUrl: true } },
    },
  });
  return projects.map(p => ({
    ...mapProject(p),
    modules: p.modules.map(m => ({ ...mapModule(m), scenarios: m.scenarios.map(mapScenario) })),
    members: p.members,
  }));
}

export async function createProject(data: { name: string; description?: string }): Promise<Project> {
  const p = await prisma.project.create({ data: { name: data.name, description: data.description } });
  return mapProject(p);
}
export async function updateProject(id: string, data: Partial<Pick<Project, "name" | "description">>): Promise<Project> {
  const p = await prisma.project.update({ where: { id }, data });
  return mapProject(p);
}
export async function deleteProject(id: string): Promise<void> {
  await prisma.project.delete({ where: { id } });
}

// ─── Modules ──────────────────────────────────────────────────────────────────

export async function createModule(data: { projectId: string; name: string; description?: string }): Promise<Module> {
  const m = await prisma.module.create({ data });
  return mapModule(m);
}
export async function updateModule(id: string, data: Partial<Pick<Module, "name" | "description">>): Promise<Module> {
  const m = await prisma.module.update({ where: { id }, data });
  return mapModule(m);
}
export async function deleteModule(id: string): Promise<void> {
  await prisma.module.delete({ where: { id } });
}

// ─── Scenarios ────────────────────────────────────────────────────────────────

export async function createScenario(data: Omit<Scenario, "id" | "createdAt" | "updatedAt">): Promise<Scenario> {
  const s = await prisma.scenario.create({
    data: {
      moduleId: data.moduleId, assigneeId: data.assigneeId, roleId: data.roleId,
      testCaseId: data.testCaseId, scenarioRefId: data.scenarioRefId,
      name: data.name, url: data.url,
      testTypes: JSON.stringify(data.testTypes),
      description: data.description,
      tags: JSON.stringify(data.tags ?? []),
      authConfig: data.authConfig ? JSON.stringify(data.authConfig) : null,
      customSpec: data.customSpec ?? null,
      testSteps: data.testSteps ? JSON.stringify(data.testSteps) : null,
    },
  });
  return mapScenario(s);
}
export async function updateScenario(id: string, data: Partial<Omit<Scenario, "id" | "moduleId" | "createdAt" | "updatedAt">>): Promise<Scenario> {
  const update: any = { ...data };
  if (data.testTypes !== undefined) update.testTypes = JSON.stringify(data.testTypes);
  if (data.tags      !== undefined) update.tags      = JSON.stringify(data.tags);
  if (data.authConfig !== undefined) update.authConfig = data.authConfig ? JSON.stringify(data.authConfig) : null;
  if (data.customSpec !== undefined) update.customSpec = data.customSpec ?? null;
  if (data.testSteps !== undefined) update.testSteps = data.testSteps ? JSON.stringify(data.testSteps) : null;
  const s = await prisma.scenario.update({ where: { id }, data: update });
  return mapScenario(s);
}
export async function deleteScenario(id: string): Promise<void> {
  await prisma.scenario.delete({ where: { id } });
}
export async function getScenario(id: string): Promise<Scenario | undefined> {
  const s = await prisma.scenario.findUnique({ where: { id } });
  return s ? mapScenario(s) : undefined;
}

// ─── Run History ──────────────────────────────────────────────────────────────

const MAX_HISTORY_PER_SCENARIO = 100;

export async function addRunRecord(record: Omit<RunRecord, "id">): Promise<RunRecord> {
  const r = await prisma.runRecord.create({
    data: {
      scenarioId: record.scenarioId, passed: record.passed,
      summary: record.summary, reportId: record.reportId,
      durationMs: record.durationMs, runAt: new Date(record.runAt),
      logs: record.logs ?? null, runBy: record.runBy ?? null,
    },
  });
  // Prune oldest beyond limit
  const all = await prisma.runRecord.findMany({
    where: { scenarioId: record.scenarioId },
    orderBy: { runAt: "desc" },
    select: { id: true },
  });
  if (all.length > MAX_HISTORY_PER_SCENARIO) {
    const toDelete = all.slice(MAX_HISTORY_PER_SCENARIO).map(x => x.id);
    await prisma.runRecord.deleteMany({ where: { id: { in: toDelete } } });
  }
  return mapRun(r);
}

export async function getScenarioHistory(scenarioId: string): Promise<RunRecord[]> {
  const runs = await prisma.runRecord.findMany({
    where: { scenarioId }, orderBy: { runAt: "desc" },
  });
  return runs.map(mapRun);
}

// ─── Members ──────────────────────────────────────────────────────────────────

export async function getMembers(projectId: string): Promise<Member[]> {
  const members = await prisma.member.findMany({
    where: { projectId }, orderBy: { createdAt: "asc" },
  });
  return members.map(mapMember);
}
export async function createMember(data: { projectId: string; name: string; email: string; role: string; avatarUrl?: string }): Promise<Member> {
  const m = await prisma.member.create({ data });
  return mapMember(m);
}
export async function updateMember(id: string, data: Partial<Pick<Member, "name" | "email" | "role" | "avatarUrl">>): Promise<Member> {
  const m = await prisma.member.update({ where: { id }, data });
  return mapMember(m);
}
export async function deleteMember(id: string): Promise<void> {
  await prisma.member.delete({ where: { id } });
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export interface DashboardStats {
  totalScenarios: number; totalRuns: number; passRate: number; runsThisWeek: number;
  moduleBreakdown: { moduleId: string; moduleName: string; scenarioCount: number; runCount: number; passCount: number; passRate: number }[];
  recentRuns: { runId: string; scenarioId: string; scenarioName: string; moduleName: string; runAt: string; passed: boolean; durationMs: number; summary: string }[];
}

export async function getDashboardStats(projectId?: string): Promise<DashboardStats> {
  const moduleFilter = projectId ? { projectId } : {};
  const modules = await prisma.module.findMany({ where: moduleFilter, include: { scenarios: { select: { id: true } } } });
  const scenarioIds = modules.flatMap(m => m.scenarios.map(s => s.id));

  const [totalRuns, passCount, runsThisWeek] = await Promise.all([
    prisma.runRecord.count({ where: { scenarioId: { in: scenarioIds } } }),
    prisma.runRecord.count({ where: { scenarioId: { in: scenarioIds }, passed: true } }),
    prisma.runRecord.count({ where: { scenarioId: { in: scenarioIds }, runAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
  ]);

  const moduleBreakdown = await Promise.all(modules.map(async m => {
    const mIds = m.scenarios.map(s => s.id);
    const [runCount, mPassCount] = await Promise.all([
      prisma.runRecord.count({ where: { scenarioId: { in: mIds } } }),
      prisma.runRecord.count({ where: { scenarioId: { in: mIds }, passed: true } }),
    ]);
    return { moduleId: m.id, moduleName: m.name, scenarioCount: mIds.length,
             runCount, passCount: mPassCount, passRate: runCount ? Math.round(mPassCount / runCount * 100) : 0 };
  }));

  const recentRaw = await prisma.runRecord.findMany({
    where: { scenarioId: { in: scenarioIds } },
    orderBy: { runAt: "desc" }, take: 20,
    include: { scenario: { include: { module: true } } },
  });
  const recentRuns = recentRaw.map(r => ({
    runId: r.id, scenarioId: r.scenarioId,
    scenarioName: r.scenario?.name ?? "(deleted)",
    moduleName: r.scenario?.module?.name ?? "(deleted)",
    runAt: r.runAt instanceof Date ? r.runAt.toISOString() : r.runAt,
    passed: r.passed, durationMs: r.durationMs, summary: r.summary,
  }));

  return {
    totalScenarios: scenarioIds.length, totalRuns,
    passRate: totalRuns ? Math.round(passCount / totalRuns * 100) : 0,
    runsThisWeek, moduleBreakdown, recentRuns,
  };
}

// ─── Project Runs (all runs for report history) ─────────────────────────────

export interface ProjectRun {
  runId: string; scenarioId: string; scenarioName: string; moduleName: string;
  testCaseId?: string; runAt: string; passed: boolean; summary: string;
  reportId?: string; durationMs: number; logs?: string; runBy?: string;
}

export async function getProjectRuns(projectId: string, limit = 200): Promise<ProjectRun[]> {
  const modules = await prisma.module.findMany({
    where: { projectId },
    include: { scenarios: { select: { id: true } } },
  });
  const scenarioIds = modules.flatMap(m => m.scenarios.map(s => s.id));
  if (!scenarioIds.length) return [];

  const runs = await prisma.runRecord.findMany({
    where: { scenarioId: { in: scenarioIds } },
    orderBy: { runAt: "desc" },
    take: limit,
    include: { scenario: { include: { module: true } } },
  });

  return runs.map(r => ({
    runId: r.id,
    scenarioId: r.scenarioId,
    scenarioName: r.scenario?.name ?? "(deleted)",
    moduleName: r.scenario?.module?.name ?? "(deleted)",
    testCaseId: (r.scenario as any)?.testCaseId ?? undefined,
    runAt: r.runAt instanceof Date ? r.runAt.toISOString() : r.runAt,
    passed: r.passed,
    summary: r.summary,
    reportId: r.reportId ?? undefined,
    durationMs: r.durationMs,
    logs: r.logs ?? undefined,
    runBy: r.runBy ?? undefined,
  }));
}

// ─── Daily Stats (time-series) ───────────────────────────────────────────────

export interface DailyStats {
  days: { date: string; totalRuns: number; passCount: number; failCount: number; passRate: number }[];
}

export async function getDailyStats(projectId?: string, rangeDays = 30): Promise<DailyStats> {
  const moduleFilter = projectId ? { projectId } : {};
  const modules = await prisma.module.findMany({ where: moduleFilter, include: { scenarios: { select: { id: true } } } });
  const scenarioIds = modules.flatMap(m => m.scenarios.map(s => s.id));

  const since = new Date(Date.now() - rangeDays * 86400000);
  const runs = await prisma.runRecord.findMany({
    where: { scenarioId: { in: scenarioIds }, runAt: { gte: since } },
    select: { runAt: true, passed: true },
    orderBy: { runAt: "asc" },
  });

  // Group by date
  const dayMap = new Map<string, { total: number; pass: number }>();
  for (const r of runs) {
    const d = (r.runAt instanceof Date ? r.runAt : new Date(r.runAt)).toISOString().slice(0, 10);
    const entry = dayMap.get(d) ?? { total: 0, pass: 0 };
    entry.total++;
    if (r.passed) entry.pass++;
    dayMap.set(d, entry);
  }

  // Fill missing days
  const days: DailyStats["days"] = [];
  for (let i = rangeDays - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const entry = dayMap.get(date);
    if (entry) {
      days.push({ date, totalRuns: entry.total, passCount: entry.pass, failCount: entry.total - entry.pass, passRate: entry.total ? Math.round(entry.pass / entry.total * 100) : 0 });
    } else {
      days.push({ date, totalRuns: 0, passCount: 0, failCount: 0, passRate: 0 });
    }
  }

  return { days };
}

// ─── Legacy compat (used by import route) ────────────────────────────────────

export async function getLibrary() {
  const projects = await prisma.project.findMany();
  const modules  = await prisma.module.findMany();
  const scenarios = await prisma.scenario.findMany();
  return {
    projects: projects.map(mapProject),
    modules:  modules.map(mapModule),
    scenarios: scenarios.map(mapScenario),
  };
}

// ─── Project Roles ────────────────────────────────────────────────────────────

export async function getRoles(projectId: string): Promise<ProjectRole[]> {
  const rows = await prisma.projectRole.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } });
  return rows.map(mapRole);
}
export async function createRole(data: { projectId: string; name: string; color?: string }): Promise<ProjectRole> {
  const r = await prisma.projectRole.create({ data: { projectId: data.projectId, name: data.name.trim(), color: data.color ?? "gray" } });
  return mapRole(r);
}
export async function updateRole(id: string, data: Partial<Pick<ProjectRole, "name" | "color">>): Promise<ProjectRole> {
  const r = await prisma.projectRole.update({ where: { id }, data });
  return mapRole(r);
}
export async function deleteRole(id: string): Promise<void> {
  await prisma.projectRole.delete({ where: { id } });
}

// ─── Environments ────────────────────────────────────────────────────────────

export interface Environment {
  id: string; projectId: string; name: string; baseUrl: string;
  authConfig?: { loginUrl: string; email: string; password: string };
  isDefault: boolean; createdAt: string;
}

function mapEnv(e: any): Environment {
  return {
    id: e.id, projectId: e.projectId, name: e.name, baseUrl: e.baseUrl,
    authConfig: e.authConfig ? JSON.parse(e.authConfig) : undefined,
    isDefault: e.isDefault,
    createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
  };
}

export async function getEnvironments(projectId: string): Promise<Environment[]> {
  const rows = await prisma.environment.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } });
  return rows.map(mapEnv);
}
export async function createEnvironment(data: { projectId: string; name: string; baseUrl: string; authConfig?: { loginUrl: string; email: string; password: string }; isDefault?: boolean }): Promise<Environment> {
  // If setting as default, unset other defaults
  if (data.isDefault) {
    await prisma.environment.updateMany({ where: { projectId: data.projectId, isDefault: true }, data: { isDefault: false } });
  }
  const e = await prisma.environment.create({
    data: { projectId: data.projectId, name: data.name, baseUrl: data.baseUrl, authConfig: data.authConfig ? JSON.stringify(data.authConfig) : null, isDefault: data.isDefault ?? false },
  });
  return mapEnv(e);
}
export async function updateEnvironment(id: string, data: Partial<Pick<Environment, "name" | "baseUrl" | "isDefault"> & { authConfig?: { loginUrl: string; email: string; password: string } | null }>): Promise<Environment> {
  const update: any = { ...data };
  if (data.authConfig !== undefined) update.authConfig = data.authConfig ? JSON.stringify(data.authConfig) : null;
  if (data.isDefault) {
    const env = await prisma.environment.findUnique({ where: { id } });
    if (env) await prisma.environment.updateMany({ where: { projectId: env.projectId, isDefault: true }, data: { isDefault: false } });
  }
  const e = await prisma.environment.update({ where: { id }, data: update });
  return mapEnv(e);
}
export async function deleteEnvironment(id: string): Promise<void> {
  await prisma.environment.delete({ where: { id } });
}
