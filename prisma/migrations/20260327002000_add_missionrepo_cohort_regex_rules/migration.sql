ALTER TABLE "MissionRepo" ADD COLUMN "cohortRegexRules" TEXT;
ALTER TABLE "MissionRepo" ADD COLUMN "githubRepoId" INTEGER;
ALTER TABLE "MissionRepo" ADD COLUMN "description" TEXT;
ALTER TABLE "MissionRepo" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "MissionRepo" ADD COLUMN "candidateReason" TEXT;
CREATE UNIQUE INDEX "MissionRepo_githubRepoId_key" ON "MissionRepo"("githubRepoId");

ALTER TABLE "Member" ADD COLUMN "manualNickname" TEXT;
ALTER TABLE "Member" ADD COLUMN "nicknameStats" TEXT;
