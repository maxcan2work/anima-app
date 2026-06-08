export type CurrentUser = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  integrations: {
    shikimori: {
      id: string;
      nickname: string;
      avatarUrl: string | null;
      profileUrl: string;
      connectedAt: string;
    } | null;
  };
};

export type ServerWatchEntry = {
  id: string;
  animeId: string;
  status: 'PLANNED' | 'WATCHING' | 'COMPLETED' | 'DROPPED';
  currentEpisode: number;
  score: number | null;
  rewatches: number;
  startedAt: string | null;
  completedAt: string | null;
  review: string | null;
  createdAt: string;
  updatedAt: string;
  anime?: {
    id: string;
    title: string;
    originalTitle: string | null;
    titleRu: string | null;
    titleEn: string | null;
    titleJa: string | null;
    titleRomaji: string | null;
    episodes: number;
    posterUrl: string | null;
  };
};

export type PlayerProviderResult = {
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

export type ServerAnime = {
  id: string;
  title: string;
  originalTitle: string | null;
  titleRu: string | null;
  titleEn: string | null;
  titleJa: string | null;
  titleRomaji: string | null;
  episodes: number;
  posterUrl: string | null;
  shikimoriId: number | null;
  malId: number | null;
  kind: string | null;
  studio: string | null;
  genres: string | null;
  score: string | null;
  status: string | null;
  sourceUrl: string | null;
  airedOn: string | null;
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
  studio: string | null;
  genres: string[];
  description: string | null;
  score: string | null;
  status: string | null;
  malId: number | null;
  sourceUrl: string;
  airedOn: string | null;
};

export type CatalogGenre = {
  id: number;
  name: string;
  titleRu: string | null;
  kind: string | null;
};

export type AnimeExtendedDetails = {
  similar: CatalogSearchResult[];
  characters: Array<{
    id: number | null;
    name: string;
    imageUrl: string | null;
    url: string | null;
    roles: string[];
  }>;
  people: Array<{
    id: number | null;
    name: string;
    imageUrl: string | null;
    url: string | null;
    roles: string[];
  }>;
  screenshots: Array<{
    originalUrl: string;
    previewUrl: string;
  }>;
};

export type ServerRandomHistoryEntry = CatalogSearchResult & {
  id: string;
  updatedAt: string;
};

export type SaveAnimeProgressPayload = {
  status: string;
  currentEpisode: number;
  score?: number | null;
  rewatches?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  review?: string | null;
};

export type AnimeReviewScores = {
  story: number;
  characters: number;
  visuals: number;
  music: number;
  opening: number;
  atmosphere: number;
};

export type AnimeReview = {
  id: string;
  animeId: string;
  userId: string;
  author: string;
  avatarUrl: string | null;
  avatarLabel: string;
  watched: number;
  reviewsCount: number;
  helpfulCount: number;
  likes: number;
  dislikes: number;
  createdAt: string;
  updatedAt: string;
  recommended: boolean;
  hasSpoilers: boolean;
  score: number;
  scores: AnimeReviewScores;
  title: string;
  excerpt: string;
  body: string;
};

export type SaveAnimeReviewPayload = {
  title: string;
  body: string;
  score: number;
  recommended: boolean;
  hasSpoilers: boolean;
  scores: AnimeReviewScores;
};

export type ShikimoriImportResult = {
  imported: number;
  updated: number;
  skipped: number;
  total: number;
  errors?: Array<{ shikimoriId: number | null; reason: string }>;
};

export type CatalogRequestOptions = {
  playableProvider?: 'anilibria';
  kind?: string;
  status?: string;
  scoredOnly?: boolean;
  season?: string;
  genre?: string;
  score?: string;
  rating?: string;
};

export type AnimaApiClientOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
};

export type PublicWatchPartyRoom = {
  code: string;
  name: string;
  participantCount: number;
  maxParticipants: number;
  passwordProtected: boolean;
  hasStarted: boolean;
};

