import { prisma } from './db.js';

type PlayerProviderResult = {
  provider: 'anilibria';
  providerTitleId: string;
  title: string;
  originalTitle: string | null;
  posterUrl: string | null;
  watchUrl: string;
  episodeCount: number | null;
  requestedEpisode: number;
  status: 'available' | 'unknown';
  streamUrl: string | null;
  streamType: 'hls' | null;
  quality: 'fhd' | 'hd' | 'sd' | null;
  note: string;
};

type AniLibriaTitle = {
  id?: number | string;
  code?: string;
  names?: {
    ru?: string;
    en?: string;
    alternative?: string;
  };
  posters?: {
    medium?: {
      url?: string;
    };
  };
  player?: {
    host?: string;
    episodes?: Record<string, unknown> | unknown[];
    episodes_count?: number;
    last_episode?: number;
    list?: Record<
      string,
      {
        hls?: {
          fhd?: string | null;
          hd?: string | null;
          sd?: string | null;
        };
      }
    >;
  };
};

type AniLibriaSearchResponse = {
  list?: AniLibriaTitle[];
};

export async function findPlayerProviders(animeId: string, episodeNumber: number) {
  const anime = await prisma.anime.findUnique({
    where: { id: animeId },
    include: { providerMatches: true },
  });
  if (!anime) return null;

  const anilibriaMatch = anime.providerMatches.find((match) => match.provider === 'anilibria');
  const anilibriaResults = anilibriaMatch
    ? await fetchAniLibriaByCode(anilibriaMatch.providerTitleId, episodeNumber)
    : await searchAniLibria(uniqueStrings([anime.originalTitle, anime.title]), episodeNumber);

  return {
    anime,
    episodeNumber,
    providers: anilibriaResults,
  };
}

export async function findAniLibriaMatch(title: string, originalTitle: string | null) {
  const results = await searchAniLibria(uniqueStrings([originalTitle, title]), 1);
  return results[0] ?? null;
}

async function searchAniLibria(queries: string[], episodeNumber: number): Promise<PlayerProviderResult[]> {
  for (const query of queries) {
    const results = await fetchAniLibria(query, episodeNumber);
    if (results.length > 0) return results;
  }

  return [];
}

async function fetchAniLibria(query: string, episodeNumber: number): Promise<PlayerProviderResult[]> {
  const url = new URL('https://api.anilibria.tv/v3/title/search');
  url.searchParams.set('search', query);
  url.searchParams.set('limit', '5');

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'AnimaAggregator/0.1',
      },
    });

    if (!response.ok) return [];

    const payload = (await response.json()) as AniLibriaSearchResponse;
    return (payload.list ?? []).flatMap((title) => mapAniLibriaTitle(title, episodeNumber));
  } catch {
    return [];
  }
}

async function fetchAniLibriaByCode(code: string, episodeNumber: number): Promise<PlayerProviderResult[]> {
  const url = new URL('https://api.anilibria.tv/v3/title');
  url.searchParams.set('code', code);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'AnimaAggregator/0.1',
      },
    });

    if (!response.ok) return [];

    return mapAniLibriaTitle((await response.json()) as AniLibriaTitle, episodeNumber);
  } catch {
    return [];
  }
}

function mapAniLibriaTitle(title: AniLibriaTitle, episodeNumber: number): PlayerProviderResult[] {
  const code = title.code;
  const id = title.id == null ? null : String(title.id);
  const providerTitleId = code ?? id;
  if (!providerTitleId) return [];

  const episodeCount = getEpisodeCount(title);
  const stream = getEpisodeStream(title, episodeNumber);

  return [
    {
      provider: 'anilibria',
      providerTitleId,
      title: title.names?.ru ?? title.names?.en ?? providerTitleId,
      originalTitle: title.names?.en ?? title.names?.alternative ?? null,
      posterUrl: title.posters?.medium?.url ? `https://anilibria.tv${title.posters.medium.url}` : null,
      watchUrl: code ? `https://anilibria.top/release/${code}.html` : `https://anilibria.top/release/id${providerTitleId}.html`,
      episodeCount,
      requestedEpisode: episodeNumber,
      status: stream.url || episodeCount == null || episodeNumber <= episodeCount ? 'available' : 'unknown',
      streamUrl: stream.url,
      streamType: stream.url ? 'hls' : null,
      quality: stream.quality,
      note: 'AniLibria/AniLiberty: русская озвучка, доступность серий зависит от релиза провайдера.',
    },
  ];
}

function getEpisodeStream(title: AniLibriaTitle, episodeNumber: number) {
  const episode = title.player?.list?.[String(episodeNumber)];
  const hls = episode?.hls;
  const quality: 'fhd' | 'hd' | 'sd' | null = hls?.fhd ? 'fhd' : hls?.hd ? 'hd' : hls?.sd ? 'sd' : null;
  const path = quality ? hls?.[quality] : null;

  if (!path) {
    return { url: null, quality: null };
  }

  const host = title.player?.host ?? 'cache.libria.fun';
  const url = path.startsWith('http') ? path : `https://${host}${path}`;

  return { url, quality };
}

function getEpisodeCount(title: AniLibriaTitle) {
  if (typeof title.player?.episodes_count === 'number') return title.player.episodes_count;
  if (typeof title.player?.last_episode === 'number') return title.player.last_episode;
  if (Array.isArray(title.player?.episodes)) return title.player.episodes.length;
  if (title.player?.episodes && typeof title.player.episodes === 'object') {
    return Object.keys(title.player.episodes).length;
  }

  return null;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean))] as string[];
}
