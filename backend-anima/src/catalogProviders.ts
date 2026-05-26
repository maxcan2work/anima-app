import { prisma } from './db.js';
import { findAniLibriaMatch } from './playerProviders.js';

const SHIKIMORI_BASE_URL = 'https://shikimori.io';

type ShikimoriImage = {
  original?: string;
  preview?: string;
  x96?: string;
};

type ShikimoriAnime = {
  id: number;
  mal_id?: number | null;
  name: string;
  russian?: string | null;
  english?: string | string[] | null;
  japanese?: string | string[] | null;
  image?: ShikimoriImage | null;
  url?: string | null;
  kind?: string | null;
  score?: string | null;
  status?: string | null;
  episodes?: number | null;
  aired_on?: string | null;
  genres?: Array<{
    name?: string | null;
    russian?: string | null;
  }>;
};

export type CatalogSearchResult = {
  provider: 'shikimori';
  providerId: number;
  title: string;
  originalTitle: string;
  titleRu: string | null;
  titleEn: string | null;
  titleJa: string | null;
  titleRomaji: string | null;
  episodes: number;
  posterUrl: string | null;
  kind: string | null;
  genres: string[];
  score: string | null;
  status: string | null;
  malId: number | null;
  sourceUrl: string;
  airedOn: string | null;
};

export async function searchCatalog(query: string) {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const url = new URL('/api/animes', SHIKIMORI_BASE_URL);
  url.searchParams.set('search', trimmed);
  url.searchParams.set('limit', '12');
  url.searchParams.set('order', 'popularity');

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'AnimaCatalog/0.1',
    },
  });

  if (!response.ok) {
    throw new Error(`Shikimori search failed: ${response.status}`);
  }

  const payload = (await response.json()) as ShikimoriAnime[];
  return payload.map(mapShikimoriAnime);
}

export async function searchPlayableCatalog(query: string, provider: string) {
  const results = await searchCatalog(query);
  return filterPlayableCatalogResults(results, provider);
}

export async function browseCatalog(page: number, limit: number, order: string) {
  const safePage = Math.max(Math.trunc(page), 1);
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 30);
  const safeOrder = ['popularity', 'ranked', 'ranked_random', 'aired_on'].includes(order) ? order : 'popularity';

  const url = new URL('/api/animes', SHIKIMORI_BASE_URL);
  url.searchParams.set('page', String(safePage));
  url.searchParams.set('limit', String(safeLimit));
  url.searchParams.set('order', safeOrder);

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'AnimaCatalog/0.1',
    },
  });

  if (!response.ok) {
    throw new Error(`Shikimori browse failed: ${response.status}`);
  }

  const payload = (await response.json()) as ShikimoriAnime[];

  return {
    page: safePage,
    limit: safeLimit,
    order: safeOrder,
    hasNextPage: payload.length === safeLimit,
    results: payload.map(mapShikimoriAnime),
  };
}

export async function browsePlayableCatalog(page: number, limit: number, order: string, provider: string) {
  const result = await browseCatalog(page, limit, order);
  return {
    ...result,
    results: await filterPlayableCatalogResults(result.results, provider),
  };
}

