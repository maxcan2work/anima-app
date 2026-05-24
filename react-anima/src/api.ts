import { createAnimaApiClient } from '@anima/api-client';

export type {
  CatalogSearchResult,
  CurrentUser,
  PlayerProviderResult,
  SaveAnimeProgressPayload,
  ServerAnime,
  ServerRandomHistoryEntry,
  ServerWatchEntry,
  ShikimoriImportResult,
} from '@anima/api-client';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

const api = createAnimaApiClient({ baseUrl: API_URL });

export function loginWithDiscord() {
  window.location.href = api.getDiscordAuthUrl();
}

export function connectShikimori() {
  window.location.href = api.getShikimoriAuthUrl();
}

export const {
  disconnectShikimori,
  importShikimoriList,
  logout,
  getCurrentUser,
  getMyAnimeList,
  getMyRandomHistory,
  clearMyRandomHistory,
  deleteRandomHistoryEntry,
  saveRandomHistoryEntry,
  getAnimeCatalog,
  getAnimeById,
  searchCatalog,
  browseCatalog,
  importCatalogAnime,
  saveAnimeProgress,
  getEpisodePlayers,
  checkWatchPartyRoom,
} = api;
