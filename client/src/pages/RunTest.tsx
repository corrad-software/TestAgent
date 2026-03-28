import { useState, useRef } from "react";
import { Play, Loader, Trash2, Monitor, Globe, ChevronDown, ChevronUp } from "lucide-react";

const TEST_TYPES = [
  { value: "smoke",         emoji: "🔍", label: "Smoke" },
  { value: "navigation",    emoji: "🔗", label: "Navigation" },
  { value: "forms",         emoji: "📝", label: "Forms" },
  { value: "responsive",    emoji: "📱", label: "Responsive" },
  { value: "accessibility", emoji: "♿", label: "Accessibility" },
  { value: "quick",         emoji: "⚡", label: "Quick" },
];

const HINTS: Record<string, string> = {
  smoke:         "Smoke: Claude writes a spec → checks page loads, title, content, JS errors.",
  navigation:    "Navigation: Claude tests all internal links respond correctly.",
  forms:         "Forms: Claude fills form fields with dummy data and checks validation.",
  responsive:    "Responsive: Claude screenshots at 375/768/1280px and checks for overflow.",
  accessibility: "Accessibility: axe-core audit + heading, alt-text, and label checks.",
  quick:         "Quick: No AI — 8 built-in checks (HTTP, title, images, JS errors).",
};


function classifyLine(msg: string): string {
  if (msg.startsWith("🔧") || msg.startsWith("  ✓")) return "text-blue-400";
  if (msg.startsWith("💬")) return "text-emerald-400";
  if (msg.includes("✅") || /^\s+\d+ passed/.test(msg)) return "text-green-400";
  if (msg.includes("❌") || msg.startsWith("  ✗") || /failed/.test(msg)) return "text-red-400";
  if (msg.startsWith("[stderr]")) return "text-red-400";
  return "text-gray-400";
}

