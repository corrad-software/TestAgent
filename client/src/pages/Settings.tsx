import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Settings2, BarChart2, Users, Plus, Pencil, Trash2,
  CheckCircle2, TrendingUp, Activity, Calendar, ShieldCheck, X,
} from "lucide-react";
import * as api from "../lib/api";
import { relativeTime, ROLE_COLORS, roleColorCls, PROJECT_ROLE_PALETTE } from "../lib/utils";

type Tab = "info" | "dashboard" | "team";

export default function Settings() {
  const [tab, setTab] = useState<Tab>("info");
  const [activeProjectId, setActiveProjectId] = useState<string>("");

  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: api.getProjects });

  // Default to first project
  useEffect(() => {
    if (!activeProjectId && projects.length) setActiveProjectId(projects[0].id);
  }, [projects, activeProjectId]);

  const activeProject = projects.find(p => p.id === activeProjectId);

  return (
    <div className="flex flex-col h-screen">
      {/* Topbar */}
      <header className="sticky top-0 z-10 bg-gray-950/80 backdrop-blur border-b border-gray-800 px-6 h-13 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-base font-semibold text-white">Project Settings</h1>
          <p className="text-xs text-gray-500 mt-0.5">Configure projects, view stats, and manage your team</p>
        </div>
        {/* Project switcher */}
        <select
          value={activeProjectId}
          onChange={e => setActiveProjectId(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-emerald-500 transition"
        >
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </header>

      {/* Tab bar */}
      <div className="border-b border-gray-800 px-8 flex gap-1 flex-shrink-0 bg-gray-950">
        {([
          { id: "info",      icon: Settings2, label: "Project Info" },
          { id: "dashboard", icon: BarChart2, label: "Dashboard" },
          { id: "team",      icon: Users,     label: "Team Members" },
        ] as { id: Tab; icon: any; label: string }[]).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition
              ${tab === id
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-gray-500 hover:text-gray-300"}`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === "info"      && activeProject && <ProjectInfoTab project={activeProject} />}
        {tab === "dashboard" && activeProjectId && <DashboardTab projectId={activeProjectId} />}
        {tab === "team"      && activeProjectId && <TeamTab projectId={activeProjectId} />}
        {!activeProject && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-600">
            <p>No projects found. Create one in the Library.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const ROLE_PALETTE = PROJECT_ROLE_PALETTE;

// ─── Project Info Tab ─────────────────────────────────────────────────────────
export function ProjectInfoTab({ project }: { project: api.Project }) {
  const qc = useQueryClient();
  const [name, setName] = useState(project.name);
  const [desc, setDesc] = useState(project.description ?? "");
  const [saved, setSaved] = useState(false);

  useEffect(() => { setName(project.name); setDesc(project.description ?? ""); }, [project]);

  const mut = useMutation({
    mutationFn: () => api.updateProject(project.id, { name, description: desc }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); setSaved(true); setTimeout(() => setSaved(false), 2000); },
  });

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white">Project Information</h2>
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">Project Name</label>
          <input
            value={name} onChange={e => setName(e.target.value)}
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-emerald-500 transition"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">Description</label>
          <textarea
            value={desc} onChange={e => setDesc(e.target.value)} rows={3}
            placeholder="What does this project test?"
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition resize-none"
          />
        </div>
        <button
          onClick={() => mut.mutate()}
          disabled={mut.isPending}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
        >
          {saved ? <><CheckCircle2 className="w-4 h-4" /> Saved</> : mut.isPending ? "Saving…" : "Save Changes"}
        </button>
      </div>

      {/* User Roles */}
      <UserRolesSection projectId={project.id} />

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-3">
        <h2 className="text-sm font-semibold text-white">Project Details</h2>
        <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
          <span>ID</span><span className="text-gray-400 font-mono">{project.id}</span>
          <span>Created</span><span className="text-gray-400">{relativeTime(project.createdAt)}</span>
          <span>Updated</span><span className="text-gray-400">{relativeTime(project.updatedAt)}</span>
          <span>Modules</span><span className="text-gray-400">{project.modules?.length ?? 0}</span>
        </div>
      </div>
    </div>
  );
}

// ─── User Roles Section ────────────────────────────────────────────────────────
function UserRolesSection({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [newName,  setNewName]  = useState("");
  const [newColor, setNewColor] = useState("gray");
  const [editId,   setEditId]   = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor,setEditColor]= useState("gray");

  const { data: roles = [] } = useQuery<api.ProjectRole[]>({
    queryKey: ["roles", projectId],
    queryFn: () => api.getRoles(projectId),
    enabled: !!projectId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["roles", projectId] });

  const createMut = useMutation({
    mutationFn: () => api.createRole(projectId, { name: newName.trim(), color: newColor }),
    onSuccess: () => { setNewName(""); setNewColor("gray"); invalidate(); },
  });
  const updateMut = useMutation({
    mutationFn: () => api.updateRole(editId!, { name: editName.trim(), color: editColor }),
    onSuccess: () => { setEditId(null); invalidate(); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteRole(id),
    onSuccess: invalidate,
  });

  function startEdit(r: api.ProjectRole) {
    setEditId(r.id); setEditName(r.name); setEditColor(r.color);
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <h2 className="text-sm font-semibold text-white">User Roles</h2>
        <span className="ml-auto text-xs text-gray-500">Categorise scenarios by which system role performs them</span>
      </div>

      {/* Existing roles */}
      <div className="space-y-2">
        {roles.length === 0 && (
          <p className="text-xs text-gray-600 py-2">No roles yet. Add roles below.</p>
        )}
        {roles.map(r => (
          <div key={r.id} className="flex items-center gap-2">
            {editId === r.id ? (
              <>
                <input
                  value={editName} onChange={e => setEditName(e.target.value)}
                  className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-200 outline-none focus:border-emerald-500"
                  autoFocus
                />
                <ColorPicker value={editColor} onChange={setEditColor} />
                <button
                  onClick={() => updateMut.mutate()}
                  disabled={!editName.trim() || updateMut.isPending}
                  className="text-xs bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 transition"
                >Save</button>
                <button onClick={() => setEditId(null)} className="p-1.5 text-gray-500 hover:text-gray-300">
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${roleColorCls(r.color)}`}>{r.name}</span>
                <span className="flex-1" />
                <button onClick={() => startEdit(r)} className="p-1.5 text-gray-600 hover:text-gray-300 transition">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { if (confirm(`Delete role "${r.name}"?`)) deleteMut.mutate(r.id); }}
                  className="p-1.5 text-gray-600 hover:text-red-400 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add new role */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-800">
        <input
          value={newName} onChange={e => setNewName(e.target.value)}
          placeholder="New role name (e.g. KOAD, Admin, Viewer)"
          onKeyDown={e => { if (e.key === "Enter" && newName.trim()) createMut.mutate(); }}
          className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition"
        />
        <ColorPicker value={newColor} onChange={setNewColor} />
        <button
          onClick={() => createMut.mutate()}
          disabled={!newName.trim() || createMut.isPending}
          className="flex items-center gap-1.5 text-xs bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 transition"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      {ROLE_PALETTE.map(p => (
        <button
          key={p.value}
          title={p.label}
          onClick={() => onChange(p.value)}
          className={`w-5 h-5 rounded-full border-2 transition ${roleColorCls(p.value).split(" ")[0]}
            ${value === p.value ? "border-white scale-110" : "border-transparent opacity-60 hover:opacity-100"}`}
        />
      ))}
    </div>
  );
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────
function DashboardTab({ projectId }: { projectId: string }) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["stats", projectId],
    queryFn: () => api.getStats(projectId),
    refetchInterval: 30000,
  });

  if (isLoading) return <div className="text-gray-600 text-sm">Loading stats…</div>;
  if (!stats) return null;

  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Scenarios",    value: stats.totalScenarios, icon: Activity,   color: "text-emerald-400" },
          { label: "Total Runs",   value: stats.totalRuns,      icon: TrendingUp,  color: "text-emerald-400" },
          { label: "Pass Rate",    value: `${stats.passRate}%`, icon: CheckCircle2,color: stats.passRate >= 80 ? "text-green-400" : stats.passRate >= 50 ? "text-yellow-400" : "text-red-400" },
          { label: "This Week",    value: stats.runsThisWeek,   icon: Calendar,    color: "text-teal-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-500 font-medium">{label}</span>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Module breakdown */}
      {stats.moduleBreakdown.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-white">Module Breakdown</h3>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 text-left border-b border-gray-800">
                <th className="px-6 py-3 font-medium">Module</th>
                <th className="px-4 py-3 font-medium text-center">Scenarios</th>
                <th className="px-4 py-3 font-medium text-center">Runs</th>
                <th className="px-4 py-3 font-medium text-center">Passed</th>
                <th className="px-4 py-3 font-medium text-center">Pass Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {stats.moduleBreakdown.map(m => (
                <tr key={m.moduleId} className="hover:bg-gray-800/30">
                  <td className="px-6 py-3 text-gray-300">{m.moduleName}</td>
                  <td className="px-4 py-3 text-center text-gray-400">{m.scenarioCount}</td>
                  <td className="px-4 py-3 text-center text-gray-400">{m.runCount}</td>
                  <td className="px-4 py-3 text-center text-gray-400">{m.passCount}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={m.passRate >= 80 ? "text-green-400" : m.passRate >= 50 ? "text-yellow-400" : "text-red-400"}>
                      {m.passRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent runs */}
      {stats.recentRuns.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-white">Recent Runs</h3>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 text-left border-b border-gray-800">
                <th className="px-6 py-3 font-medium">Scenario</th>
                <th className="px-4 py-3 font-medium">Module</th>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {stats.recentRuns.map(r => (
                <tr key={r.runId} className="hover:bg-gray-800/30">
                  <td className="px-6 py-3 text-gray-300 max-w-xs truncate">{r.scenarioName}</td>
                  <td className="px-4 py-3 text-gray-500">{r.moduleName}</td>
                  <td className="px-4 py-3 text-gray-600">{relativeTime(r.runAt)}</td>
                  <td className={`px-4 py-3 font-medium ${r.passed ? "text-green-400" : "text-red-400"}`}>
                    {r.passed ? "✅ Pass" : "❌ Fail"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{(r.durationMs / 1000).toFixed(1)}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Team Tab ─────────────────────────────────────────────────────────────────
// ─── Member Avatar helper ──────────────────────────────────────────────────────
function MemberAvatar({ member, size = "md" }: { member: Pick<api.Member, "name" | "avatarUrl">; size?: "sm" | "md" | "lg" }) {
  const sizeMap = { sm: "w-6 h-6 text-[9px]", md: "w-8 h-8 text-xs", lg: "w-12 h-12 text-base" };
  const cls = sizeMap[size];
  if (member.avatarUrl) {
    return <img src={member.avatarUrl} alt={member.name} className={`${cls} rounded-full object-cover border border-gray-700 shrink-0`} />;
  }
  const initials = member.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className={`${cls} rounded-full bg-emerald-900/60 border border-emerald-700/40 flex items-center justify-center font-bold text-emerald-300 shrink-0`}>
      {initials}
    </div>
  );
}
export { MemberAvatar };

// ─── Project Settings Modal (used from Projects page) ───────────────────────
export function ProjectSettingsModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [tab, setTab] = useState<"info" | "team">("info");
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: api.getProjects });
  const project = projects.find(p => p.id === projectId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-white">{project?.name ?? "Project"} Settings</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 transition text-xl leading-none">&times;</button>
        </div>
        <div className="border-b border-gray-800 px-6 pt-2 flex gap-1 shrink-0">
          {([
            { id: "info" as const, icon: Settings2, label: "Info & Roles" },
            { id: "team" as const, icon: Users,     label: "Team Members" },
          ]).map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition
                ${tab === id ? "border-emerald-500 text-emerald-400" : "border-transparent text-gray-500 hover:text-gray-300"}`}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {tab === "info" && project && <ProjectInfoTab project={project} />}
          {tab === "team" && <TeamTab projectId={projectId} />}
        </div>
      </div>
    </div>
  );
}

export function TeamTab({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [addRole, setAddRole] = useState("Tester");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");

  const { data: members = [] } = useQuery({
    queryKey: ["members", projectId],
    queryFn: () => api.getMembers(projectId),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: api.getUsers,
    enabled: showAdd,
  });

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["members", projectId] });
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["users"] });
  }, [qc, projectId]);

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteMember(id),
    onSuccess: invalidate,
  });

  const updateRoleMut = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => api.updateMember(id, { role }),
    onSuccess: () => { setEditingId(null); invalidate(); },
  });

  const assignMut = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.assignUserToProject(userId, projectId, role),
    onSuccess: () => { setSearch(""); invalidate(); },
  });

  // Filter users not already in project
  const memberEmails = new Set(members.map(m => m.email));
  const availableUsers = users.filter(u => !memberEmails.has(u.email));
  const searchResults = search.length >= 1
    ? availableUsers.filter(u => {
        const q = search.toLowerCase();
        return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      }).slice(0, 6)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Team Members</h2>
        <button onClick={() => setShowAdd(a => !a)}
          className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition">
          <Plus className="w-3.5 h-3.5" /> Add Member
        </button>
      </div>

      {/* Add member — user search */}
      {showAdd && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <p className="text-xs text-gray-500">Search existing users to add to this project</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Type a name or email..."
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition"
                autoFocus
              />
            </div>
            <select value={addRole} onChange={e => setAddRole(e.target.value)}
              className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-emerald-500 transition">
              <option>Admin</option>
              <option>Tester</option>
              <option>Viewer</option>
            </select>
          </div>
          {/* Search results */}
          {search.length >= 1 && (
            <div className="space-y-1">
              {searchResults.length === 0 ? (
                <p className="text-xs text-gray-600 py-2 text-center italic">No matching users found</p>
              ) : (
                searchResults.map(u => (
                  <div key={u.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800/50 transition">
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt={u.name} className="w-8 h-8 rounded-full object-cover border border-gray-700 shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-emerald-900/60 border border-emerald-700/40 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-emerald-300">
                          {u.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 truncate">{u.name}</p>
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    </div>
                    <button
                      onClick={() => assignMut.mutate({ userId: u.id, role: addRole })}
                      disabled={assignMut.isPending}
                      className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-medium px-3 py-1.5 rounded-lg transition disabled:opacity-50 shrink-0"
                    >
                      Add
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Members table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {!members.length ? (
          <div className="px-6 py-10 text-center text-xs text-gray-600 italic">No team members yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 text-left border-b border-gray-800">
                <th className="px-6 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {members.map(m => (
                <tr key={m.id} className="hover:bg-gray-800/30 group">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <MemberAvatar member={m} size="md" />
                      <span className="text-gray-200 font-medium">{m.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{m.email}</td>
                  <td className="px-4 py-3">
                    {editingId === m.id ? (
                      <div className="flex items-center gap-1.5">
                        <select value={editRole} onChange={e => setEditRole(e.target.value)}
                          className="bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 outline-none focus:border-emerald-500">
                          <option>Admin</option>
                          <option>Tester</option>
                          <option>Viewer</option>
                        </select>
                        <button onClick={() => updateRoleMut.mutate({ id: m.id, role: editRole })}
                          className="text-xs text-emerald-400 hover:text-emerald-300">Save</button>
                        <button onClick={() => setEditingId(null)}
                          className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
                      </div>
                    ) : (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[m.role] ?? "bg-gray-800 text-gray-400"}`}>{m.role}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{relativeTime(m.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 justify-end opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => { setEditingId(m.id); setEditRole(m.role); }} className="p-1.5 rounded hover:bg-gray-700 text-gray-400 transition" title="Change role">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { if (confirm(`Remove "${m.name}" from this project?`)) deleteMut.mutate(m.id); }}
                        className="p-1.5 rounded hover:bg-red-900/50 text-gray-500 hover:text-red-400 transition"
                        title="Remove from project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
