-- CreateTable
CREATE TABLE "ProjectRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'gray',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectRole_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Scenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "moduleId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "roleId" TEXT,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "testTypes" TEXT NOT NULL,
    "description" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "authConfig" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Scenario_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Scenario_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Scenario_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "ProjectRole" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Scenario" ("assigneeId", "authConfig", "createdAt", "description", "id", "moduleId", "name", "tags", "testTypes", "updatedAt", "url") SELECT "assigneeId", "authConfig", "createdAt", "description", "id", "moduleId", "name", "tags", "testTypes", "updatedAt", "url" FROM "Scenario";
DROP TABLE "Scenario";
ALTER TABLE "new_Scenario" RENAME TO "Scenario";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRole_projectId_name_key" ON "ProjectRole"("projectId", "name");
