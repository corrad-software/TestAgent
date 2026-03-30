import { useState, useRef, useEffect } from "react";
import { Play, Loader, Trash2, Monitor, Globe, ChevronDown, ChevronUp, Circle, Sparkles, Code2 } from "lucide-react";
import PageHeader from "../components/PageHeader";

const TEST_TYPES = [
  { value: "smoke",         emoji: "🔍", label: "Smoke" },
  { value: "navigation",    emoji: "🔗", label: "Navigation" },
  { value: "forms",         emoji: "📝", label: "Forms" },
  { value: "responsive",    emoji: "📱", label: "Responsive" },
  { value: "accessibility", emoji: "♿", label: "Accessibility" },
  { value: "quick",         emoji: "⚡", label: "Quick" },
];

const HINTS: Record<string, string> = {
  smoke:         "Smoke: Checks page loads, title, headings, links visible.",
  navigation:    "Navigation: Clicks up to 5 links and verifies navigation works.",
  forms:         "Forms: Fills inputs with test data, validates empty submission + invalid email.",
  responsive:    "Responsive: Screenshots at mobile (375px), tablet (768px), desktop (1280px).",
  accessibility: "Accessibility: Checks headings, img alt attrs, keyboard nav, landmarks.",
  quick:         "Quick: 8 built-in checks (HTTP, title, images, JS errors) — no Playwright.",
};

function classifyLine(msg: string): string {
  if (msg.startsWith("🔧") || msg.startsWith("  ✓")) return "text-blue-400";
  if (msg.startsWith("📝")) return "text-violet-400";
  if (msg.includes("✅") || /^\s+\d+ passed/.test(msg)) return "text-green-400";
  if (msg.includes("❌") || msg.startsWith("  ✗") || /failed/.test(msg)) return "text-red-400";
  if (msg.startsWith("[stderr]")) return "text-orange-400";
  if (msg.startsWith("🔐") || msg.startsWith("[AUTH]")) return "text-amber-400";
  if (msg.startsWith("🤖") || msg.startsWith("✨")) return "text-violet-400";
  return "text-gray-400";
}

