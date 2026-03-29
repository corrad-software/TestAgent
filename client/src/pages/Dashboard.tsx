import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, TrendingUp, CheckCircle2, Calendar, ChevronDown } from "lucide-react";
import PageHeader from "../components/PageHeader";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";
import * as api from "../lib/api";
import { relativeTime } from "../lib/utils";

const CHART_THEME = {
  grid: "#1f2937",       // gray-800
  tick: "#6b7280",       // gray-500
  tooltipBg: "#111827",  // gray-900
  tooltipBorder: "#374151", // gray-700
  pass: "#10b981",       // emerald-500
  fail: "#ef4444",       // red-500
  line: "#10b981",       // emerald-500
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.value}{p.dataKey === "passRate" ? "%" : ""}
        </p>
      ))}
    </div>
  );
};

export function ProjectDashboardContent({ projectId }: { projectId: string }) {
  const { data: stats } = useQuery({
    queryKey: ["stats", projectId],
    queryFn: () => api.getStats(projectId),
    refetchInterval: 30_000,
  });

  const { data: daily } = useQuery({
    queryKey: ["daily-stats", projectId],
    queryFn: () => api.getDailyStats(projectId),
  });

  const chartData = daily?.days.map(d => ({
    ...d,
    date: d.date.slice(5),
  })) ?? [];

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Activity className="w-4 h-4" />} label="Scenarios" value={stats.totalScenarios} color="text-emerald-400" />
        <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Total Runs" value={stats.totalRuns} color="text-emerald-400" />
        <StatCard icon={<CheckCircle2 className="w-4 h-4" />} label="Pass Rate"
          value={`${stats.passRate}%`}
          color={stats.passRate >= 80 ? "text-green-400" : stats.passRate >= 50 ? "text-yellow-400" : "text-red-400"} />
        <StatCard icon={<Calendar className="w-4 h-4" />} label="This Week" value={stats.runsThisWeek} color="text-teal-400" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Pass Rate Trend (30 days)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                <XAxis dataKey="date" tick={{ fill: CHART_THEME.tick, fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={{ fill: CHART_THEME.tick, fontSize: 10 }} tickFormatter={v => `${v}%`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="passRate" name="Pass Rate" stroke={CHART_THEME.line} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Runs Per Day</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                <XAxis dataKey="date" tick={{ fill: CHART_THEME.tick, fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: CHART_THEME.tick, fontSize: 10 }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
                <Bar dataKey="passCount" name="Passed" stackId="a" fill={CHART_THEME.pass} radius={[0, 0, 0, 0]} />
                <Bar dataKey="failCount" name="Failed" stackId="a" fill={CHART_THEME.fail} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Module Breakdown */}
      {stats.moduleBreakdown.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Module Pass Rate</h3>
          <div style={{ height: Math.max(120, stats.moduleBreakdown.length * 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.moduleBreakdown} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: CHART_THEME.tick, fontSize: 10 }} tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="moduleName" tick={{ fill: "#d1d5db", fontSize: 11 }} width={150} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="passRate" name="Pass Rate" fill={CHART_THEME.pass} radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent Runs */}
      {stats.recentRuns.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-white">Recent Runs</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500">
                  <th className="text-left px-4 py-2 font-semibold">Scenario</th>
                  <th className="text-left px-4 py-2 font-semibold">Module</th>
                  <th className="text-left px-4 py-2 font-semibold">When</th>
                  <th className="text-center px-4 py-2 font-semibold">Status</th>
                  <th className="text-right px-4 py-2 font-semibold">Duration</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentRuns.map(r => (
                  <tr key={r.runId} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-2 text-gray-200 truncate max-w-[200px]">{r.scenarioName}</td>
                    <td className="px-4 py-2 text-gray-500">{r.moduleName}</td>
                    <td className="px-4 py-2 text-gray-500">{relativeTime(r.runAt)}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={r.passed ? "text-green-400" : "text-red-400"}>
                        {r.passed ? "Passed" : "Failed"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-gray-500">{(r.durationMs / 1000).toFixed(1)}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { data: projects = [] } = useQuery<api.Project[]>({
    queryKey: ["projects"], queryFn: api.getProjects,
  });
  const [projectId, setProjectId] = useState<string>("");

  useEffect(() => {
    if (!projectId && projects.length) setProjectId(projects[0].id);
  }, [projects, projectId]);

  return (
    <div className="flex flex-col h-screen">
      <PageHeader title="Dashboard" subtitle="Test execution analytics">
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
      <div className="flex-1 overflow-y-auto p-6">
        {projectId && <ProjectDashboardContent projectId={projectId} />}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className={`flex items-center gap-2 text-xs font-medium ${color} mb-2`}>
        {icon}
        {label}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
