-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Member" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "githubId" TEXT NOT NULL,
    "nickname" TEXT,
    "manualNickname" TEXT,
    "nicknameStats" TEXT,
    "cohort" INTEGER,
    "blog" TEXT,
    "role" TEXT NOT NULL DEFAULT 'crew',
    "workspaceId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Member_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Member" ("blog", "cohort", "createdAt", "githubId", "id", "manualNickname", "nickname", "nicknameStats", "updatedAt", "workspaceId") SELECT "blog", "cohort", "createdAt", "githubId", "id", "manualNickname", "nickname", "nicknameStats", "updatedAt", "workspaceId" FROM "Member";
DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";
CREATE UNIQUE INDEX "Member_githubId_workspaceId_key" ON "Member"("githubId", "workspaceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
