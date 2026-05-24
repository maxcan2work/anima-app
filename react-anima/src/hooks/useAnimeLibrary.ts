import { useEffect, useMemo, useState } from 'react';
import { getAnimeById, getAnimeCatalog, importCatalogAnime, searchCatalog, type CatalogSearchResult } from '../api';
import type { AnimeTitle } from '../data';
import { mapServerAnime, mergeAnimeLibrary } from '../shared/animeMappers';
import {
  animeRouteFromCatalog,
  findAnimeByRoute,
  findCatalogResultByRoute,
  parseShikimoriRouteId,
  type AppView,
} from '../shared/navigation';

type UseAnimeLibraryOptions = {
  routeAnimeId: string;
  displayedRouteAnimeId: string;
  catalogCandidates: CatalogSearchResult[];
  requestAnimeRoute: (path: string) => void;
  setView: (view: AppView) => void;
};

export function useAnimeLibrary({
  routeAnimeId,
  displayedRouteAnimeId,
  catalogCandidates,
  requestAnimeRoute,
  setView,
}: UseAnimeLibraryOptions) {
  const [library, setLibrary] = useState<AnimeTitle[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const selected = library.find((anime) => anime.id === selectedId) ?? library[0] ?? null;
  const displayedSelected = displayedRouteAnimeId ? findAnimeByRoute(library, displayedRouteAnimeId) ?? selected : selected;

  useEffect(() => {
    let ignore = false;

    async function loadCatalog() {
      try {
        const response = await getAnimeCatalog();
        if (ignore) return;

        const loaded = mergeAnimeLibrary([], response.anime.map(mapServerAnime));
        setLibrary(loaded);
        setSelectedId((current) => current || loaded[0]?.id || '');
      } catch {
        if (!ignore) {
          console.warn('Failed to load local catalog');
        }
      }
    }

    loadCatalog();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!routeAnimeId) return;
    let ignore = false;

    async function loadRouteAnime() {
      const localAnime = findAnimeByRoute(library, routeAnimeId);
      if (localAnime) {
        setSelectedId(localAnime.id);
        setView('watch');
        return;
      }

      try {
        const response = await getAnimeById(routeAnimeId);
        if (ignore) return;

        const anime = mapServerAnime(response.anime);
        setLibrary((current) => mergeAnimeLibrary(current, [anime]));
        setSelectedId(anime.id);
        setView('watch');
      } catch {
        const shikimoriId = parseShikimoriRouteId(routeAnimeId);
        const catalogMatch = shikimoriId
          ? null
          : findCatalogResultByRoute(catalogCandidates, routeAnimeId) ??
            (await findCatalogResultBySearch(routeAnimeId));
        const providerId = shikimoriId ?? catalogMatch?.providerId;
        if (!providerId) return;

        try {
          const response = await importCatalogAnime('shikimori', providerId);
          if (ignore) return;

          const anime = mapServerAnime(response.anime);
          setLibrary((current) => mergeAnimeLibrary(current, [anime]));
          setSelectedId(anime.id);
          setView('watch');
        } catch {
          if (!ignore) {
            console.warn('Failed to open anime route');
          }
        }
      }
    }

    loadRouteAnime();

    return () => {
      ignore = true;
    };
  }, [catalogCandidates, library, routeAnimeId, setView]);

  const api = useMemo(
    () => ({
      library,
      setLibrary,
      selected,
      displayedSelected,
      openCatalogAnime: (result: CatalogSearchResult) => requestAnimeRoute(animeRouteFromCatalog(result)),
    }),
    [displayedSelected, library, requestAnimeRoute, selected],
  );

  return api;
}

async function findCatalogResultBySearch(routeId: string) {
  const query = routeId.replace(/-/g, ' ');
  try {
    const response = await searchCatalog(query);
    return findCatalogResultByRoute(response.results, routeId) ?? response.results[0] ?? null;
  } catch {
    return null;
  }
}
