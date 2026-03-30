import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import {
  Plus, Upload, Download, Play, Monitor, Pencil, Trash2,
  Layers, Inbox, FolderOpen, BarChart2, X, Loader,
  CheckCircle2, ChevronLeft, ExternalLink, Tag, Clock, Search, Settings,
  ArrowRight, ArrowLeft, Code, ListOrdered,
} from "lucide-react";
import * as api from "../lib/api";
import { relativeTime, SUITE_LABELS, SUITE_COLORS } from "../lib/utils";
import { ProjectSettingsModal } from "./Settings";

export default function Library() {
  const { projectId } = useParams<{ projectId: string }>();
  return <LibraryContent projectId={projectId!} />;
}

export function LibraryContent({ projectId, embedded = false }: { projectId: string; embedded?: boolean }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [activeModuleId,  setActiveModuleId]  = useState<string | null>(null);
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [editingScenario,   setEditingScenario]   = useState<api.Scenario | null>(null);
  const [selectedScenario,  setSelectedScenario]  = useState<api.Scenario | null>(null);
  const [importResult, setImportResult] = useState<{ created: number; createdNames: string[]; errors: { row: number; error: string }[] } | null>(null);

  // Project settings modal
  const [showProjectSettings, setShowProjectSettings] = useState(false);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "passed" | "failed" | "never">("all");
  const [flowFilter, setFlowFilter] = useState<"all" | "positif" | "negatif">("all");

  const { data: projects = [] } = useQuery<api.Project[]>({
    queryKey: ["projects"],
    queryFn: api.getProjects,
  });

  const activeProject = projects.find((p: api.Project) => p.id === projectId);
  const effectiveProjectId = activeProject?.id ?? "";
  const modules = activeProject?.modules ?? [];
  const activeModule = modules.find((m: api.Module) => m.id === activeModuleId);
  const scenarios = activeModule?.scenarios ?? [];

  // Batch fetch history for filtering
  const historyQueries = useQueries({
    queries: scenarios.map(s => ({
      queryKey: ["history", s.id],
      queryFn: () => api.getScenarioHistory(s.id),
      staleTime: 30_000,
    })),
  });
  const historyMap = useMemo(() => {
    const m = new Map<string, api.RunRecord[] | undefined>();
    scenarios.forEach((s, i) => m.set(s.id, historyQueries[i]?.data));
    return m;
  }, [scenarios, historyQueries]);

  const filteredScenarios = useMemo(() => {
    return scenarios.filter(s => {
      // Text search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!(s.name.toLowerCase().includes(q) || s.testCaseId?.toLowerCase().includes(q) || s.scenarioRefId?.toLowerCase().includes(q))) return false;
      }
      // Flow filter
      if (flowFilter !== "all") {
        const flow = s.tags.find(t => t === "positif" || t === "negatif");
        if (flow !== flowFilter) return false;
      }
      // Status filter
      if (statusFilter !== "all") {
        const last = historyMap.get(s.id)?.[0];
        if (statusFilter === "never" && last) return false;
        if (statusFilter === "passed" && (!last || !last.passed)) return false;
        if (statusFilter === "failed" && (!last || last.passed)) return false;
      }
      return true;
    });
  }, [scenarios, searchQuery, flowFilter, statusFilter, historyMap]);

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
    <div className={embedded ? "flex flex-col flex-1 min-h-0" : "flex flex-col h-screen"}>
      {/* Topbar — only in standalone mode */}
      {!embedded && (
        <header className="sticky top-0 z-10 bg-gray-950/80 backdrop-blur border-b border-gray-800 px-6 h-13 flex items-center justify-between shrink-0 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 text-gray-500 hover:text-gray-200 transition text-xs"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Projects</span>
            </button>
            <div className="w-px h-5 bg-gray-800" />
            <div className="flex items-center gap-2">
              <div>
                <h1 className="text-base font-semibold text-white">{activeProject?.name ?? "Project"}</h1>
                {activeProject?.description && (
                  <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">{activeProject.description}</p>
                )}
              </div>
              <button
                onClick={() => setShowProjectSettings(true)}
                title="Project settings"
                className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-400 hover:bg-gray-800 transition"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
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
              className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
            >
              <Plus className="w-4 h-4" /> New Scenario
            </button>
          </div>
        </header>
      )}

      {/* Action bar in embedded mode */}
      {embedded && (
        <div className="flex items-center justify-end gap-2 px-4 py-2 border-b border-gray-800 shrink-0">
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
            className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
          >
            <Plus className="w-4 h-4" /> New Scenario
          </button>
        </div>
      )}

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
          {/* Module name + search/filter bar */}
          <div className="px-4 py-2.5 border-b border-gray-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">
                {activeModule
                  ? <span className="text-gray-200 font-medium">{activeModule.name}</span>
                  : <span className="text-gray-600 italic">Select a module to view scenarios</span>}
              </span>
              {activeModule && scenarios.length > 0 && (
                <span className="text-xs text-gray-600">{filteredScenarios.length} of {scenarios.length}</span>
              )}
            </div>
            {activeModule && scenarios.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[180px] max-w-sm">
                  <Search className="w-3.5 h-3.5 text-gray-600 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search name, Kes ID, Scenario ID..."
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition" />
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
                  className="bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 outline-none focus:border-emerald-500 transition">
                  <option value="all">All Status</option>
                  <option value="passed">Passed</option>
                  <option value="failed">Failed</option>
                  <option value="never">Never Run</option>
                </select>
                <select value={flowFilter} onChange={e => setFlowFilter(e.target.value as any)}
                  className="bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 outline-none focus:border-emerald-500 transition">
                  <option value="all">All Flow</option>
                  <option value="positif">Positif</option>
                  <option value="negatif">Negatif</option>
                </select>
                {(searchQuery || statusFilter !== "all" || flowFilter !== "all") && (
                  <button onClick={() => { setSearchQuery(""); setStatusFilter("all"); setFlowFilter("all"); }}
                    className="text-xs text-gray-500 hover:text-gray-300 transition px-1.5">Clear</button>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {!effectiveProjectId ? (
              <EmptyState icon={<FolderOpen className="w-12 h-12 text-gray-700" />} text="Create a project to get started" />
            ) : !activeModuleId ? (
              <EmptyState icon={<FolderOpen className="w-12 h-12 text-gray-700" />} text="Select a module from the list" sub="or create a module to get started" />
            ) : !filteredScenarios.length && !scenarios.length ? (
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
                {filteredScenarios.map((s: api.Scenario) => (
                  <ScenarioRow
                    key={s.id}
                    scenario={s}
                    onSelect={() => setSelectedScenario(s)}
                  />
                ))}
                {filteredScenarios.length === 0 && scenarios.length > 0 && (
                  <div className="px-4 py-8 text-center text-xs text-gray-600">No scenarios match your filters</div>
                )}
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
          projectId={effectiveProjectId}
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

      {/* Project Settings Modal */}
      {showProjectSettings && effectiveProjectId && (
        <ProjectSettingsModal projectId={effectiveProjectId} onClose={() => setShowProjectSettings(false)} />
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
function ScenarioDetailModal({ scenario: s, projectId, onEdit, onDelete, onClose, onRefresh }: {
  scenario: api.Scenario;
  projectId: string;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [running, setRunning]     = useState(false);
  const [recording, setRecording] = useState(false);
  const [logs, setLogs]           = useState<string[]>([]);
  const [result, setResult]       = useState<{ passed: boolean; text: string } | null>(null);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [recordedCode, setRecordedCode] = useState<string | null>(s.customSpec ?? null);
  const [runMode, setRunMode]           = useState<"template" | "recorded" | "steps">(
    s.testSteps?.length ? "steps" : s.customSpec ? "recorded" : "template"
  );
  const [showCode, setShowCode]         = useState(false);
  const [showSteps, setShowSteps]       = useState(false);
  const [enriching, setEnriching]       = useState(false);
  const [logTab, setLogTab]             = useState<"live" | "history">("live");
  const [selectedEnvId, setSelectedEnvId] = useState<string>("");
  const logRef = useRef<HTMLDivElement>(null);

  const { data: environments = [] } = useQuery({
    queryKey: ["environments", projectId],
    queryFn: () => api.getEnvironments(projectId),
    enabled: !!projectId,
  });

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
    setLogTab("live");
    setLogs([headed ? "▶ Starting test (headed)…" : "▶ Starting test (headless)…"]);
    try {
      const res = await fetch(`/library/scenarios/${s.id}/run`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headed,
          useCustomSpec: runMode === "recorded" && !!recordedCode,
          useTestSteps: runMode === "steps" && !!s.testSteps?.length,
          environmentId: selectedEnvId || undefined,
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

  async function record() {
    setRecording(true);
    setResult(null);
    setLogTab("live");
    setLogs(["🎬 Starting Playwright Recorder..."]);
    try {
      const res = await fetch(`/library/scenarios/${s.id}/record`, { method: "POST" });
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
            if (ev.type === "log") setLogs(prev => [...prev, ev.message]);
            if (ev.type === "codeGenerated" && ev.code) {
              setRecordedCode(ev.code);
              setShowCode(true);
              // Auto-save to DB
              await fetch(`/library/scenarios/${s.id}/custom-spec`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customSpec: ev.code }),
              });
              setRunMode("recorded");
              onRefresh();
            }
            if (ev.type === "recordEnd") {
              setLogs(prev => [...prev, "🎬 Recording session ended"]);
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      setLogs(prev => [...prev, `❌ ${(err as Error).message}`]);
    } finally {
      setRecording(false);
    }
  }

  async function deleteCustomSpec() {
    if (!confirm("Delete the recorded spec? This cannot be undone.")) return;
    await fetch(`/library/scenarios/${s.id}/custom-spec`, { method: "DELETE" });
    setRecordedCode(null);
    setRunMode("template");
    setShowCode(false);
    onRefresh();
  }

  async function enrichWithAI() {
    setEnriching(true);
    setLogTab("live");
    setLogs(["✨ Asking AI to add assertions to recorded spec..."]);
    try {
      const res = await fetch(`/library/scenarios/${s.id}/enrich`, { method: "POST" });
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
            if (ev.type === "log") setLogs(prev => [...prev, ev.message]);
            if (ev.type === "enriched" && ev.code) {
              setRecordedCode(ev.code);
              setLogs(prev => [...prev, "✅ Assertions added and saved"]);
              onRefresh();
            }
            if (ev.type === "error") setLogs(prev => [...prev, `❌ ${ev.message}`]);
          } catch {}
        }
      }
    } catch (err) {
      setLogs(prev => [...prev, `❌ ${(err as Error).message}`]);
    } finally {
      setEnriching(false);
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
                  // Use live result if available, else fall back to lastRun
                  const liveResult = result;
                  const hasRun = liveResult || lastRun;
                  const isPassed = liveResult ? liveResult.passed : lastRun?.passed;
                  // During a run, show spinner for current/pending types
                  const isRunningThis = running && !liveResult;
                  return (
                    <div key={t} className="flex items-center gap-2">
                      {isRunningThis ? (
                        <Loader className="w-3.5 h-3.5 text-emerald-400 animate-spin shrink-0" />
                      ) : hasRun ? (
                        isPassed
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

            {/* Environment selector */}
            {environments.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest">Environment</p>
                <select value={selectedEnvId} onChange={e => setSelectedEnvId(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2 py-1.5 text-xs text-gray-300 outline-none focus:border-emerald-500 transition">
                  <option value="">Default (scenario URL)</option>
                  {environments.map(env => (
                    <option key={env.id} value={env.id}>{env.name} — {env.baseUrl}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Run mode toggle */}
            {(recordedCode || (s.testSteps && s.testSteps.length > 0)) && (
              <div className="flex items-center gap-0.5 bg-gray-950 rounded-lg p-0.5">
                <button onClick={() => setRunMode("template")}
                  className={`flex-1 text-xs py-1.5 rounded-md transition font-medium ${runMode === "template" ? "bg-emerald-500/20 text-emerald-300" : "text-gray-500 hover:text-gray-300"}`}>
                  Template
                </button>
                {s.testSteps && s.testSteps.length > 0 && (
                  <button onClick={() => setRunMode("steps")}
                    className={`flex-1 text-xs py-1.5 rounded-md transition font-medium ${runMode === "steps" ? "bg-blue-500/20 text-blue-300" : "text-gray-500 hover:text-gray-300"}`}>
                    Steps
                  </button>
                )}
                {recordedCode && (
                  <button onClick={() => setRunMode("recorded")}
                    className={`flex-1 text-xs py-1.5 rounded-md transition font-medium ${runMode === "recorded" ? "bg-red-500/20 text-red-300" : "text-gray-500 hover:text-gray-300"}`}>
                    Recorded
                  </button>
                )}
              </div>
            )}

            {/* Run buttons */}
            <div className="flex gap-2 relative group/run">
              <button onClick={() => run(false)} disabled={running || recording}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white py-2 rounded-lg transition"
                title="Headless — runs in background, faster and uses less resources. Best for automated testing.">
                {running ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Headless{runMode === "recorded" ? " (Rec)" : runMode === "steps" ? " (Steps)" : ""}
              </button>
              <button onClick={() => run(true)} disabled={running || recording}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white py-2 rounded-lg transition"
                title="Visible Browser — opens a real browser window so you can watch the test run. Useful for debugging and verifying test steps.">
                <Monitor className="w-3.5 h-3.5" />
                Visible{runMode === "recorded" ? " (Rec)" : runMode === "steps" ? " (Steps)" : ""}
              </button>
            </div>

            {/* Record button */}
            <button onClick={record} disabled={running || recording}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 disabled:opacity-50 text-red-400 py-2 rounded-lg transition">
              {recording ? (
                <><Loader className="w-3.5 h-3.5 animate-spin" /> Recording...</>
              ) : (
                <><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Record</>
              )}
            </button>

            {/* Recorded spec viewer */}
            {recordedCode && (
              <div className="space-y-1.5">
                <button onClick={() => setShowCode(!showCode)}
                  className="text-xs text-gray-500 hover:text-gray-300 transition flex items-center gap-1">
                  {showCode ? "▾" : "▸"} Recorded Spec ({recordedCode.split("\n").length} lines)
                </button>
                {showCode && (
                  <div className="space-y-1.5">
                    <textarea
                      value={recordedCode}
                      onChange={e => setRecordedCode(e.target.value)}
                      spellCheck={false}
                      className="w-full text-xs font-mono text-gray-400 bg-gray-950 border border-gray-800 rounded-lg p-2.5 h-40 overflow-auto resize-y outline-none focus:border-emerald-500 transition"
                    />
                    <div className="flex gap-1.5">
                      <button onClick={async () => {
                        await fetch(`/library/scenarios/${s.id}/custom-spec`, {
                          method: "PUT", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ customSpec: recordedCode }),
                        });
                        onRefresh();
                        setLogs(prev => [...prev, "✅ Spec saved"]);
                      }} className="flex-1 flex items-center justify-center gap-1 text-xs font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 py-1.5 rounded-lg transition">
                        Save Spec
                      </button>
                      <button onClick={enrichWithAI} disabled={enriching || running || recording}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 disabled:opacity-50 text-violet-400 py-1.5 rounded-lg transition">
                        {enriching ? <><Loader className="w-3 h-3 animate-spin" /> Adding...</> : "✨ AI Assertions"}
                      </button>
                      <button onClick={deleteCustomSpec}
                        className="flex items-center justify-center text-xs text-gray-600 hover:text-red-400 px-2 py-1.5 rounded-lg transition" title="Delete spec">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Test steps viewer */}
            {s.testSteps && s.testSteps.length > 0 && (
              <div className="space-y-1.5">
                <button onClick={() => setShowSteps(!showSteps)}
                  className="text-xs text-gray-500 hover:text-gray-300 transition flex items-center gap-1">
                  {showSteps ? "▾" : "▸"} Test Steps ({s.testSteps.length})
                </button>
                {showSteps && (
                  <div className="space-y-1 bg-gray-950 border border-gray-800 rounded-lg p-2 max-h-40 overflow-y-auto">
                    {s.testSteps.map((step, i) => (
                      <div key={step.id} className="flex items-center gap-1.5 text-[11px]">
                        <span className="text-gray-700 font-mono w-3 text-right shrink-0">{i + 1}</span>
                        <span className="text-emerald-400 font-medium">{step.action}</span>
                        {step.target && <span className="text-gray-500 font-mono truncate">{step.target}</span>}
                        {step.input && <span className="text-gray-600 truncate">"{step.input}"</span>}
                        {step.description && <span className="text-gray-700 italic truncate">— {step.description}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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

          {/* Right: Live output + history */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            {/* Tab header */}
            <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1">
                <button onClick={() => setLogTab("live")}
                  className={`text-xs font-semibold px-2.5 py-1 rounded transition ${logTab === "live" ? "bg-gray-800 text-gray-200" : "text-gray-500 hover:text-gray-300"}`}>
                  Live Output
                </button>
                <button onClick={() => setLogTab("history")}
                  className={`text-xs font-semibold px-2.5 py-1 rounded transition ${logTab === "history" ? "bg-gray-800 text-gray-200" : "text-gray-500 hover:text-gray-300"}`}>
                  History {history?.length ? `(${history.length})` : ""}
                </button>
              </div>
              {logTab === "live" && running && (
                <span className="text-xs text-emerald-400 flex items-center gap-1.5">
                  <Loader className="w-3 h-3 animate-spin" /> Running…
                </span>
              )}
              {logTab === "live" && result && !running && (
                <span className={`text-xs font-semibold ${result.passed ? "text-green-400" : "text-red-400"}`}>
                  {result.text}
                </span>
              )}
            </div>

            {/* Live output tab */}
            {logTab === "live" && (
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
                      line.startsWith("🎬") ? "text-red-300" :
                      line.startsWith("[AUTH]") || line.startsWith("🔐") ? "text-amber-400" :
                      line.startsWith("[stderr]") || line.startsWith("[recorder]") ? "text-orange-400" :
                      "text-gray-400"
                    }`}>{line}</div>
                  ))
                )}
              </div>
            )}

            {/* History tab */}
            {logTab === "history" && (
              <div className="flex-1 overflow-y-auto bg-gray-950">
                {!history?.length ? (
                  <p className="text-gray-700 italic text-xs p-4">No run history yet</p>
                ) : (
                  history.map(run => (
                    <details key={run.id} className="border-b border-gray-800/50 group">
                      <summary className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-900/70 transition text-xs select-none">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${run.passed ? "bg-green-500" : "bg-red-500"}`} />
                        <span className={`font-semibold ${run.passed ? "text-green-400" : "text-red-400"}`}>
                          {run.passed ? "Passed" : "Failed"}
                        </span>
                        <span className="text-gray-500">{relativeTime(run.runAt)}</span>
                        <span className="text-gray-700 ml-auto">{(run.durationMs / 1000).toFixed(1)}s</span>
                      </summary>
                      <div className="px-4 pb-3 space-y-2">
                        <p className="text-xs text-gray-500">{run.summary}</p>
                        {run.reportId && (
                          <a href={`/playwright-report/${run.reportId}/index.html`} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline">
                            <BarChart2 className="w-3 h-3" /> View Report
                          </a>
                        )}
                        {run.logs ? (
                          <pre className="text-xs font-mono text-gray-500 bg-gray-900 border border-gray-800 rounded-lg p-3 max-h-48 overflow-auto whitespace-pre-wrap">
                            {run.logs}
                          </pre>
                        ) : (
                          <p className="text-xs text-gray-700 italic">No logs saved for this run</p>
                        )}
                      </div>
                    </details>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Test Step Actions ────────────────────────────────────────────────────────
const STEP_ACTIONS: { value: api.TestStep["action"]; label: string; icon: string }[] = [
  { value: "navigate",       label: "Navigate",       icon: "🔗" },
  { value: "click",          label: "Click",          icon: "👆" },
  { value: "fill",           label: "Fill / Type",    icon: "✏️" },
  { value: "select",         label: "Select Option",  icon: "📋" },
  { value: "check",          label: "Check",          icon: "☑️" },
  { value: "uncheck",        label: "Uncheck",        icon: "⬜" },
  { value: "hover",          label: "Hover",          icon: "🖱️" },
  { value: "wait",           label: "Wait",           icon: "⏳" },
  { value: "screenshot",     label: "Screenshot",     icon: "📸" },
  { value: "assert_visible", label: "Assert Visible", icon: "👁️" },
  { value: "assert_text",    label: "Assert Text",    icon: "📝" },
  { value: "assert_url",     label: "Assert URL",     icon: "🔍" },
  { value: "custom",         label: "Custom Code",    icon: "💻" },
];

function makeStepId(): string {
  return "s_" + Math.random().toString(36).slice(2, 9);
}

// ─── Test Steps Editor (dual-mode: table + code preview) ──────────────────────
function TestStepsEditor({ steps, onChange, scenarioUrl }: {
  steps: api.TestStep[];
  onChange: (steps: api.TestStep[]) => void;
  scenarioUrl: string;
}) {
  const [mode, setMode] = useState<"steps" | "code">("steps");
  const [codePreview, setCodePreview] = useState("");

  function addStep() {
    onChange([...steps, { id: makeStepId(), action: "click", target: "", input: "", expected: "", description: "" }]);
  }

  function updateStep(id: string, patch: Partial<api.TestStep>) {
    onChange(steps.map(s => s.id === id ? { ...s, ...patch } : s));
  }

  function removeStep(id: string) {
    onChange(steps.filter(s => s.id !== id));
  }

  function moveStep(idx: number, dir: -1 | 1) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= steps.length) return;
    const copy = [...steps];
    [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
    onChange(copy);
  }

  function duplicateStep(idx: number) {
    const copy = [...steps];
    copy.splice(idx + 1, 0, { ...steps[idx], id: makeStepId() });
    onChange(copy);
  }

  // Generate code preview
  useEffect(() => {
    if (mode !== "code" || !steps.length) return;
    // Client-side preview generation (mirrors server stepsToSpec logic)
    const lines: string[] = [];
    lines.push(`import { test, expect } from '@playwright/test';`);
    lines.push(``);
    lines.push(`test.describe('Test Steps', () => {`);
    lines.push(`  test('execute test steps', async ({ page }) => {`);
    lines.push(`    await page.goto(${JSON.stringify(scenarioUrl)});`);
    lines.push(``);
    for (const step of steps) {
      const t = step.target || "";
      const v = step.input || "";
      const desc = step.description ? `    // ${step.description}\n` : "";
      let code = "";
      switch (step.action) {
        case "navigate":    code = `    await page.goto(${JSON.stringify(v || t)});`; break;
        case "click":       code = `    await page.locator(${JSON.stringify(t)}).click();`; break;
        case "fill":        code = `    await page.locator(${JSON.stringify(t)}).fill(${JSON.stringify(v)});`; break;
        case "select":      code = `    await page.locator(${JSON.stringify(t)}).selectOption(${JSON.stringify(v)});`; break;
        case "check":       code = `    await page.locator(${JSON.stringify(t)}).check();`; break;
        case "uncheck":     code = `    await page.locator(${JSON.stringify(t)}).uncheck();`; break;
        case "hover":       code = `    await page.locator(${JSON.stringify(t)}).hover();`; break;
        case "wait":        code = `    await page.waitForTimeout(${parseInt(v) || 1000});`; break;
        case "screenshot":  code = `    await page.screenshot({ path: ${JSON.stringify(v || "test-results/step-screenshot.png")} });`; break;
        case "assert_visible": code = `    await expect(page.locator(${JSON.stringify(t)})).toBeVisible();`; break;
        case "assert_text": code = `    await expect(page.locator(${JSON.stringify(t)})).toContainText(${JSON.stringify(v)});`; break;
        case "assert_url":  code = `    await expect(page).toHaveURL(${JSON.stringify(v || t)});`; break;
        case "custom":      code = `    ${v || `// Custom step: ${step.description ?? "TODO"}`}`; break;
        default:            code = `    // Unknown action: ${step.action}`;
      }
      lines.push(desc + code);
    }
    lines.push(``);
    lines.push(`    await page.screenshot({ path: 'test-results/steps-final.png' });`);
    lines.push(`  });`);
    lines.push(`});`);
    setCodePreview(lines.join("\n"));
  }, [steps, mode, scenarioUrl]);

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5 bg-gray-950 rounded-lg p-0.5">
          <button onClick={() => setMode("steps")}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition font-medium ${mode === "steps" ? "bg-emerald-500/20 text-emerald-300" : "text-gray-500 hover:text-gray-300"}`}>
            <ListOrdered className="w-3 h-3" /> Steps
          </button>
          <button onClick={() => setMode("code")}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition font-medium ${mode === "code" ? "bg-blue-500/20 text-blue-300" : "text-gray-500 hover:text-gray-300"}`}>
            <Code className="w-3 h-3" /> Code Preview
          </button>
        </div>
        <span className="text-[10px] text-gray-600 ml-auto">{steps.length} step{steps.length !== 1 ? "s" : ""}</span>
      </div>

      {mode === "steps" ? (
        <div className="space-y-2">
          {/* Steps table */}
          {steps.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-gray-800 rounded-lg">
              <p className="text-xs text-gray-600 mb-2">No test steps yet</p>
              <button onClick={addStep}
                className="text-xs text-emerald-400 hover:text-emerald-300 transition font-medium">
                + Add first step
              </button>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
              {steps.map((step, idx) => (
                <div key={step.id} className="group flex items-start gap-1.5 bg-gray-950 border border-gray-800 rounded-lg p-2 hover:border-gray-700 transition">
                  {/* Step number + drag handle */}
                  <div className="flex flex-col items-center gap-0.5 pt-1 shrink-0 w-6">
                    <span className="text-[10px] text-gray-600 font-mono">{idx + 1}</span>
                    <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => moveStep(idx, -1)} disabled={idx === 0}
                        className="text-gray-600 hover:text-gray-400 disabled:opacity-30 text-[10px]">▲</button>
                      <button onClick={() => moveStep(idx, 1)} disabled={idx === steps.length - 1}
                        className="text-gray-600 hover:text-gray-400 disabled:opacity-30 text-[10px]">▼</button>
                    </div>
                  </div>

                  {/* Step content */}
                  <div className="flex-1 grid grid-cols-12 gap-1.5 min-w-0">
                    {/* Action dropdown */}
                    <select value={step.action} onChange={e => updateStep(step.id, { action: e.target.value as api.TestStep["action"] })}
                      className="col-span-3 bg-gray-900 border border-gray-800 rounded px-2 py-1 text-xs text-gray-300 outline-none focus:border-emerald-500 transition">
                      {STEP_ACTIONS.map(a => <option key={a.value} value={a.value}>{a.icon} {a.label}</option>)}
                    </select>

                    {/* Target / Selector */}
                    {!["navigate", "wait", "screenshot", "assert_url", "custom"].includes(step.action) && (
                      <input value={step.target ?? ""} onChange={e => updateStep(step.id, { target: e.target.value })}
                        placeholder="Selector (e.g. #email, button[type=submit])"
                        className="col-span-4 bg-gray-900 border border-gray-800 rounded px-2 py-1 text-xs text-gray-300 placeholder-gray-700 font-mono outline-none focus:border-emerald-500 transition" />
                    )}

                    {/* Input / Value */}
                    {["fill", "select", "navigate", "wait", "screenshot", "assert_text", "assert_url", "custom"].includes(step.action) && (
                      <input value={step.input ?? ""} onChange={e => updateStep(step.id, { input: e.target.value })}
                        placeholder={step.action === "wait" ? "ms (e.g. 1000)" : step.action === "custom" ? "Playwright code" : step.action === "navigate" ? "URL" : "Value"}
                        className={`${!["navigate", "wait", "screenshot", "assert_url", "custom"].includes(step.action) ? "col-span-3" : "col-span-7"} bg-gray-900 border border-gray-800 rounded px-2 py-1 text-xs text-gray-300 placeholder-gray-700 ${step.action === "custom" ? "font-mono" : ""} outline-none focus:border-emerald-500 transition`} />
                    )}

                    {/* Expected (for assertions) */}
                    {["assert_visible", "assert_text", "assert_url"].includes(step.action) && (
                      <input value={step.expected ?? ""} onChange={e => updateStep(step.id, { expected: e.target.value })}
                        placeholder="Expected result"
                        className={`${step.action === "assert_visible" ? "col-span-7" : "col-span-2"} bg-gray-900 border border-gray-800 rounded px-2 py-1 text-xs text-gray-300 placeholder-gray-700 outline-none focus:border-emerald-500 transition`} />
                    )}

                    {/* Spacer for actions without input/target */}
                    {["click", "check", "uncheck", "hover"].includes(step.action) && (
                      <div className="col-span-5" />
                    )}

                    {/* Description (inline, small) */}
                    <input value={step.description ?? ""} onChange={e => updateStep(step.id, { description: e.target.value })}
                      placeholder="Note..."
                      className="col-span-12 bg-transparent border-none text-[11px] text-gray-600 placeholder-gray-800 outline-none px-2 py-0.5" />
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => duplicateStep(idx)} title="Duplicate"
                      className="text-gray-600 hover:text-gray-400 text-[10px] px-1 py-0.5 rounded hover:bg-gray-800 transition">⧉</button>
                    <button onClick={() => removeStep(step.id)} title="Remove"
                      className="text-gray-600 hover:text-red-400 text-[10px] px-1 py-0.5 rounded hover:bg-gray-800 transition">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add step button */}
          {steps.length > 0 && (
            <button onClick={addStep}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-gray-500 hover:text-emerald-400 border border-dashed border-gray-800 hover:border-emerald-500/30 rounded-lg py-2 transition">
              <Plus className="w-3 h-3" /> Add Step
            </button>
          )}
        </div>
      ) : (
        /* Code preview mode */
        <div className="relative">
          <pre className="text-xs font-mono text-gray-400 bg-gray-950 border border-gray-800 rounded-lg p-3 max-h-[380px] overflow-auto whitespace-pre-wrap leading-relaxed">
            {codePreview || "// Add test steps to see generated Playwright code"}
          </pre>
          <span className="absolute top-2 right-2 text-[10px] text-gray-700 bg-gray-900 px-1.5 py-0.5 rounded">Read-only preview</span>
        </div>
      )}
    </div>
  );
}

// ─── Scenario Modal (Wizard) ──────────────────────────────────────────────────
const WIZARD_STEPS = ["Basics", "Test Design", "Review"] as const;
type WizardStep = (typeof WIZARD_STEPS)[number];

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

  // Wizard state
  const [wizardStep, setWizardStep] = useState<WizardStep>("Basics");
  const wizardIdx = WIZARD_STEPS.indexOf(wizardStep);

  // Form state
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

  // Test steps state
  const [testSteps, setTestSteps] = useState<api.TestStep[]>(scenario?.testSteps ?? []);

  // Snapshot of last saved values for dirty tracking
  const [snapshot, setSnapshot] = useState(() => getFormValues());

  function getFormValues() {
    return JSON.stringify({ moduleId, testCaseId, scenarioRefId, name, url, testTypes, description, tags, assigneeId, roleId, loginUrl, loginEmail, loginPass, testSteps });
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

  function canProceed(): boolean {
    if (wizardStep === "Basics") return !!(moduleId && name.trim() && url.trim());
    if (wizardStep === "Test Design") return testTypes.length > 0;
    return true;
  }

  function nextStep() {
    if (wizardIdx < WIZARD_STEPS.length - 1) setWizardStep(WIZARD_STEPS[wizardIdx + 1]);
  }
  function prevStep() {
    if (wizardIdx > 0) setWizardStep(WIZARD_STEPS[wizardIdx - 1]);
  }

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
      testSteps: testSteps.length > 0 ? testSteps : undefined,
    });
    if (ok) {
      setSavedAt(Date.now());
      setSnapshot(getFormValues());
    }
  }

  const inputCls = "w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition";
  const labelCls = "block text-xs font-semibold text-gray-400 uppercase tracking-widest";
  const optSpan = <span className="text-gray-600 font-normal normal-case tracking-normal">— optional</span>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="shrink-0">
          <div className="flex items-center justify-between px-6 py-3">
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

          {/* Tab bar */}
          <div className="flex border-b border-gray-800">
            {WIZARD_STEPS.map((s, i) => {
              const isActive = s === wizardStep;
              const isCompleted = i < wizardIdx;
              const isReachable = i <= wizardIdx || (i === wizardIdx + 1 && canProceed());
              return (
                <button key={s} onClick={() => { if (isReachable) setWizardStep(s); }}
                  disabled={!isReachable}
                  className={`relative flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition
                    ${isActive
                      ? "text-emerald-400"
                      : isCompleted
                        ? "text-gray-400 hover:text-gray-200 cursor-pointer"
                        : isReachable
                          ? "text-gray-500 hover:text-gray-300 cursor-pointer"
                          : "text-gray-700 cursor-not-allowed"
                    }`}>
                  <span className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold border transition
                    ${isActive
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : isCompleted
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                        : "bg-gray-900 text-gray-600 border-gray-700"
                    }`}>
                    {isCompleted ? "✓" : i + 1}
                  </span>
                  {s}
                  {/* Active indicator bar */}
                  {isActive && (
                    <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-emerald-500 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body — changes based on wizard step */}
        <div className="overflow-y-auto flex-1 px-6 py-4">

          {/* ─── Step 1: Basics ─── */}
          {wizardStep === "Basics" && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div className="space-y-1">
                <label className={labelCls}>Module</label>
                <select value={moduleId} onChange={e => setModuleId(e.target.value)} className={inputCls}>
                  <option value="">— select module —</option>
                  {projectModules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className={labelCls}>URL</label>
                <input value={url} onChange={e => setUrl(e.target.value)} type="url" placeholder="https://example.com" className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Kes ID {optSpan}</label>
                <input value={testCaseId} onChange={e => setTestCaseId(e.target.value)} placeholder="e.g. TC-NAS-PRF-01" className={inputCls + " font-mono"} />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Scenario ID {optSpan}</label>
                <input value={scenarioRefId} onChange={e => setScenarioRefId(e.target.value)} placeholder="e.g. SR-NAS-PRF-01" className={inputCls + " font-mono"} />
              </div>
              <div className="col-span-2 space-y-1">
                <label className={labelCls}>Scenario Name</label>
                <input value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="e.g. Login page smoke test" className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Description {optSpan}</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                  placeholder="What should the test focus on?" className={inputCls + " resize-none"} />
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className={labelCls}>Tags {optSpan}</label>
                  <input value={tags} onChange={e => setTags(e.target.value)} placeholder="auth, critical, regression" className={inputCls} />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>User Role</label>
                  <select value={roleId} onChange={e => setRoleId(e.target.value)} className={inputCls}>
                    <option value="">— no role —</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                {members.length > 0 && (
                  <div className="space-y-1">
                    <label className={labelCls}>Assignee</label>
                    <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} className={inputCls}>
                      <option value="">— unassigned —</option>
                      {members.map(m => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="col-span-2 border-t border-gray-800 pt-3 space-y-1.5">
                <label className={labelCls}>Login Required {optSpan}</label>
                <div className="grid grid-cols-3 gap-2">
                  <input value={loginUrl} onChange={e => setLoginUrl(e.target.value)} type="url" placeholder="Login URL" className={inputCls} />
                  <input value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="Email / Username" className={inputCls} />
                  <input value={loginPass} onChange={e => setLoginPass(e.target.value)} type="password" placeholder="Password" className={inputCls} />
                </div>
              </div>
            </div>
          )}

          {/* ─── Step 2: Test Design ─── */}
          {wizardStep === "Test Design" && (
            <div className="space-y-4">
              {/* Test types */}
              <div className="space-y-1.5">
                <label className={labelCls}>
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

              {/* Divider */}
              <div className="border-t border-gray-800 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <ListOrdered className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-widest">Test Steps</h3>
                  <span className="text-[10px] text-gray-600">— structured step-by-step actions (optional, Katalon-style)</span>
                </div>
                <TestStepsEditor steps={testSteps} onChange={setTestSteps} scenarioUrl={url || "https://example.com"} />
              </div>
            </div>
          )}

          {/* ─── Step 3: Review ─── */}
          {wizardStep === "Review" && (
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Review Before Saving</h3>

              <div className="grid grid-cols-2 gap-4">
                {/* Left: Details */}
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-0.5">Module</p>
                    <p className="text-sm text-gray-200">{projectModules.find(m => m.id === moduleId)?.name ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-0.5">Scenario</p>
                    <p className="text-sm text-gray-200 font-medium">{name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-0.5">URL</p>
                    <p className="text-xs text-emerald-400 font-mono break-all">{url || "—"}</p>
                  </div>
                  {(testCaseId || scenarioRefId) && (
                    <div className="flex gap-4">
                      {testCaseId && (
                        <div>
                          <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-0.5">Kes ID</p>
                          <p className="text-xs text-gray-300 font-mono">{testCaseId}</p>
                        </div>
                      )}
                      {scenarioRefId && (
                        <div>
                          <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-0.5">Scenario ID</p>
                          <p className="text-xs text-gray-300 font-mono">{scenarioRefId}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {description && (
                    <div>
                      <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-0.5">Description</p>
                      <p className="text-xs text-gray-400 whitespace-pre-wrap">{description}</p>
                    </div>
                  )}
                  {tags && (
                    <div>
                      <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-0.5">Tags</p>
                      <div className="flex flex-wrap gap-1">
                        {tags.split(",").map(t => t.trim()).filter(Boolean).map(t => (
                          <span key={t} className="text-xs bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {(loginUrl && loginEmail) && (
                    <div>
                      <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-0.5">Auth</p>
                      <p className="text-xs text-gray-400">{loginEmail} @ {loginUrl}</p>
                    </div>
                  )}
                </div>

                {/* Right: Test config summary */}
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Test Types</p>
                    <div className="flex flex-wrap gap-1.5">
                      {testTypes.map(t => {
                        const tt = TEST_TYPES.find(x => x.value === t);
                        return (
                          <span key={t} className="text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                            {tt?.label ?? t}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  {testSteps.length > 0 && (
                    <div>
                      <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Test Steps ({testSteps.length})</p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {testSteps.map((step, i) => {
                          const act = STEP_ACTIONS.find(a => a.value === step.action);
                          return (
                            <div key={step.id} className="flex items-center gap-2 text-xs text-gray-400">
                              <span className="text-gray-600 font-mono w-4 text-right shrink-0">{i + 1}</span>
                              <span>{act?.icon}</span>
                              <span className="font-medium text-gray-300">{act?.label ?? step.action}</span>
                              {step.target && <span className="text-gray-600 font-mono truncate">{step.target}</span>}
                              {step.input && <span className="text-gray-500 truncate">= {step.input}</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {roles.find(r => r.id === roleId) && (
                    <div>
                      <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-0.5">User Role</p>
                      <p className="text-xs text-gray-300">{roles.find(r => r.id === roleId)?.name}</p>
                    </div>
                  )}
                  {members.find(m => m.id === assigneeId) && (
                    <div>
                      <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-0.5">Assignee</p>
                      <p className="text-xs text-gray-300">{members.find(m => m.id === assigneeId)?.name}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer with wizard navigation */}
        <div className="px-6 py-3 border-t border-gray-800 flex items-center gap-3 shrink-0">
          {/* Left: Back / Previous */}
          {wizardIdx > 0 ? (
            <button onClick={prevStep}
              className="flex items-center gap-1.5 px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2 rounded-lg transition">
              <ArrowLeft className="w-3.5 h-3.5" /> {WIZARD_STEPS[wizardIdx - 1]}
            </button>
          ) : (
            <button onClick={() => confirmAndClose(onBack ?? onClose)}
              className="px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2 rounded-lg transition">
              {onBack ? "Back" : "Cancel"}
            </button>
          )}

          <div className="flex-1" />

          {savedAt && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved
            </span>
          )}

          {/* Right: Next / Save */}
          {wizardIdx < WIZARD_STEPS.length - 1 ? (
            <button onClick={nextStep} disabled={!canProceed()}
              className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition">
              {WIZARD_STEPS[wizardIdx + 1]} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button onClick={submit} disabled={saving}
              className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold px-6 py-2 rounded-lg transition">
              {saving ? "Saving…" : scenario ? "Save Changes" : "Create Scenario"}
            </button>
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
