import "dotenv/config";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const dbUrl = process.env.DATABASE_URL
  ?? `file:${path.join(process.cwd(), "data/testAgent.db")}`;

const adapter = new PrismaBetterSqlite3({ url: dbUrl });

export const prisma = new PrismaClient({ adapter } as any);
