import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bot, Sliders, FileText, Bell, Eye, EyeOff,
  CheckCircle2, AlertCircle, Save,
} from "lucide-react";
import * as api from "../lib/api";
import { SUITE_LABELS } from "../lib/utils";

type Tab = "ai" | "defaults" | "reports" | "notifications";

const MODELS = [
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (recommended)" },
  { value: "claude-opus-4-6",   label: "Claude Opus 4.6 (most capable)" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (fastest)" },
];

const TEST_TYPES = Object.entries(SUITE_LABELS).map(([value, label]) => ({ value, label }));

function TabBtn({ label, icon: Icon, active, onClick }: {
  label: string; icon: React.FC<{ className?: string }>;
  active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition whitespace-nowrap
        ${active ? "bg-emerald-500/10 text-emerald-400" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"}`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-300">{label}</label>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
      {children}
    </div>
  );
}

const inputCls = "w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition";

export default function AppSettings() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("ai");
  const [form, setForm] = useState<Partial<api.AppSettings>>({});
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const { data: settings } = useQuery<api.AppSettings>({
    queryKey: ["app-settings"],
    queryFn: api.getAppSettings,
  });

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const saveMut = useMutation({
    mutationFn: (patch: Partial<api.AppSettings>) => api.updateAppSettings(patch),
    onSuccess: (updated) => {
      qc.setQueryData(["app-settings"], updated);
      setForm(updated);
      setSaved(true);
      setError("");
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (e: Error) => setError(e.message),
  });

  const set = (key: keyof api.AppSettings, value: unknown) =>
    setForm(f => ({ ...f, [key]: value }));

  const handleSave = () => {
    // Strip the masked display field — never send it back
    const { anthropicApiKeyMasked: _, ...patch } = form as api.AppSettings;
    // If key field is empty and we didn't type a new one, omit it
    const toSend: Partial<api.AppSettings> = { ...patch };
    if (!toSend.anthropicApiKey) delete toSend.anthropicApiKey;
    saveMut.mutate(toSend);
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Topbar */}
      <header className="sticky top-0 z-10 bg-gray-950/80 backdrop-blur border-b border-gray-800 px-8 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-base font-semibold text-white">Application Settings</h1>
          <p className="text-xs text-gray-500 mt-0.5">Global configuration for TestAgent</p>
        </div>
        <div className="flex items-center gap-3">
          {error && (
            <span className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle className="w-3.5 h-3.5" /> {error}
            </span>
          )}
          {saved && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saveMut.isPending}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
          >
            <Save className="w-3.5 h-3.5" />
            {saveMut.isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Tab sidebar */}
        <aside className="w-52 shrink-0 border-r border-gray-800 p-3 space-y-1">
          <TabBtn label="AI Configuration" icon={Bot}      active={tab === "ai"}            onClick={() => setTab("ai")} />
          <TabBtn label="Test Defaults"    icon={Sliders}  active={tab === "defaults"}      onClick={() => setTab("defaults")} />
          <TabBtn label="Reports"          icon={FileText} active={tab === "reports"}       onClick={() => setTab("reports")} />
          <TabBtn label="Notifications"    icon={Bell}     active={tab === "notifications"} onClick={() => setTab("notifications")} />
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-xl space-y-6">

            {/* ── AI Configuration ───────────────────────────────────────── */}
            {tab === "ai" && (
              <>
                <SectionHeader title="AI Configuration" desc="Claude model and agent behaviour settings" />

                <Field label="Anthropic API Key" hint="Your key is stored locally and never sent anywhere except the Anthropic API.">
                  <div className="relative">
                    <input
                      type={showKey ? "text" : "password"}
                      value={form.anthropicApiKey ?? ""}
                      onChange={e => set("anthropicApiKey", e.target.value)}
                      placeholder={settings?.anthropicApiKeyMasked || "sk-ant-api03-…"}
                      className={inputCls + " pr-10"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {settings?.anthropicApiKeyMasked && (
                    <p className="text-xs text-gray-600 mt-1">Current: {settings.anthropicApiKeyMasked}</p>
                  )}
                </Field>

                <Field label="Model" hint="Model used for all AI-powered test suites.">
                  <select value={form.model ?? ""} onChange={e => set("model", e.target.value)} className={inputCls}>
                    {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </Field>

                <Field label="Max Iterations" hint="Maximum number of tool-call cycles per agent run (1 – 50).">
                  <div className="flex items-center gap-4">
                    <input
                      type="range" min={1} max={50} step={1}
                      value={form.maxIterations ?? 20}
                      onChange={e => set("maxIterations", Number(e.target.value))}
                      className="flex-1 accent-emerald-500"
                    />
                    <span className="w-8 text-right text-sm font-mono text-gray-200">{form.maxIterations ?? 20}</span>
                  </div>
                </Field>
              </>
            )}

            {/* ── Test Defaults ──────────────────────────────────────────── */}
            {tab === "defaults" && (
              <>
                <SectionHeader title="Test Defaults" desc="Pre-filled values used on the Run Test page" />

                <Field label="Default Test Type">
                  <select value={form.defaultTestType ?? "smoke"} onChange={e => set("defaultTestType", e.target.value)} className={inputCls}>
                    {TEST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </Field>

                <Field label="Default Base URL" hint="Pre-fill the URL field on Run Test (e.g. https://staging.example.com).">
                  <input
                    type="url" value={form.defaultBaseUrl ?? ""}
                    onChange={e => set("defaultBaseUrl", e.target.value)}
                    placeholder="https://example.com"
                    className={inputCls}
                  />
                </Field>

                <Field label="Browser Mode">
                  <div className="flex gap-3">
                    {[
                      { val: true,  label: "Headless", desc: "Faster, no visible browser" },
                      { val: false, label: "Headed",   desc: "See the browser window" },
                    ].map(opt => (
                      <button
                        key={String(opt.val)}
                        onClick={() => set("defaultHeadless", opt.val)}
                        className={`flex-1 border rounded-lg px-3 py-2.5 text-left transition
                          ${form.defaultHeadless === opt.val
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                            : "border-gray-700 bg-gray-950 text-gray-400 hover:border-emerald-500/60"}`}
                      >
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Default Timeout" hint="Per-action timeout in milliseconds (5 000 – 120 000).">
                  <div className="flex items-center gap-4">
                    <input
                      type="range" min={5000} max={120000} step={5000}
                      value={form.defaultTimeout ?? 30000}
                      onChange={e => set("defaultTimeout", Number(e.target.value))}
                      className="flex-1 accent-emerald-500"
                    />
                    <span className="w-16 text-right text-sm font-mono text-gray-200">
                      {((form.defaultTimeout ?? 30000) / 1000).toFixed(0)}s
                    </span>
                  </div>
                </Field>
              </>
            )}

            {/* ── Reports ────────────────────────────────────────────────── */}
            {tab === "reports" && (
              <>
                <SectionHeader title="Reports" desc="Control how test reports are stored and cleaned up" />

                <Field label="Report Retention" hint="Reports older than this many days are eligible for cleanup.">
                  <div className="flex items-center gap-4">
                    <input
                      type="range" min={1} max={365} step={1}
                      value={form.reportRetentionDays ?? 30}
                      onChange={e => set("reportRetentionDays", Number(e.target.value))}
                      className="flex-1 accent-emerald-500"
                    />
                    <span className="w-20 text-right text-sm font-mono text-gray-200">
                      {form.reportRetentionDays ?? 30} days
                    </span>
                  </div>
                </Field>

                <Field label="Screenshots">
                  <div className="flex gap-3">
                    {[
                      { val: false, label: "Always",      desc: "Capture screenshot on every step" },
                      { val: true,  label: "Fail only",   desc: "Only on failed steps" },
                    ].map(opt => (
                      <button
                        key={String(opt.val)}
                        onClick={() => set("screenshotOnFailOnly", opt.val)}
                        className={`flex-1 border rounded-lg px-3 py-2.5 text-left transition
                          ${form.screenshotOnFailOnly === opt.val
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                            : "border-gray-700 bg-gray-950 text-gray-400 hover:border-emerald-500/60"}`}
                      >
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </Field>

                <InfoBox>
                  Reports are saved to <code className="text-emerald-400">reports/</code> in the project root.
                  Run <code className="text-emerald-400">npm run db:studio</code> to browse the database.
                </InfoBox>
              </>
            )}

            {/* ── Notifications ──────────────────────────────────────────── */}
            {tab === "notifications" && (
              <>
                <SectionHeader title="Notifications" desc="Send results to an external webhook (Slack, Teams, etc.)" />

                <Field label="Webhook URL" hint="POST with JSON body { passed, url, summary, reportId } after each run.">
                  <input
                    type="url" value={form.webhookUrl ?? ""}
                    onChange={e => set("webhookUrl", e.target.value)}
                    placeholder="https://hooks.slack.com/services/…"
                    className={inputCls}
                  />
                </Field>

                <Field label="Trigger on">
                  <div className="space-y-2">
                    {[
                      { key: "webhookOnPass" as const, label: "Test passed" },
                      { key: "webhookOnFail" as const, label: "Test failed" },
                    ].map(opt => (
                      <label key={opt.key} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!(form[opt.key])}
                          onChange={e => set(opt.key, e.target.checked)}
                          className="w-4 h-4 accent-emerald-500 rounded"
                        />
                        <span className="text-sm text-gray-300">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </Field>

                {!form.webhookUrl && (
                  <InfoBox>Enter a webhook URL above to enable notifications.</InfoBox>
                )}
              </>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="pb-2 border-b border-gray-800">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 text-xs text-gray-400">
      {children}
    </div>
  );
}
