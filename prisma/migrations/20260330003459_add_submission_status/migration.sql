-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Submission" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "prNumber" INTEGER NOT NULL,
    "prUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "submittedAt" DATETIME NOT NULL,
    "memberId" INTEGER NOT NULL,
    "missionRepoId" INTEGER NOT NULL,
    CONSTRAINT "Submission_missionRepoId_fkey" FOREIGN KEY ("missionRepoId") REFERENCES "MissionRepo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Submission_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Submission" ("id", "memberId", "missionRepoId", "prNumber", "prUrl", "submittedAt", "title") SELECT "id", "memberId", "missionRepoId", "prNumber", "prUrl", "submittedAt", "title" FROM "Submission";
DROP TABLE "Submission";
ALTER TABLE "new_Submission" RENAME TO "Submission";
CREATE UNIQUE INDEX "Submission_prNumber_missionRepoId_key" ON "Submission"("prNumber", "missionRepoId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
