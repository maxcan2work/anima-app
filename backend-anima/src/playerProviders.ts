import { prisma } from './db.js';

type PlayerProviderResult = {
  provider: 'anilibria' | 'kodik';
  providerTitleId: string;
  title: string;
  originalTitle: string | null;
  posterUrl: string | null;
  watchUrl: string;
  episodeCount: number | null;
  requestedEpisode: number;
  status: 'available' | 'unknown';
  streamUrl: string | null;
  streamType: 'hls' | 'iframe' | null;
  embedUrl: string | null;
  quality: 'fhd' | 'hd' | 'sd' | null;
  note: string;
};

type AniLibertyRelease = {
  id?: number | string;
  alias?: string;
  name?: {
    main?: string | null;
    english?: string | null;
    alternative?: string | null;
  };
  poster?: {
    src?: string | null;
    preview?: string | null;
    thumbnail?: string | null;
    optimized?: {
      src?: string | null;
      preview?: string | null;
      thumbnail?: string | null;
    } | null;
  } | null;
  episodes_total?: number | null;
  external_player?: string | null;
  episodes?: AniLibertyEpisode[];
};

type AniLibertyEpisode = {
  ordinal?: number;
  hls_1080?: string | null;
  hls_720?: string | null;
  hls_480?: string | null;
};

type KodikSearchResponse = {
  results?: KodikRelease[];
};

type KodikRelease = {
  id?: string;
  title?: string;
  title_orig?: string | null;
  link?: string | null;
  translation?: {
    title?: string | null;
  } | null;
  episodes_count?: number | null;
  last_episode?: number | null;
  seasons?: Record<string, { episodes?: Record<string, string | null> | null } | null> | null;
};

const ANILIBERTY_BASE_URL = 'https://anilibria.top';
const ANILIBERTY_API_URL = `${ANILIBERTY_BASE_URL}/api/v1`;
const KODIK_API_URL = 'https://kodik-api.com';
const ANILIBERTY_MIN_MATCH_SCORE = 70;

export async function findPlayerProviders(animeId: string, episodeNumber: number) {
  const anime = await prisma.anime.findUnique({
    where: { id: animeId },
    include: { providerMatches: true },
  });
  if (!anime) return null;

  const anilibriaMatch = anime.providerMatches.find((match) => match.provider === 'anilibria');
  let anilibriaResults: PlayerProviderResult[] = [];

  if (anilibriaMatch) {
    anilibriaResults = await fetchAniLibertyRelease(anilibriaMatch.providerTitleId, episodeNumber);
  } else {
    const animeQueries = getAnimeSearchTitles(anime);
    const autoMatch = await findAniLibriaMatch(animeQueries);

    if (autoMatch) {
      await prisma.providerMatch.upsert({
        where: {
          animeId_provider: {
            animeId: anime.id,
            provider: 'anilibria',
          },
        },
        update: {
          providerTitleId: autoMatch.providerTitleId,
          title: autoMatch.title,
          confidence: 'auto',
        },
        create: {
          animeId: anime.id,
          provider: 'anilibria',
          providerTitleId: autoMatch.providerTitleId,
          title: autoMatch.title,
          confidence: 'auto',
        },
      });
      anilibriaResults = await fetchAniLibertyRelease(autoMatch.providerTitleId, episodeNumber);
    } else {
      anilibriaResults = await searchAniLiberty(animeQueries, episodeNumber);
    }
  }
  const kodikResults = await searchKodik(anime, episodeNumber);

  return {
    anime,
    episodeNumber,
    providers: [...anilibriaResults, ...kodikResults],
  };
}

export async function findAniLibriaMatch(title: string, originalTitle: string | null): Promise<PlayerProviderResult | null>;
export async function findAniLibriaMatch(queries: string[]): Promise<PlayerProviderResult | null>;
export async function findAniLibriaMatch(titleOrQueries: string | string[], originalTitle?: string | null) {
  const queries = Array.isArray(titleOrQueries) ? titleOrQueries : uniqueStrings([originalTitle, titleOrQueries]);
  const candidates = await searchAniLibertyCandidates(queries);
  return candidates.find((candidate) => candidate.score >= ANILIBERTY_MIN_MATCH_SCORE)?.provider ?? null;
}

async function searchAniLiberty(queries: string[], episodeNumber: number): Promise<PlayerProviderResult[]> {
  const candidates = await searchAniLibertyCandidates(queries);
  const selected = candidates.filter((candidate) => candidate.score >= ANILIBERTY_MIN_MATCH_SCORE).slice(0, 5);
  const detailed = await Promise.all(
    selected.map((candidate) => fetchAniLibertyRelease(candidate.provider.providerTitleId, episodeNumber)),
  );

  return detailed.flat();
}

