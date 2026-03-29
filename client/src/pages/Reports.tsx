import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, ChevronLeft, ChevronRight, Search, User } from "lucide-react";
import * as api from "../lib/api";
import { relativeTime } from "../lib/utils";
import PageHeader from "../components/PageHeader";

const PAGE_SIZE = 25;

export default function Reports() {
  const { data: projects = [] } = useQuery<api.Project[]>({
    queryKey: ["projects"], queryFn: api.getProjects,
  });
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "passed" | "failed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [statusFilter, searchQuery, projectFilter]);

  // Fetch runs for each project
  const projectIds = projects.map(p => p.id);
  const runQueries = projectIds.map(pid =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useQuery({
      queryKey: ["project-runs", pid],
      queryFn: () => api.getProjectRuns(pid),
      enabled: projectIds.length > 0,
      staleTime: 30_000,
    })
  );

  // Build project name map
  const projectNameMap = new Map(projects.map(p => [p.id, p.name]));

  // Merge all runs with project info
  type RunWithProject = api.ProjectRun & { projectName: string; projectId: string };
  const allRuns: RunWithProject[] = [];
  projectIds.forEach((pid, i) => {
    const runs = runQueries[i]?.data ?? [];
    const pName = projectNameMap.get(pid) ?? "Unknown";
    for (const r of runs) {
      allRuns.push({ ...r, projectName: pName, projectId: pid });
    }
  });
  allRuns.sort((a, b) => new Date(b.runAt).getTime() - new Date(a.runAt).getTime());

  // Filter
  const filtered = allRuns.filter(r => {
    if (projectFilter !== "all" && r.projectId !== projectFilter) return false;
    if (statusFilter === "passed" && !r.passed) return false;
    if (statusFilter === "failed" && r.passed) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!(r.scenarioName.toLowerCase().includes(q) || r.testCaseId?.toLowerCase().includes(q) || r.moduleName.toLowerCase().includes(q) || r.runBy?.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const passCount = filtered.filter(r => r.passed).length;
  const failCount = filtered.filter(r => !r.passed).length;
  const isLoading = runQueries.some(q => q.isLoading);

  return (
    <div className="flex flex-col h-screen">
      <PageHeader title="Test Reports" subtitle={`${filtered.length} runs · ${passCount} passed · ${failCount} failed`} />

      <div className="flex-1 overflow-y-auto">
        {/* Filters */}
        <div className="sticky top-0 z-1 bg-gray-950 px-6 py-2 flex items-center gap-2 border-b border-gray-800 flex-wrap">
          <div className="relative flex-1 min-w-[150px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-gray-600 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search scenario, module, user..."
              className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-8 pr-3 py-1 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition" />
          </div>
          <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
            className="bg-gray-900 border border-gray-800 rounded-lg px-2 py-1 text-xs text-gray-300 outline-none focus:border-emerald-500 transition">
            <option value="all">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
            className="bg-gray-900 border border-gray-800 rounded-lg px-2 py-1 text-xs text-gray-300 outline-none focus:border-emerald-500 transition">
            <option value="all">All Status</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : paged.length === 0 ? (
          <div className="text-center text-xs text-gray-600 py-12">
            {allRuns.length === 0 ? "No test runs yet." : "No runs match your filters."}
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-2 px-6 py-1.5 text-[10px] font-semibold text-gray-600 uppercase tracking-widest border-b border-gray-800 bg-gray-950">
              <span className="w-4" />
              <span className="flex-1 min-w-0">Scenario</span>
              <span className="w-20 hidden lg:block">Project</span>
              <span className="w-20 hidden md:block">Module</span>
              <span className="w-20 hidden xl:block">Kes ID</span>
              <span className="w-16">Run By</span>
              <span className="w-14 text-right">Time</span>
              <span className="w-10 text-right">Dur.</span>
              <span className="w-12 text-center">Report</span>
            </div>

            {/* Rows */}
            {paged.map(r => (
              <div key={r.runId}>
                <div
                  onClick={() => setExpandedId(expandedId === r.runId ? null : r.runId)}
                  className="flex items-center gap-2 px-6 py-1.5 cursor-pointer hover:bg-gray-900/70 transition border-b border-gray-800/40 text-xs"
                >
                  <span className="w-4 shrink-0">
                    <span className={`w-2 h-2 rounded-full block ${r.passed ? "bg-green-500" : "bg-red-500"}`} />
                  </span>
                  <span className="flex-1 min-w-0 text-gray-300 truncate">{r.scenarioName}</span>
                  <span className="w-20 text-gray-600 truncate hidden lg:block">{r.projectName}</span>
                  <span className="w-20 text-gray-600 truncate hidden md:block">{r.moduleName}</span>
                  <span className="w-20 text-gray-600 font-mono truncate hidden xl:block">{r.testCaseId || "—"}</span>
                  <span className="w-16 text-gray-500 truncate flex items-center gap-1">
                    {r.runBy ? <><User className="w-2.5 h-2.5 shrink-0" />{r.runBy.split("@")[0]}</> : "—"}
                  </span>
                  <span className="w-14 text-right text-gray-500">{relativeTime(r.runAt)}</span>
                  <span className="w-10 text-right text-gray-600">{(r.durationMs / 1000).toFixed(1)}s</span>
                  <span className="w-12 text-center">
                    {r.reportId ? (
                      <a href={`/playwright-report/${r.reportId}/index.html`} target="_blank" rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-emerald-400 hover:underline inline-flex items-center gap-0.5">
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    ) : <span className="text-gray-700">—</span>}
                  </span>
                </div>
                {expandedId === r.runId && (
                  <div className="bg-gray-950 border-b border-gray-800 px-6 py-2 space-y-1.5">
                    <p className="text-xs text-gray-400">{r.summary}</p>
                    {r.runBy && <p className="text-[10px] text-gray-600">Run by: {r.runBy}</p>}
                    {r.logs ? (
                      <pre className="text-[10px] font-mono text-gray-500 bg-gray-900 border border-gray-800 rounded p-2 max-h-36 overflow-auto whitespace-pre-wrap">{r.logs}</pre>
                    ) : (
                      <p className="text-[10px] text-gray-700 italic">No logs</p>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-2 border-t border-gray-800 bg-gray-950">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-200 disabled:opacity-30 transition">
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <span className="text-xs text-gray-600">
                  Page {page + 1} of {totalPages}
                </span>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-200 disabled:opacity-30 transition">
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
