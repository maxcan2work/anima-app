ALTER TABLE "Anime" ADD COLUMN "titleRu" TEXT;
ALTER TABLE "Anime" ADD COLUMN "titleEn" TEXT;
ALTER TABLE "Anime" ADD COLUMN "titleJa" TEXT;
ALTER TABLE "Anime" ADD COLUMN "titleRomaji" TEXT;

ALTER TABLE "UserRandomAnime" ADD COLUMN "titleRu" TEXT;
ALTER TABLE "UserRandomAnime" ADD COLUMN "titleEn" TEXT;
ALTER TABLE "UserRandomAnime" ADD COLUMN "titleJa" TEXT;
ALTER TABLE "UserRandomAnime" ADD COLUMN "titleRomaji" TEXT;

UPDATE "Anime"
SET
  "titleRu" = "title",
  "titleRomaji" = "originalTitle"
WHERE "titleRu" IS NULL AND "titleRomaji" IS NULL;

UPDATE "UserRandomAnime"
SET
  "titleRu" = "title",
  "titleRomaji" = "originalTitle"
WHERE "titleRu" IS NULL AND "titleRomaji" IS NULL;
