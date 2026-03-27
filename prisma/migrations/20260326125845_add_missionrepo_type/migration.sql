-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MissionRepo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "track" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'individual',
    "nicknameRegex" TEXT,
    "workspaceId" INTEGER NOT NULL,
    CONSTRAINT "MissionRepo_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MissionRepo" ("id", "name", "nicknameRegex", "repoUrl", "track", "workspaceId") SELECT "id", "name", "nicknameRegex", "repoUrl", "track", "workspaceId" FROM "MissionRepo";
DROP TABLE "MissionRepo";
ALTER TABLE "new_MissionRepo" RENAME TO "MissionRepo";
CREATE UNIQUE INDEX "MissionRepo_name_workspaceId_key" ON "MissionRepo"("name", "workspaceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
