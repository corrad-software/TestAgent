import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, BarChart2, Play, Settings2,
  FolderOpen, Calendar, Activity, FlaskConical, Trash2, AlertTriangle,
} from "lucide-react";
import * as api from "../lib/api";
import { relativeTime } from "../lib/utils";
import { ProjectDashboardContent } from "./Dashboard";
import { LibraryContent } from "./Library";
import { ProjectInfoTab, TeamTab } from "./Settings";

type Tab = "modules" | "dashboard" | "settings";

export default function ProjectHub() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("dashboard");

  const { data: projects = [] } = useQuery<api.Project[]>({
    queryKey: ["projects"],
    queryFn: api.getProjects,
  });

  const project = projects.find(p => p.id === projectId);

  if (!projectId) return null;

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-950/80 backdrop-blur border-b border-gray-800 px-6 h-13 flex items-center gap-4 shrink-0">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-200 transition text-xs"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Projects</span>
        </button>
        <div className="w-px h-5 bg-gray-800" />
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-white truncate">{project?.name ?? "Project"}</h1>
          {project?.description && (
            <p className="text-xs text-gray-500 mt-0.5 truncate hidden sm:block">{project.description}</p>
          )}
        </div>
      </header>

      {/* Tab bar */}
      <div className="border-b border-gray-800 px-6 pt-2 flex gap-1 shrink-0 bg-gray-950">
        {([
          { id: "dashboard" as Tab, icon: BarChart2, label: "Dashboard" },
          { id: "modules" as Tab, icon: Play, label: "Test Execution" },
          { id: "settings" as Tab, icon: Settings2, label: "Settings" },
        ]).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition
              ${tab === id
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-gray-500 hover:text-gray-300"}`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "modules" && (
        <LibraryContent projectId={projectId} embedded />
      )}
      {tab === "dashboard" && (
        <div className="flex-1 overflow-y-auto p-6">
          <ProjectDashboardContent projectId={projectId} />
        </div>
      )}
      {tab === "settings" && project && (
        <div className="flex-1 overflow-y-auto p-6">
          <SettingsContent project={project} projectId={projectId} />
        </div>
      )}
    </div>
  );
}

function SettingsContent({ project, projectId }: { project: api.Project; projectId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState("");

  const { data: stats } = useQuery({
    queryKey: ["stats", projectId],
    queryFn: () => api.getStats(projectId),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.deleteProject(projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      navigate("/", { replace: true });
    },
  });

  const moduleCount = project.modules?.length ?? 0;
  const scenarioCount = project.modules?.reduce((sum, m) => sum + (m.scenarios?.length ?? 0), 0) ?? 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ── Left Column ── */}
      <div className="space-y-6">
        {/* Project Info */}
        <ProjectInfoTab project={project} />
      </div>

      {/* ── Right Column ── */}
      <div className="space-y-6">
        {/* Team Members */}
        <TeamTab projectId={projectId} />

        {/* Quick Overview */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Overview</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: FolderOpen, label: "Modules", value: moduleCount, color: "text-emerald-400" },
              { icon: FlaskConical, label: "Scenarios", value: scenarioCount, color: "text-sky-400" },
              { icon: Activity, label: "Total Runs", value: stats?.totalRuns ?? 0, color: "text-violet-400" },
              { icon: BarChart2, label: "Pass Rate", value: stats ? `${stats.passRate}%` : "—", color: stats && stats.passRate >= 80 ? "text-green-400" : stats && stats.passRate >= 50 ? "text-amber-400" : "text-red-400" },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="bg-gray-950 rounded-lg p-3 flex items-center gap-3">
                <Icon className={`w-4 h-4 ${color} shrink-0`} />
                <div>
                  <p className="text-lg font-bold text-white leading-tight">{value}</p>
                  <p className="text-[10px] text-gray-500">{label}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-600 pt-1 border-t border-gray-800">
            <Calendar className="w-3 h-3" />
            <span>Created {relativeTime(project.createdAt)}</span>
            <span className="mx-1">·</span>
            <span>Updated {relativeTime(project.updatedAt)}</span>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-gray-900 border border-red-900/30 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h2 className="text-sm font-semibold text-red-400">Danger Zone</h2>
          </div>
          <p className="text-xs text-gray-500">
            Deleting this project will permanently remove all modules, scenarios, and run history. This action cannot be undone.
          </p>
          <div className="space-y-2">
            <input
              type="text"
              value={confirmDelete}
              onChange={e => setConfirmDelete(e.target.value)}
              placeholder={`Type "${project.name}" to confirm`}
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-red-500 transition"
            />
            <button
              onClick={() => deleteMut.mutate()}
              disabled={confirmDelete !== project.name || deleteMut.isPending}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deleteMut.isPending ? "Deleting…" : "Delete Project"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
