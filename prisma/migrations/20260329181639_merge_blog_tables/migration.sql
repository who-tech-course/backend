/*
  Warnings:

  - You are about to drop the `BlogPostLatest` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "BlogPostLatest";
PRAGMA foreign_keys=on;

-- CreateIndex
CREATE INDEX "BlogPost_publishedAt_idx" ON "BlogPost"("publishedAt");
