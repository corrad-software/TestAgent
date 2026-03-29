import { Bot, Shield, FlaskConical, BarChart2, Users, Cpu, Globe, Upload, Code2, Sparkles, Play, Layers, Settings2, Monitor, FileText, Camera } from "lucide-react";
import PageHeader from "../components/PageHeader";

const VERSION = "1.2.0";
const BUILD_DATE = "2026-03-28";

interface Feature {
  icon: React.FC<{ className?: string }>;
  title: string;
  description: string;
  color: string;
}

const FEATURES: Feature[] = [
  { icon: FlaskConical, title: "Template-Based Testing", description: "6 built-in test types — smoke, navigation, forms, responsive, accessibility, and quick checks. No coding required.", color: "text-emerald-400" },
  { icon: Play, title: "Playwright Codegen Recorder", description: "Record browser interactions with Playwright Codegen. Captured scripts are saved and replayable as custom specs.", color: "text-violet-400" },
  { icon: Sparkles, title: "AI-Powered Enrichment", description: "Claude AI analyzes recorded specs and injects expect() assertions. Failure explainer provides plain-English debugging help.", color: "text-amber-400" },
  { icon: Layers, title: "Project Hub", description: "Organize tests into Projects, Modules, and Scenarios. Dashboard, test execution, and settings all in one tabbed view.", color: "text-sky-400" },
  { icon: BarChart2, title: "Analytics Dashboard", description: "Pass rate trends, daily run charts, module breakdown, and recent runs — all scoped per project with Recharts visualizations.", color: "text-pink-400" },
  { icon: Users, title: "User & Team Management", description: "Role-based access (Admin/Tester). Assign users to projects, manage team members, preset avatars, and project-level roles.", color: "text-teal-400" },
  { icon: Shield, title: "Authentication & Security", description: "JWT + bcrypt auth with HTTP-only cookies. Admin-only routes for settings, user management, and system configuration.", color: "text-rose-400" },
  { icon: Globe, title: "Environment Management", description: "Configure multiple environments per project with base URLs and auth credentials. Switch contexts without editing scenarios.", color: "text-cyan-400" },
  { icon: Upload, title: "Bulk Import", description: "Import test scenarios from Excel, CSV, DSSB format, or Katalon .tc files. Auto-creates projects, modules, and scenarios.", color: "text-orange-400" },
  { icon: Code2, title: "Custom Spec Editor", description: "Edit recorded Playwright TypeScript code directly in the browser. Full control over test logic with syntax-highlighted viewer.", color: "text-indigo-400" },
  { icon: Monitor, title: "Headed & Headless Modes", description: "Run tests with a visible browser for debugging or headless for CI. Per-scenario and global default configuration.", color: "text-lime-400" },
  { icon: FileText, title: "HTML & JSON Reports", description: "Playwright generates HTML reports per run. Browse, filter, and download from the Reports page. JSON results available via API.", color: "text-purple-400" },
  { icon: Camera, title: "Screenshot Gallery", description: "Capture and browse screenshots from test runs. Visual evidence for debugging failures and documenting test coverage.", color: "text-fuchsia-400" },
  { icon: Cpu, title: "AI Token Tracking", description: "Real-time cost monitoring with analog gauge in sidebar. Set budgets, track spend per model, and monitor API usage.", color: "text-violet-400" },
  { icon: Settings2, title: "Configurable Settings", description: "Choose AI model, set timeouts, configure webhooks, manage API keys, and control report retention — all from the UI.", color: "text-gray-400" },
];

interface ChangelogEntry {
  version: string;
  date: string;
  changes: { type: "added" | "changed" | "removed" | "fixed"; items: string[] }[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.2.0",
    date: "2026-03-28",
    changes: [
      { type: "added", items: [
        "Project Hub — tabbed view combining Dashboard, Test Execution, and Settings per project",
        "User Management page — create users, assign to projects, reset passwords, preset avatars",
        "Environment management — multiple environments per project with auth configs",
        "Screenshot gallery page for visual test evidence",
        "AI budget tracking with analog gauge meter in sidebar",
        "Collapsible sidebar with styled tooltips and enlarged icons",
        "Team members via user search — add existing system users to projects",
        "Danger zone with confirmation for project deletion",
        "Quick Run Test now supports Record, Custom Spec, and AI Enrich",
        "Project-scoped access — non-admin users only see their assigned projects",
      ]},
      { type: "changed", items: [
        "Sidebar defaults to collapsed with white tooltips on hover",
        "All topbars standardized to 52px height",
        "App Settings uses horizontal tab bar (matching Project Hub style)",
        "Project cards show collaborator avatar stack instead of action buttons",
        "Tech Stack and API Explorer restricted to admin-only",
      ]},
    ],
  },
  {
    version: "1.1.0",
    date: "2026-03-28",
    changes: [
      { type: "added", items: [
        "Test Reports page — browse runs with pass/fail filter, search, expandable logs",
        "Custom spec editor — edit Playwright code in detail modal",
        "Negative testing — empty form submission + invalid email validation",
        "AI assertion enrichment — Claude adds expect() to recorded specs",
        "AI failure explainer — plain-English debugging explanations",
        "Playwright Codegen recorder — record browser actions, save as custom spec",
        "Dashboard with Recharts — pass rate trend, daily runs, module breakdown",
        "Search & filter in Library — by name, status, flow type",
        "API Explorer with 40+ documented endpoints",
        "59 unit & integration tests with Vitest",
      ]},
      { type: "changed", items: [
        "Extracted DSSB parser for testability",
        "Scenario list uses table view with aligned columns",
        "Edit modal redesigned as landscape two-column layout",
      ]},
      { type: "removed", items: [
        "Direct Claude API dependency for spec generation (replaced with templates)",
      ]},
    ],
  },
  {
    version: "1.0.0",
    date: "2026-03-27",
    changes: [
      { type: "added", items: [
        "Initial release: AI-powered Playwright test agent",
        "Express API + Prisma SQLite backend",
        "React client with Tailwind CSS",
        "JWT + bcrypt authentication",
        "Scenario library with modules, members, roles",
        "Quick run test page with SSE streaming",
        "Katalon .tc and Excel/CSV import",
        "App settings page",
      ]},
    ],
  },
];

