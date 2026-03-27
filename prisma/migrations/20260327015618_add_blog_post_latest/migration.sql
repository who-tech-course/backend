-- CreateTable
CREATE TABLE "BlogPostLatest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL,
    "memberId" INTEGER NOT NULL,
    CONSTRAINT "BlogPostLatest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BlogPostLatest_url_key" ON "BlogPostLatest"("url");
