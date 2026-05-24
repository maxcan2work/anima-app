import { useCallback, useEffect, useMemo, useState } from 'react';
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
  const [routeAnimeLoading, setRouteAnimeLoading] = useState(false);
  const selected = library.find((anime) => anime.id === selectedId) ?? library[0] ?? null;
  const displayedSelected = displayedRouteAnimeId ? findAnimeByRoute(library, displayedRouteAnimeId) ?? selected : selected;

  const refreshLibrary = useCallback(async () => {
    try {
      const response = await getAnimeCatalog();
      const loaded = mergeAnimeLibrary([], response.anime.map(mapServerAnime));
      setLibrary(loaded);
      setSelectedId((current) => current || loaded[0]?.id || '');
    } catch {
      console.warn('Failed to load local catalog');
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    refreshLibrary().catch(() => {
      if (!ignore) {
        console.warn('Failed to load local catalog');
      }
    });

    return () => {
      ignore = true;
    };
  }, [refreshLibrary]);

  useEffect(() => {
    if (!routeAnimeId) return;
    let ignore = false;

    async function loadRouteAnime() {
      const localAnime = findAnimeByRoute(library, routeAnimeId);
      if (localAnime) {
        setSelectedId(localAnime.id);
        setView('watch');
        setRouteAnimeLoading(false);
        return;
      }

      setRouteAnimeLoading(true);
      try {
        const response = await getAnimeById(routeAnimeId);
        if (ignore) return;

        const anime = mapServerAnime(response.anime);
        setLibrary((current) => mergeAnimeLibrary(current, [anime]));
        setSelectedId(anime.id);
        setView('watch');
        setRouteAnimeLoading(false);
      } catch {
        const shikimoriId = parseShikimoriRouteId(routeAnimeId);
        const catalogMatch = shikimoriId
          ? null
          : findCatalogResultByRoute(catalogCandidates, routeAnimeId) ??
            (await findCatalogResultBySearch(routeAnimeId));
        const providerId = shikimoriId ?? catalogMatch?.providerId;
        if (!providerId) {
          setRouteAnimeLoading(false);
          return;
        }

        try {
          const response = await importCatalogAnime('shikimori', providerId);
          if (ignore) return;

          const anime = mapServerAnime(response.anime);
          setLibrary((current) => mergeAnimeLibrary(current, [anime]));
          setSelectedId(anime.id);
          setView('watch');
          setRouteAnimeLoading(false);
        } catch {
          if (!ignore) {
            console.warn('Failed to open anime route');
            setRouteAnimeLoading(false);
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
      refreshLibrary,
      selected,
      displayedSelected,
      routeAnimeLoading,
      openCatalogAnime: (result: CatalogSearchResult) => requestAnimeRoute(animeRouteFromCatalog(result)),
    }),
    [displayedSelected, library, refreshLibrary, requestAnimeRoute, routeAnimeLoading, selected],
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
