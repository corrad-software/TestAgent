import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

export async function createTestDb() {
  const dbPath = path.join("/tmp", `testagent-test-${randomUUID()}.db`);
  const url = `file:${dbPath}`;

  // Push schema to temp DB (creates all tables)
  execSync("npx prisma db push --accept-data-loss", {
    cwd: path.resolve(__dirname, "../../.."),
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });

  const adapter = new PrismaBetterSqlite3({ url });
  const prisma = new PrismaClient({ adapter } as any);

  return {
    prisma,
    cleanup: async () => {
      await prisma.$disconnect();
      try { fs.unlinkSync(dbPath); } catch { /* ok */ }
    },
  };
}
