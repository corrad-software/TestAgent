import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart2, CheckCircle2, XCircle, Clock, ExternalLink, ChevronDown, Search } from "lucide-react";
import * as api from "../lib/api";
import { relativeTime } from "../lib/utils";
import PageHeader from "../components/PageHeader";

export default function Reports() {
  const { data: projects = [] } = useQuery<api.Project[]>({
    queryKey: ["projects"], queryFn: api.getProjects,
  });
  const [projectId, setProjectId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "passed" | "failed">("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!projectId && projects.length) setProjectId(projects[0].id);
  }, [projects, projectId]);

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["project-runs", projectId],
    queryFn: () => api.getProjectRuns(projectId),
    enabled: !!projectId,
    refetchInterval: 30_000,
  });

  // Filter
  const filtered = runs.filter(r => {
    if (statusFilter === "passed" && !r.passed) return false;
    if (statusFilter === "failed" && r.passed) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!(r.scenarioName.toLowerCase().includes(q) || r.testCaseId?.toLowerCase().includes(q) || r.moduleName.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const passCount = runs.filter(r => r.passed).length;
  const failCount = runs.filter(r => !r.passed).length;

  // Expanded row for logs
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-screen">
      <PageHeader title="Test Reports" subtitle="Browse all test run results and Playwright reports">
        {projects.length > 0 && (
          <div className="relative">
            <select value={projectId} onChange={e => setProjectId(e.target.value)}
              className="appearance-none bg-gray-800 border border-gray-700 rounded-lg pl-3 pr-8 py-1.5 text-xs font-medium text-gray-200 outline-none focus:border-emerald-500 transition cursor-pointer">
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <ChevronDown className="w-3 h-3 text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        )}
      </PageHeader>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Summary cards */}
        <div className="flex gap-3">
          <StatBadge icon={<BarChart2 className="w-4 h-4 text-gray-500" />} label="Total Runs" value={runs.length} color="text-white" />
          <StatBadge icon={<CheckCircle2 className="w-4 h-4 text-green-500" />} label="Passed" value={passCount} color="text-green-400" />
          <StatBadge icon={<XCircle className="w-4 h-4 text-red-500" />} label="Failed" value={failCount} color="text-red-400" />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-gray-600 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search scenario, module, Kes ID..."
              className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
            className="bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 outline-none focus:border-emerald-500 transition">
            <option value="all">All Status</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
          </select>
          <span className="text-xs text-gray-600 ml-auto">{filtered.length} of {runs.length} runs</span>
        </div>

        {/* Runs list */}
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-xs text-gray-600 py-12">
            {runs.length === 0 ? "No test runs yet." : "No runs match your filters."}
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map(r => (
              <div key={r.runId} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                <div
                  onClick={() => setExpandedId(expandedId === r.runId ? null : r.runId)}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-800/50 transition"
                >
                  {r.passed
                    ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    : <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-200 truncate">{r.scenarioName}</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">{r.moduleName}{r.testCaseId ? ` · ${r.testCaseId}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 text-xs">
                    <span className="text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {relativeTime(r.runAt)}
                    </span>
                    <span className="text-gray-600 w-12 text-right">{(r.durationMs / 1000).toFixed(1)}s</span>
                    {r.reportId ? (
                      <a href={`/playwright-report/${r.reportId}/index.html`} target="_blank" rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1 text-emerald-400 hover:underline">
                        <ExternalLink className="w-3 h-3" /> Report
                      </a>
                    ) : (
                      <span className="text-gray-700 w-14">—</span>
                    )}
                  </div>
                </div>

                {/* Expanded: summary + logs */}
                {expandedId === r.runId && (
                  <div className="border-t border-gray-800 px-4 py-3 space-y-2">
                    <p className="text-xs text-gray-400">{r.summary}</p>
                    {r.logs ? (
                      <pre className="text-xs font-mono text-gray-500 bg-gray-950 border border-gray-800 rounded-lg p-3 max-h-48 overflow-auto whitespace-pre-wrap">{r.logs}</pre>
                    ) : (
                      <p className="text-xs text-gray-700 italic">No logs saved for this run</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBadge({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 flex items-center gap-3">
      {icon}
      <div>
        <p className="text-[10px] text-gray-500">{label}</p>
        <p className={`text-base font-bold ${color}`}>{value}</p>
      </div>
    </div>
  );
}
