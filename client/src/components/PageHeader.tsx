import { useQuery } from "@tanstack/react-query";
import { Coins } from "lucide-react";

export interface TokenUsage {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  callCount: number;
}

export default function PageHeader({ title, subtitle, children }: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  const { data: usage } = useQuery<TokenUsage>({
    queryKey: ["token-usage"],
    queryFn: () => fetch("/ai/usage").then(r => r.json()),
    refetchInterval: 30_000,
    retry: false,
  });

  return (
    <header className="sticky top-0 z-10 bg-gray-950/80 backdrop-blur border-b border-gray-800 px-6 py-3 flex items-center justify-between shrink-0 gap-4">
      <div className="min-w-0">
        <h1 className="text-base font-semibold text-white">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {/* Token usage badge — always visible */}
        {usage && (
          <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border ${
            usage.callCount > 0
              ? "bg-violet-500/10 border-violet-500/20 text-violet-300"
              : "bg-gray-800/50 border-gray-700/50 text-gray-500"
          }`} title={usage.callCount > 0
            ? `${usage.callCount} AI call${usage.callCount !== 1 ? "s" : ""} | ${usage.totalInputTokens.toLocaleString()} in + ${usage.totalOutputTokens.toLocaleString()} out tokens`
            : "No AI calls yet"}>
            <Coins className="w-3 h-3" />
            <span className="font-mono">${usage.totalCost.toFixed(4)}</span>
          </div>
        )}
        {children}
      </div>
    </header>
  );
}
