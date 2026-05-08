import mysql from "mysql2/promise";
import { getAppSettings, updateAppSettings } from "./appSettings";

export interface TestResult {
  ok: boolean;
  active: "mysql" | "sqlite";
  error?: string;
  serverVersion?: string;
  pingMs?: number;
}

/**
 * Attempt a one-shot MySQL connection (3 s timeout). Does not throw — returns a
 * TestResult so the caller can decide whether to fall back to SQLite.
 */
export async function testMysqlConnection(url: string): Promise<TestResult> {
  if (!url) return { ok: false, active: "sqlite", error: "No connection URL configured" };
  const started = Date.now();
  let conn: mysql.Connection | null = null;
  try {
    conn = await mysql.createConnection({ uri: url, connectTimeout: 3000 });
    const [rows] = await conn.query("SELECT VERSION() AS v");
    const v = Array.isArray(rows) && (rows[0] as any)?.v;
    return { ok: true, active: "mysql", serverVersion: String(v ?? ""), pingMs: Date.now() - started };
  } catch (e) {
    return { ok: false, active: "sqlite", error: (e as Error).message };
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
}

/**
 * Probe the configured MySQL and update dbActive/dbLastError in settings.
 * There is no SQLite fallback — MySQL is always the required backend.
 */
export async function probeConfiguredDb(): Promise<TestResult> {
  const s = await getAppSettings();
  const r = await testMysqlConnection(s.dbUrl);
  await updateAppSettings({ dbActive: r.active, dbLastError: r.error ?? "" });
  if (!r.ok) {
    console.warn(`[db] MySQL probe failed: ${r.error}`);
  } else {
    console.log(`[db] MySQL reachable (${r.serverVersion}, ${r.pingMs}ms).`);
  }
  return r;
}
