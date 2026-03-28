import { ExternalLink } from "lucide-react";
import PageHeader from "../components/PageHeader";

interface Tech {
  name: string;
  version: string;
  description: string;
  url: string;
  color: string;
}

const STACK: { category: string; items: Tech[] }[] = [
  {
    category: "Frontend",
    items: [
      { name: "React", version: "19", description: "UI component library", url: "https://react.dev", color: "bg-sky-900/40 text-sky-300" },
      { name: "TypeScript", version: "5", description: "Type-safe JavaScript", url: "https://typescriptlang.org", color: "bg-blue-900/40 text-blue-300" },
      { name: "Vite", version: "8", description: "Build tool & dev server", url: "https://vite.dev", color: "bg-violet-900/40 text-violet-300" },
      { name: "Tailwind CSS", version: "4", description: "Utility-first CSS framework", url: "https://tailwindcss.com", color: "bg-teal-900/40 text-teal-300" },
      { name: "React Router", version: "7", description: "Client-side routing", url: "https://reactrouter.com", color: "bg-red-900/40 text-red-300" },
      { name: "TanStack Query", version: "5", description: "Server state management", url: "https://tanstack.com/query", color: "bg-orange-900/40 text-orange-300" },
      { name: "Lucide React", version: "—", description: "Icon library", url: "https://lucide.dev", color: "bg-gray-800 text-gray-300" },
    ],
  },
  {
    category: "Backend",
    items: [
      { name: "Node.js", version: "25", description: "JavaScript runtime", url: "https://nodejs.org", color: "bg-green-900/40 text-green-300" },
      { name: "Express", version: "5", description: "HTTP server framework", url: "https://expressjs.com", color: "bg-gray-800 text-gray-300" },
      { name: "TypeScript", version: "5", description: "Type-safe server code", url: "https://typescriptlang.org", color: "bg-blue-900/40 text-blue-300" },
      { name: "ts-node", version: "10", description: "TypeScript execution engine", url: "https://typestrong.org/ts-node", color: "bg-blue-900/40 text-blue-300" },
    ],
  },
  {
    category: "Database",
    items: [
      { name: "Prisma", version: "7", description: "Type-safe ORM", url: "https://prisma.io", color: "bg-indigo-900/40 text-indigo-300" },
      { name: "SQLite", version: "—", description: "Embedded relational database", url: "https://sqlite.org", color: "bg-sky-900/40 text-sky-300" },
      { name: "better-sqlite3", version: "12", description: "Fast SQLite3 driver for Node.js", url: "https://github.com/WiseLibs/better-sqlite3", color: "bg-gray-800 text-gray-300" },
    ],
  },
  {
    category: "Testing",
    items: [
      { name: "Playwright", version: "1.58", description: "Browser automation & E2E testing", url: "https://playwright.dev", color: "bg-green-900/40 text-green-300" },
      { name: "Vitest", version: "4", description: "Unit & integration test framework", url: "https://vitest.dev", color: "bg-amber-900/40 text-amber-300" },
    ],
  },
  {
    category: "Authentication",
    items: [
      { name: "bcryptjs", version: "3", description: "Password hashing (12 rounds)", url: "https://github.com/dcodeIO/bcrypt.js", color: "bg-rose-900/40 text-rose-300" },
      { name: "jsonwebtoken", version: "9", description: "JWT token sign & verify", url: "https://github.com/auth0/node-jsonwebtoken", color: "bg-purple-900/40 text-purple-300" },
    ],
  },
  {
    category: "Utilities",
    items: [
      { name: "xlsx (SheetJS)", version: "0.18", description: "Excel/CSV file parsing & generation", url: "https://sheetjs.com", color: "bg-emerald-900/40 text-emerald-300" },
      { name: "multer", version: "2", description: "File upload middleware", url: "https://github.com/expressjs/multer", color: "bg-gray-800 text-gray-300" },
      { name: "dotenv", version: "16", description: "Environment variable loading", url: "https://github.com/motdotla/dotenv", color: "bg-yellow-900/40 text-yellow-300" },
    ],
  },
];

export default function TechStack() {
  return (
    <div className="flex flex-col h-screen">
      <PageHeader title="Tech Stack" subtitle="Technologies powering TestAgent" />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Architecture overview */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-white mb-3">Architecture</h2>
          <div className="flex items-center justify-center gap-3 text-xs flex-wrap">
            <span className="bg-sky-900/30 text-sky-300 px-3 py-1.5 rounded-lg border border-sky-800/50">React SPA</span>
            <span className="text-gray-600">→</span>
            <span className="bg-gray-800 text-gray-300 px-3 py-1.5 rounded-lg border border-gray-700">Express API</span>
            <span className="text-gray-600">→</span>
            <span className="bg-indigo-900/30 text-indigo-300 px-3 py-1.5 rounded-lg border border-indigo-800/50">Prisma + SQLite</span>
            <span className="text-gray-600 mx-2">|</span>
            <span className="bg-green-900/30 text-green-300 px-3 py-1.5 rounded-lg border border-green-800/50">Playwright</span>
          </div>
          <p className="text-xs text-gray-600 text-center mt-3">
            Single server serves both API and built React client. Playwright runs browser tests against target applications.
          </p>
        </div>

        {/* Stack grid */}
        <div className="space-y-6">
          {STACK.map(({ category, items }) => (
            <div key={category}>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">{category}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {items.map(tech => (
                  <a
                    key={tech.name + tech.description}
                    href={tech.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-lg p-3.5 flex items-start gap-3 transition hover:shadow-lg"
                  >
                    <span className={`text-xs font-bold px-2 py-1 rounded shrink-0 ${tech.color}`}>
                      {tech.version}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-gray-200 group-hover:text-white transition">{tech.name}</p>
                        <ExternalLink className="w-3 h-3 text-gray-700 group-hover:text-gray-500 transition shrink-0" />
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{tech.description}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer stats */}
        <div className="mt-8 border-t border-gray-800 pt-4 flex flex-wrap gap-6 text-xs text-gray-600">
          <span>59 unit/integration tests</span>
          <span>Prisma migrations</span>
          <span>JWT + bcrypt auth</span>
          <span>SSE streaming for live test output</span>
          <span>DSSB Excel import</span>
        </div>
      </div>
    </div>
  );
}
