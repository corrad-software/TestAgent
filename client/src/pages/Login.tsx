import { useState, type FormEvent } from "react";
import { Bot, Eye, EyeOff, Loader } from "lucide-react";
import { useAuth } from "../lib/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-white">TestAgent</h1>
            <p className="text-xs text-gray-500 mt-0.5">Sign in to continue</p>
          </div>
        </div>

        {/* Card */}
        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4 shadow-xl">
          {/* Email */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@testAgent.local"
              required
              autoFocus
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-400">Password</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 pr-10 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowPwd(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-lg transition mt-2"
          >
            {loading ? <><Loader className="w-4 h-4 animate-spin" /> Signing in…</> : "Sign In"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-600 mt-5">
          Powered by Claude + Playwright
        </p>
      </div>
    </div>
  );
}
