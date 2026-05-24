import type { CatalogSearchResult, ServerAnime, ServerRandomHistoryEntry, ServerWatchEntry } from '../api';
import type { AnimeTitle } from '../data';

export function mapServerAnime(anime: ServerAnime): AnimeTitle {
  const year = anime.airedOn ? Number(anime.airedOn.slice(0, 4)) : 0;

  return {
    id: anime.id,
    title: anime.title,
    originalTitle: anime.originalTitle ?? anime.title,
    year: Number.isFinite(year) && year > 0 ? year : new Date().getFullYear(),
    episodes: anime.episodes || 1,
    studio: anime.sourceUrl ? 'Shikimori' : 'Anima',
    rating: anime.score ?? '-',
    genres: parseAnimeGenres(anime.genres, anime.kind),
    description: '',
    poster: anime.posterUrl ?? 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80',
    backdrop: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=1600&q=80',
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

export function mapRandomHistoryEntry(entry: ServerRandomHistoryEntry): CatalogSearchResult {
  return {
    provider: entry.provider,
    providerId: entry.providerId,
    title: entry.title,
    originalTitle: entry.originalTitle,
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

export function upsertDiaryEntry(entries: ServerWatchEntry[], entry: ServerWatchEntry) {
  const exists = entries.some((item) => item.id === entry.id);
  if (!exists) {
    return [entry, ...entries];
  }

  return entries.map((item) => (item.id === entry.id ? entry : item));
}
