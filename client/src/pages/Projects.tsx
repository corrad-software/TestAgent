import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Plus, FolderOpen, Layers, FlaskConical, Clock,
} from "lucide-react";
import * as api from "../lib/api";
import { relativeTime } from "../lib/utils";
import PageHeader from "../components/PageHeader";

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

  return (
    <div className="flex flex-col h-screen">
      <PageHeader title="Projects" subtitle="Select a project to manage scenarios">
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition">
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

              const members = p.members ?? [];

              return (
                <div
                  key={p.id}
                  onClick={() => navigate(`/project/${p.id}`)}
                  className="group bg-gray-900 border border-gray-800 hover:border-emerald-500/50 rounded-xl p-5 flex flex-col gap-3 cursor-pointer transition hover:shadow-lg hover:shadow-emerald-500/5"
                >
                  {/* Title row */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
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

                  {/* Collaborators + Updated */}
                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-800/50">
                    {/* Avatar stack */}
                    {members.length > 0 ? (
                      <div className="flex items-center">
                        <div className="flex -space-x-2">
                          {members.slice(0, 5).map(m => (
                            m.avatarUrl ? (
                              <img key={m.id} src={m.avatarUrl} alt={m.name} title={m.name}
                                className="w-6 h-6 rounded-full border-2 border-gray-900 object-cover" />
                            ) : (
                              <div key={m.id} title={m.name}
                                className="w-6 h-6 rounded-full border-2 border-gray-900 bg-emerald-900/60 flex items-center justify-center">
                                <span className="text-[9px] font-bold text-emerald-300">
                                  {m.name[0]?.toUpperCase()}
                                </span>
                              </div>
                            )
                          ))}
                        </div>
                        {members.length > 5 && (
                          <span className="text-[10px] text-gray-500 ml-1.5">+{members.length - 5}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-700 italic">No members</span>
                    )}
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-700 shrink-0">
                      <Clock className="w-3 h-3" />
                      {relativeTime(p.updatedAt)}
                    </div>
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

    </div>
  );
}
