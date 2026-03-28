import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Bot, FlaskConical, FolderOpen, BarChart2, SlidersHorizontal, Layers, Route, PanelLeftClose, PanelLeftOpen, LogOut } from "lucide-react";
import { useAuth } from "../lib/AuthContext";

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-800">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <span className="font-bold text-white text-sm tracking-wide flex-1 truncate">TestAgent</span>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-800 text-gray-500 hover:text-gray-200 transition shrink-0"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="px-3 py-4 space-y-1 flex-1">
          {[
            { to: "/",             icon: FolderOpen,        label: "Projects",         adminOnly: false },
            { to: "/dashboard",    icon: BarChart2,         label: "Dashboard",        adminOnly: false },
            { to: "/run",          icon: FlaskConical,      label: "Quick Run Test",   adminOnly: false },
            { to: "/app-settings", icon: SlidersHorizontal, label: "App Settings",     adminOnly: true  },
            { to: "/tech-stack",   icon: Layers,             label: "Tech Stack",       adminOnly: false },
            { to: "/api-explorer", icon: Route,              label: "API Explorer",     adminOnly: false },
          ].filter(item => !item.adminOnly || user?.role === "Admin")
          .map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              title={label}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition
                 ${collapsed ? "justify-center px-0" : ""}
                 ${isActive ? "bg-emerald-500/10 text-emerald-400" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"}`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer — user + logout */}
        <div className="border-t border-gray-800 p-3">
          {collapsed ? (
            <button
              onClick={handleLogout}
              title="Sign out"
              className="w-full flex items-center justify-center p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-gray-800 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              {/* Avatar */}
              <div className="w-7 h-7 rounded-full bg-emerald-900/60 border border-emerald-700/40 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-emerald-300">
                  {user?.name?.[0]?.toUpperCase() ?? "?"}
                </span>
              </div>
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
