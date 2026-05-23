-- CreateTable
CREATE TABLE "ProviderMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animeId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerTitleId" TEXT NOT NULL,
    "title" TEXT,
    "confidence" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProviderMatch_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderMatch_animeId_provider_key" ON "ProviderMatch"("animeId", "provider");

-- CreateIndex
CREATE INDEX "ProviderMatch_provider_providerTitleId_idx" ON "ProviderMatch"("provider", "providerTitleId");
