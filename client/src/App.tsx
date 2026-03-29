import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import RunTest from "./pages/RunTest";
import Projects from "./pages/Projects";
import ProjectHub from "./pages/ProjectHub";
import AppSettings from "./pages/AppSettings";
import UserManagement from "./pages/UserManagement";
import TechStack from "./pages/TechStack";
import ApiExplorer from "./pages/ApiExplorer";
import Reports from "./pages/Reports";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, retry: 1 } },
});

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== "Admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function ProtectedRoutes() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Projects />} />
        <Route path="project/:projectId" element={<ProjectHub />} />
        <Route path="library/:projectId" element={<LibraryRedirect />} />
        <Route path="dashboard" element={<Navigate to="/" replace />} />
        <Route path="run" element={<RunTest />} />
        <Route path="reports" element={<Reports />} />
        <Route path="app-settings" element={<AdminRoute><AppSettings /></AdminRoute>} />
        <Route path="users" element={<AdminRoute><UserManagement /></AdminRoute>} />
        <Route path="tech-stack" element={<AdminRoute><TechStack /></AdminRoute>} />
        <Route path="api-explorer" element={<AdminRoute><ApiExplorer /></AdminRoute>} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginGate />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function LibraryRedirect() {
  const { projectId } = useParams();
  return <Navigate to={`/project/${projectId}`} replace />;
}

// Redirect already-logged-in users away from /login
function LoginGate() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}
