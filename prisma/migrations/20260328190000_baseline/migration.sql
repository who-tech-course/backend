-- CreateTable
CREATE TABLE "Workspace" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "githubOrg" TEXT NOT NULL,
    "nicknameRegex" TEXT NOT NULL,
    "cohortRules" TEXT NOT NULL,
    "blogSyncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Member" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "githubUserId" INTEGER,
    "githubId" TEXT NOT NULL,
    "previousGithubIds" TEXT,
    "nickname" TEXT,
    "manualNickname" TEXT,
    "nicknameStats" TEXT,
    "avatarUrl" TEXT,
    "profileFetchedAt" DATETIME,
    "profileRefreshError" TEXT,
    "cohort" INTEGER,
    "blog" TEXT,
    "rssStatus" TEXT NOT NULL DEFAULT 'unknown',
    "rssUrl" TEXT,
    "rssCheckedAt" DATETIME,
    "rssError" TEXT,
    "lastPostedAt" DATETIME,
    "roles" TEXT NOT NULL DEFAULT '["crew"]',
    "workspaceId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Member_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MissionRepo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "githubRepoId" INTEGER,
    "name" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "description" TEXT,
    "track" TEXT,
    "type" TEXT NOT NULL DEFAULT 'individual',
    "tabCategory" TEXT NOT NULL DEFAULT 'base',
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

-- CreateTable
CREATE TABLE "Submission" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "prNumber" INTEGER NOT NULL,
    "prUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "submittedAt" DATETIME NOT NULL,
    "memberId" INTEGER NOT NULL,
    "missionRepoId" INTEGER NOT NULL,
    CONSTRAINT "Submission_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Submission_missionRepoId_fkey" FOREIGN KEY ("missionRepoId") REFERENCES "MissionRepo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BlogPost" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL,
    "memberId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BlogPost_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BlogPostLatest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL,
    "memberId" INTEGER NOT NULL,
    CONSTRAINT "BlogPostLatest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_name_key" ON "Workspace"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Member_githubId_workspaceId_key" ON "Member"("githubId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_githubUserId_workspaceId_key" ON "Member"("githubUserId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "MissionRepo_githubRepoId_key" ON "MissionRepo"("githubRepoId");

-- CreateIndex
CREATE UNIQUE INDEX "MissionRepo_name_workspaceId_key" ON "MissionRepo"("name", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "CohortRepo_cohort_missionRepoId_key" ON "CohortRepo"("cohort", "missionRepoId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_prNumber_missionRepoId_key" ON "Submission"("prNumber", "missionRepoId");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_url_key" ON "BlogPost"("url");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPostLatest_url_key" ON "BlogPostLatest"("url");