const TYPE_STYLES = {
  added: { label: "Added", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
  changed: { label: "Changed", cls: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
  removed: { label: "Removed", cls: "bg-red-500/15 text-red-400 border-red-500/20" },
  fixed: { label: "Fixed", cls: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
};

export default function About() {
  return (
    <div className="flex flex-col h-screen">
      <PageHeader title="About TestAgent" subtitle={`v${VERSION} — AI-Powered Playwright Test Automation`} />

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Hero */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex items-center gap-5">
          <div className="w-14 h-14 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
            <Bot className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">TestAgent</h2>
            <p className="text-sm text-gray-400 mt-1">
              A full-stack QA automation platform combining template-based test generation,
              Playwright browser recording, and Claude AI enrichment — all managed through a modern React dashboard.
            </p>
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
              <span>Version <span className="text-gray-300 font-mono">{VERSION}</span></span>
              <span>Built {BUILD_DATE}</span>
              <span>React 19 + Express 5 + SQLite</span>
              <span>Playwright 1.58</span>
              <span>Claude AI</span>
            </div>
          </div>
        </div>

        {/* System Capabilities */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">System Capabilities</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FEATURES.map(f => (
              <div key={f.title} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-3">
                <f.icon className={`w-5 h-5 ${f.color} shrink-0 mt-0.5`} />
                <div>
                  <h3 className="text-sm font-semibold text-gray-200">{f.title}</h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Architecture */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Architecture</h2>
          <div className="flex items-center justify-center gap-3 flex-wrap text-xs">
            {[
              { label: "React 19 SPA", cls: "bg-sky-900/30 text-sky-300 border-sky-800/50" },
              { label: "Express 5 API", cls: "bg-gray-800 text-gray-300 border-gray-700" },
              { label: "Prisma + SQLite", cls: "bg-indigo-900/30 text-indigo-300 border-indigo-800/50" },
              { label: "Playwright", cls: "bg-green-900/30 text-green-300 border-green-800/50" },
              { label: "Claude AI", cls: "bg-violet-900/30 text-violet-300 border-violet-800/50" },
              { label: "Recharts", cls: "bg-pink-900/30 text-pink-300 border-pink-800/50" },
            ].map(({ label, cls }) => (
              <span key={label} className={`px-3 py-1.5 rounded-lg border ${cls}`}>{label}</span>
            ))}
          </div>
          <div className="flex items-center justify-center gap-2 mt-3 text-xs text-gray-600">
            <span>TypeScript</span><span>·</span>
            <span>Tailwind CSS 4</span><span>·</span>
            <span>TanStack Query</span><span>·</span>
            <span>Vite 8</span><span>·</span>
            <span>bcrypt + JWT</span><span>·</span>
            <span>SSE Streaming</span>
          </div>
        </div>

        {/* Changelog */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Changelog</h2>
          <div className="space-y-4">
            {CHANGELOG.map(entry => (
              <div key={entry.version} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-3">
                  <span className="text-sm font-bold text-white font-mono">v{entry.version}</span>
                  <span className="text-xs text-gray-500">{entry.date}</span>
                </div>
                <div className="px-5 py-4 space-y-4">
                  {entry.changes.map(({ type, items }) => {
                    const style = TYPE_STYLES[type];
                    return (
                      <div key={type}>
                        <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border mb-2 ${style.cls}`}>
                          {style.label}
                        </span>
                        <ul className="space-y-1">
                          {items.map((item, i) => (
                            <li key={i} className="text-xs text-gray-400 flex gap-2">
                              <span className="text-gray-600 shrink-0">-</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-700 pb-4">
          Built with Claude Code by Anthropic
        </div>
      </div>
    </div>
  );
}
