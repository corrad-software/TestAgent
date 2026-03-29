import { useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import PageHeader from "../components/PageHeader";

interface Section {
  id: string;
  title: string;
  content: React.ReactNode;
}

const sections: Section[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    content: (
      <div className="space-y-4">
        <p>
          <strong>TestAgent</strong> is an AI-powered end-to-end testing platform built on Playwright and Claude.
          It lets you create, organize, run, and report on browser-based tests — with optional AI enrichment for smarter assertions.
        </p>
        <h4 className="text-sm font-semibold text-white mt-4">Signing In</h4>
        <ol className="list-decimal list-inside space-y-1 text-gray-400">
          <li>Navigate to the login page.</li>
          <li>Enter the email and password provided by your administrator.</li>
          <li>Click <strong className="text-gray-200">Sign in</strong>.</li>
        </ol>
        <p className="text-gray-500 text-xs">First-time accounts are created by an admin from the Users page.</p>

        <h4 className="text-sm font-semibold text-white mt-4">Navigation</h4>
        <p className="text-gray-400">
          The sidebar on the left gives you access to every section. Click the toggle icon at the top to expand or collapse it.
          Admin-only pages (Users, App Settings, Tech Stack, API Explorer) are visible only to administrators.
        </p>
      </div>
    ),
  },
  {
    id: "projects",
    title: "Projects",
    content: (
      <div className="space-y-4">
        <p className="text-gray-400">
          Projects are the top-level containers for your test suites. Each project holds modules, scenarios, environments, and team members.
        </p>

        <h4 className="text-sm font-semibold text-white">Creating a Project</h4>
        <ol className="list-decimal list-inside space-y-1 text-gray-400">
          <li>Click <strong className="text-gray-200">New Project</strong> in the header.</li>
          <li>Enter a name (required) and an optional description.</li>
          <li>Press <strong className="text-gray-200">Create</strong> or hit Enter.</li>
        </ol>

        <h4 className="text-sm font-semibold text-white mt-4">Project Cards</h4>
        <p className="text-gray-400">
          Each card shows the project name, description, module & scenario counts, team member avatars, and the last-updated timestamp. Click a card to open the <strong className="text-gray-200">Project Hub</strong>.
        </p>
      </div>
    ),
  },
  {
    id: "project-hub",
    title: "Project Hub",
    content: (
      <div className="space-y-4">
        <p className="text-gray-400">
          The Project Hub is the central workspace for a single project. It has three tabs:
        </p>

        <h4 className="text-sm font-semibold text-white">Dashboard</h4>
        <ul className="list-disc list-inside space-y-1 text-gray-400">
          <li>Pass rate, total runs, and runs this week.</li>
          <li>Module breakdown with per-module pass rates.</li>
          <li>Recent runs list with scenario name and result.</li>
        </ul>

        <h4 className="text-sm font-semibold text-white mt-4">Test Execution</h4>
        <ul className="list-disc list-inside space-y-1 text-gray-400">
          <li>View all modules and their nested scenarios.</li>
          <li>Create, edit, or delete modules and scenarios.</li>
          <li>Import scenarios from Excel, CSV, or Katalon files.</li>
          <li>Run a scenario and view its execution history.</li>
        </ul>

        <h4 className="text-sm font-semibold text-white mt-4">Settings</h4>
        <ul className="list-disc list-inside space-y-1 text-gray-400">
          <li><strong className="text-gray-300">Project Info</strong> — update name and description.</li>
          <li><strong className="text-gray-300">Environments</strong> — manage base URLs and per-environment auth credentials.</li>
          <li><strong className="text-gray-300">Team Members</strong> — add, edit, or remove members.</li>
          <li><strong className="text-gray-300">Danger Zone</strong> — permanently delete the project (requires typing the project name to confirm).</li>
        </ul>
      </div>
    ),
  },
  {
    id: "modules-scenarios",
    title: "Modules & Scenarios",
    content: (
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-white">Modules</h4>
        <p className="text-gray-400">
          Modules are logical groupings inside a project (e.g., "Login", "Checkout", "Admin Panel").
          Create them from the Test Execution tab.
        </p>

        <h4 className="text-sm font-semibold text-white mt-4">Scenarios</h4>
        <p className="text-gray-400">
          A scenario is a single test case. Each scenario has:
        </p>
        <ul className="list-disc list-inside space-y-1 text-gray-400">
          <li><strong className="text-gray-300">URL</strong> — the page under test.</li>
          <li><strong className="text-gray-300">Test Types</strong> — one or more from: Smoke, Navigation, Forms, Responsive, Accessibility, Quick.</li>
          <li><strong className="text-gray-300">Auth Config</strong> — optional login credentials for authenticated pages.</li>
          <li><strong className="text-gray-300">Custom Spec</strong> — recorded or hand-written Playwright code.</li>
          <li><strong className="text-gray-300">Tags</strong> — free-text labels for filtering.</li>
        </ul>

        <h4 className="text-sm font-semibold text-white mt-4">Importing Scenarios</h4>
        <p className="text-gray-400">
          Click the import button on the Test Execution tab and upload an <code className="text-emerald-400 bg-gray-800 px-1 rounded">.xlsx</code>, <code className="text-emerald-400 bg-gray-800 px-1 rounded">.csv</code>, or Katalon <code className="text-emerald-400 bg-gray-800 px-1 rounded">.tc/.groovy</code> file.
          Scenarios are created under the selected module.
        </p>
      </div>
    ),
  },
  {
    id: "quick-run",
    title: "Quick Run Test",
    content: (
      <div className="space-y-4">
        <p className="text-gray-400">
          Quick Run lets you execute ad-hoc tests without saving a scenario. It's ideal for exploratory testing or one-off checks.
        </p>

        <h4 className="text-sm font-semibold text-white">Running a Template Test</h4>
        <ol className="list-decimal list-inside space-y-1 text-gray-400">
          <li>Enter the URL you want to test.</li>
          <li>Select one or more test types.</li>
          <li>Optionally add a focus/description to guide the test.</li>
          <li>Toggle <strong className="text-gray-200">Headed</strong> mode if you want to watch the browser.</li>
          <li>Click <strong className="text-gray-200">Run</strong>.</li>
        </ol>

        <h4 className="text-sm font-semibold text-white mt-4">Test Types</h4>
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="py-2 pr-4 text-gray-400 font-medium">Type</th>
              <th className="py-2 text-gray-400 font-medium">What It Checks</th>
            </tr>
          </thead>
          <tbody className="text-gray-400">
            <tr className="border-b border-gray-800/50"><td className="py-2 pr-4 text-gray-200">Smoke</td><td className="py-2">Page loads, title, headings, links visible</td></tr>
            <tr className="border-b border-gray-800/50"><td className="py-2 pr-4 text-gray-200">Navigation</td><td className="py-2">Clicks up to 5 links, verifies navigation works</td></tr>
            <tr className="border-b border-gray-800/50"><td className="py-2 pr-4 text-gray-200">Forms</td><td className="py-2">Fills inputs, validates empty submission and invalid email</td></tr>
            <tr className="border-b border-gray-800/50"><td className="py-2 pr-4 text-gray-200">Responsive</td><td className="py-2">Screenshots at 375px, 768px, and 1280px widths</td></tr>
            <tr className="border-b border-gray-800/50"><td className="py-2 pr-4 text-gray-200">Accessibility</td><td className="py-2">Headings, image alt text, keyboard nav, ARIA landmarks</td></tr>
            <tr><td className="py-2 pr-4 text-gray-200">Quick</td><td className="py-2">8 built-in checks (HTTP, title, images, JS errors) — no Playwright needed</td></tr>
          </tbody>
        </table>

        <h4 className="text-sm font-semibold text-white mt-4">Recording</h4>
        <p className="text-gray-400">
          Click the <strong className="text-gray-200">Record</strong> button to launch Playwright Codegen. Interact with your site in the browser that opens — your actions are captured as Playwright code.
          When finished, you can review the generated code, edit it, or use <strong className="text-gray-200">AI Enrich</strong> to add intelligent assertions.
        </p>

        <h4 className="text-sm font-semibold text-white mt-4">AI Enrichment</h4>
        <p className="text-gray-400">
          After recording, click <strong className="text-gray-200">AI Enrich</strong> to have Claude analyze your recording and add meaningful expect-assertions.
          This turns a simple recording into a robust test.
        </p>

        <h4 className="text-sm font-semibold text-white mt-4">Live Output</h4>
        <p className="text-gray-400">
          While a test is running, the console at the bottom streams real-time logs. After completion, a banner shows pass/fail status with a summary. Click the report link to open the full Playwright HTML report.
        </p>
      </div>
    ),
  },
  {
    id: "reports",
    title: "Test Reports",
    content: (
      <div className="space-y-4">
        <p className="text-gray-400">
          The Reports page shows a history of every test run across all projects.
        </p>

        <h4 className="text-sm font-semibold text-white">Filtering & Search</h4>
        <ul className="list-disc list-inside space-y-1 text-gray-400">
          <li>Search by scenario name, module, test case ID, or user.</li>
          <li>Filter by project or by status (Passed / Failed).</li>
        </ul>

        <h4 className="text-sm font-semibold text-white mt-4">Report Table</h4>
        <p className="text-gray-400">Each row shows:</p>
        <ul className="list-disc list-inside space-y-1 text-gray-400">
          <li>Pass/fail indicator (green or red dot).</li>
          <li>Scenario name, project, module, test case ID.</li>
          <li>Who ran the test and when.</li>
          <li>Duration in seconds.</li>
          <li>Link to the full Playwright HTML report.</li>
        </ul>

        <h4 className="text-sm font-semibold text-white mt-4">Expanding a Row</h4>
        <p className="text-gray-400">
          Click any row to expand it and view the full summary and execution logs.
        </p>

        <h4 className="text-sm font-semibold text-white mt-4">Pagination</h4>
        <p className="text-gray-400">
          Results are paginated at 25 per page. Use the controls at the bottom to navigate.
        </p>
      </div>
    ),
  },
  {
    id: "screenshots",
    title: "Screenshots",
    content: (
      <div className="space-y-4">
        <p className="text-gray-400">
          The Screenshots gallery displays all images captured during test runs.
        </p>

        <h4 className="text-sm font-semibold text-white">Browsing</h4>
        <ul className="list-disc list-inside space-y-1 text-gray-400">
          <li>Screenshots are shown in a responsive grid.</li>
          <li>Each card shows the image preview, run ID, test type badge, and timestamp.</li>
          <li>Hover over a card to see a slight zoom effect.</li>
        </ul>

        <h4 className="text-sm font-semibold text-white mt-4">Filtering</h4>
        <ul className="list-disc list-inside space-y-1 text-gray-400">
          <li>Search by run ID or filename.</li>
          <li>Filter by test type (e.g., Smoke, Responsive).</li>
        </ul>

        <h4 className="text-sm font-semibold text-white mt-4">Lightbox</h4>
        <p className="text-gray-400">
          Click any thumbnail to open the full-size image in a lightbox overlay. Click outside the image or the X button to close.
        </p>
      </div>
    ),
  },
  {
    id: "environments",
    title: "Environments",
    content: (
      <div className="space-y-4">
        <p className="text-gray-400">
          Environments let you define different base URLs and auth credentials per context (e.g., Staging, Production, QA).
          They are configured in a project's Settings tab.
        </p>

        <h4 className="text-sm font-semibold text-white">Setting Up an Environment</h4>
        <ol className="list-decimal list-inside space-y-1 text-gray-400">
          <li>Open a project and go to the <strong className="text-gray-200">Settings</strong> tab.</li>
          <li>Under <strong className="text-gray-200">Environments</strong>, click <strong className="text-gray-200">Add Environment</strong>.</li>
          <li>Enter a name and base URL.</li>
          <li>Optionally set auth credentials (login URL, email, password).</li>
          <li>Mark one environment as default if desired.</li>
        </ol>

        <p className="text-gray-400 mt-2">
          When running a scenario, the environment's base URL and auth config are applied automatically.
        </p>
      </div>
    ),
  },
  {
    id: "user-management",
    title: "User Management (Admin)",
    content: (
      <div className="space-y-4">
        <p className="text-gray-400">
          Administrators can manage all users from the <strong className="text-gray-200">Users</strong> page.
        </p>

        <h4 className="text-sm font-semibold text-white">Creating a User</h4>
        <ol className="list-decimal list-inside space-y-1 text-gray-400">
          <li>Click <strong className="text-gray-200">New User</strong>.</li>
          <li>Enter email, name, and password (minimum 6 characters).</li>
          <li>Select a role: <strong className="text-gray-200">Admin</strong> or <strong className="text-gray-200">Tester</strong>.</li>
          <li>Optionally pick an avatar.</li>
          <li>Click <strong className="text-gray-200">Create</strong>.</li>
        </ol>

        <h4 className="text-sm font-semibold text-white mt-4">Managing Users</h4>
        <p className="text-gray-400">Hover over a user row to see action buttons:</p>
        <ul className="list-disc list-inside space-y-1 text-gray-400">
          <li><strong className="text-gray-300">Assign to Project</strong> — add the user to a project with a specific role (Admin, Tester, or Viewer).</li>
          <li><strong className="text-gray-300">Reset Password</strong> — set a new password for the user.</li>
          <li><strong className="text-gray-300">Edit</strong> — change name, email, role, or avatar.</li>
          <li><strong className="text-gray-300">Delete</strong> — remove the user (cannot delete yourself).</li>
        </ul>

        <h4 className="text-sm font-semibold text-white mt-4">Avatars</h4>
        <p className="text-gray-400">
          Choose from 10 preset avatar styles or upload a custom image.
        </p>
      </div>
    ),
  },
  {
    id: "app-settings",
    title: "App Settings (Admin)",
    content: (
      <div className="space-y-4">
        <p className="text-gray-400">
          Global configuration for the TestAgent instance, organized into four tabs.
        </p>

        <h4 className="text-sm font-semibold text-white">AI Configuration</h4>
        <ul className="list-disc list-inside space-y-1 text-gray-400">
          <li><strong className="text-gray-300">Anthropic API Key</strong> — required for AI enrichment and failure explanations.</li>
          <li><strong className="text-gray-300">Model</strong> — Claude Sonnet 4.6, Opus 4.6, or Haiku 4.5.</li>
          <li><strong className="text-gray-300">Max Iterations</strong> — how many times the AI agent retries (1–50).</li>
          <li><strong className="text-gray-300">AI Budget</strong> — spending limit in USD (0 = unlimited).</li>
        </ul>

        <h4 className="text-sm font-semibold text-white mt-4">Test Defaults</h4>
        <ul className="list-disc list-inside space-y-1 text-gray-400">
          <li><strong className="text-gray-300">Default Test Type</strong> — pre-selected type on the Quick Run page.</li>
          <li><strong className="text-gray-300">Default Base URL</strong> — pre-filled URL field.</li>
          <li><strong className="text-gray-300">Browser Mode</strong> — Headless (fast) or Headed (visible).</li>
          <li><strong className="text-gray-300">Timeout</strong> — per-action timeout in ms (5s–120s).</li>
        </ul>

        <h4 className="text-sm font-semibold text-white mt-4">Reports</h4>
        <ul className="list-disc list-inside space-y-1 text-gray-400">
          <li><strong className="text-gray-300">Retention</strong> — days before auto-cleanup (1–365).</li>
          <li><strong className="text-gray-300">Screenshots</strong> — capture always or only on failure.</li>
        </ul>

        <h4 className="text-sm font-semibold text-white mt-4">Notifications</h4>
        <ul className="list-disc list-inside space-y-1 text-gray-400">
          <li><strong className="text-gray-300">Webhook URL</strong> — POST endpoint for Slack, Teams, etc.</li>
          <li><strong className="text-gray-300">Trigger</strong> — send on pass, fail, or both.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "ai-features",
    title: "AI Features",
    content: (
      <div className="space-y-4">
        <p className="text-gray-400">
          TestAgent leverages Claude to make your tests smarter. An Anthropic API key must be configured in App Settings.
        </p>

        <h4 className="text-sm font-semibold text-white">AI Enrichment</h4>
        <p className="text-gray-400">
          After recording a Playwright script (or writing one manually), click <strong className="text-gray-200">AI Enrich</strong>.
          Claude analyzes the page and your recorded actions, then inserts meaningful <code className="text-emerald-400 bg-gray-800 px-1 rounded">expect()</code> assertions.
          This turns a bare recording into a proper test.
        </p>

        <h4 className="text-sm font-semibold text-white mt-4">Failure Explanation</h4>
        <p className="text-gray-400">
          When a scenario fails, you can request an AI explanation. Claude reads the test output and logs to suggest the probable root cause and a recommended fix.
        </p>

        <h4 className="text-sm font-semibold text-white mt-4">Token Usage</h4>
        <p className="text-gray-400">
          The sidebar shows your current AI spending via an analog gauge (collapsed) or a detailed meter (expanded).
          This tracks total cost, call count, and tokens used. If a budget is set, you'll see remaining balance and a usage bar.
        </p>
      </div>
    ),
  },
  {
    id: "api-explorer",
    title: "API Explorer (Admin)",
    content: (
      <div className="space-y-4">
        <p className="text-gray-400">
          Interactive documentation for the TestAgent REST API. Useful for integrating with CI/CD pipelines or building custom tooling.
        </p>

        <h4 className="text-sm font-semibold text-white">Using the Explorer</h4>
        <ul className="list-disc list-inside space-y-1 text-gray-400">
          <li>Endpoints are grouped by function (Auth, Projects, Scenarios, etc.).</li>
          <li>Click a group header to expand or collapse it.</li>
          <li>Click an endpoint to see its details: method, path, request body, and response format.</li>
          <li>Use <strong className="text-gray-200">Try it</strong> on safe GET endpoints to test them live.</li>
          <li>Use <strong className="text-gray-200">Copy cURL</strong> to get a ready-to-paste command.</li>
        </ul>

        <h4 className="text-sm font-semibold text-white mt-4">Badges</h4>
        <ul className="list-disc list-inside space-y-1 text-gray-400">
          <li><span className="text-emerald-400">GET</span> — read data.</li>
          <li><span className="text-blue-400">POST</span> — create or trigger actions.</li>
          <li><span className="text-amber-400">PUT</span> — update existing data.</li>
          <li><span className="text-red-400">DELETE</span> — remove data.</li>
          <li><span className="text-purple-400">SSE</span> — streaming endpoint (real-time output).</li>
        </ul>
      </div>
    ),
  },
  {
    id: "keyboard-shortcuts",
    title: "Tips & Shortcuts",
    content: (
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-white">General</h4>
        <ul className="list-disc list-inside space-y-1 text-gray-400">
          <li>Press <kbd className="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-xs text-gray-300">Enter</kbd> to confirm most dialogs.</li>
          <li>Press <kbd className="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-xs text-gray-300">Escape</kbd> to close modals.</li>
          <li>The sidebar remembers its collapsed/expanded state during your session.</li>
        </ul>

        <h4 className="text-sm font-semibold text-white mt-4">Quick Run Tips</h4>
        <ul className="list-disc list-inside space-y-1 text-gray-400">
          <li>Use <strong className="text-gray-200">Quick</strong> test type for the fastest feedback — it doesn't launch Playwright.</li>
          <li>Combine multiple test types in a single run for comprehensive coverage.</li>
          <li>Use <strong className="text-gray-200">Headed</strong> mode when debugging — you can watch the browser interact with your site.</li>
          <li>After recording, always review the generated code before running.</li>
        </ul>

        <h4 className="text-sm font-semibold text-white mt-4">Best Practices</h4>
        <ul className="list-disc list-inside space-y-1 text-gray-400">
          <li>Organize scenarios into modules that mirror your application's structure.</li>
          <li>Use environments to avoid hardcoding URLs and credentials.</li>
          <li>Set up a webhook to get notified of failures in Slack or Teams.</li>
          <li>Review the AI Budget in App Settings to avoid surprise costs.</li>
          <li>Use tags on scenarios to enable quick filtering.</li>
        </ul>
      </div>
    ),
  },
];

export default function UserManual() {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(["getting-started"]));
  const [search, setSearch] = useState("");

  function toggle(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setExpandedIds(new Set(sections.map(s => s.id)));
  }

  function collapseAll() {
    setExpandedIds(new Set());
  }

  const filtered = search.trim()
    ? sections.filter(s => s.title.toLowerCase().includes(search.toLowerCase()))
    : sections;

  return (
    <div className="flex flex-col h-screen">
      <PageHeader title="User Manual" subtitle="How to use TestAgent">
        <div className="flex items-center gap-2">
          <button onClick={expandAll} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition">
            Expand All
          </button>
          <button onClick={collapseAll} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition">
            Collapse All
          </button>
        </div>
      </PageHeader>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar — Table of Contents */}
        <aside className="w-56 shrink-0 border-r border-gray-800 bg-gray-900/40 flex flex-col overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-gray-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-gray-900 border border-gray-800 rounded-md text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          {/* Section links */}
          <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {filtered.map((s) => {
              const isActive = expandedIds.has(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setExpandedIds(prev => new Set(prev).add(s.id));
                    document.getElementById(`section-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition
                    ${isActive ? "bg-emerald-500/10 text-emerald-400" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"}`}
                >
                  <span className="text-gray-600 w-4 text-right shrink-0">{sections.indexOf(s) + 1}.</span>
                  <span className="truncate">{s.title}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center text-gray-600 text-xs py-6">No match</p>
            )}
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-2">
            {filtered.map((section) => {
              const isOpen = expandedIds.has(section.id);
              return (
                <div
                  key={section.id}
                  id={`section-${section.id}`}
                  className="border border-gray-800 rounded-lg overflow-hidden bg-gray-900/30"
                >
                  <button
                    onClick={() => toggle(section.id)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-800/50 transition"
                  >
                    {isOpen
                      ? <ChevronDown className="w-4 h-4 text-emerald-400 shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
                    }
                    <span className={`text-sm font-semibold ${isOpen ? "text-emerald-400" : "text-gray-200"}`}>
                      {section.title}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-sm leading-relaxed border-t border-gray-800/50">
                      {section.content}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-10 pt-6 border-t border-gray-800 text-center">
            <p className="text-xs text-gray-600">
              TestAgent — AI-powered E2E testing with Playwright & Claude
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