async function searchAniLibertyCandidates(queries: string[]) {
  const releasesByAlias = new Map<string, { release: AniLibertyRelease; score: number; order: number }>();

  for (const query of queries) {
    const releases = await fetchAniLibertySearch(query);
    releases.forEach((release, index) => {
      const providerTitleId = getReleaseProviderTitleId(release);
      if (!providerTitleId) return;

      const current = releasesByAlias.get(providerTitleId);
      const score = scoreAniLibertyRelease(release, queries);
      if (!current || score > current.score) {
        releasesByAlias.set(providerTitleId, { release, score, order: index });
      }
    });
  }

  return [...releasesByAlias.values()]
    .sort((left, right) => right.score - left.score || left.order - right.order)
    .map(({ release, score }) => ({
      provider: mapAniLibertyRelease(release, 1)[0],
      score,
    }))
    .filter((candidate) => candidate.provider);
}

async function fetchAniLibertySearch(query: string): Promise<AniLibertyRelease[]> {
  const url = new URL(`${ANILIBERTY_API_URL}/app/search/releases`);
  url.searchParams.set('query', query);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'AnimaAggregator/0.1',
      },
    });

    if (!response.ok) return [];

    return (await response.json()) as AniLibertyRelease[];
  } catch {
    return [];
  }
}

async function fetchAniLibertyRelease(idOrAlias: string, episodeNumber: number): Promise<PlayerProviderResult[]> {
  const releaseUrl = new URL(`${ANILIBERTY_API_URL}/anime/releases/${encodeURIComponent(idOrAlias)}`);
  const episodesUrl = new URL(`${ANILIBERTY_API_URL}/anime/releases/${encodeURIComponent(idOrAlias)}`);
  episodesUrl.searchParams.set('include', 'episodes');

  try {
    const [releaseResponse, episodesResponse] = await Promise.all([
      fetch(releaseUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'AnimaAggregator/0.1',
        },
      }),
      fetch(episodesUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'AnimaAggregator/0.1',
        },
      }),
    ]);

    if (!releaseResponse.ok) return [];

    const release = (await releaseResponse.json()) as AniLibertyRelease;
    const episodesPayload = episodesResponse.ok ? ((await episodesResponse.json()) as Pick<AniLibertyRelease, 'episodes'>) : {};

    return mapAniLibertyRelease({ ...release, episodes: episodesPayload.episodes ?? [] }, episodeNumber);
  } catch {
    return [];
  }
}

function mapAniLibertyRelease(release: AniLibertyRelease, episodeNumber: number): PlayerProviderResult[] {
  const providerTitleId = getReleaseProviderTitleId(release);
  if (!providerTitleId) return [];

  const episodeCount = release.episodes_total ?? release.episodes?.length ?? null;
  const stream = getEpisodeStream(release, episodeNumber);

  return [
    {
      provider: 'anilibria',
      providerTitleId,
      title: release.name?.main ?? release.name?.english ?? providerTitleId,
      originalTitle: release.name?.english ?? release.name?.alternative ?? null,
      posterUrl: buildAniLibertyUrl(
        release.poster?.optimized?.src ?? release.poster?.src ?? release.poster?.preview ?? release.poster?.thumbnail,
      ),
      watchUrl: release.alias
        ? `${ANILIBERTY_BASE_URL}/anime/releases/release/${release.alias}`
        : `${ANILIBERTY_BASE_URL}/anime/releases/${providerTitleId}`,
      episodeCount,
      requestedEpisode: episodeNumber,
      status: stream.url || episodeCount == null || episodeNumber <= episodeCount ? 'available' : 'unknown',
      streamUrl: stream.url,
      streamType: stream.url ? 'hls' : null,
      embedUrl: null,
      quality: stream.quality,
      note: 'AniLiberty: русская озвучка, доступность серий зависит от релиза провайдера.',
    },
  ];
}

async function searchKodik(anime: { title: string; originalTitle: string | null; shikimoriId: number | null }, episodeNumber: number) {
  const token = process.env.KODIK_TOKEN?.trim();
  if (!token) return [];

  const searches = uniqueStrings([anime.shikimoriId ? String(anime.shikimoriId) : null, anime.originalTitle, anime.title]);
  const resultsById = new Map<string, KodikRelease>();

  for (const query of searches) {
    const releases = await fetchKodikSearch(token, anime.shikimoriId ? { shikimoriId: anime.shikimoriId } : { title: query });
    releases.forEach((release, index) => {
      const id = release.id ?? release.link ?? `${query}-${index}`;
      if (!resultsById.has(id)) {
        resultsById.set(id, release);
      }
    });
    if (resultsById.size > 0 && anime.shikimoriId) break;
  }

  return [...resultsById.values()].slice(0, 5).map((release) => mapKodikRelease(release, episodeNumber)).filter(Boolean);
}

