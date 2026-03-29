import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Image, Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { relativeTime } from "../lib/utils";
import PageHeader from "../components/PageHeader";

interface Screenshot {
  url: string; runId: string; testType: string; filename: string; createdAt: string;
}

const PAGE_SIZE = 24;

export default function Screenshots() {
  const { data: screenshots = [], isLoading } = useQuery<Screenshot[]>({
    queryKey: ["screenshots"],
    queryFn: () => fetch("/screenshots").then(r => r.json()),
  });

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [viewUrl, setViewUrl] = useState<string | null>(null);

  // Get unique test types
  const testTypes = [...new Set(screenshots.map(s => s.testType))].sort();

  // Filter
  const filtered = screenshots.filter(s => {
    if (typeFilter !== "all" && s.testType !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(s.runId.toLowerCase().includes(q) || s.filename.toLowerCase().includes(q) || s.testType.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="flex flex-col h-screen">
      <PageHeader title="Screenshots" subtitle={`${filtered.length} screenshots from test runs`} />

      <div className="flex-1 overflow-y-auto">
        {/* Filters */}
        <div className="sticky top-0 z-1 bg-gray-950 px-6 py-2 flex items-center gap-2 border-b border-gray-800">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-gray-600 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search by run ID, filename..."
              className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-8 pr-3 py-1 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-emerald-500 transition" />
          </div>
          <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(0); }}
            className="bg-gray-900 border border-gray-800 rounded-lg px-2 py-1 text-xs text-gray-300 outline-none focus:border-emerald-500 transition">
            <option value="all">All Types</option>
            {testTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <span className="text-xs text-gray-600 ml-auto">{filtered.length} images</span>
        </div>

        {/* Grid */}
        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : paged.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-60 text-gray-600">
              <Image className="w-12 h-12 text-gray-700 mb-3" />
              <p className="text-xs">{screenshots.length === 0 ? "No screenshots yet. Run some tests first." : "No screenshots match your filter."}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {paged.map((s, i) => (
                <div key={s.url + i}
                  onClick={() => setViewUrl(s.url)}
                  className="group bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-lg overflow-hidden cursor-pointer transition">
                  <div className="aspect-video bg-gray-950 flex items-center justify-center overflow-hidden">
                    <img src={s.url} alt={s.filename} loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition" />
                  </div>
                  <div className="px-2.5 py-2">
                    <p className="text-[10px] text-gray-400 truncate">{s.runId}</p>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[10px] bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">{s.testType}</span>
                      <span className="text-[10px] text-gray-600">{relativeTime(s.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-800">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-200 disabled:opacity-30 transition">
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <span className="text-xs text-gray-600">Page {page + 1} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-200 disabled:opacity-30 transition">
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {viewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-8" onClick={() => setViewUrl(null)}>
          <button onClick={() => setViewUrl(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white transition">
            <X className="w-6 h-6" />
          </button>
          <img src={viewUrl} alt="Screenshot" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
        </div>
      )}
    </div>
  );
}
