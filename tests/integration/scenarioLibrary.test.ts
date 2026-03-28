import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createTestDb } from "./helpers/testDb";

// Mock the db module before importing scenarioLibrary
vi.mock("../../src/db", () => ({ prisma: {} as any }));

import * as lib from "../../src/scenarioLibrary";

let prisma: PrismaClient;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const db = await createTestDb();
  prisma = db.prisma;
  cleanup = db.cleanup;
  // Replace the mocked prisma with real test instance
  const dbModule = await import("../../src/db");
  (dbModule as any).prisma = prisma;
});

afterAll(async () => {
  await cleanup();
});

describe("scenarioLibrary", () => {
  // ─── Projects ────────────────────────────────────────────────────────────────
  describe("projects", () => {
    it("creates a project", async () => {
      const p = await lib.createProject({ name: "Test Project", description: "Desc" });
      expect(p.id).toBeTruthy();
      expect(p.name).toBe("Test Project");
      expect(p.description).toBe("Desc");
      expect(p.createdAt).toBeTruthy();
    });

    it("updates a project", async () => {
      const p = await lib.createProject({ name: "Old" });
      const updated = await lib.updateProject(p.id, { name: "New" });
      expect(updated.name).toBe("New");
    });

    it("deletes a project", async () => {
      const p = await lib.createProject({ name: "ToDelete" });
      await lib.deleteProject(p.id);
      const tree = await lib.getProjectTree();
      expect(tree.find(x => x.id === p.id)).toBeUndefined();
    });
  });

  // ─── Modules ─────────────────────────────────────────────────────────────────
  describe("modules", () => {
    it("creates a module under a project", async () => {
      const p = await lib.createProject({ name: "ModuleTestProject" });
      const m = await lib.createModule({ projectId: p.id, name: "Login Module" });
      expect(m.id).toBeTruthy();
      expect(m.projectId).toBe(p.id);
      expect(m.name).toBe("Login Module");
    });
  });

  // ─── Scenarios ───────────────────────────────────────────────────────────────
  describe("scenarios", () => {
    it("creates a scenario with JSON fields", async () => {
      const p = await lib.createProject({ name: "ScenarioProject" });
      const m = await lib.createModule({ projectId: p.id, name: "Mod" });
      const s = await lib.createScenario({
        moduleId: m.id,
        name: "Login Test",
        url: "https://example.com",
        testTypes: ["smoke", "forms"] as any,
        description: "Test login",
        tags: ["auth", "critical"],
        authConfig: { loginUrl: "https://example.com/login", email: "user@test.com", password: "pass" },
      });
      expect(s.id).toBeTruthy();
      expect(s.testTypes).toEqual(["smoke", "forms"]);
      expect(s.tags).toEqual(["auth", "critical"]);
      expect(s.authConfig).toEqual({ loginUrl: "https://example.com/login", email: "user@test.com", password: "pass" });
    });

    it("round-trips JSON fields correctly", async () => {
      const p = await lib.createProject({ name: "RoundTripProject" });
      const m = await lib.createModule({ projectId: p.id, name: "Mod" });
      const created = await lib.createScenario({
        moduleId: m.id, name: "RT", url: "https://x.com",
        testTypes: ["navigation", "responsive"] as any,
        tags: ["tag1", "tag2"],
      });
      const fetched = await lib.getScenario(created.id);
      expect(fetched).toBeDefined();
      expect(fetched!.testTypes).toEqual(["navigation", "responsive"]);
      expect(fetched!.tags).toEqual(["tag1", "tag2"]);
      expect(fetched!.authConfig).toBeUndefined();
    });

    it("updates a scenario partially", async () => {
      const p = await lib.createProject({ name: "UpdateProject" });
      const m = await lib.createModule({ projectId: p.id, name: "Mod" });
      const s = await lib.createScenario({
        moduleId: m.id, name: "Before", url: "https://old.com",
        testTypes: ["smoke"] as any, tags: [],
      });
      const updated = await lib.updateScenario(s.id, { name: "After" });
      expect(updated.name).toBe("After");
      expect(updated.url).toBe("https://old.com"); // unchanged
    });

    it("deletes a scenario", async () => {
      const p = await lib.createProject({ name: "DelScenProject" });
      const m = await lib.createModule({ projectId: p.id, name: "Mod" });
      const s = await lib.createScenario({
        moduleId: m.id, name: "Bye", url: "https://x.com",
        testTypes: ["smoke"] as any, tags: [],
      });
      await lib.deleteScenario(s.id);
      expect(await lib.getScenario(s.id)).toBeUndefined();
    });
  });

  // ─── Project tree ────────────────────────────────────────────────────────────
  describe("getProjectTree", () => {
    it("returns nested structure", async () => {
      const p = await lib.createProject({ name: "TreeProject" });
      const m = await lib.createModule({ projectId: p.id, name: "TreeMod" });
      await lib.createScenario({
        moduleId: m.id, name: "TreeScenario", url: "https://x.com",
        testTypes: ["smoke"] as any, tags: [],
      });
      const tree = await lib.getProjectTree();
      const proj = tree.find(x => x.id === p.id);
      expect(proj).toBeDefined();
      expect(proj!.modules).toHaveLength(1);
      expect(proj!.modules[0].name).toBe("TreeMod");
      expect(proj!.modules[0].scenarios).toHaveLength(1);
      expect(proj!.modules[0].scenarios[0].name).toBe("TreeScenario");
    });
  });

  // ─── Cascade delete ──────────────────────────────────────────────────────────
  describe("cascade delete", () => {
    it("deleting project removes modules and scenarios", async () => {
      const p = await lib.createProject({ name: "CascadeProject" });
      const m = await lib.createModule({ projectId: p.id, name: "CascadeMod" });
      const s = await lib.createScenario({
        moduleId: m.id, name: "CascadeScenario", url: "https://x.com",
        testTypes: ["smoke"] as any, tags: [],
      });
      await lib.deleteProject(p.id);
      expect(await lib.getScenario(s.id)).toBeUndefined();
    });
  });

  // ─── Run records ─────────────────────────────────────────────────────────────
  describe("run records", () => {
    it("adds and retrieves run history", async () => {
      const p = await lib.createProject({ name: "RunProject" });
      const m = await lib.createModule({ projectId: p.id, name: "Mod" });
      const s = await lib.createScenario({
        moduleId: m.id, name: "RunScenario", url: "https://x.com",
        testTypes: ["smoke"] as any, tags: [],
      });

      await lib.addRunRecord({
        scenarioId: s.id, runAt: new Date().toISOString(),
        passed: true, summary: "All good", durationMs: 1500,
      });
      await lib.addRunRecord({
        scenarioId: s.id, runAt: new Date().toISOString(),
        passed: false, summary: "Failed", durationMs: 2000,
      });

      const history = await lib.getScenarioHistory(s.id);
      expect(history).toHaveLength(2);
      expect(history[0].passed).toBe(false); // most recent first
      expect(history[1].passed).toBe(true);
    });
  });

  // ─── Roles ───────────────────────────────────────────────────────────────────
  describe("roles", () => {
    it("CRUD cycle for project roles", async () => {
      const p = await lib.createProject({ name: "RoleProject" });
      const r = await lib.createRole({ projectId: p.id, name: "Admin", color: "emerald" });
      expect(r.name).toBe("Admin");
      expect(r.color).toBe("emerald");

      const roles = await lib.getRoles(p.id);
      expect(roles).toHaveLength(1);

      await lib.deleteRole(r.id);
      expect(await lib.getRoles(p.id)).toHaveLength(0);
    });
  });

  // ─── Members ─────────────────────────────────────────────────────────────────
  describe("members", () => {
    it("CRUD cycle for project members", async () => {
      const p = await lib.createProject({ name: "MemberProject" });
      const m = await lib.createMember({ projectId: p.id, name: "John", email: "john@test.com", role: "Tester" });
      expect(m.name).toBe("John");

      const members = await lib.getMembers(p.id);
      expect(members).toHaveLength(1);

      const updated = await lib.updateMember(m.id, { name: "Jane" });
      expect(updated.name).toBe("Jane");

      await lib.deleteMember(m.id);
      expect(await lib.getMembers(p.id)).toHaveLength(0);
    });
  });
});
