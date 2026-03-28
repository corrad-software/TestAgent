import { useState } from "react";
import { Lock, Shield, ChevronDown, ChevronRight, Send, Loader, Copy, CheckCircle2 } from "lucide-react";

interface Endpoint {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  description: string;
  auth: boolean;
  admin: boolean;
  body?: Record<string, { type: string; required?: boolean; description: string }>;
  response: string;
  sse?: boolean;
}

const ENDPOINTS: { group: string; endpoints: Endpoint[] }[] = [
  {
    group: "Authentication",
    endpoints: [
      { method: "POST", path: "/auth/login", description: "Login with email and password", auth: false, admin: false,
        body: { email: { type: "string", required: true, description: "User email" }, password: { type: "string", required: true, description: "User password" } },
        response: '{ id, email, name, role }' },
      { method: "POST", path: "/auth/logout", description: "Clear session cookie", auth: false, admin: false, response: '{ ok: true }' },
      { method: "GET", path: "/auth/me", description: "Get current authenticated user", auth: true, admin: false, response: '{ id, email, name, role }' },
      { method: "PUT", path: "/auth/password", description: "Change password", auth: true, admin: false,
        body: { currentPassword: { type: "string", required: true, description: "Current password" }, newPassword: { type: "string", required: true, description: "New password (min 6 chars)" } },
        response: '{ ok: true }' },
    ],
  },
  {
    group: "Projects",
    endpoints: [
      { method: "GET", path: "/library/projects", description: "Get all projects with nested modules and scenarios", auth: true, admin: false, response: 'Project[] (with modules[] and scenarios[])' },
      { method: "POST", path: "/library/projects", description: "Create a new project", auth: true, admin: true,
        body: { name: { type: "string", required: true, description: "Project name" }, description: { type: "string", description: "Optional description" } },
        response: 'Project { id, name, description, createdAt, updatedAt }' },
      { method: "PUT", path: "/library/projects/:id", description: "Update a project", auth: true, admin: true,
        body: { name: { type: "string", description: "New name" }, description: { type: "string", description: "New description" } },
        response: 'Project' },
      { method: "DELETE", path: "/library/projects/:id", description: "Delete project (cascades to modules & scenarios)", auth: true, admin: true, response: '{ ok: true }' },
      { method: "GET", path: "/library/projects/:id/stats", description: "Get dashboard stats for a project", auth: true, admin: false, response: 'DashboardStats { totalScenarios, totalRuns, passRate, runsThisWeek, moduleBreakdown[], recentRuns[] }' },
    ],
  },
  {
    group: "Modules",
    endpoints: [
      { method: "POST", path: "/library/modules", description: "Create a module under a project", auth: true, admin: true,
        body: { projectId: { type: "string", required: true, description: "Parent project ID" }, name: { type: "string", required: true, description: "Module name" }, description: { type: "string", description: "Optional description" } },
        response: 'Module { id, projectId, name, description, createdAt, updatedAt }' },
      { method: "PUT", path: "/library/modules/:id", description: "Update a module", auth: true, admin: true,
        body: { name: { type: "string", description: "New name" }, description: { type: "string", description: "New description" } },
        response: 'Module' },
      { method: "DELETE", path: "/library/modules/:id", description: "Delete module and its scenarios", auth: true, admin: true, response: '{ ok: true }' },
    ],
  },
  {
    group: "Scenarios",
    endpoints: [
      { method: "POST", path: "/library/scenarios", description: "Create a test scenario", auth: true, admin: false,
        body: {
          moduleId: { type: "string", required: true, description: "Parent module ID" },
          name: { type: "string", required: true, description: "Scenario name" },
          url: { type: "string", required: true, description: "Target URL to test" },
          testTypes: { type: "string[]", required: true, description: "Test types: smoke, navigation, forms, responsive, accessibility" },
          testCaseId: { type: "string", description: "Kes ID (optional)" },
          scenarioRefId: { type: "string", description: "Scenario reference ID (optional)" },
          description: { type: "string", description: "Test description" },
          tags: { type: "string[]", description: "Tags array" },
          authConfig: { type: "object", description: '{ loginUrl, email, password }' },
        },
        response: 'Scenario' },
      { method: "PUT", path: "/library/scenarios/:id", description: "Update a scenario", auth: true, admin: false,
        body: { name: { type: "string", description: "Any scenario field" } },
        response: 'Scenario' },
      { method: "DELETE", path: "/library/scenarios/:id", description: "Delete a scenario", auth: true, admin: false, response: '{ ok: true }' },
      { method: "GET", path: "/library/scenarios/:id/history", description: "Get run history for a scenario", auth: true, admin: false, response: 'RunRecord[] { id, scenarioId, runAt, passed, summary, reportId, durationMs }' },
      { method: "POST", path: "/library/scenarios/:id/run", description: "Run a test scenario (SSE stream)", auth: true, admin: false, sse: true,
        body: { headed: { type: "boolean", description: "Run with visible browser" } },
        response: 'SSE events: { type: "log"|"result"|"error", ... }' },
    ],
  },
  {
    group: "Members",
    endpoints: [
      { method: "GET", path: "/library/projects/:id/members", description: "Get project members", auth: true, admin: false, response: 'Member[]' },
      { method: "POST", path: "/library/projects/:id/members", description: "Add a member to project", auth: true, admin: false,
        body: { name: { type: "string", required: true, description: "Member name" }, email: { type: "string", required: true, description: "Member email" }, role: { type: "string", required: true, description: "Role (e.g. Tester)" } },
        response: 'Member' },
      { method: "PUT", path: "/library/members/:id", description: "Update a member", auth: true, admin: false, response: 'Member' },
      { method: "DELETE", path: "/library/members/:id", description: "Remove a member", auth: true, admin: false, response: '{ ok: true }' },
    ],
  },
  {
    group: "Roles",
    endpoints: [
      { method: "GET", path: "/library/projects/:id/roles", description: "Get project roles", auth: true, admin: false, response: 'ProjectRole[]' },
      { method: "POST", path: "/library/projects/:id/roles", description: "Create a project role", auth: true, admin: true,
        body: { name: { type: "string", required: true, description: "Role name" }, color: { type: "string", description: "Color key (gray, blue, emerald, violet, amber, rose, teal, orange)" } },
        response: 'ProjectRole' },
      { method: "PUT", path: "/library/roles/:id", description: "Update a role", auth: true, admin: true, response: 'ProjectRole' },
      { method: "DELETE", path: "/library/roles/:id", description: "Delete a role", auth: true, admin: true, response: '{ ok: true }' },
    ],
  },
  {
    group: "Import",
    endpoints: [
      { method: "GET", path: "/library/import/template", description: "Download Excel import template", auth: true, admin: false, response: '.xlsx file download' },
      { method: "POST", path: "/library/import", description: "Import scenarios from Excel/CSV/Katalon (multipart)", auth: true, admin: false,
        body: {
          files: { type: "File[]", required: true, description: "Upload .xlsx, .csv, .tc, .groovy files" },
          projectId: { type: "string", description: "Target project (for DSSB format)" },
          module: { type: "string", description: "Module name (for Katalon)" },
          defaultUrl: { type: "string", description: "Fallback URL" },
        },
        response: '{ created: number, createdNames: string[], errors: { row, error }[] }' },
    ],
  },
  {
    group: "Quick Run",
    endpoints: [
      { method: "POST", path: "/run-test", description: "Run a quick test (SSE stream)", auth: true, admin: false, sse: true,
        body: {
          url: { type: "string", required: true, description: "Target URL" },
          testTypes: { type: "string[]", description: "Test types to run" },
          description: { type: "string", description: "Test focus description" },
          headed: { type: "boolean", description: "Visible browser" },
          loginUrl: { type: "string", description: "Login page URL" },
          email: { type: "string", description: "Login email" },
          password: { type: "string", description: "Login password" },
        },
        response: 'SSE events: log, result, error, separator' },
    ],
  },
  {
    group: "App Settings",
    endpoints: [
      { method: "GET", path: "/app-settings", description: "Get application settings (masked)", auth: true, admin: true, response: 'AppSettings (API key masked)' },
      { method: "PUT", path: "/app-settings", description: "Update application settings", auth: true, admin: true,
        body: { model: { type: "string", description: "AI model name" }, defaultTestType: { type: "string", description: "Default test type" }, defaultHeadless: { type: "boolean", description: "Default headless mode" } },
        response: 'AppSettings' },
    ],
  },
];

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  POST: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  PUT: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  DELETE: "bg-red-500/20 text-red-300 border-red-500/30",
};

