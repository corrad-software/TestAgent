// ─── Typed API client ─────────────────────────────────────────────────────────

export interface Project {
  id: string; name: string; description?: string;
  createdAt: string; updatedAt: string;
  modules: Module[];
}
export interface Module {
  id: string; projectId: string; name: string; description?: string;
  createdAt: string; updatedAt: string;
  scenarios: Scenario[];
}
export interface ProjectRole {
  id: string; projectId: string; name: string; color: string; createdAt: string;
}
export interface Scenario {
  id: string; moduleId: string; assigneeId?: string; roleId?: string;
  testCaseId?: string; scenarioRefId?: string;
  name: string; url: string; testTypes: string[];
  description?: string; tags: string[];
  authConfig?: { loginUrl: string; email: string; password: string };
  createdAt: string; updatedAt: string;
}
export interface RunRecord {
  id: string; scenarioId: string; runAt: string; passed: boolean;
  summary: string; reportId?: string; durationMs: number;
}
export interface Member {
  id: string; projectId: string; name: string; email: string;
  role: string; avatarUrl?: string; createdAt: string;
}
export interface DashboardStats {
  totalScenarios: number; totalRuns: number; passRate: number; runsThisWeek: number;
  moduleBreakdown: { moduleId: string; moduleName: string; scenarioCount: number; runCount: number; passCount: number; passRate: number }[];
  recentRuns: { runId: string; scenarioId: string; scenarioName: string; moduleName: string; runAt: string; passed: boolean; durationMs: number; summary: string }[];
}

const json = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error ?? res.statusText);
  }
  return res.json();
};

// Projects
export const getProjects  = () => fetch("/library/projects").then(r => json<Project[]>(r));
export const createProject = (data: { name: string; description?: string }) =>
  fetch("/library/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => json<Project>(r));
export const updateProject = (id: string, data: Partial<Pick<Project, "name" | "description">>) =>
  fetch(`/library/projects/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => json<Project>(r));
export const deleteProject = (id: string) =>
  fetch(`/library/projects/${id}`, { method: "DELETE" }).then(r => json<{ ok: boolean }>(r));

// Modules
export const createModule = (data: { projectId: string; name: string; description?: string }) =>
  fetch("/library/modules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => json<Module>(r));
export const updateModule = (id: string, data: Partial<Pick<Module, "name" | "description">>) =>
  fetch(`/library/modules/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => json<Module>(r));
export const deleteModule = (id: string) =>
  fetch(`/library/modules/${id}`, { method: "DELETE" }).then(r => json<{ ok: boolean }>(r));

// Scenarios
export const createScenario = (data: Omit<Scenario, "id" | "createdAt" | "updatedAt">) =>
  fetch("/library/scenarios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => json<Scenario>(r));
export const updateScenario = (id: string, data: Partial<Scenario>) =>
  fetch(`/library/scenarios/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => json<Scenario>(r));
export const deleteScenario = (id: string) =>
  fetch(`/library/scenarios/${id}`, { method: "DELETE" }).then(r => json<{ ok: boolean }>(r));
export const getScenarioHistory = (id: string) =>
  fetch(`/library/scenarios/${id}/history`).then(r => json<RunRecord[]>(r));

// Project Roles
export const getRoles    = (projectId: string) => fetch(`/library/projects/${projectId}/roles`).then(r => json<ProjectRole[]>(r));
export const createRole  = (projectId: string, data: { name: string; color?: string }) =>
  fetch(`/library/projects/${projectId}/roles`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => json<ProjectRole>(r));
export const updateRole  = (id: string, data: Partial<Pick<ProjectRole, "name" | "color">>) =>
  fetch(`/library/roles/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => json<ProjectRole>(r));
export const deleteRole  = (id: string) =>
  fetch(`/library/roles/${id}`, { method: "DELETE" }).then(r => json<{ ok: boolean }>(r));

// Members
export const getMembers   = (projectId: string) => fetch(`/library/projects/${projectId}/members`).then(r => json<Member[]>(r));
export const createMember = (projectId: string, data: { name: string; email: string; role: string; avatarUrl?: string }) =>
  fetch(`/library/projects/${projectId}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => json<Member>(r));
export const updateMember = (id: string, data: Partial<Pick<Member, "name" | "email" | "role" | "avatarUrl">>) =>
  fetch(`/library/members/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => json<Member>(r));
export const deleteMember = (id: string) =>
  fetch(`/library/members/${id}`, { method: "DELETE" }).then(r => json<{ ok: boolean }>(r));

// Stats
export const getStats = (projectId?: string) =>
  fetch(projectId ? `/library/projects/${projectId}/stats` : "/library/stats").then(r => json<DashboardStats>(r));

export interface DailyStatsDay { date: string; totalRuns: number; passCount: number; failCount: number; passRate: number }
export interface DailyStats { days: DailyStatsDay[] }
export const getDailyStats = (projectId?: string) =>
  fetch(projectId ? `/library/projects/${projectId}/daily-stats` : "/library/daily-stats").then(r => json<DailyStats>(r));

// Auth
export interface AuthUser { id: string; email: string; name: string; role: string }
export const getMe        = () => fetch("/auth/me").then(r => r.ok ? r.json() as Promise<AuthUser> : Promise.reject());
export const login        = (email: string, password: string) =>
  fetch("/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }).then(r => json<AuthUser>(r));
export const logout       = () => fetch("/auth/logout", { method: "POST" }).then(r => r.json());
export const changePassword = (currentPassword: string, newPassword: string) =>
  fetch("/auth/password", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) }).then(r => json<{ ok: boolean }>(r));

// App Settings
export interface AppSettings {
  anthropicApiKey: string;        // empty string when fetched (masked server-side)
  anthropicApiKeyMasked: string;  // e.g. "sk-ant-•••••••last4"
  model: string;
  maxIterations: number;
  defaultTestType: string;
  defaultHeadless: boolean;
  defaultTimeout: number;
  defaultBaseUrl: string;
  reportRetentionDays: number;
  screenshotOnFailOnly: boolean;
  webhookUrl: string;
  webhookOnPass: boolean;
  webhookOnFail: boolean;
}
export const getAppSettings = () => fetch("/app-settings").then(r => json<AppSettings>(r));
export const updateAppSettings = (data: Partial<AppSettings>) =>
  fetch("/app-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => json<AppSettings>(r));

// Import — accepts .xlsx/.csv and/or .tc (Katalon) + optional .groovy companions
export const importScenarios = (files: File | File[], opts?: { module?: string; defaultUrl?: string; projectId?: string }) => {
  const fd = new FormData();
  const arr = Array.isArray(files) ? files : [files];
  for (const f of arr) fd.append("files", f);
  if (opts?.module)     fd.append("module", opts.module);
  if (opts?.defaultUrl) fd.append("defaultUrl", opts.defaultUrl);
  if (opts?.projectId)  fd.append("projectId", opts.projectId);
  return fetch("/library/import", { method: "POST", body: fd }).then(r => json<{ created: number; createdNames: string[]; errors: { row: number; error: string }[] }>(r));
};