function getAnimeSearchTitles(anime: {
  title: string;
  originalTitle: string | null;
  titleRu?: string | null;
  titleEn?: string | null;
  titleJa?: string | null;
  titleRomaji?: string | null;
}) {
  return uniqueStrings([
    anime.titleRomaji,
    anime.originalTitle,
    anime.titleEn,
    anime.titleRu,
    anime.title,
    anime.titleJa,
  ]);
}

async function fetchKodikSearch(token: string, query: { shikimoriId?: number; title?: string }): Promise<KodikRelease[]> {
  const url = new URL(`${KODIK_API_URL}/search`);
  url.searchParams.set('token', token);
  url.searchParams.set('with_episodes', 'true');
  url.searchParams.set('limit', '8');
  url.searchParams.set('types', 'anime,anime-serial');

  if (query.shikimoriId) {
    url.searchParams.set('shikimori_id', String(query.shikimoriId));
  } else if (query.title) {
    url.searchParams.set('title', query.title);
  }

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'AnimaAggregator/0.1',
      },
    });

    if (!response.ok) return [];

    const payload = (await response.json()) as KodikSearchResponse;
    return payload.results ?? [];
  } catch {
    return [];
  }
}

function mapKodikRelease(release: KodikRelease, episodeNumber: number): PlayerProviderResult | null {
  const embedUrl = buildKodikUrl(getKodikEpisodeLink(release, episodeNumber) ?? release.link);
  if (!embedUrl) return null;

  return {
    provider: 'kodik',
    providerTitleId: release.id ?? embedUrl,
    title: release.title ?? release.title_orig ?? 'Kodik',
    originalTitle: release.title_orig ?? null,
    posterUrl: null,
    watchUrl: embedUrl,
    episodeCount: release.episodes_count ?? release.last_episode ?? null,
    requestedEpisode: episodeNumber,
    status: 'available',
    streamUrl: null,
    streamType: 'iframe',
    embedUrl,
    quality: null,
    note: release.translation?.title ? `Kodik: ${release.translation.title}` : 'Kodik',
  };
}

function getKodikEpisodeLink(release: KodikRelease, episodeNumber: number) {
  const seasons = Object.values(release.seasons ?? {});
  for (const season of seasons) {
    const link = season?.episodes?.[String(episodeNumber)];
    if (link) return link;
  }
  return null;
}

function buildKodikUrl(value: string | null | undefined) {
  if (!value) return null;
  if (value.startsWith('//')) return `https:${value}`;
  if (value.startsWith('http')) return value;
  return `https://${value}`;
}

function getEpisodeStream(release: AniLibertyRelease, episodeNumber: number) {
  const episode = release.episodes?.find((item) => item.ordinal === episodeNumber);
  const quality: 'fhd' | 'hd' | 'sd' | null = episode?.hls_1080
    ? 'fhd'
    : episode?.hls_720
      ? 'hd'
      : episode?.hls_480
        ? 'sd'
        : null;
  const url = quality === 'fhd' ? episode?.hls_1080 : quality === 'hd' ? episode?.hls_720 : episode?.hls_480;

  return { url: url ?? null, quality };
}

function scoreAniLibertyRelease(release: AniLibertyRelease, queries: string[]) {
  const names = uniqueStrings([
    release.name?.main,
    release.name?.english,
    release.name?.alternative,
    release.alias?.replaceAll('-', ' '),
  ]).map(normalizeTitle);
  const normalizedQueries = queries.map(normalizeTitle).filter(Boolean);

  let bestScore = 0;
  for (const query of normalizedQueries) {
    for (const name of names) {
      if (!query || !name) continue;
      if (query === name) bestScore = Math.max(bestScore, 100);
      else if (name.includes(query) || query.includes(name)) bestScore = Math.max(bestScore, 80);
      else bestScore = Math.max(bestScore, Math.round(tokenOverlap(query, name) * 60));
    }
  }

  return bestScore;
}

function tokenOverlap(left: string, right: string) {
  const leftTokens = new Set(left.split(' ').filter((token) => token.length > 2));
  const rightTokens = new Set(right.split(' ').filter((token) => token.length > 2));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  const matches = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return matches / Math.max(leftTokens.size, rightTokens.size);
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function getReleaseProviderTitleId(release: AniLibertyRelease) {
  if (release.alias) return release.alias;
  return release.id == null ? null : String(release.id);
}

function buildAniLibertyUrl(path: string | null | undefined) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${ANILIBERTY_BASE_URL}${path}`;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean))] as string[];
}
