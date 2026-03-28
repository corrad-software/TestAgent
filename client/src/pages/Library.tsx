import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import {
  Plus, Upload, Download, Play, Monitor, Pencil, Trash2,
  Layers, Inbox, FolderOpen, BarChart2, X, Loader,
  CheckCircle2, ChevronLeft, ExternalLink, Tag, Clock,
} from "lucide-react";
import * as api from "../lib/api";
import { relativeTime, SUITE_LABELS, SUITE_COLORS } from "../lib/utils";

export default function Library() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [activeModuleId,  setActiveModuleId]  = useState<string | null>(null);
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [editingScenario,   setEditingScenario]   = useState<api.Scenario | null>(null);
  const [selectedScenario,  setSelectedScenario]  = useState<api.Scenario | null>(null);
  const [importResult, setImportResult] = useState<{ created: number; createdNames: string[]; errors: { row: number; error: string }[] } | null>(null);

  const { data: projects = [] } = useQuery<api.Project[]>({
    queryKey: ["projects"],
    queryFn: api.getProjects,
  });

  const activeProject = projects.find((p: api.Project) => p.id === projectId);
  const effectiveProjectId = activeProject?.id ?? "";
  const modules = activeProject?.modules ?? [];
  const activeModule = modules.find((m: api.Module) => m.id === activeModuleId);
  const scenarios = activeModule?.scenarios ?? [];

  const { data: members = [] } = useQuery({
    queryKey: ["members", effectiveProjectId],
    queryFn: () => api.getMembers(effectiveProjectId),
    enabled: !!effectiveProjectId,
  });

  const { data: roles = [] } = useQuery<api.ProjectRole[]>({
    queryKey: ["roles", effectiveProjectId],
    queryFn: () => api.getRoles(effectiveProjectId),
    enabled: !!effectiveProjectId,
  });

  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: ["projects"] }), [qc]);

  // ── Module management ───────────────────────────────────────────────────────
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [newModuleName,  setNewModuleName]  = useState("");

  const createModuleMut = useMutation({
    mutationFn: () => api.createModule({ projectId: effectiveProjectId, name: newModuleName.trim() }),
    onSuccess: (mod) => {
      setNewModuleName(""); setShowModuleForm(false);
      setActiveModuleId(mod.id); invalidate();
    },
  });

  const deleteModuleMut = useMutation({
    mutationFn: api.deleteModule,
    onSuccess: () => { setActiveModuleId(null); invalidate(); },
  });

  // ── Scenario management ─────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  async function handleSaveScenario(data: Omit<api.Scenario, "id" | "createdAt" | "updatedAt">): Promise<boolean> {
    setSaving(true);
    try {
      const result = editingScenario
        ? await api.updateScenario(editingScenario.id, data)
        : await api.createScenario(data);
      if (!editingScenario) setEditingScenario(result);
      invalidate();
      return true;
    } catch {
      return false;
    } finally { setSaving(false); }
  }

  const deleteScenarioMut = useMutation({
    mutationFn: api.deleteScenario,
    onSuccess: invalidate,
  });

  // ── Import ──────────────────────────────────────────────────────────────────
  async function handleImport(files: FileList | File[]) {
    const arr = Array.from(files);
    const opts = effectiveProjectId
      ? { module: activeModule?.name ?? modules[0]?.name ?? "Katalon Import", projectId: effectiveProjectId }
      : undefined;
    const result = await api.importScenarios(arr, opts);
    setImportResult(result);
    if (result.created > 0) invalidate();
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Topbar */}
      <header className="sticky top-0 z-10 bg-gray-950/80 backdrop-blur border-b border-gray-800 px-6 py-3 flex items-center justify-between flex-shrink-0 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-gray-500 hover:text-gray-200 transition text-xs"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Projects</span>
          </button>
          <div className="w-px h-5 bg-gray-800" />
          <div>
            <h1 className="text-base font-semibold text-white">{activeProject?.name ?? "Project"}</h1>
            {activeProject?.description && (
              <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">{activeProject.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <a href="/library/import/template" download
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium px-3 py-2 rounded-lg transition">
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Template</span>
          </a>
          <label className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium px-3 py-2 rounded-lg transition cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Import</span>
            <input type="file" accept=".xlsx,.xls,.csv,.tc,.groovy" multiple className="hidden"
              onChange={e => { if (e.target.files?.length) handleImport(e.target.files); e.target.value = ""; }} />
          </label>
          <button
            onClick={() => { setEditingScenario(null); setShowScenarioModal(true); }}
            className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
          >
            <Plus className="w-4 h-4" /> New Scenario
          </button>
        </div>
      </header>

      {/* Two-panel body */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Module list */}
        <aside className="w-56 flex-shrink-0 border-r border-gray-800 bg-gray-900 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Modules</span>
            {effectiveProjectId && (
              <button onClick={() => setShowModuleForm(f => !f)} title="New module"
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-700 text-gray-500 hover:text-gray-200 transition">
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {showModuleForm && (
            <div className="px-3 py-2 border-b border-gray-800 space-y-1.5">
              <input
                value={newModuleName} onChange={e => setNewModuleName(e.target.value)}
                placeholder="Module name…" autoFocus
                onKeyDown={e => { if (e.key === "Enter" && newModuleName.trim()) createModuleMut.mutate(); if (e.key === "Escape") setShowModuleForm(false); }}
                className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500"
              />
              <div className="flex gap-1">
                <button onClick={() => createModuleMut.mutate()} disabled={!newModuleName.trim()}
                  className="flex-1 text-xs bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded px-2 py-1 transition">Save</button>
                <button onClick={() => { setShowModuleForm(false); setNewModuleName(""); }}
                  className="flex-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded px-2 py-1 transition">Cancel</button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto py-2">
            {!effectiveProjectId ? (
              <p className="px-4 py-2 text-xs text-gray-700 italic">Create a project first</p>
            ) : !modules.length ? (
              <p className="px-4 py-2 text-xs text-gray-700 italic">No modules yet</p>
            ) : modules.map((m: api.Module) => (
              <div
                key={m.id}
                onClick={() => setActiveModuleId(m.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded mx-1 cursor-pointer group transition
                  ${m.id === activeModuleId ? "bg-emerald-500/15 text-emerald-300" : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"}`}
              >
                <Layers className={`w-3.5 h-3.5 flex-shrink-0 ${m.id === activeModuleId ? "text-emerald-400" : "text-gray-600"}`} />
                <span className="text-xs flex-1 truncate font-medium">{m.name}</span>
                <span className="text-xs text-gray-700 mr-1">{(m as any).scenarios?.length ?? 0}</span>
                <button
                  onClick={e => { e.stopPropagation(); if (confirm(`Delete module "${m.name}" and all its scenarios?`)) deleteModuleMut.mutate(m.id); }}
                  className="w-4 h-4 flex items-center justify-center rounded hover:bg-gray-700 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition flex-shrink-0"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* Right: Scenario cards */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center px-6 py-3 border-b border-gray-800">
            <span className="text-sm">
              {activeModule
                ? <span className="text-gray-200 font-medium">{activeModule.name}</span>
                : <span className="text-gray-600 italic">Select a module to view scenarios</span>}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {!effectiveProjectId ? (
              <EmptyState icon={<FolderOpen className="w-12 h-12 text-gray-700" />} text="Create a project to get started" />
            ) : !activeModuleId ? (
              <EmptyState icon={<FolderOpen className="w-12 h-12 text-gray-700" />} text="Select a module from the list" sub="or create a module to get started" />
            ) : !scenarios.length ? (
              <EmptyState
                icon={<Inbox className="w-12 h-12 text-gray-700" />}
                text="No scenarios in this module"
                action={<button onClick={() => { setEditingScenario(null); setShowScenarioModal(true); }}
                  className="mt-3 text-xs bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg transition">
                  + Add first scenario
                </button>}
              />
            ) : (
              <div className="flex flex-col">
                {/* Table header */}
                <div className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-widest border-b border-gray-800 sticky top-0 bg-gray-950 z-[1]">
                  <span className="w-6 shrink-0" />
                  <span className="w-56 shrink-0 hidden lg:block">Kes ID</span>
                  <span className="w-56 shrink-0 hidden xl:block">Scenario ID</span>
                  <span className="flex-1 min-w-0">Scenario</span>
                  <span className="w-14 shrink-0 text-center hidden md:block">Flow</span>
                  <span className="w-16 shrink-0 text-center">Status</span>
                </div>
                {scenarios.map((s: api.Scenario) => (
                  <ScenarioRow
                    key={s.id}
                    scenario={s}
                    onSelect={() => setSelectedScenario(s)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scenario Modal */}
      {showScenarioModal && activeProject && (
        <ScenarioModal
          scenario={editingScenario}
          project={activeProject}
          members={members}
          roles={roles}
          defaultModuleId={activeModuleId ?? ""}
          saving={saving}
          onSave={handleSaveScenario}
          onBack={editingScenario ? () => {
            setShowScenarioModal(false);
            setSelectedScenario(editingScenario);
            setEditingScenario(null);
          } : undefined}
          onClose={() => { setShowScenarioModal(false); setEditingScenario(null); }}
        />
      )}

      {/* Scenario Detail / Run Modal */}
      {selectedScenario && (
        <ScenarioDetailModal
          scenario={selectedScenario}
          onEdit={() => {
            setSelectedScenario(null);
            setEditingScenario(selectedScenario);
            setShowScenarioModal(true);
          }}
          onDelete={() => {
            if (confirm(`Delete "${selectedScenario.name}"?`)) {
              deleteScenarioMut.mutate(selectedScenario.id);
              setSelectedScenario(null);
            }
          }}
          onClose={() => setSelectedScenario(null)}
          onRefresh={invalidate}
        />
      )}

      {/* Import Result Modal */}
      {importResult && (
        <ImportResultModal result={importResult} onClose={() => setImportResult(null)} />
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ icon, text, sub, action }: { icon: React.ReactNode; text: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      {icon}
      <p className="text-sm text-gray-500 mt-3">{text}</p>
      {sub && <p className="text-xs text-gray-700 mt-1">{sub}</p>}
      {action}
    </div>
  );
}

// ─── Scenario Row (clickable list view) ──────────────────────────────────────
function ScenarioRow({ scenario: s, onSelect }: {
  scenario: api.Scenario;
  onSelect: () => void;
}) {
  const { data: history } = useQuery({
    queryKey: ["history", s.id],
    queryFn: () => api.getScenarioHistory(s.id),
  });
  const lastRun = history?.[0];
  const flowTag = s.tags.find(t => t === "positif" || t === "negatif");

  return (
    <div onClick={onSelect}
      className="flex items-center gap-2 px-4 py-2 border-b border-gray-800/60 hover:bg-gray-900/70 cursor-pointer transition">
      {/* Status dot */}
      <span className="w-6 flex justify-center shrink-0">
        {lastRun ? (
          <span className={`w-2 h-2 rounded-full ${lastRun.passed ? "bg-green-500" : "bg-red-500"}`} />
        ) : (
          <span className="w-2 h-2 rounded-full bg-gray-700" />
        )}
      </span>

      {/* Kes ID */}
      <span className="w-56 shrink-0 hidden lg:block text-xs text-gray-400 font-mono truncate">
        {s.testCaseId || "—"}
      </span>

      {/* Scenario ID */}
      <span className="w-56 shrink-0 hidden xl:block text-xs text-gray-500 font-mono truncate">
        {s.scenarioRefId || "—"}
      </span>

      {/* Name */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <p className="text-xs text-gray-200 truncate">{s.name && s.name.length > 60 ? s.name.slice(0, 60) + "…" : s.name}</p>
      </div>

      {/* Flow */}
      <div className="w-14 hidden md:flex justify-center shrink-0">
        {flowTag ? (
          <span className={`text-xs px-1.5 py-0.5 rounded ${flowTag === "positif" ? "bg-blue-900/40 text-blue-300" : "bg-orange-900/40 text-orange-300"}`}>
            {flowTag === "positif" ? "Positif" : "Negatif"}
          </span>
        ) : null}
      </div>

      {/* Status */}
      <div className="w-16 text-center text-xs shrink-0">
        {lastRun ? (
          <span className={lastRun.passed ? "text-green-500" : "text-red-400"}>
            {lastRun.passed ? "Passed" : "Failed"}
          </span>
        ) : (
          <span className="text-gray-700">—</span>
        )}
      </div>
    </div>
  );
}

// ─── Scenario Detail / Run Modal ─────────────────────────────────────────────
function ScenarioDetailModal({ scenario: s, onEdit, onDelete, onClose, onRefresh }: {
  scenario: api.Scenario;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [running, setRunning]     = useState(false);
  const [logs, setLogs]           = useState<string[]>([]);
  const [result, setResult]       = useState<{ passed: boolean; text: string } | null>(null);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const { data: history } = useQuery({
    queryKey: ["history", s.id],
    queryFn: () => api.getScenarioHistory(s.id),
  });
  const lastRun = history?.[0];
  const flowTag = s.tags.find(t => t === "positif" || t === "negatif");

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && !running) onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [running, onClose]);

  async function run(headed = false) {
    setRunning(true);
    setResult(null);
    setReportUrl(null);
    setLogs([headed ? "▶ Starting test (headed)…" : "▶ Starting test (headless)…"]);
    try {
      const res = await fetch(`/library/scenarios/${s.id}/run`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headed }),
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
            if (ev.type === "log") {
              setLogs(prev => [...prev, ev.message]);
            }
            if (ev.type === "result") {
              const text = ev.passed ? "✅ Test Passed" : "❌ Test Failed";
              setResult({ passed: ev.passed, text });
              setLogs(prev => [...prev, "", text]);
              if (ev.reportId) setReportUrl(`/playwright-report/${ev.reportId}/index.html`);
              onRefresh();
            }
            if (ev.type === "error") {
              setResult({ passed: false, text: `Error: ${ev.message}` });
              setLogs(prev => [...prev, `❌ Error: ${ev.message}`]);
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      setLogs(prev => [...prev, `❌ ${(err as Error).message}`]);
      setResult({ passed: false, text: (err as Error).message });
    } finally {
      setRunning(false);
    }
  }

  const lastReportUrl = lastRun?.reportId ? `/playwright-report/${lastRun.reportId}/index.html` : null;
  const effectiveReportUrl = reportUrl ?? lastReportUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-white leading-tight">{s.name}</h2>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {s.testCaseId && (
                <span className="text-xs text-gray-400 font-mono">{s.testCaseId}</span>
              )}
              {s.scenarioRefId && (
                <span className="text-xs text-gray-500 font-mono">{s.scenarioRefId}</span>
              )}
              {flowTag && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${flowTag === "positif" ? "bg-blue-900/40 text-blue-300" : "bg-orange-900/40 text-orange-300"}`}>
                  {flowTag === "positif" ? "Positif" : "Negatif"}
                </span>
              )}
              {lastRun && (
                <span className="text-xs text-gray-600 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Last run {relativeTime(lastRun.runAt)} — <span className={lastRun.passed ? "text-green-500" : "text-red-400"}>{lastRun.passed ? "Passed" : "Failed"}</span>
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 transition text-xl leading-none ml-4">&times;</button>
        </div>

        {/* Body — two columns */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Left: Details + Actions */}
          <div className="w-72 shrink-0 border-r border-gray-800 p-4 flex flex-col gap-3 overflow-y-auto min-h-0">
            {/* URL */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">URL</p>
              <a href={s.url} target="_blank" rel="noreferrer"
                className="text-xs text-emerald-400 hover:underline flex items-center gap-1 truncate">
                {s.url} <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>

            {/* Test Types */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Test Types</p>
              <div className="flex flex-col gap-1">
                {s.testTypes.map(t => {
                  const passed = lastRun?.passed;
                  return (
                    <div key={t} className="flex items-center gap-2">
                      {lastRun ? (
                        passed
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          : <X className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-gray-700 shrink-0" />
                      )}
                      <span className={`text-xs px-1.5 py-0.5 rounded ${SUITE_COLORS[t] ?? "bg-gray-800 text-gray-400"}`}>
                        {SUITE_LABELS[t] ?? t}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Description */}
            {s.description && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Description</p>
                <p className="text-xs text-gray-400 whitespace-pre-wrap max-h-28 overflow-y-auto leading-relaxed">{s.description}</p>
              </div>
            )}

            {/* Tags */}
            {s.tags.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {s.tags.map(t => (
                    <span key={t} className="text-xs bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Tag className="w-2.5 h-2.5" />{t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Auth info */}
            {s.authConfig && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Login</p>
                <p className="text-xs text-gray-400 font-mono">{s.authConfig.email}</p>
                <p className="text-xs text-gray-600 truncate">{s.authConfig.loginUrl}</p>
              </div>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Run buttons */}
            <div className="flex gap-2">
              <button onClick={() => run(false)} disabled={running}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white py-2 rounded-lg transition">
                {running ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Run
              </button>
              <button onClick={() => run(true)} disabled={running} title="Run with visible browser"
                className="flex items-center justify-center gap-1.5 text-xs font-semibold bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg transition">
                <Monitor className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Report link */}
            {effectiveReportUrl && (
              <a href={effectiveReportUrl} target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded-lg transition">
                <BarChart2 className="w-3.5 h-3.5" /> View Report
              </a>
            )}

            {/* Edit / Delete */}
            <div className="flex gap-2 pt-2 border-t border-gray-800">
              <button onClick={onEdit}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 py-1.5 rounded-lg transition">
                <Pencil className="w-3 h-3" /> Edit
              </button>
              <button onClick={onDelete}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-gray-800 hover:bg-red-900/50 text-gray-500 hover:text-red-400 py-1.5 rounded-lg transition">
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </div>
          </div>

          {/* Right: Live log terminal */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between shrink-0">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Test Output</span>
              {running && (
                <span className="text-xs text-emerald-400 flex items-center gap-1.5">
                  <Loader className="w-3 h-3 animate-spin" /> Running…
                </span>
              )}
              {result && !running && (
                <span className={`text-xs font-semibold ${result.passed ? "text-green-400" : "text-red-400"}`}>
                  {result.text}
                </span>
              )}
            </div>
            <div ref={logRef}
              className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed bg-gray-950">
              {logs.length === 0 ? (
                <p className="text-gray-700 italic">Click "Run" to start a test…</p>
              ) : (
                logs.map((line, i) => (
                  <div key={i} className={`whitespace-pre-wrap ${
                    line.startsWith("✅") ? "text-green-400 font-semibold" :
                    line.startsWith("❌") ? "text-red-400 font-semibold" :
                    line.startsWith("▶") ? "text-emerald-400" :
                    line.startsWith("[AUTH]") ? "text-amber-400" :
                    line.startsWith("[stderr]") ? "text-orange-400" :
                    "text-gray-400"
                  }`}>{line}</div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Scenario Modal ───────────────────────────────────────────────────────────
const TEST_TYPES = [
  { value: "smoke",         label: "🔍 Smoke" },
  { value: "navigation",    label: "🔗 Navigation" },
  { value: "forms",         label: "📝 Forms" },
  { value: "responsive",    label: "📱 Responsive" },
  { value: "accessibility", label: "♿ Accessibility" },
  { value: "quick",         label: "⚡ Quick" },
];

function ScenarioModal({ scenario, project, members, roles, defaultModuleId, saving, onSave, onBack, onClose }: {
  scenario: api.Scenario | null;
  project: api.Project;
  members: api.Member[];
  roles: api.ProjectRole[];
  defaultModuleId: string;
  saving: boolean;
  onSave: (data: Omit<api.Scenario, "id" | "createdAt" | "updatedAt">) => Promise<boolean>;
  onBack?: () => void;
  onClose: () => void;
}) {
  const projectModules = project.modules ?? [];

  const [moduleId,      setModuleId]      = useState(scenario?.moduleId ?? defaultModuleId);
  const [testCaseId,    setTestCaseId]    = useState(scenario?.testCaseId ?? "");
  const [scenarioRefId, setScenarioRefId] = useState(scenario?.scenarioRefId ?? "");
  const [name,        setName]        = useState(scenario?.name ?? "");
  const [url,         setUrl]         = useState(scenario?.url ?? "");
  const [testTypes,   setTestTypes]   = useState<string[]>(scenario?.testTypes ?? ["smoke"]);
  const [description, setDescription] = useState(scenario?.description ?? "");
  const [tags,        setTags]        = useState((scenario?.tags ?? []).join(", "));
  const [assigneeId,  setAssigneeId]  = useState(scenario?.assigneeId ?? "");
  const [roleId,      setRoleId]      = useState(scenario?.roleId ?? "");
  const [loginUrl,    setLoginUrl]    = useState(scenario?.authConfig?.loginUrl ?? "");
  const [loginEmail,  setLoginEmail]  = useState(scenario?.authConfig?.email ?? "");
  const [loginPass,   setLoginPass]   = useState(scenario?.authConfig?.password ?? "");
  const [savedAt,     setSavedAt]     = useState<number | null>(null);

  // Snapshot of last saved values for dirty tracking
  const [snapshot, setSnapshot] = useState(() => getFormValues());

  function getFormValues() {
    return JSON.stringify({ moduleId, testCaseId, scenarioRefId, name, url, testTypes, description, tags, assigneeId, roleId, loginUrl, loginEmail, loginPass });
  }

  const isDirty = () => getFormValues() !== snapshot;

  function confirmAndClose(action: () => void) {
    if (isDirty()) {
      if (confirm("You have unsaved changes. Discard them?")) action();
    } else {
      action();
    }
  }

  // Auto-hide saved message after 3s
  useEffect(() => {
    if (!savedAt) return;
    const t = setTimeout(() => setSavedAt(null), 3000);
    return () => clearTimeout(t);
  }, [savedAt]);

  const toggleType = (t: string) =>
    setTestTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  async function submit() {
    if (!moduleId || !name.trim() || !url.trim() || !testTypes.length) {
      alert("Module, name, URL, and at least one test type are required."); return;
    }
    const authConfig = (loginUrl && loginEmail && loginPass)
      ? { loginUrl, email: loginEmail, password: loginPass } : undefined;
    const ok = await onSave({
      moduleId, name: name.trim(), url: url.trim(), testTypes: testTypes as any,
      testCaseId: testCaseId.trim() || undefined, scenarioRefId: scenarioRefId.trim() || undefined,
      description: description.trim() || undefined,
      tags: tags.split(",").map(t => t.trim()).filter(Boolean),
      authConfig, assigneeId: assigneeId || undefined, roleId: roleId || undefined,
    });
    if (ok) {
      setSavedAt(Date.now());
      setSnapshot(getFormValues());
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header with breadcrumb + back button */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            {onBack && (
              <button onClick={() => confirmAndClose(onBack)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-200 transition">
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-0.5">
                <span>{project.name}</span>
                <span className="text-gray-700">/</span>
                <span>{projectModules.find(m => m.id === moduleId)?.name ?? "Select module"}</span>
              </div>
              <h2 className="text-sm font-semibold text-white">{scenario ? "Edit Scenario" : "New Scenario"}</h2>
            </div>
          </div>
          <button onClick={() => confirmAndClose(onClose)} className="text-gray-500 hover:text-gray-200 transition text-xl leading-none">&times;</button>
        </div>

        {/* Two-column body */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">

            {/* ─── Left column ─── */}
            {/* Module */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">Module</label>
              <select value={moduleId} onChange={e => setModuleId(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-emerald-500 transition">
                <option value="">— select module —</option>
                {projectModules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            {/* URL */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">URL</label>
              <input value={url} onChange={e => setUrl(e.target.value)} type="url" placeholder="https://example.com"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition" />
            </div>

            {/* Kes ID */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">
                Kes ID <span className="text-gray-600 font-normal normal-case tracking-normal">— optional</span>
              </label>
              <input value={testCaseId} onChange={e => setTestCaseId(e.target.value)}
                placeholder="e.g. TC-NAS-PRF-01"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition font-mono" />
            </div>

            {/* Scenario ID */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">
                Scenario ID <span className="text-gray-600 font-normal normal-case tracking-normal">— optional</span>
              </label>
              <input value={scenarioRefId} onChange={e => setScenarioRefId(e.target.value)}
                placeholder="e.g. SR-NAS-PRF-01"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition font-mono" />
            </div>

            {/* Scenario Name — full width */}
            <div className="col-span-2 space-y-1">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">Scenario Name</label>
              <input value={name} onChange={e => setName(e.target.value)} autoFocus
                placeholder="e.g. Login page smoke test"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition" />
            </div>

            {/* Test types — full width */}
            <div className="col-span-2 space-y-1">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">
                Test Types <span className="text-gray-600 font-normal normal-case tracking-normal">— select one or more</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {TEST_TYPES.map(({ value, label }) => (
                  <button key={value} type="button" onClick={() => toggleType(value)}
                    className={`px-3 py-1 rounded-lg border text-xs font-medium transition select-none
                      ${testTypes.includes(value)
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                        : "border-gray-700 bg-gray-950 text-gray-400 hover:border-emerald-500/60"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">
                Description <span className="text-gray-600 font-normal normal-case tracking-normal">— optional</span>
              </label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                placeholder="What should the test focus on?"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition resize-none" />
            </div>

            {/* Right: Tags, Role, Assignee stacked */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">
                  Tags <span className="text-gray-600 font-normal normal-case tracking-normal">— comma separated</span>
                </label>
                <input value={tags} onChange={e => setTags(e.target.value)} placeholder="auth, critical, regression"
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition" />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">User Role</label>
                <select value={roleId} onChange={e => setRoleId(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-emerald-500 transition">
                  <option value="">— no role —</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              {members.length > 0 && (
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">Assignee</label>
                  <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-emerald-500 transition">
                    <option value="">— unassigned —</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Auth — full width */}
            <details className="col-span-2 border-t border-gray-800 pt-3">
              <summary className="flex items-center gap-2 cursor-pointer select-none list-none text-xs font-semibold text-gray-500 uppercase tracking-widest hover:text-gray-300 transition w-fit">
                Login Required
              </summary>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <input value={loginUrl} onChange={e => setLoginUrl(e.target.value)} type="url" placeholder="Login URL"
                  className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition" />
                <input value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="Email / Username"
                  className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition" />
                <input value={loginPass} onChange={e => setLoginPass(e.target.value)} type="password" placeholder="Password"
                  className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition" />
              </div>
            </details>

          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-800 flex items-center gap-3 shrink-0">
          <button onClick={submit} disabled={saving}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition">
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={() => confirmAndClose(onBack ?? onClose)}
            className="px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2 rounded-lg transition">{onBack ? "Back" : "Cancel"}</button>
          {savedAt && (
            <span className="text-xs text-green-400 flex items-center gap-1 ml-auto">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Import Result Modal ──────────────────────────────────────────────────────
function ImportResultModal({ result, onClose }: {
  result: { created: number; createdNames: string[]; errors: { row: number; error: string }[] };
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
          <h2 className="text-sm font-semibold text-white">Import Result</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 transition text-xl leading-none">×</button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4 text-sm">
          {result.created > 0 && (
            <div className="flex items-start gap-3 bg-green-900/20 border border-green-800/50 rounded-lg px-4 py-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-green-300 font-semibold">{result.created} scenario{result.created !== 1 ? "s" : ""} imported</p>
                <ul className="mt-1 space-y-0.5 text-xs text-green-700">
                  {result.createdNames.map(n => <li key={n}>✓ {n}</li>)}
                </ul>
              </div>
            </div>
          )}
          {result.errors.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-400 uppercase tracking-widest mb-2">{result.errors.length} skipped</p>
              <ul className="space-y-1 text-xs border border-gray-800 rounded-lg px-3 py-2 max-h-40 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-400">
                    <span className="text-red-500 flex-shrink-0">{e.row > 0 ? `Row ${e.row}:` : "Error:"}</span>
                    <span>{e.error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.created === 0 && !result.errors.length && (
            <p className="text-gray-500">No data rows found. Check the format matches the template.</p>
          )}
          <p className="text-xs text-gray-600 border-t border-gray-800 pt-3">
            Excel/CSV columns: Module · Scenario Name · URL · Test Types · Description · Tags · Login URL · Login Email · Login Password
            {" — "}<a href="/library/import/template" download className="text-emerald-400 hover:underline">Download template</a>
            <br />Katalon: upload <span className="text-gray-400">.tc</span> files (optionally with companion <span className="text-gray-400">.groovy</span> scripts for URL extraction).
          </p>
        </div>
        <div className="px-6 py-4 border-t border-gray-800 flex-shrink-0">
          <button onClick={onClose} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold py-2 rounded-lg transition">Done</button>
        </div>
      </div>
    </div>
  );
}
