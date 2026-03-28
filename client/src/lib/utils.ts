export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export const SUITE_LABELS: Record<string, string> = {
  smoke: "Smoke", navigation: "Nav", forms: "Forms",
  responsive: "Responsive", accessibility: "A11y", quick: "Quick",
};
export const SUITE_COLORS: Record<string, string> = {
  smoke:         "bg-blue-900/50 text-blue-300",
  navigation:    "bg-emerald-900/50 text-emerald-300",
  forms:         "bg-orange-900/50 text-orange-300",
  responsive:    "bg-teal-900/50 text-teal-300",
  accessibility: "bg-green-900/50 text-green-300",
  quick:         "bg-gray-800 text-gray-400",
};
export const ROLE_COLORS: Record<string, string> = {
  Admin:  "bg-emerald-900/50 text-emerald-300",
  Tester: "bg-teal-900/50 text-teal-300",
  Viewer: "bg-gray-800 text-gray-400",
};

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export const PROJECT_ROLE_PALETTE: { value: string; label: string; cls: string }[] = [
  { value: "gray",    label: "Gray",   cls: "bg-gray-800 text-gray-300" },
  { value: "blue",    label: "Blue",   cls: "bg-blue-900/50 text-blue-300" },
  { value: "emerald", label: "Green",  cls: "bg-emerald-900/50 text-emerald-300" },
  { value: "violet",  label: "Purple", cls: "bg-violet-900/50 text-violet-300" },
  { value: "amber",   label: "Amber",  cls: "bg-amber-900/50 text-amber-300" },
  { value: "rose",    label: "Red",    cls: "bg-rose-900/50 text-rose-300" },
  { value: "teal",    label: "Teal",   cls: "bg-teal-900/50 text-teal-300" },
  { value: "orange",  label: "Orange", cls: "bg-orange-900/50 text-orange-300" },
];
export function roleColorCls(color: string): string {
  return PROJECT_ROLE_PALETTE.find(p => p.value === color)?.cls ?? "bg-gray-800 text-gray-300";
}
