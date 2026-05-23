-- Delete old demo rows that were seeded before Shikimori became the source catalog.
DELETE FROM "Anime"
WHERE "id" IN ('frieren', 'dungeon-meshi', 'apothecary', 'chainsaw-man');
