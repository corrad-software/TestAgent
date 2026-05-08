/**
 * One-shot script: copy all User rows from SQLite → MySQL.
 * Skips rows that already exist in MySQL (by email). Safe to re-run.
 */
import "dotenv/config";
import path from "path";
import Database from "better-sqlite3";
import { PrismaClient as MysqlPrisma } from "../prisma/generated/mysql-client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const MYSQL_URL = process.env.MYSQL_DATABASE_URL
  ?? "mysql://kerisi:kerisi123@43.217.187.42:4151/testagent";

async function main() {
  // Read from SQLite
  const sqliteDb = new Database(path.join(process.cwd(), "data/testAgent.db"));
  const rows = sqliteDb.prepare(
    "SELECT id, email, name, role, passwordHash, avatarUrl, createdAt, updatedAt FROM User"
  ).all() as any[];
  sqliteDb.close();
  console.log(`Found ${rows.length} users in SQLite`);

  // Connect to MySQL
  const adapter = new PrismaMariaDb(MYSQL_URL);
  const mysql = new MysqlPrisma({ adapter } as any);

  let inserted = 0, skipped = 0;
  for (const u of rows) {
    const exists = await mysql.user.findUnique({ where: { email: u.email } });
    if (exists) {
      console.log(`  skip  ${u.email} (already in MySQL)`);
      skipped++;
      continue;
    }
    await mysql.user.create({
      data: {
        id:           u.id,
        email:        u.email,
        name:         u.name,
        role:         u.role,
        passwordHash: u.passwordHash,
        avatarUrl:    null, // base64 avatars are too large for VARCHAR; users can re-upload
        createdAt:    new Date(u.createdAt),
        updatedAt:    new Date(u.updatedAt),
      },
    });
    console.log(`  copied ${u.email} (${u.role})`);
    inserted++;
  }

  await mysql.$disconnect();
  console.log(`\nDone — ${inserted} inserted, ${skipped} skipped.`);
}

main().catch(e => { console.error(e); process.exit(1); });