export default function RunTest() {
  const [url, setUrl]             = useState("");
  const [desc, setDesc]           = useState("");
  const [testTypes, setTestTypes] = useState<string[]>(["smoke"]);
  const [headed, setHeaded]       = useState(false);
  const [loginUrl, setLoginUrl]   = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [running, setRunning]     = useState(false);
  const [lines, setLines]         = useState<{ text: string; cls: string }[]>([]);
  const [result, setResult]       = useState<{ passed: boolean; summary: string; reportId: string | null; steps: string[] } | null>(null);
  const [showSteps, setShowSteps] = useState(false);

  // Recording & custom spec
  const [recording, setRecording]       = useState(false);
  const [recordedCode, setRecordedCode] = useState<string | null>(null);
  const [useRecorded, setUseRecorded]   = useState(false);
  const [showCode, setShowCode]         = useState(false);
  const [enriching, setEnriching]       = useState(false);

  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (consoleRef.current) consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
  }, [lines]);

  const toggleType = (t: string) =>
    setTestTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  function appendLine(text: string, cls: string) {
    setLines(prev => [...prev, { text, cls }]);
  }

  async function runTest() {
    if (!url.trim() || !testTypes.length) return;
    setRunning(true);
    setLines([]);
    setResult(null);

    const authConfig = loginUrl && email && password
      ? { loginUrl, email, password } : undefined;

    try {
      const res = await fetch("/run-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(), description: desc.trim() || undefined, testTypes, headed,
          loginUrl: authConfig?.loginUrl, email: authConfig?.email, password: authConfig?.password,
          customSpec: useRecorded && recordedCode ? recordedCode : undefined,
        }),
      });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";

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
            else if (ev.type === "separator") { appendLine("", ""); appendLine(`▶ Starting ${ev.testType} test…`, "text-emerald-400"); }
            else if (ev.type === "result") {
              appendLine("─".repeat(48), "text-gray-800");
              appendLine(ev.passed ? "✅  RESULT: PASS" : "❌  RESULT: FAIL", ev.passed ? "text-green-400" : "text-red-400");
              setResult({ passed: ev.passed, summary: ev.summary, reportId: ev.reportId, steps: ev.steps });
            }
            else if (ev.type === "error") appendLine("ERROR: " + ev.message, "text-red-400");
          } catch { /* skip */ }
        }
      }
    } finally { setRunning(false); }
  }

  async function record() {
    if (!url.trim()) return;
    setRecording(true);
    setLines([]);
    // If auth is configured, start recording at the login URL so the user can log in first
    const startUrl = loginUrl.trim() || url.trim();
    appendLine("🎬 Starting Playwright Codegen recorder…", "text-violet-400");
    if (loginUrl.trim()) appendLine("🔐 Opening login page — log in first, then navigate to the target page.", "text-amber-400");
    appendLine("Perform actions in the browser, then close it to capture the script.", "text-gray-500");

    try {
      const res = await fetch("/run-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: startUrl, record: true }),
      });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";

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
            else if (ev.type === "recordEnd" && ev.code) {
              setRecordedCode(ev.code);
              setUseRecorded(true);
              appendLine(`✅ Recorded ${ev.code.split("\n").length} lines of Playwright code`, "text-green-400");
            }
            else if (ev.type === "error") appendLine("ERROR: " + ev.message, "text-red-400");
          } catch { /* skip */ }
        }
      }
    } finally { setRecording(false); }
  }

  async function enrichWithAI() {
    if (!recordedCode || !url.trim()) return;
    setEnriching(true);
    setLines([{ text: "✨ Asking AI to add assertions to recorded spec...", cls: "text-violet-400" }]);

    try {
      const res = await fetch("/run-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), enrich: true, customSpec: recordedCode }),
      });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";

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
            else if (ev.type === "enriched" && ev.code) {
              setRecordedCode(ev.code);
              appendLine(`✅ AI added assertions — ${ev.code.split("\n").length} lines total`, "text-green-400");
            }
            else if (ev.type === "error") appendLine("ERROR: " + ev.message, "text-red-400");
          } catch { /* skip */ }
        }
      }
    } finally { setEnriching(false); }
  }

  function clear() {
    setLines([]); setResult(null);
    setUrl(""); setDesc(""); setTestTypes(["smoke"]);
    setLoginUrl(""); setEmail(""); setPassword("");
    setRecordedCode(null); setUseRecorded(false); setShowCode(false);
  }

  return (
    <div className="flex flex-col h-screen">
      <PageHeader title="Quick Run Test" subtitle="Run template-based or recorded Playwright tests">
        {(running || recording || enriching) && (
          <div className="flex items-center gap-2 text-xs font-medium bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full">
            <Loader className="w-3 h-3 animate-spin" />
            {recording ? "Recording…" : enriching ? "Enriching…" : "Running…"}
          </div>
        )}
      </PageHeader>

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-5 space-y-4 max-w-4xl w-full">
          {/* Input card */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            {/* URL + Headed toggle */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                <input value={url} onChange={e => setUrl(e.target.value)} type="url" placeholder="https://example.com"
                  onKeyDown={e => e.key === "Enter" && !running && runTest()}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition" />
              </div>
              <button onClick={() => setHeaded(h => !h)}
                title={headed
                  ? "Visible Browser — opens a real browser window so you can watch the test run. Click to switch to headless."
                  : "Headless — runs in background, faster and uses less resources. Click to switch to visible browser."}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition shrink-0
                  ${headed ? "border-teal-500 text-teal-300 bg-teal-900/20" : "border-gray-700 text-gray-400 bg-gray-800"}`}>
                <Monitor className="w-3.5 h-3.5" />
                {headed ? "Visible Browser" : "Headless"}
              </button>
            </div>

            {/* Test types */}
            <div className="space-y-1.5">
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
                <p className="text-xs text-gray-600">{testTypes.map(t => HINTS[t]).join(" ")}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">
                Focus <span className="text-gray-600 font-normal normal-case tracking-normal">— optional</span>
              </label>
              <input value={desc} onChange={e => setDesc(e.target.value)}
                placeholder="e.g. Focus on the login form, check that the sign-up link works…"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition" />
            </div>

            {/* Recorded spec toggle */}
            {recordedCode && (
              <div className="border-t border-gray-800 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={useRecorded} onChange={e => setUseRecorded(e.target.checked)}
                      className="w-3.5 h-3.5 accent-emerald-500 rounded" />
                    <span className="text-xs font-medium text-gray-300">Use recorded spec ({recordedCode.split("\n").length} lines)</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setShowCode(s => !s)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition">
                      <Code2 className="w-3 h-3" />
                      {showCode ? "Hide" : "View"}
                    </button>
                    <button onClick={enrichWithAI} disabled={enriching || running}
                      className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition disabled:opacity-50">
                      <Sparkles className="w-3 h-3" />
                      AI Enrich
                    </button>
                    <button onClick={() => { setRecordedCode(null); setUseRecorded(false); setShowCode(false); }}
                      className="text-xs text-gray-600 hover:text-red-400 transition">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {showCode && (
                  <pre className="bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs font-mono text-gray-400 max-h-48 overflow-auto">
                    {recordedCode}
                  </pre>
                )}
              </div>
            )}

            {/* Auth */}
            <details className="border-t border-gray-800 pt-3">
              <summary className="flex items-center gap-2 cursor-pointer select-none list-none text-xs font-semibold text-gray-500 uppercase tracking-widest w-fit hover:text-gray-300 transition">
                Login Required <span className="font-normal normal-case tracking-normal text-gray-600">— Record will start at Login URL</span>
              </summary>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <input value={loginUrl} onChange={e => setLoginUrl(e.target.value)} type="url" placeholder="Login URL"
                  className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition" />
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email / Username"
                  className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition" />
                <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Password"
                  className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition" />
              </div>
            </details>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button onClick={runTest} disabled={running || recording || enriching || !url.trim() || !testTypes.length}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition">
                {running ? <Loader className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {running ? "Running…" : useRecorded && recordedCode ? "Run (Recorded)" : "Run Test"}
              </button>
              <button onClick={record} disabled={running || recording || enriching || !url.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-violet-300 hover:border-violet-500/50 hover:bg-violet-900/10 transition disabled:opacity-50 text-sm font-medium">
                {recording ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Circle className="w-3.5 h-3.5 text-red-400" />}
                {recording ? "Recording…" : "Record"}
              </button>
              <button onClick={clear} disabled={running || recording}
                className="p-2 rounded-lg border border-gray-700 text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition disabled:opacity-50"
                title="Clear">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Result banner */}
          {result && (
            <div className={`border rounded-xl p-4 ${result.passed ? "bg-green-900/10 border-green-800/50" : "bg-red-900/10 border-red-800/50"}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={`font-bold text-base ${result.passed ? "text-green-400" : "text-red-400"}`}>
                    {result.passed ? "PASS" : "FAIL"}
                  </p>
                  <p className="text-xs text-gray-400 mt-1 whitespace-pre-line">{result.summary}</p>
                </div>
                <div className="flex gap-2 shrink-0">
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
                <div className="mt-3 border-t border-gray-800 pt-3 max-h-48 overflow-y-auto">
                  {result.steps.map((s, i) => (
                    <div key={i} className="text-xs text-gray-400 py-0.5">{s}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Console */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Live Output</span>
              {(running || recording || enriching) && <Loader className="w-3 h-3 text-emerald-400 animate-spin" />}
            </div>
            <div ref={consoleRef} className="font-mono text-xs leading-relaxed p-4 h-64 overflow-y-auto bg-gray-950">
              {lines.length === 0
                ? <span className="text-gray-700 italic">Output will appear here when a test runs…</span>
                : lines.map((l, i) => <span key={i} className={`block whitespace-pre-wrap ${l.cls}`}>{l.text || "\u00A0"}</span>)
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