export default function ApiExplorer() {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);
  const [tryResult, setTryResult] = useState<{ path: string; status: number; body: string } | null>(null);
  const [trying, setTrying] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const totalEndpoints = ENDPOINTS.reduce((sum, g) => sum + g.endpoints.length, 0);

  async function tryEndpoint(ep: Endpoint) {
    const key = ep.method + ep.path;
    setTrying(key);
    setTryResult(null);
    try {
      const res = await fetch(ep.path, { method: ep.method });
      const text = await res.text();
      let body: string;
      try { body = JSON.stringify(JSON.parse(text), null, 2); } catch { body = text.substring(0, 500); }
      setTryResult({ path: `${ep.method} ${ep.path}`, status: res.status, body });
    } catch (err) {
      setTryResult({ path: `${ep.method} ${ep.path}`, status: 0, body: (err as Error).message });
    } finally {
      setTrying(null);
    }
  }

  function copyCurl(ep: Endpoint) {
    const curl = `curl -s -b "ta_session=YOUR_TOKEN" ${ep.method !== "GET" ? `-X ${ep.method} ` : ""}http://localhost:4000${ep.path}${ep.body && ep.method !== "GET" ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(Object.fromEntries(Object.entries(ep.body).filter(([_, v]) => v.required).map(([k]) => [k, ""])))}'` : ""}`;
    navigator.clipboard.writeText(curl);
    setCopied(ep.method + ep.path);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="sticky top-0 z-10 bg-gray-950/80 backdrop-blur border-b border-gray-800 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">API Explorer</h1>
            <p className="text-xs text-gray-500 mt-0.5">{totalEndpoints} endpoints across {ENDPOINTS.length} groups</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> GET</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> POST</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> PUT</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> DELETE</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Endpoint list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {ENDPOINTS.map(group => {
            const isGroupOpen = expandedGroup === group.group || expandedGroup === null;
            return (
              <div key={group.group} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                {/* Group header */}
                <button
                  onClick={() => setExpandedGroup(expandedGroup === group.group ? null : group.group)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 transition"
                >
                  <div className="flex items-center gap-3">
                    {isGroupOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                    <span className="text-sm font-semibold text-gray-200">{group.group}</span>
                    <span className="text-xs text-gray-600">{group.endpoints.length} endpoint{group.endpoints.length !== 1 ? "s" : ""}</span>
                  </div>
                </button>

                {/* Endpoints */}
                {isGroupOpen && (
                  <div className="border-t border-gray-800">
                    {group.endpoints.map(ep => {
                      const key = ep.method + ep.path;
                      const isOpen = expandedEndpoint === key;
                      return (
                        <div key={key} className="border-b border-gray-800/50 last:border-b-0">
                          <button
                            onClick={() => setExpandedEndpoint(isOpen ? null : key)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800/30 transition text-left"
                          >
                            <span className={`text-xs font-bold px-2 py-0.5 rounded border shrink-0 ${METHOD_COLORS[ep.method]}`}>
                              {ep.method}
                            </span>
                            <code className="text-xs text-gray-300 font-mono flex-1 truncate">{ep.path}</code>
                            <div className="flex items-center gap-2 shrink-0">
                              {ep.sse && <span className="text-xs bg-purple-900/30 text-purple-300 px-1.5 py-0.5 rounded">SSE</span>}
                              {ep.admin && <span title="Admin required"><Shield className="w-3.5 h-3.5 text-amber-500" /></span>}
                              {ep.auth && <span title="Auth required"><Lock className="w-3.5 h-3.5 text-gray-600" /></span>}
                            </div>
                          </button>

                          {isOpen && (
                            <div className="px-4 pb-4 pt-1 space-y-3 bg-gray-950/50">
                              <p className="text-xs text-gray-400">{ep.description}</p>

                              {/* Auth badges */}
                              <div className="flex gap-2">
                                {ep.auth && (
                                  <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded flex items-center gap-1">
                                    <Lock className="w-3 h-3" /> Auth required
                                  </span>
                                )}
                                {ep.admin && (
                                  <span className="text-xs bg-amber-900/30 text-amber-300 px-2 py-0.5 rounded flex items-center gap-1">
                                    <Shield className="w-3 h-3" /> Admin only
                                  </span>
                                )}
                                {ep.sse && (
                                  <span className="text-xs bg-purple-900/30 text-purple-300 px-2 py-0.5 rounded">Server-Sent Events</span>
                                )}
                              </div>

                              {/* Request body */}
                              {ep.body && (
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Request Body</p>
                                  <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b border-gray-800">
                                          <th className="text-left px-3 py-1.5 text-gray-500 font-semibold">Field</th>
                                          <th className="text-left px-3 py-1.5 text-gray-500 font-semibold">Type</th>
                                          <th className="text-left px-3 py-1.5 text-gray-500 font-semibold">Description</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {Object.entries(ep.body).map(([field, info]) => (
                                          <tr key={field} className="border-b border-gray-800/50 last:border-b-0">
                                            <td className="px-3 py-1.5 font-mono text-gray-300">
                                              {field}{info.required && <span className="text-red-400 ml-0.5">*</span>}
                                            </td>
                                            <td className="px-3 py-1.5 text-gray-500">{info.type}</td>
                                            <td className="px-3 py-1.5 text-gray-600">{info.description}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {/* Response */}
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Response</p>
                                <code className="text-xs text-emerald-400 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 block font-mono">{ep.response}</code>
                              </div>

                              {/* Actions */}
                              <div className="flex gap-2 pt-1">
                                {ep.method === "GET" && !ep.path.includes(":") && (
                                  <button onClick={() => tryEndpoint(ep)} disabled={trying === key}
                                    className="flex items-center gap-1.5 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-medium px-3 py-1.5 rounded-lg transition disabled:opacity-50">
                                    {trying === key ? <Loader className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                    Try it
                                  </button>
                                )}
                                <button onClick={() => copyCurl(ep)}
                                  className="flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 font-medium px-3 py-1.5 rounded-lg transition">
                                  {copied === key ? <CheckCircle2 className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                                  {copied === key ? "Copied" : "Copy cURL"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Response panel */}
        {tryResult && (
          <div className="w-96 shrink-0 border-l border-gray-800 flex flex-col bg-gray-950">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
              <div>
                <p className="text-xs font-semibold text-gray-400">Response</p>
                <p className="text-xs font-mono text-gray-500 mt-0.5">{tryResult.path}</p>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                tryResult.status >= 200 && tryResult.status < 300 ? "bg-green-900/30 text-green-300" :
                tryResult.status >= 400 ? "bg-red-900/30 text-red-300" : "bg-gray-800 text-gray-400"
              }`}>
                {tryResult.status || "ERR"}
              </span>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-gray-400 whitespace-pre-wrap">{tryResult.body}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
