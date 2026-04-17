-- CreateTable
CREATE TABLE "ScenarioGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "moduleId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScenarioGroup_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScenarioGroup_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ScenarioGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Scenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseNumber" INTEGER,
    "moduleId" TEXT NOT NULL,
    "groupId" TEXT,
    "assigneeId" TEXT,
    "roleId" TEXT,
    "testCaseId" TEXT,
    "scenarioRefId" TEXT,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "testTypes" TEXT NOT NULL,
    "description" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "authConfig" TEXT,
    "customSpec" TEXT,
    "testSteps" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Scenario_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Scenario_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ScenarioGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Scenario_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Scenario_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "ProjectRole" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Scenario" ("assigneeId", "authConfig", "createdAt", "customSpec", "description", "id", "moduleId", "name", "roleId", "scenarioRefId", "tags", "testCaseId", "testSteps", "testTypes", "updatedAt", "url") SELECT "assigneeId", "authConfig", "createdAt", "customSpec", "description", "id", "moduleId", "name", "roleId", "scenarioRefId", "tags", "testCaseId", "testSteps", "testTypes", "updatedAt", "url" FROM "Scenario";
DROP TABLE "Scenario";
ALTER TABLE "new_Scenario" RENAME TO "Scenario";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
