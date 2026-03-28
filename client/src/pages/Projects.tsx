import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Plus, FolderOpen, Layers, FlaskConical, Pencil, Trash2,
  Clock, Upload, CheckCircle2, Settings2,
} from "lucide-react";
import * as api from "../lib/api";
import { relativeTime } from "../lib/utils";
import PageHeader from "../components/PageHeader";
import { ProjectSettingsModal } from "./Settings";

export default function Projects() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: projects = [], isLoading } = useQuery<api.Project[]>({
    queryKey: ["projects"],
    queryFn: api.getProjects,
  });

  // ── Create project ───────────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const createMut = useMutation({
    mutationFn: () => api.createProject({ name: newName.trim(), description: newDesc.trim() || undefined }),
    onSuccess: () => {
      setNewName(""); setNewDesc(""); setShowCreate(false);
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  // ── Edit project ─────────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const updateMut = useMutation({
    mutationFn: () => api.updateProject(editingId!, { name: editName.trim(), description: editDesc.trim() || undefined }),
    onSuccess: () => {
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: api.deleteProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });

  // ── Import DSSB ──────────────────────────────────────────────────────────
  const [importResult, setImportResult] = useState<{ created: number; createdNames: string[]; errors: { row: number; error: string }[] } | null>(null);
  const [settingsProjectId, setSettingsProjectId] = useState<string | null>(null);

  async function handleImport(files: FileList | File[]) {
    const arr = Array.from(files);
    const result = await api.importScenarios(arr);
    setImportResult(result);
    if (result.created > 0) qc.invalidateQueries({ queryKey: ["projects"] });
  }

  function startEdit(p: api.Project) {
    setEditingId(p.id); setEditName(p.name); setEditDesc(p.description ?? "");
  }

  return (
    <div className="flex flex-col h-screen">
      <PageHeader title="Projects" subtitle="Select a project to manage scenarios">
        <label className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium px-3 py-2 rounded-lg transition cursor-pointer">
          <Upload className="w-3.5 h-3.5" />
          Import Test Script
          <input type="file" accept=".xlsx,.xls,.csv" multiple className="hidden"
            onChange={e => { if (e.target.files?.length) handleImport(e.target.files); e.target.value = ""; }} />
        </label>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
          <Plus className="w-4 h-4" /> New Project
        </button>
      </PageHeader>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FolderOpen className="w-16 h-16 text-gray-700" />
            <p className="text-sm text-gray-500 mt-4">No projects yet</p>
            <p className="text-xs text-gray-700 mt-1">Create your first project to start organising test scenarios</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-sm px-4 py-2 rounded-lg transition"
            >
              <Plus className="w-4 h-4" /> Create Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects.map(p => {
              const moduleCount = p.modules?.length ?? 0;
              const scenarioCount = p.modules?.reduce((sum, m) => sum + (m.scenarios?.length ?? 0), 0) ?? 0;

              return (
                <div
                  key={p.id}
                  onClick={() => navigate(`/library/${p.id}`)}
                  className="group bg-gray-900 border border-gray-800 hover:border-emerald-500/50 rounded-xl p-5 flex flex-col gap-3 cursor-pointer transition hover:shadow-lg hover:shadow-emerald-500/5"
                >
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                        <FolderOpen className="w-4.5 h-4.5 text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-gray-200 truncate group-hover:text-emerald-300 transition">
                          {p.name}
                        </h3>
                        {p.description && (
                          <p className="text-xs text-gray-600 truncate mt-0.5">{p.description}</p>
                        )}
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0"
                      onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setSettingsProjectId(p.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-500 hover:text-gray-200 transition"
                        title="Project settings"
                      >
                        <Settings2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => startEdit(p)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-500 hover:text-gray-200 transition"
                        title="Edit project"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => { if (confirm(`Delete project "${p.name}" and all its modules/scenarios?`)) deleteMut.mutate(p.id); }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-red-900/50 text-gray-500 hover:text-red-400 transition"
                        title="Delete project"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-gray-600" />
                      {moduleCount} module{moduleCount !== 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <FlaskConical className="w-3.5 h-3.5 text-gray-600" />
                      {scenarioCount} scenario{scenarioCount !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Updated */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-700 mt-auto pt-2 border-t border-gray-800/50">
                    <Clock className="w-3 h-3" />
                    Updated {relativeTime(p.updatedAt)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="text-sm font-semibold text-white">New Project</h2>
              <button onClick={() => { setShowCreate(false); setNewName(""); setNewDesc(""); }}
                className="text-gray-500 hover:text-gray-200 transition text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">Project Name</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} autoFocus
                  placeholder="e.g. E-Commerce Platform"
                  onKeyDown={e => { if (e.key === "Enter" && newName.trim()) createMut.mutate(); if (e.key === "Escape") setShowCreate(false); }}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">
                  Description <span className="text-gray-600 font-normal normal-case tracking-normal">— optional</span>
                </label>
                <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2}
                  placeholder="Brief description of this project"
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-800 flex gap-3">
              <button onClick={() => createMut.mutate()} disabled={!newName.trim() || createMut.isPending}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition">
                {createMut.isPending ? "Creating…" : "Create Project"}
              </button>
              <button onClick={() => { setShowCreate(false); setNewName(""); setNewDesc(""); }}
                className="px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2 rounded-lg transition">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="text-sm font-semibold text-white">Edit Project</h2>
              <button onClick={() => setEditingId(null)}
                className="text-gray-500 hover:text-gray-200 transition text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">Project Name</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus
                  onKeyDown={e => { if (e.key === "Enter" && editName.trim()) updateMut.mutate(); if (e.key === "Escape") setEditingId(null); }}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">
                  Description <span className="text-gray-600 font-normal normal-case tracking-normal">— optional</span>
                </label>
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-800 flex gap-3">
              <button onClick={() => updateMut.mutate()} disabled={!editName.trim() || updateMut.isPending}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition">
                {updateMut.isPending ? "Saving…" : "Save Changes"}
              </button>
              <button onClick={() => setEditingId(null)}
                className="px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2 rounded-lg transition">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Result Modal */}
      {importResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
              <h2 className="text-sm font-semibold text-white">Import Result</h2>
              <button onClick={() => setImportResult(null)} className="text-gray-500 hover:text-gray-200 transition text-xl leading-none">&times;</button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4 text-sm">
              {importResult.created > 0 && (
                <div className="flex items-start gap-3 bg-green-900/20 border border-green-800/50 rounded-lg px-4 py-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-green-300 font-semibold">{importResult.created} scenario{importResult.created !== 1 ? "s" : ""} imported</p>
                    <ul className="mt-1 space-y-0.5 text-xs text-green-700 max-h-40 overflow-y-auto">
                      {importResult.createdNames.map(n => <li key={n}>&#10003; {n}</li>)}
                    </ul>
                  </div>
                </div>
              )}
              {importResult.errors.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-400 uppercase tracking-widest mb-2">{importResult.errors.length} skipped</p>
                  <ul className="space-y-1 text-xs border border-gray-800 rounded-lg px-3 py-2 max-h-40 overflow-y-auto">
                    {importResult.errors.map((e, i) => (
                      <li key={i} className="flex items-start gap-2 text-gray-400">
                        <span className="text-red-500 flex-shrink-0">{e.row > 0 ? `Row ${e.row}:` : "Error:"}</span>
                        <span>{e.error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {importResult.created === 0 && !importResult.errors.length && (
                <p className="text-gray-500">No test cases found. Make sure the file is in DSSB or standard template format.</p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-800 flex-shrink-0">
              <button onClick={() => setImportResult(null)} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold py-2 rounded-lg transition">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Project Settings Modal */}
      {settingsProjectId && (
        <ProjectSettingsModal projectId={settingsProjectId} onClose={() => setSettingsProjectId(null)} />
      )}
    </div>
  );
}
