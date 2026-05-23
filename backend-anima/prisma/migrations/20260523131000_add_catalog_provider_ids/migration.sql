-- AlterTable
ALTER TABLE "Anime" ADD COLUMN "shikimoriId" INTEGER;
ALTER TABLE "Anime" ADD COLUMN "malId" INTEGER;
ALTER TABLE "Anime" ADD COLUMN "kind" TEXT;
ALTER TABLE "Anime" ADD COLUMN "score" TEXT;
ALTER TABLE "Anime" ADD COLUMN "status" TEXT;
ALTER TABLE "Anime" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "Anime" ADD COLUMN "airedOn" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Anime_shikimoriId_key" ON "Anime"("shikimoriId");
