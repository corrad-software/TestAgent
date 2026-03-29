import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Bot, Play, FolderOpen, BarChart2, Image, SlidersHorizontal, Layers, Route, PanelLeftClose, PanelLeftOpen, LogOut, Coins, Cpu, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../lib/AuthContext";
import { getAppSettings } from "../lib/api";
import type { TokenUsage } from "./PageHeader";

export default function Layout() {
  const [collapsed, setCollapsed] = useState(true);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const { data: usage } = useQuery<TokenUsage>({
    queryKey: ["token-usage"],
    queryFn: () => fetch("/ai/usage").then(r => r.json()),
    refetchInterval: 30_000,
    retry: false,
  });

  const { data: settings } = useQuery({
    queryKey: ["app-settings"],
    queryFn: getAppSettings,
    retry: false,
  });

  const modelLabel = settings?.model
    ? settings.model.replace("claude-", "").split("-").slice(0, 2).join(" ").replace(/^\w/, c => c.toUpperCase())
    : null;

  const spent = usage?.totalCost ?? 0;
  const budget = settings?.aiBudget ?? 0;
  const remaining = budget > 0 ? Math.max(budget - spent, 0) : null;
  const spentPct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-gray-950 text-gray-200">
      {/* Sidebar */}
      <aside
        className="fixed inset-y-0 left-0 z-20 flex flex-col bg-gray-900 border-r border-gray-800 transition-all duration-200"
        style={{ width: collapsed ? "4rem" : "16rem" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-13 border-b border-gray-800">
          <div className="w-6 h-6 rounded-md bg-emerald-500 flex items-center justify-center shrink-0">
            <Bot className="w-3.5 h-3.5 text-white" />
          </div>
          {!collapsed && (
            <span className="font-bold text-white text-sm tracking-wide flex-1 truncate">TestAgent</span>
          )}
          <div className="relative group/toggle shrink-0">
            <button
              onClick={() => setCollapsed(c => !c)}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-800 text-white transition"
            >
              {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
            {collapsed && (
              <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md bg-white text-gray-900 text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover/toggle:opacity-100 transition-opacity z-50 shadow-lg">
                Expand sidebar
              </span>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="px-3 py-2.5 space-y-0.5 flex-1">
          {[
            { to: "/",             icon: FolderOpen,        label: "Projects",         adminOnly: false },
            { to: "/run",          icon: Play,              label: "Quick Run Test",   adminOnly: false },
            { to: "/reports",      icon: BarChart2,         label: "Test Reports",     adminOnly: false },
            { to: "/screenshots", icon: Image,             label: "Screenshots",      adminOnly: false },
            { to: "/users",        icon: Users,              label: "Users",            adminOnly: true  },
            { to: "/app-settings", icon: SlidersHorizontal, label: "App Settings",     adminOnly: true  },
            { to: "/tech-stack",   icon: Layers,             label: "Tech Stack",       adminOnly: true  },
            { to: "/api-explorer", icon: Route,              label: "API Explorer",     adminOnly: true  },
          ].filter(item => !item.adminOnly || user?.role === "Admin")
          .map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              title={collapsed ? undefined : undefined}
              className={({ isActive }) =>
                `relative group/nav flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition
                 ${collapsed ? "justify-center px-0" : ""}
                 ${isActive ? "bg-emerald-500/10 text-emerald-400" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"}`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
              {collapsed && (
                <span className="absolute left-full ml-2 px-2.5 py-1 rounded-md bg-gray-800 border border-gray-700 text-xs font-medium text-gray-200 whitespace-nowrap opacity-0 pointer-events-none group-hover/nav:opacity-100 transition-opacity z-50 shadow-lg">
                  {label}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* AI Usage Meter */}
        <div className="border-t border-gray-800 px-3 py-3">
          {collapsed ? (
            <div className="relative group/meter flex items-center justify-center">
              {/* Analog gauge */}
              <svg width="36" height="22" viewBox="0 0 36 22" className="shrink-0">
                {/* Background arc */}
                <path
                  d="M 4 20 A 14 14 0 0 1 32 20"
                  fill="none"
                  stroke="#374151"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                {/* Filled arc */}
                <path
                  d="M 4 20 A 14 14 0 0 1 32 20"
                  fill="none"
                  stroke={spentPct >= 100 ? "#ef4444" : spentPct > 80 ? "#f59e0b" : "#10b981"}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${(spentPct / 100) * 44} 44`}
                />
                {/* Needle */}
                {(() => {
                  const angle = Math.PI - (spentPct / 100) * Math.PI;
                  const nx = 18 + Math.cos(angle) * 10;
                  const ny = 20 - Math.sin(angle) * 10;
                  return <line x1="18" y1="20" x2={nx} y2={ny} stroke="#e5e7eb" strokeWidth="1.5" strokeLinecap="round" />;
                })()}
                {/* Center dot */}
                <circle cx="18" cy="20" r="1.5" fill="#e5e7eb" />
              </svg>
              {/* Tooltip */}
              <span className="absolute left-full ml-2 px-2.5 py-1.5 rounded-md bg-white text-gray-900 text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover/meter:opacity-100 transition-opacity z-50 shadow-lg">
                <span className="font-mono font-bold">${spent.toFixed(2)}</span>
                {budget > 0 && <span className="text-gray-500"> / ${budget.toFixed(2)}</span>}
                {modelLabel && <span className="text-gray-400 ml-1.5">· {modelLabel}</span>}
              </span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {/* Model */}
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3 h-3 text-gray-500 shrink-0" />
                <span className="text-[10px] text-gray-500 truncate">{modelLabel ?? "No model set"}</span>
              </div>

              {/* Balance / Budget */}
              {remaining !== null ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">Balance</span>
                    <span className={`text-xs font-mono font-semibold ${
                      remaining <= 0 ? "text-red-400" : spentPct > 80 ? "text-amber-400" : "text-emerald-400"
                    }`}>
                      ${remaining.toFixed(4)}
                    </span>
                  </div>
                  {/* Budget bar */}
                  <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        spentPct >= 100 ? "bg-red-500" : spentPct > 80 ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${spentPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-600">
                    <span>${spent.toFixed(4)} used</span>
                    <span>${budget.toFixed(2)} limit</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Coins className={`w-3 h-3 shrink-0 ${spent > 0 ? "text-violet-400" : "text-gray-600"}`} />
                  <span className={`text-xs font-mono ${spent > 0 ? "text-violet-300" : "text-gray-600"}`}>
                    ${spent.toFixed(4)}
                  </span>
                  <span className="text-[10px] text-gray-600 ml-auto">no limit</span>
                </div>
              )}

              {/* Calls + tokens */}
              <div className="flex items-center justify-between text-[10px] text-gray-600">
                <span>{usage?.callCount ?? 0} call{(usage?.callCount ?? 0) !== 1 ? "s" : ""}</span>
                <span>{((usage?.totalInputTokens ?? 0) + (usage?.totalOutputTokens ?? 0)).toLocaleString()} tokens</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer — user + logout */}
        <div className="border-t border-gray-800 p-3">
          {collapsed ? (
            <div className="relative group/user">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-gray-800 transition"
              >
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="w-6 h-6 rounded-full object-cover border border-gray-700" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
              </button>
              <span className="absolute left-full ml-2 bottom-0 px-2.5 py-1 rounded-md bg-gray-800 border border-gray-700 text-xs font-medium text-gray-200 whitespace-nowrap opacity-0 pointer-events-none group-hover/user:opacity-100 transition-opacity z-50 shadow-lg">
                {user?.name} — Sign out
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {/* Avatar */}
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-7 h-7 rounded-full object-cover border border-gray-700 shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-emerald-900/60 border border-emerald-700/40 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-emerald-300">
                    {user?.name?.[0]?.toUpperCase() ?? "?"}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-200 truncate">{user?.name}</p>
                <p className="text-[10px] text-gray-500 truncate">{user?.role}</p>
              </div>
              <button
                onClick={handleLogout}
                title="Sign out"
                className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-gray-800 transition shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <main
        className="flex-1 flex flex-col transition-all duration-200"
        style={{ marginLeft: collapsed ? "4rem" : "16rem" }}
      >
        <Outlet />
      </main>
    </div>
  );
}
