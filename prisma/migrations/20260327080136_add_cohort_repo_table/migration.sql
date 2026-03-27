/*
  Warnings:

  - You are about to drop the column `order` on the `MissionRepo` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "CohortRepo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cohort" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "missionRepoId" INTEGER NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    CONSTRAINT "CohortRepo_missionRepoId_fkey" FOREIGN KEY ("missionRepoId") REFERENCES "MissionRepo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CohortRepo_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MissionRepo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "githubRepoId" INTEGER,
    "name" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "description" TEXT,
    "track" TEXT,
    "type" TEXT NOT NULL DEFAULT 'individual',
    "status" TEXT NOT NULL DEFAULT 'active',
    "candidateReason" TEXT,
    "nicknameRegex" TEXT,
    "cohortRegexRules" TEXT,
    "cohorts" TEXT,
    "level" INTEGER,
    "syncMode" TEXT NOT NULL DEFAULT 'continuous',
    "lastSyncAt" DATETIME,
    "workspaceId" INTEGER NOT NULL,
    CONSTRAINT "MissionRepo_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MissionRepo" ("candidateReason", "cohortRegexRules", "cohorts", "description", "githubRepoId", "id", "lastSyncAt", "level", "name", "nicknameRegex", "repoUrl", "status", "syncMode", "track", "type", "workspaceId") SELECT "candidateReason", "cohortRegexRules", "cohorts", "description", "githubRepoId", "id", "lastSyncAt", "level", "name", "nicknameRegex", "repoUrl", "status", "syncMode", "track", "type", "workspaceId" FROM "MissionRepo";
DROP TABLE "MissionRepo";
ALTER TABLE "new_MissionRepo" RENAME TO "MissionRepo";
CREATE UNIQUE INDEX "MissionRepo_githubRepoId_key" ON "MissionRepo"("githubRepoId");
CREATE UNIQUE INDEX "MissionRepo_name_workspaceId_key" ON "MissionRepo"("name", "workspaceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CohortRepo_cohort_missionRepoId_key" ON "CohortRepo"("cohort", "missionRepoId");
