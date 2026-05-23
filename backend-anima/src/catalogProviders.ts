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
  image?: ShikimoriImage | null;
  url?: string | null;
  kind?: string | null;
  score?: string | null;
  status?: string | null;
  episodes?: number | null;
  aired_on?: string | null;
};

export type CatalogSearchResult = {
  provider: 'shikimori';
  providerId: number;
  title: string;
  originalTitle: string;
  episodes: number;
  posterUrl: string | null;
  kind: string | null;
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
      episodes: anime.episodes,
      posterUrl: anime.posterUrl,
      shikimoriId: anime.providerId,
      malId: anime.malId,
      kind: anime.kind,
      score: anime.score,
      status: anime.status,
      sourceUrl: anime.sourceUrl,
      airedOn: anime.airedOn,
    },
    create: {
      id: `shikimori-${anime.providerId}`,
      title: anime.title,
      originalTitle: anime.originalTitle,
      episodes: anime.episodes,
      posterUrl: anime.posterUrl,
      shikimoriId: anime.providerId,
      malId: anime.malId,
      kind: anime.kind,
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
  return {
    provider: 'shikimori',
    providerId: anime.id,
    title: anime.russian || anime.name,
    originalTitle: anime.name,
    episodes: anime.episodes && anime.episodes > 0 ? anime.episodes : 1,
    posterUrl: buildShikimoriImageUrl(anime.image),
    kind: anime.kind ?? null,
    score: anime.score ?? null,
    status: anime.status ?? null,
    malId: anime.mal_id ?? null,
    sourceUrl: anime.url ? `${SHIKIMORI_BASE_URL}${anime.url}` : `${SHIKIMORI_BASE_URL}/animes/${anime.id}`,
    airedOn: anime.aired_on ?? null,
  };
}

function buildShikimoriImageUrl(image: ShikimoriImage | null | undefined) {
  const path = image?.original ?? image?.preview ?? image?.x96;
  if (!path) return null;
  return path.startsWith('http') ? path : `${SHIKIMORI_BASE_URL}${path}`;
}
