/**
 * One-time migration: scenarios/library.json + scenarios/history.json → SQLite
 * Run: npx ts-node scripts/migrate-json-to-db.ts
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { prisma } from "../src/db";
const SCENARIOS_DIR = path.join(process.cwd(), "scenarios");

interface OldScenario {
  id: string; moduleId: string; name: string; url: string;
  testTypes: string[]; description?: string; tags: string[];
  authConfig?: { loginUrl: string; email: string; password: string };
  createdAt: string; updatedAt: string;
}
interface OldLibrary {
  projects: { id: string; name: string; description?: string; createdAt: string; updatedAt: string }[];
  modules:  { id: string; projectId: string; name: string; description?: string; createdAt: string; updatedAt: string }[];
  scenarios: OldScenario[];
}
interface OldRunRecord {
  id: string; scenarioId: string; runAt: string; passed: boolean;
  summary: string; reportId?: string; durationMs: number;
}

async function main() {
  const libPath  = path.join(SCENARIOS_DIR, "library.json");
  const histPath = path.join(SCENARIOS_DIR, "history.json");

  if (!fs.existsSync(libPath)) {
    console.log("No library.json found — nothing to migrate.");
    return;
  }

  const lib: OldLibrary = JSON.parse(fs.readFileSync(libPath, "utf-8"));
  const hist = fs.existsSync(histPath)
    ? JSON.parse(fs.readFileSync(histPath, "utf-8")) as { runs: OldRunRecord[] }
    : { runs: [] };

  console.log(`Migrating ${lib.projects.length} projects, ${lib.modules.length} modules, ${lib.scenarios.length} scenarios, ${hist.runs.length} runs...`);

  // Projects
  for (const p of lib.projects) {
    await prisma.project.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id, name: p.name, description: p.description ?? null,
        createdAt: new Date(p.createdAt), updatedAt: new Date(p.updatedAt),
      },
    });
  }

  // Modules
  for (const m of lib.modules) {
    await prisma.module.upsert({
      where: { id: m.id },
      update: {},
      create: {
        id: m.id, projectId: m.projectId, name: m.name,
        description: m.description ?? null,
        createdAt: new Date(m.createdAt), updatedAt: new Date(m.updatedAt),
      },
    });
  }

  // Scenarios
  for (const s of lib.scenarios) {
    await prisma.scenario.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id, moduleId: s.moduleId, name: s.name, url: s.url,
        testTypes: JSON.stringify(s.testTypes ?? ["smoke"]),
        description: s.description ?? null,
        tags: JSON.stringify(s.tags ?? []),
        authConfig: s.authConfig ? JSON.stringify(s.authConfig) : null,
        createdAt: new Date(s.createdAt), updatedAt: new Date(s.updatedAt),
      },
    });
  }

  // Run records
  const scenarioIds = new Set((await prisma.scenario.findMany({ select: { id: true } })).map(s => s.id));
  for (const r of hist.runs) {
    if (!scenarioIds.has(r.scenarioId)) continue; // skip orphaned runs
    await prisma.runRecord.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id, scenarioId: r.scenarioId, passed: r.passed,
        summary: r.summary, reportId: r.reportId ?? null,
        durationMs: r.durationMs, runAt: new Date(r.runAt),
      },
    });
  }

  console.log("✅ Migration complete.");
  console.log(`   Projects : ${await prisma.project.count()}`);
  console.log(`   Modules  : ${await prisma.module.count()}`);
  console.log(`   Scenarios: ${await prisma.scenario.count()}`);
  console.log(`   Runs     : ${await prisma.runRecord.count()}`);
}

main().catch(console.error).finally(() => prisma.$disconnect().catch(() => {}));