export async function importShikimoriAnime(providerId: number) {
  const url = new URL(`/api/animes/${providerId}`, SHIKIMORI_BASE_URL);
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'AnimaCatalog/0.1',
    },
  });

  if (!response.ok) {
    throw new Error(`Shikimori import failed: ${response.status}`);
  }

  const anime = mapShikimoriAnime((await response.json()) as ShikimoriAnime);

  const savedAnime = await prisma.anime.upsert({
    where: { id: `shikimori-${anime.providerId}` },
    update: {
      title: anime.title,
      originalTitle: anime.originalTitle,
      titleRu: anime.titleRu,
      titleEn: anime.titleEn,
      titleJa: anime.titleJa,
      titleRomaji: anime.titleRomaji,
      episodes: anime.episodes,
      posterUrl: anime.posterUrl,
      shikimoriId: anime.providerId,
      malId: anime.malId,
      kind: anime.kind,
      genres: JSON.stringify(anime.genres),
      score: anime.score,
      status: anime.status,
      sourceUrl: anime.sourceUrl,
      airedOn: anime.airedOn,
    },
    create: {
      id: `shikimori-${anime.providerId}`,
      title: anime.title,
      originalTitle: anime.originalTitle,
      titleRu: anime.titleRu,
      titleEn: anime.titleEn,
      titleJa: anime.titleJa,
      titleRomaji: anime.titleRomaji,
      episodes: anime.episodes,
      posterUrl: anime.posterUrl,
      shikimoriId: anime.providerId,
      malId: anime.malId,
      kind: anime.kind,
      genres: JSON.stringify(anime.genres),
      score: anime.score,
      status: anime.status,
      sourceUrl: anime.sourceUrl,
      airedOn: anime.airedOn,
    },
  });

  const match = await findAniLibriaMatch(savedAnime.title, savedAnime.originalTitle);
  if (match) {
    await prisma.providerMatch.upsert({
      where: {
        animeId_provider: {
          animeId: savedAnime.id,
          provider: 'anilibria',
        },
      },
      update: {
        providerTitleId: match.providerTitleId,
        title: match.title,
        confidence: 'auto',
      },
      create: {
        animeId: savedAnime.id,
        provider: 'anilibria',
        providerTitleId: match.providerTitleId,
        title: match.title,
        confidence: 'auto',
      },
    });
  }

  return savedAnime;
}

function mapShikimoriAnime(anime: ShikimoriAnime): CatalogSearchResult {
  const titleRu = cleanText(anime.russian);
  const titleRomaji = cleanText(anime.name);
  const titleEn = firstTitle(anime.english);
  const titleJa = firstTitle(anime.japanese);

  return {
    provider: 'shikimori',
    providerId: anime.id,
    title: titleRu || titleRomaji || titleEn || titleJa || `Shikimori ${anime.id}`,
    originalTitle: titleRomaji || titleEn || titleJa || titleRu || `Shikimori ${anime.id}`,
    titleRu,
    titleEn,
    titleJa,
    titleRomaji,
    episodes: anime.episodes && anime.episodes > 0 ? anime.episodes : 1,
    posterUrl: buildShikimoriImageUrl(anime.image),
    kind: anime.kind ?? null,
    genres: mapShikimoriGenres(anime.genres),
    score: anime.score ?? null,
    status: anime.status ?? null,
    malId: anime.mal_id ?? null,
    sourceUrl: anime.url ? `${SHIKIMORI_BASE_URL}${anime.url}` : `${SHIKIMORI_BASE_URL}/animes/${anime.id}`,
    airedOn: anime.aired_on ?? null,
  };
}

async function filterPlayableCatalogResults(results: CatalogSearchResult[], provider: string) {
  if (provider !== 'anilibria') return results;

  const checks = await Promise.all(
    results.map(async (result) => ({
      result,
      match: await findAniLibriaMatch(getCatalogSearchTitles(result)),
    })),
  );

  return checks.filter((item) => Boolean(item.match)).map((item) => item.result);
}

function getCatalogSearchTitles(result: CatalogSearchResult) {
  return uniqueStrings([
    result.titleRomaji,
    result.originalTitle,
    result.titleEn,
    result.titleRu,
    result.title,
    result.titleJa,
  ]);
}

function mapShikimoriGenres(genres: ShikimoriAnime['genres']) {
  return uniqueStrings(
    (genres ?? [])
      .map((genre) => genre.russian || genre.name)
      .filter(Boolean),
  );
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean))] as string[];
}

function firstTitle(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) {
    return value.map(cleanText).find(Boolean) ?? null;
  }

  return cleanText(value);
}

function cleanText(value: string | null | undefined) {
  const text = value?.trim();
  return text && text.length > 0 ? text : null;
}

function buildShikimoriImageUrl(image: ShikimoriImage | null | undefined) {
  const path = image?.original ?? image?.preview ?? image?.x96;
  if (!path) return null;
  return path.startsWith('http') ? path : `${SHIKIMORI_BASE_URL}${path}`;
}
