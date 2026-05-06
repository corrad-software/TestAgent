import "dotenv/config";
import path from "path";
import fs from "fs";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

/**
 * `prisma` is a Proxy that forwards to whichever client `initDb()` selects.
 * Synchronous use before `initDb()` runs throws — but every caller is inside
 * a request handler that boots after `initDb()`, so this is fine.
 */
let _client: any = null;
export const prisma = new Proxy({} as PrismaClient, {
  get(_t, prop, recv) {
    if (!_client) throw new Error("DB not initialized — call initDb() before using prisma");
    const v = (_client as any)[prop];
    return typeof v === "function" ? v.bind(_client) : v;
  },
}) as PrismaClient;

export type ActiveBackend = "mysql" | "sqlite";
let _active: ActiveBackend = "sqlite";
export const getActiveBackend = (): ActiveBackend => _active;

function sqliteFileUrl(): string {
  const pick = (v: string | undefined) =>
    v?.trim().startsWith("file:") ? v.trim() : undefined;
  return (
    pick(process.env["SQLITE_DATABASE_URL"]) ??
    pick(process.env["DATABASE_URL"]) ??
    `file:${path.join(process.cwd(), "data/testAgent.db")}`
  );
}

function makeSqliteClient(): PrismaClient {
  const dbUrl = sqliteFileUrl();
  const adapter = new PrismaBetterSqlite3({ url: dbUrl });
  return new PrismaClient({ adapter } as any);
}

async function makeMysqlClient(url: string): Promise<PrismaClient> {
  // The MySQL client lives in a separate generated path because schema providers differ.
  // It exposes the same model surface as the sqlite client, so casting is safe.
  const { PrismaClient: MysqlPrisma } = await import("../prisma/generated/mysql-client");
  const { PrismaMariaDb } = await import("@prisma/adapter-mariadb");
  const adapter = new PrismaMariaDb(url);
  return new MysqlPrisma({ adapter } as any) as unknown as PrismaClient;
}

/**
 * Read the saved app-settings synchronously (avoids circular import with appSettings.ts,
 * which is async-fs-based). Returns the raw db config or null if the file doesn't exist.
 */
function readDbSettingsSync(): { dbEnabled: boolean; dbUrl: string } | null {
  const p = path.join(process.cwd(), "data", "app-settings.json");
  try {
    const raw = fs.readFileSync(p, "utf-8");
    const j = JSON.parse(raw);
    return { dbEnabled: !!j.dbEnabled, dbUrl: String(j.dbUrl ?? "") };
  } catch {
    return null;
  }
}

function mysqlUrlForRuntime(): string | null {
  const cfg = readDbSettingsSync();
  if (cfg && !cfg.dbEnabled) return null;
  const fromSettings = cfg?.dbEnabled && cfg.dbUrl.trim() ? cfg.dbUrl.trim() : null;
  if (fromSettings) return fromSettings;
  const envUrl = process.env["DATABASE_URL"]?.trim();
  if (envUrl && /^(mysql|mariadb):\/\//i.test(envUrl)) return envUrl;
  return null;
}

/**
 * Pick the DB at boot. MySQL URL: App Settings (dbEnabled + dbUrl), else DATABASE_URL if mysql/mariadb.
 * Prisma SQLite migrate still uses a file: URL only (see prisma.config.ts).
 */
export async function initDb(): Promise<ActiveBackend> {
  const mysqlUrl = mysqlUrlForRuntime();
  if (mysqlUrl) {
    try {
      const mysql = await import("mysql2/promise");
      const conn = await mysql.createConnection({ uri: mysqlUrl, connectTimeout: 3000 });
      await conn.query("SELECT 1");
      await conn.end();
      _client = await makeMysqlClient(mysqlUrl);
      _active = "mysql";
      console.log("[db] active backend: MySQL");
      return _active;
    } catch (e) {
      console.warn(`[db] MySQL unreachable (${(e as Error).message}). Falling back to SQLite.`);
    }
  }
  _client = makeSqliteClient();
  _active = "sqlite";
  console.log("[db] active backend: SQLite");
  return _active;
}
