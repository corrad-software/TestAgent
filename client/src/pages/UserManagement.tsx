import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Pencil, Trash2, X, KeyRound, FolderPlus,
  Shield, ShieldCheck, CheckCircle2, Search, Upload,
} from "lucide-react";
import * as api from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { relativeTime } from "../lib/utils";
import PageHeader from "../components/PageHeader";

const ROLES = ["Admin", "Tester"];

// 10 preset avatar SVGs as data URIs
const mkAvatar = (bg: string, skin: string, hair: string, extra: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="40" fill="${bg}"/><circle cx="40" cy="34" r="16" fill="${skin}"/>${hair}<circle cx="34" cy="31" r="2" fill="#333"/><circle cx="46" cy="31" r="2" fill="#333"/><path d="M36 38q4 3 8 0" stroke="#333" stroke-width="1.5" fill="none" stroke-linecap="round"/><ellipse cx="40" cy="62" rx="18" ry="14" fill="${skin}"/>${extra}</svg>`)}`;

const PRESET_AVATARS = [
  mkAvatar("#6366f1", "#f5d0a9", '<path d="M24 28q4-14 32 0" fill="#4338ca"/>', ''),
  mkAvatar("#10b981", "#c68642", '<path d="M24 30q0-16 32 0v4H24z" fill="#333"/>', ''),
  mkAvatar("#f59e0b", "#ffe0bd", '<path d="M22 26q6-12 36 0" fill="#92400e"/><rect x="30" y="27" width="20" height="5" rx="2" fill="#92400e" opacity=".3"/>', ''),
  mkAvatar("#ec4899", "#f5d0a9", '<path d="M24 34q-2-18 16-18t16 18" fill="#7c2d12"/>', ''),
  mkAvatar("#8b5cf6", "#ffe0bd", '<ellipse cx="40" cy="22" rx="14" ry="8" fill="#1e1b4b"/>', ''),
  mkAvatar("#06b6d4", "#c68642", '<path d="M26 30q0-14 28 0" fill="#164e63"/><path d="M26 30h28" stroke="#164e63" stroke-width="2"/>', ''),
  mkAvatar("#ef4444", "#f5d0a9", '<path d="M24 28q4-10 16-10t16 10" fill="#dc2626"/>', '<circle cx="40" cy="48" r="3" fill="#fbbf24"/>'),
  mkAvatar("#14b8a6", "#ffe0bd", '<path d="M24 32q2-16 16-14t16 14" fill="#0f766e"/>', ''),
  mkAvatar("#f97316", "#c68642", '<path d="M22 30q6-16 36 0" fill="#1a1a2e"/><path d="M22 30h36" stroke="#1a1a2e" stroke-width="2"/>', ''),
  mkAvatar("#a855f7", "#f5d0a9", '<path d="M26 34q-4-20 14-18t14 18" fill="#581c87"/><path d="M24 34h32" stroke="#581c87" stroke-width="1.5"/>', ''),
];

const inputCls =
  "w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition";

export default function UserManagement() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<api.SystemUser | null>(null);
  const [resetPwUser, setResetPwUser] = useState<api.SystemUser | null>(null);
  const [assignUser, setAssignUser] = useState<api.SystemUser | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: api.getUsers,
  });

  const { data: projects = [] } = useQuery<api.Project[]>({
    queryKey: ["projects"],
    queryFn: api.getProjects,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["users"] });

  const deleteMut = useMutation({
    mutationFn: api.deleteUser,
    onSuccess: invalidate,
  });

  const unassignMut = useMutation({
    mutationFn: ({ userId, projectId }: { userId: string; projectId: string }) =>
      api.unassignUserFromProject(userId, projectId),
    onSuccess: invalidate,
  });

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col h-screen">
      <PageHeader title="User Management">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search users..."
            className="bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 outline-none focus:border-emerald-500 transition w-48"
          />
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
        >
          <Plus className="w-3.5 h-3.5" /> New User
        </button>
      </PageHeader>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 text-left border-b border-gray-800">
                  <th className="px-6 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Projects</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtered.map(u => (
                  <tr key={u.id} className="hover:bg-gray-800/30 group">
                    {/* User */}
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt={u.name} className="w-8 h-8 rounded-full object-cover border border-gray-700 shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-emerald-900/60 border border-emerald-700/40 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-emerald-300">
                              {u.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-gray-200 truncate">{u.name}</span>
                            {u.id === me?.id && (
                              <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-medium">You</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    {/* Role */}
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        u.role === "Admin"
                          ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                          : "bg-sky-500/15 text-sky-400 border border-sky-500/20"
                      }`}>
                        {u.role === "Admin" ? <ShieldCheck className="w-3 h-3 inline mr-0.5 -mt-0.5" /> : <Shield className="w-3 h-3 inline mr-0.5 -mt-0.5" />}
                        {u.role}
                      </span>
                    </td>
                    {/* Projects */}
                    <td className="px-4 py-3">
                      {u.projects.length === 0 ? (
                        <span className="text-xs text-gray-600 italic">None</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {u.projects.map(p => (
                            <span key={p.projectId} className="inline-flex items-center gap-1 text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-md">
                              {p.projectName}
                              <button
                                onClick={() => unassignMut.mutate({ userId: u.id, projectId: p.projectId })}
                                className="text-gray-600 hover:text-red-400 transition"
                                title="Remove from project"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    {/* Joined */}
                    <td className="px-4 py-3 text-xs text-gray-600">{relativeTime(u.createdAt)}</td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => setAssignUser(u)} title="Assign to project"
                          className="p-1.5 rounded hover:bg-gray-700 text-gray-500 hover:text-emerald-400 transition">
                          <FolderPlus className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setResetPwUser(u)} title="Reset password"
                          className="p-1.5 rounded hover:bg-gray-700 text-gray-500 hover:text-amber-400 transition">
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setEditing(u)} title="Edit user"
                          className="p-1.5 rounded hover:bg-gray-700 text-gray-500 hover:text-sky-400 transition">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {u.id !== me?.id && (
                          <button
                            onClick={() => { if (confirm(`Delete user "${u.name}"? This cannot be undone.`)) deleteMut.mutate(u.id); }}
                            title="Delete user"
                            className="p-1.5 rounded hover:bg-red-900/50 text-gray-500 hover:text-red-400 transition">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showCreate && (
        <UserFormModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); invalidate(); }}
        />
      )}

      {/* Edit User Modal */}
      {editing && (
        <UserFormModal
          user={editing}
          onClose={() => setEditing(null)}
          onSuccess={() => { setEditing(null); invalidate(); }}
        />
      )}

      {/* Reset Password Modal */}
      {resetPwUser && (
        <ResetPasswordModal
          user={resetPwUser}
          onClose={() => setResetPwUser(null)}
        />
      )}

      {/* Assign to Project Modal */}
      {assignUser && (
        <AssignProjectModal
          user={assignUser}
          projects={projects}
          onClose={() => setAssignUser(null)}
          onSuccess={() => { setAssignUser(null); invalidate(); }}
        />
      )}
    </div>
  );
}

// ─── Create / Edit User Modal ─────────────────────────────────────────────────
function UserFormModal({ user, onClose, onSuccess }: {
  user?: api.SystemUser;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(user?.role ?? "Tester");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [error, setError] = useState("");

  function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setAvatarUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  const mut = useMutation({
    mutationFn: () =>
      user
        ? api.updateUser(user.id, { name, email, role, avatarUrl: avatarUrl || undefined })
        : api.createUser({ email, name, password, role, avatarUrl: avatarUrl || undefined }),
    onSuccess,
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">{user ? "Edit User" : "Create User"}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 transition text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={e => { e.preventDefault(); mut.mutate(); }} className="px-6 py-5 space-y-4">
          {/* Avatar picker */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">Avatar</label>
            <div className="flex flex-wrap gap-2">
              {/* No avatar option */}
              <button type="button" onClick={() => setAvatarUrl("")}
                className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition ${
                  !avatarUrl ? "border-emerald-500 ring-2 ring-emerald-500/30" : "border-gray-700 hover:border-gray-500"
                } bg-gray-800`}>
                <span className="text-xs text-gray-500 font-bold">
                  {name ? name[0]?.toUpperCase() : "?"}
                </span>
              </button>
              {/* Preset avatars */}
              {PRESET_AVATARS.map((src, i) => (
                <button type="button" key={i} onClick={() => setAvatarUrl(src)}
                  className={`w-10 h-10 rounded-full border-2 overflow-hidden transition ${
                    avatarUrl === src ? "border-emerald-500 ring-2 ring-emerald-500/30" : "border-gray-700 hover:border-gray-500"
                  }`}>
                  <img src={src} alt={`Avatar ${i + 1}`} className="w-full h-full" />
                </button>
              ))}
              {/* Upload custom */}
              <label className={`w-10 h-10 rounded-full border-2 border-dashed flex items-center justify-center cursor-pointer transition ${
                avatarUrl && !PRESET_AVATARS.includes(avatarUrl) && avatarUrl !== "" ? "border-emerald-500 ring-2 ring-emerald-500/30" : "border-gray-600 hover:border-gray-400"
              } bg-gray-800 overflow-hidden`}>
                {avatarUrl && !PRESET_AVATARS.includes(avatarUrl) && avatarUrl !== "" ? (
                  <img src={avatarUrl} alt="Custom" className="w-full h-full object-cover" />
                ) : (
                  <Upload className="w-3.5 h-3.5 text-gray-500" />
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
              </label>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="John Doe" autoFocus required />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="john@example.com" required />
          </div>
          {!user && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} placeholder="Min 6 characters" required minLength={6} />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">Role</label>
            <select value={role} onChange={e => setRole(e.target.value)} className={inputCls}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={mut.isPending}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition">
              {mut.isPending ? "Saving..." : user ? "Save Changes" : "Create User"}
            </button>
            <button type="button" onClick={onClose} className="px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2 rounded-lg transition">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Reset Password Modal ─────────────────────────────────────────────────────
function ResetPasswordModal({ user, onClose }: { user: api.SystemUser; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);

  const mut = useMutation({
    mutationFn: () => api.resetUserPassword(user.id, password),
    onSuccess: () => setDone(true),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Reset Password</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 transition text-xl leading-none">&times;</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-xs text-gray-400">
            Set a new password for <span className="text-white font-medium">{user.name}</span> ({user.email})
          </p>
          {done ? (
            <div className="flex items-center gap-2 text-emerald-400 text-sm">
              <CheckCircle2 className="w-4 h-4" /> Password updated successfully
            </div>
          ) : (
            <form onSubmit={e => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className={inputCls} placeholder="New password (min 6 chars)" required minLength={6} autoFocus />
              <div className="flex gap-3">
                <button type="submit" disabled={mut.isPending}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition">
                  {mut.isPending ? "Resetting..." : "Reset Password"}
                </button>
                <button type="button" onClick={onClose} className="px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2 rounded-lg transition">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Assign to Project Modal ──────────────────────────────────────────────────
function AssignProjectModal({ user, projects, onClose, onSuccess }: {
  user: api.SystemUser;
  projects: api.Project[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const assignedIds = new Set(user.projects.map(p => p.projectId));
  const available = projects.filter(p => !assignedIds.has(p.id));
  const [selectedProject, setSelectedProject] = useState(available[0]?.id ?? "");
  const [role, setRole] = useState("Tester");
  const [error, setError] = useState("");

  const mut = useMutation({
    mutationFn: () => api.assignUserToProject(user.id, selectedProject, role),
    onSuccess,
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Assign to Project</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 transition text-xl leading-none">&times;</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-xs text-gray-400">
            Assign <span className="text-white font-medium">{user.name}</span> to a project
          </p>
          {available.length === 0 ? (
            <p className="text-xs text-gray-500 italic">Already assigned to all projects</p>
          ) : (
            <form onSubmit={e => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">Project</label>
                <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} className={inputCls}>
                  {available.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">Role in Project</label>
                <select value={role} onChange={e => setRole(e.target.value)} className={inputCls}>
                  <option>Admin</option>
                  <option>Tester</option>
                  <option>Viewer</option>
                </select>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-3">
                <button type="submit" disabled={mut.isPending}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition">
                  {mut.isPending ? "Assigning..." : "Assign"}
                </button>
                <button type="button" onClick={onClose} className="px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2 rounded-lg transition">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
