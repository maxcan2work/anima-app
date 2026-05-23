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

export async function saveAnimeProgress(animeId: string, payload: { status: string; currentEpisode: number }) {
  return apiFetch<{ entry: ServerWatchEntry }>(`/me/anime/${animeId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
