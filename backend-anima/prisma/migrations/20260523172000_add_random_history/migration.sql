CREATE TABLE "UserRandomAnime" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "originalTitle" TEXT NOT NULL,
    "episodes" INTEGER NOT NULL,
    "posterUrl" TEXT,
    "kind" TEXT,
    "score" TEXT,
    "status" TEXT,
    "malId" INTEGER,
    "sourceUrl" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserRandomAnime_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "UserRandomAnime_userId_provider_providerId_key" ON "UserRandomAnime"("userId", "provider", "providerId");
CREATE INDEX "UserRandomAnime_userId_updatedAt_idx" ON "UserRandomAnime"("userId", "updatedAt");
