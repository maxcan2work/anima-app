export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export type CurrentUser = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
};

export type ServerWatchEntry = {
  id: string;
  animeId: string;
  status: 'PLANNED' | 'WATCHING' | 'COMPLETED' | 'DROPPED';
  currentEpisode: number;
  score: number | null;
  startedAt: string | null;
  completedAt: string | null;
  review: string | null;
  updatedAt: string;
  anime?: {
    id: string;
    title: string;
    originalTitle: string | null;
    episodes: number;
    posterUrl: string | null;
  };
};

export type PlayerProviderResult = {
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

export type ServerAnime = {
  id: string;
  title: string;
  originalTitle: string | null;
  episodes: number;
  posterUrl: string | null;
  shikimoriId: number | null;
  malId: number | null;
  kind: string | null;
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
  episodes: number;
  posterUrl: string | null;
  kind: string | null;
  score: string | null;
  status: string | null;
  malId: number | null;
  sourceUrl: string;
};

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
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
}

export function loginWithDiscord() {
  window.location.href = `${API_URL}/auth/discord`;
}

export async function logout() {
  await apiFetch<void>('/logout', { method: 'POST' });
}

export async function getCurrentUser() {
  return apiFetch<{ user: CurrentUser }>('/me');
}

export async function getMyAnimeList() {
  return apiFetch<{ list: ServerWatchEntry[] }>('/me/anime');
}

export async function getAnimeCatalog() {
  return apiFetch<{ anime: ServerAnime[] }>('/anime');
}

export async function searchCatalog(query: string) {
  return apiFetch<{ results: CatalogSearchResult[] }>(`/catalog/search?q=${encodeURIComponent(query)}`);
}

export async function importCatalogAnime(provider: CatalogSearchResult['provider'], providerId: number) {
  return apiFetch<{ anime: ServerAnime }>('/catalog/import', {
    method: 'POST',
    body: JSON.stringify({ provider, providerId }),
  });
}

export type SaveAnimeProgressPayload = {
  status: string;
  currentEpisode: number;
  score?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  review?: string | null;
};

export async function saveAnimeProgress(animeId: string, payload: SaveAnimeProgressPayload) {
  return apiFetch<{ entry: ServerWatchEntry }>(`/me/anime/${animeId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function getEpisodePlayers(animeId: string, episodeNumber: number) {
  return apiFetch<{ providers: PlayerProviderResult[] }>(`/anime/${animeId}/episodes/${episodeNumber}/players`);
}
