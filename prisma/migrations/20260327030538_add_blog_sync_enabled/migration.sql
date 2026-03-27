-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Workspace" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "githubOrg" TEXT NOT NULL,
    "nicknameRegex" TEXT NOT NULL,
    "cohortRules" TEXT NOT NULL,
    "blogSyncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Workspace" ("cohortRules", "createdAt", "githubOrg", "id", "name", "nicknameRegex", "updatedAt") SELECT "cohortRules", "createdAt", "githubOrg", "id", "name", "nicknameRegex", "updatedAt" FROM "Workspace";
DROP TABLE "Workspace";
ALTER TABLE "new_Workspace" RENAME TO "Workspace";
CREATE UNIQUE INDEX "Workspace_name_key" ON "Workspace"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
