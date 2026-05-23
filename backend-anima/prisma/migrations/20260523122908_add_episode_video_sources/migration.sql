-- CreateTable
CREATE TABLE "Episode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animeId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Episode_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VideoSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "episodeId" TEXT NOT NULL,
    "addedById" TEXT,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "audioLang" TEXT NOT NULL DEFAULT 'ja',
    "quality" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VideoSource_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VideoSource_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubtitleTrack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoSourceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SubtitleTrack_videoSourceId_fkey" FOREIGN KEY ("videoSourceId") REFERENCES "VideoSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Episode_animeId_number_key" ON "Episode"("animeId", "number");
