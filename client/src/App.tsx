import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import RunTest from "./pages/RunTest";
import Projects from "./pages/Projects";
import Library from "./pages/Library";
import Settings from "./pages/Settings";
import AppSettings from "./pages/AppSettings";

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
        <Route path="library/:projectId" element={<Library />} />
        <Route path="run" element={<RunTest />} />
        <Route path="settings"     element={<AdminRoute><Settings /></AdminRoute>} />
        <Route path="app-settings" element={<AdminRoute><AppSettings /></AdminRoute>} />
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
