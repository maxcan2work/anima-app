CREATE TABLE "AnimeReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "recommended" BOOLEAN NOT NULL DEFAULT true,
    "hasSpoilers" BOOLEAN NOT NULL DEFAULT false,
    "storyScore" INTEGER NOT NULL,
    "charactersScore" INTEGER NOT NULL,
    "visualsScore" INTEGER NOT NULL,
    "musicScore" INTEGER NOT NULL,
    "openingScore" INTEGER NOT NULL,
    "atmosphereScore" INTEGER NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "dislikes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AnimeReview_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnimeReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AnimeReview_animeId_userId_key" ON "AnimeReview"("animeId", "userId");
CREATE INDEX "AnimeReview_animeId_createdAt_idx" ON "AnimeReview"("animeId", "createdAt");
CREATE INDEX "AnimeReview_userId_createdAt_idx" ON "AnimeReview"("userId", "createdAt");
