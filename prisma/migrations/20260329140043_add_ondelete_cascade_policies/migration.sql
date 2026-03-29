-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BlogPost" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL,
    "memberId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BlogPost_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BlogPost" ("createdAt", "id", "memberId", "publishedAt", "title", "url") SELECT "createdAt", "id", "memberId", "publishedAt", "title", "url" FROM "BlogPost";
DROP TABLE "BlogPost";
ALTER TABLE "new_BlogPost" RENAME TO "BlogPost";
CREATE UNIQUE INDEX "BlogPost_url_key" ON "BlogPost"("url");
CREATE TABLE "new_BlogPostLatest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL,
    "memberId" INTEGER NOT NULL,
    CONSTRAINT "BlogPostLatest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BlogPostLatest" ("id", "memberId", "publishedAt", "title", "url") SELECT "id", "memberId", "publishedAt", "title", "url" FROM "BlogPostLatest";
DROP TABLE "BlogPostLatest";
ALTER TABLE "new_BlogPostLatest" RENAME TO "BlogPostLatest";
CREATE UNIQUE INDEX "BlogPostLatest_url_key" ON "BlogPostLatest"("url");
CREATE TABLE "new_MemberCohort" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "memberId" INTEGER NOT NULL,
    "cohortId" INTEGER NOT NULL,
    "roleId" INTEGER NOT NULL,
    CONSTRAINT "MemberCohort_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MemberCohort_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MemberCohort_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MemberCohort" ("cohortId", "id", "memberId", "roleId") SELECT "cohortId", "id", "memberId", "roleId" FROM "MemberCohort";
DROP TABLE "MemberCohort";
ALTER TABLE "new_MemberCohort" RENAME TO "MemberCohort";
CREATE UNIQUE INDEX "MemberCohort_memberId_cohortId_roleId_key" ON "MemberCohort"("memberId", "cohortId", "roleId");
CREATE TABLE "new_Submission" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "prNumber" INTEGER NOT NULL,
    "prUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
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