export function createAnimaApiClient({ baseUrl, fetchImpl = fetch }: AnimaApiClientOptions) {
  const apiFetch = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  };

  return {
    getDiscordAuthUrl: () => `${baseUrl}/auth/discord`,
    getShikimoriAuthUrl: () => `${baseUrl}/auth/shikimori`,
    disconnectShikimori: () => apiFetch<void>('/me/integrations/shikimori', { method: 'DELETE' }),
    importShikimoriList: () => apiFetch<ShikimoriImportResult>('/me/integrations/shikimori/import', { method: 'POST' }),
    logout: () => apiFetch<void>('/logout', { method: 'POST' }),
    getCurrentUser: () => apiFetch<{ user: CurrentUser }>('/me'),
    getMyAnimeList: () => apiFetch<{ list: ServerWatchEntry[] }>('/me/anime'),
    getMyRandomHistory: () => apiFetch<{ history: ServerRandomHistoryEntry[] }>('/me/random-history'),
    clearMyRandomHistory: () => apiFetch<void>('/me/random-history', { method: 'DELETE' }),
    deleteRandomHistoryEntry: (provider: CatalogSearchResult['provider'], providerId: number) =>
      apiFetch<void>(`/me/random-history/${encodeURIComponent(provider)}/${providerId}`, { method: 'DELETE' }),
    saveRandomHistoryEntry: (entry: CatalogSearchResult) =>
      apiFetch<{ entry: ServerRandomHistoryEntry }>('/me/random-history', {
        method: 'POST',
        body: JSON.stringify(entry),
      }),
    getAnimeCatalog: () => apiFetch<{ anime: ServerAnime[] }>('/anime'),
    getAnimeById: (animeId: string) => apiFetch<{ anime: ServerAnime }>(`/anime/${animeId}`),
    getAnimeExtendedDetails: (animeId: string) => apiFetch<{ details: AnimeExtendedDetails }>(`/anime/${animeId}/details`),
    getAnimeReviews: (animeId: string) => apiFetch<{ reviews: AnimeReview[] }>(`/anime/${animeId}/reviews`),
    getAnimeReview: (animeId: string, reviewId: string) =>
      apiFetch<{ review: AnimeReview }>(`/anime/${animeId}/reviews/${encodeURIComponent(reviewId)}`),
    saveAnimeReview: (animeId: string, payload: SaveAnimeReviewPayload) =>
      apiFetch<{ review: AnimeReview }>(`/anime/${animeId}/reviews`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getCatalogAnimeDetails: (provider: CatalogSearchResult['provider'], providerId: number) =>
      apiFetch<{ anime: CatalogSearchResult }>(`/catalog/${encodeURIComponent(provider)}/${providerId}`),
    getCatalogGenres: () => apiFetch<{ genres: CatalogGenre[] }>('/catalog/genres'),
    searchCatalog: (query: string, options: CatalogRequestOptions = {}) =>
      apiFetch<{ results: CatalogSearchResult[] }>(`/catalog/search?${catalogSearchParams({
        q: query,
        playableProvider: options.playableProvider,
        kind: options.kind,
        status: options.status,
        scoredOnly: options.scoredOnly ? 'true' : undefined,
        season: options.season,
        genre: options.genre,
        score: options.score,
        rating: options.rating,
      })}`),
    browseCatalog: (page: number, order = 'popularity', options: CatalogRequestOptions = {}) =>
      apiFetch<{
        page: number;
        limit: number;
        order: string;
        filters?: {
          kind?: string;
          status?: string;
          scoredOnly: boolean;
          season?: string;
          genre?: string;
          score?: string;
          rating?: string;
        };
        hasNextPage: boolean;
        results: CatalogSearchResult[];
      }>(`/catalog/browse?${catalogSearchParams({
        page,
        limit: 18,
        order,
        playableProvider: options.playableProvider,
        kind: options.kind,
        status: options.status,
        scoredOnly: options.scoredOnly ? 'true' : undefined,
        season: options.season,
        genre: options.genre,
        score: options.score,
        rating: options.rating,
      })}`),
    importCatalogAnime: (provider: CatalogSearchResult['provider'], providerId: number) =>
      apiFetch<{ anime: ServerAnime }>('/catalog/import', {
        method: 'POST',
        body: JSON.stringify({ provider, providerId }),
      }),
    saveAnimeProgress: (animeId: string, payload: SaveAnimeProgressPayload) =>
      apiFetch<{ entry: ServerWatchEntry }>(`/me/anime/${animeId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    deleteAnimeProgress: (animeId: string) =>
      apiFetch<void>(`/me/anime/${animeId}`, { method: 'DELETE' }),
    getEpisodePlayers: (animeId: string, episodeNumber: number) =>
      apiFetch<{ providers: PlayerProviderResult[] }>(`/anime/${animeId}/episodes/${episodeNumber}/players`),
    checkWatchPartyRoom: (code: string) =>
      apiFetch<{ exists: boolean; requiresPassword: boolean }>(`/watch-party/${encodeURIComponent(code)}`),
    getPublicWatchPartyRooms: () =>
      apiFetch<{ rooms: PublicWatchPartyRoom[] }>('/watch-party'),
  };
}

function catalogSearchParams(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') continue;
    searchParams.set(key, String(value));
  }

  return searchParams.toString();
}

export type AnimaApiClient = ReturnType<typeof createAnimaApiClient>;