export default function RunTest() {
  const [url, setUrl]           = useState("");
  const [desc, setDesc]         = useState("");
  const [testTypes, setTestTypes] = useState<string[]>(["smoke"]);
  const [headed, setHeaded]     = useState(false);
  const [loginUrl, setLoginUrl] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [running, setRunning]   = useState(false);
  const [lines, setLines]       = useState<{ text: string; cls: string }[]>([]);
  const [result, setResult]     = useState<{ passed: boolean; summary: string; reportId: string | null; steps: string[] } | null>(null);
  const [explanation, setExplanation] = useState("");
  const [showSteps, setShowSteps] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);

  const toggleType = (t: string) =>
    setTestTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  function appendLine(text: string, cls: string) {
    setLines(prev => [...prev, { text, cls }]);
    setTimeout(() => consoleRef.current?.scrollTo(0, consoleRef.current.scrollHeight), 50);
  }

  async function runTest() {
    if (!url.trim() || !testTypes.length) return;
    setRunning(true);
    setLines([]);
    setResult(null);
    setExplanation("");

    const authConfig = loginUrl && email && password
      ? { loginUrl, email, password } : undefined;

    try {
      const res = await fetch("/run-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), description: desc.trim() || undefined, testTypes, headed,
          loginUrl: authConfig?.loginUrl, email: authConfig?.email, password: authConfig?.password }),
      });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let expText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n"); buf = parts.pop() ?? "";
        for (const part of parts) {
          if (!part.startsWith("data:")) continue;
          try {
            const ev = JSON.parse(part.replace(/^data:\s*/, ""));
            if (ev.type === "log") appendLine(ev.message, classifyLine(ev.message));
            else if (ev.type === "separator") { appendLine("", ""); appendLine(`▶ Starting ${ev.testType} test…`, "text-gray-400"); }
            else if (ev.type === "result") {
              appendLine("─".repeat(48), "text-gray-800");
              appendLine(ev.passed ? "✅  RESULT: PASS" : "❌  RESULT: FAIL", ev.passed ? "text-green-400" : "text-red-400");
              setResult({ passed: ev.passed, summary: ev.summary, reportId: ev.reportId, steps: ev.steps });
            }
            else if (ev.type === "explanation_start") { expText = ""; }
            else if (ev.type === "explanation_chunk") { expText += ev.text; setExplanation(expText); }
            else if (ev.type === "error") appendLine("ERROR: " + ev.message, "text-red-400");
          } catch { /* skip */ }
        }
      }
    } finally { setRunning(false); }
  }

  function clear() {
    setLines([]); setResult(null); setExplanation("");
    setUrl(""); setDesc(""); setTestTypes(["smoke"]);
    setLoginUrl(""); setEmail(""); setPassword("");
  }

  return (
    <div className="flex flex-col">
      {/* Topbar */}
      <header className="sticky top-0 z-10 bg-gray-950/80 backdrop-blur border-b border-gray-800 px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-white">Quick Run Test</h1>
          <p className="text-xs text-gray-500 mt-0.5">Select a test type, enter a URL, and let the agent do the work</p>
        </div>
        {running && (
          <div className="flex items-center gap-2 text-xs font-medium bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
            Running…
          </div>
        )}
      </header>

      <div className="flex-1 px-8 py-6 space-y-5 max-w-4xl w-full">
        {/* Input card */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
          {/* URL */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">Target URL</label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <input value={url} onChange={e => setUrl(e.target.value)} type="url" placeholder="https://example.com"
                onKeyDown={e => e.key === "Enter" && runTest()}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 transition" />
            </div>
          </div>

          {/* Test types */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">
              Test Type <span className="text-gray-600 font-normal normal-case tracking-normal">— select one or more</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {TEST_TYPES.map(({ value, emoji, label }) => (
                <button key={value} type="button" onClick={() => toggleType(value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition select-none
                    ${testTypes.includes(value)
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                      : "border-gray-700 bg-gray-950 text-gray-400 hover:border-emerald-500/60"}`}>
                  {emoji} {label}
                </button>
              ))}
            </div>
            {testTypes.length > 0 && (
              <p className="text-xs text-gray-500">{testTypes.map(t => HINTS[t]).join(" · ")}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">
              Additional instructions <span className="text-gray-600 font-normal normal-case tracking-normal">— optional</span>
            </label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
              placeholder="e.g. Focus on the login form, check that the sign-up link works…"
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition resize-none" />
          </div>

          {/* Auth collapsible */}
          <details className="group border-t border-gray-800 pt-4">
            <summary className="flex items-center gap-2 cursor-pointer select-none list-none text-xs font-semibold text-gray-500 uppercase tracking-widest w-fit hover:text-gray-300 transition">
              🔒 Login Required
            </summary>
            <div className="mt-3 space-y-2">
              <input value={loginUrl} onChange={e => setLoginUrl(e.target.value)} type="url" placeholder="Login page URL"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition" />
              <div className="grid grid-cols-2 gap-2">
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email / Username"
                  className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition" />
                <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Password"
                  className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition" />
              </div>
            </div>
          </details>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button onClick={runTest} disabled={running || !url.trim() || !testTypes.length}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition">
              {running ? <Loader className="w-4 h-4 spin" /> : <Play className="w-4 h-4" />}
              {running ? "Running…" : "Run Test"}
            </button>
            <button onClick={() => setHeaded(h => !h)}
              className={`flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg border transition
                ${headed ? "border-teal-500 text-teal-300 bg-teal-900/20" : "border-gray-700 text-gray-300 bg-gray-800"}`}>
              <Monitor className="w-4 h-4" />
              {headed ? "Visible Browser" : "Headless"}
            </button>
            <button onClick={clear} disabled={running}
              className="p-2.5 rounded-lg border border-gray-700 text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition disabled:opacity-50">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Result banner */}
        {result && (
          <div className={`border rounded-xl p-5 ${result.passed ? "bg-green-900/10 border-green-800/50" : "bg-red-900/10 border-red-800/50"}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`font-bold text-lg ${result.passed ? "text-green-400" : "text-red-400"}`}>
                  {result.passed ? "✅ PASS" : "❌ FAIL"}
                </p>
                <p className="text-xs text-gray-400 mt-1 whitespace-pre-line">{result.summary}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {result.reportId && (
                  <a href={`/playwright-report/${result.reportId}/index.html`} target="_blank" rel="noreferrer"
                    className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition">
                    View Report
                  </a>
                )}
                <button onClick={() => setShowSteps(s => !s)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition">
                  Steps {showSteps ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
            </div>
            {showSteps && result.steps.length > 0 && (
              <div className="mt-4 border-t border-gray-800 pt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-gray-600 text-left border-b border-gray-800">
                    <th className="px-2 py-1">#</th><th className="px-2 py-1">Step</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {result.steps.map((s, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1 text-gray-700">{i + 1}</td>
                        <td className="px-2 py-1 text-gray-400">{s}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* AI explanation */}
        {explanation && (
          <div className="bg-gray-900 border border-emerald-800/30 rounded-xl p-5">
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-2">🤖 AI Analysis</p>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{explanation}</p>
          </div>
        )}

        {/* Console */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Live Output</span>
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500/40" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/40" />
              <span className="w-3 h-3 rounded-full bg-green-500/40" />
            </div>
          </div>
          <div ref={consoleRef} className="font-mono text-xs leading-relaxed p-5 h-72 overflow-y-auto bg-gray-950">
            {lines.length === 0
              ? <span className="text-gray-600 italic">Output will appear here when a test runs…</span>
              : lines.map((l, i) => <span key={i} className={`block ${l.cls}`}>{l.text || "\u00A0"}</span>)
            }
          </div>
        </div>
      </div>
    </div>
  );
}
