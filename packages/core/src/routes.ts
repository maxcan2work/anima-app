import type { AnimeTitle, CatalogSearchResultLike } from './anime.js';

export type AppView = 'watch' | 'profile' | 'random' | 'settings' | 'watchParty';

export function getRouteAnimeId(pathname: string) {
  if (pathname === '/anime') return '';
  const match = pathname.match(/^\/anime\/([^/]+)(?:\/reviews(?:\/[^/]+)?)?$/);
  return match?.[1] ? decodeURIComponent(match[1]) : '';
}

export function getViewFromPath(pathname: string): AppView {
  if (pathname === '/profile' || pathname.startsWith('/profile/')) return 'profile';
  if (pathname === '/random') return 'random';
  if (pathname === '/settings') return 'settings';
  if (pathname === '/watch-party' || pathname.startsWith('/watch-party/')) return 'watchParty';
  return 'watch';
}

export function getProfileIdFromPath(pathname: string) {
  const match = pathname.match(/^\/profile\/([^/]+)$/);
  return match?.[1] ? decodeURIComponent(match[1]) : '';
}

export function profileRoute(profileId: string) {
  return `/profile/${encodeURIComponent(profileId)}`;
}

export function getWatchPartyCodeFromPath(pathname: string) {
  const match = pathname.match(/^\/watch-party\/([^/]+)$/);
  return match?.[1] ? normalizeWatchPartyCode(decodeURIComponent(match[1])) : '';
}

export function normalizeWatchPartyCode(value: string) {
  return value.replace(/[^a-z0-9]/gi, '').slice(0, 12).toUpperCase();
}

export function parseShikimoriRouteId(animeId: string) {
  const match = animeId.match(/^shikimori-(\d+)$/);
  return match ? Number(match[1]) : null;
}

export function animeRouteFromCatalog(result: CatalogSearchResultLike) {
  return `/anime/${catalogRouteSlug(result)}`;
}

export function animeRouteSlug(anime: AnimeTitle) {
  return slugifyAnimeTitle(anime.originalTitle || anime.title || anime.id);
}

export function catalogRouteSlug(result: CatalogSearchResultLike) {
  return slugifyAnimeTitle(result.originalTitle || result.title || `${result.provider}-${result.providerId}`);
}

export function findAnimeByRoute(library: AnimeTitle[], routeId: string) {
  return library.find((anime) => anime.id === routeId || animeRouteSlug(anime) === routeId) ?? null;
}

export function findCatalogResultByRoute<T extends CatalogSearchResultLike>(results: T[], routeId: string) {
  return results.find((result) => catalogRouteSlug(result) === routeId) ?? null;
}

export function slugifyAnimeTitle(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
