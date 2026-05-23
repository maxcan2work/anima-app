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

export type SubtitleTrack = {
  id: string;
  url: string;
  lang: string;
  label: string;
};

export type VideoSource = {
  id: string;
  type: 'MP4' | 'WEBM' | 'HLS' | 'YOUTUBE' | 'EXTERNAL';
  url: string;
  label: string;
  audioLang: string;
  quality: string | null;
  subtitles: SubtitleTrack[];
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

export async function getEpisodeSources(animeId: string, episodeNumber: number) {
  return apiFetch<{ sources: VideoSource[] }>(`/anime/${animeId}/episodes/${episodeNumber}/sources`);
}

export type AddVideoSourcePayload = {
  type: VideoSource['type'];
  url: string;
  label: string;
  audioLang: string;
  quality?: string;
  subtitles: Array<{
    url: string;
    lang: string;
    label: string;
  }>;
};

export async function addEpisodeSource(animeId: string, episodeNumber: number, payload: AddVideoSourcePayload) {
  return apiFetch<{ source: VideoSource }>(`/anime/${animeId}/episodes/${episodeNumber}/sources`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
