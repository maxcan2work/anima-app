export type WatchSource = {
  name: string;
  url: string;
  kind: 'streaming' | 'youtube';
  subtitles: string[];
  note: string;
};

export type AnimeTitle = {
  id: string;
  title: string;
  originalTitle: string;
  titleRu: string | null;
  titleEn: string | null;
  titleJa: string | null;
  titleRomaji: string | null;
  year: number;
  episodes: number;
  studio: string;
  rating: string;
  genres: string[];
  description: string;
  poster: string;
  backdrop: string;
  sampleEpisodeTitle: string;
  watchSources: WatchSource[];
};

export type ServerAnimeLike = {
  id: string;
  title: string;
  originalTitle: string | null;
  titleRu?: string | null;
  titleEn?: string | null;
  titleJa?: string | null;
  titleRomaji?: string | null;
  episodes: number;
  posterUrl: string | null;
  kind: string | null;
  studio?: string | null;
  genres: string | null;
  score: string | null;
  sourceUrl: string | null;
  airedOn: string | null;
};

export type CatalogSearchResultLike = {
  provider: 'shikimori';
  providerId: number;
  title: string;
  originalTitle: string;
  titleRu?: string | null;
  titleEn?: string | null;
  titleJa?: string | null;
  titleRomaji?: string | null;
  episodes: number;
  posterUrl: string | null;
  kind: string | null;
  score: string | null;
  status: string | null;
  malId: number | null;
  sourceUrl: string;
};

export type ServerRandomHistoryEntryLike = CatalogSearchResultLike & {
  id: string;
  updatedAt: string;
};

export type AnimeTitleLanguage = 'ru' | 'en' | 'ja';

export type LocalizedAnimeTitleLike = {
  title: string;
  originalTitle?: string | null;
  titleRu?: string | null;
  titleEn?: string | null;
  titleJa?: string | null;
  titleRomaji?: string | null;
};

const DEFAULT_POSTER_URL = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80';
const DEFAULT_BACKDROP_URL = 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=1600&q=80';

export function mapServerAnime(anime: ServerAnimeLike): AnimeTitle {
  const year = anime.airedOn ? Number(anime.airedOn.slice(0, 4)) : 0;

  return {
    id: anime.id,
    title: anime.title,
    originalTitle: anime.originalTitle ?? anime.title,
    titleRu: anime.titleRu ?? null,
    titleEn: anime.titleEn ?? null,
    titleJa: anime.titleJa ?? null,
    titleRomaji: anime.titleRomaji ?? anime.originalTitle ?? null,
    year: Number.isFinite(year) && year > 0 ? year : new Date().getFullYear(),
    episodes: anime.episodes || 1,
    studio: anime.studio || '-',
    rating: anime.score ?? '-',
    genres: parseAnimeGenres(anime.genres, anime.kind),
    description: '',
    poster: anime.posterUrl ?? DEFAULT_POSTER_URL,
    backdrop: DEFAULT_BACKDROP_URL,
    sampleEpisodeTitle: 'Просмотр',
    watchSources: anime.sourceUrl
      ? [
          {
            name: 'Shikimori',
            url: anime.sourceUrl,
            kind: 'streaming',
            subtitles: ['метаданные'],
            note: 'Страница тайтла в каталоге Shikimori.',
          },
        ]
      : [],
  };
}

export const mapServerAnimeToTitle = mapServerAnime;

export function parseAnimeGenres(value: string | null | undefined, fallback: string | null | undefined) {
  if (value) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        const genres = parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
        if (genres.length > 0) return genres;
      }
    } catch {
      return [fallback ?? 'Аниме'];
    }
  }

  return [fallback ?? 'Аниме'];
}

export function mapRandomHistoryEntry<T extends ServerRandomHistoryEntryLike>(entry: T): CatalogSearchResultLike {
  return {
    provider: entry.provider,
    providerId: entry.providerId,
    title: entry.title,
    originalTitle: entry.originalTitle,
    titleRu: entry.titleRu ?? null,
    titleEn: entry.titleEn ?? null,
    titleJa: entry.titleJa ?? null,
    titleRomaji: entry.titleRomaji ?? null,
    episodes: entry.episodes,
    posterUrl: entry.posterUrl,
    kind: entry.kind,
    score: entry.score,
    status: entry.status,
    malId: entry.malId,
    sourceUrl: entry.sourceUrl,
  };
}

export function mergeAnimeLibrary(current: AnimeTitle[], incoming: AnimeTitle[]) {
  const byId = new Map(current.map((anime) => [anime.id, anime]));
  for (const anime of incoming) {
    byId.set(anime.id, anime);
  }

  return [...byId.values()].sort((a, b) => a.title.localeCompare(b.title, 'ru'));
}

export function getLocalizedAnimeTitle(anime: LocalizedAnimeTitleLike, language: AnimeTitleLanguage) {
  if (language === 'ru') {
    return firstTitle(anime.titleRu, anime.title, anime.titleRomaji, anime.titleEn, anime.titleJa, anime.originalTitle);
  }

  if (language === 'ja') {
    return firstTitle(anime.titleJa, anime.titleRomaji, anime.originalTitle, anime.titleEn, anime.titleRu, anime.title);
  }

  return firstTitle(anime.titleEn, anime.titleRomaji, anime.originalTitle, anime.titleRu, anime.titleJa, anime.title);
}

export function getAnimeOriginalDisplayTitle(anime: LocalizedAnimeTitleLike, language: AnimeTitleLanguage) {
  const primary = getLocalizedAnimeTitle(anime, language);
  const secondary = firstTitle(anime.titleRomaji, anime.titleEn, anime.titleJa, anime.titleRu, anime.originalTitle, anime.title);
  return secondary === primary ? '' : secondary;
}

function firstTitle(...titles: Array<string | null | undefined>) {
  return titles.map((title) => title?.trim()).find(Boolean) ?? '';
}

export function upsertDiaryEntry<T extends { id: string }>(entries: T[], entry: T) {
  const exists = entries.some((item) => item.id === entry.id);
  if (!exists) {
    return [entry, ...entries];
  }

  return entries.map((item) => (item.id === entry.id ? entry : item));
}
