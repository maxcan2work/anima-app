import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fromServerWatchStatus } from '@anima/core';
import type { CatalogSearchResult } from '../../api';
import type { AnimeTitle } from '../../data';
import { useAuth } from '../auth/AuthProvider';
import { useCatalog } from '../catalog/CatalogProvider';
import { useNavigation } from '../navigation/NavigationProvider';
import { useAnimeLibrary } from '../../hooks/useAnimeLibrary';
import { useWatchProgress } from '../../hooks/useWatchProgress';
import { loadWatchState, type WatchState } from '../../shared/storage';

type WatchLibraryContextValue = {
  library: AnimeTitle[];
  displayedSelected: AnimeTitle | null;
  routeAnimeLoading: boolean;
  watchState: Record<string, WatchState>;
  openCatalogAnime: (anime: CatalogSearchResult) => void;
  updateWatchState: (animeId: string, patch: Partial<WatchState>) => void;
  refreshLibrary: () => Promise<void>;
};

const WatchLibraryContext = createContext<WatchLibraryContextValue | null>(null);

export function WatchLibraryProvider({ children }: { children: ReactNode }) {
  const [watchState, setWatchState] = useState<Record<string, WatchState>>(loadWatchState);
  const {
    user,
    authStatus,
    diaryEntries,
    libraryRefreshKey,
    setDiaryEntries,
  } = useAuth();
  const { browseResults, searchResults } = useCatalog();
  const {
    routeAnimeId,
    displayedRouteAnimeId,
    requestAnimeRoute,
    setView,
  } = useNavigation();
  const catalogCandidates = useMemo(
    () => [...searchResults, ...browseResults],
    [browseResults, searchResults],
  );
  const {
    library,
    displayedSelected,
    routeAnimeLoading,
    openCatalogAnime,
    refreshLibrary,
  } = useAnimeLibrary({
    routeAnimeId,
    displayedRouteAnimeId,
    catalogCandidates,
    requestAnimeRoute,
    setView,
  });
  const { updateState } = useWatchProgress({ library, user, setWatchState, setDiaryEntries });

  useEffect(() => {
    if (authStatus === 'loading') return;

    if (!user) {
      setWatchState(loadWatchState());
      return;
    }

    setWatchState(
      diaryEntries.reduce<Record<string, WatchState>>((acc, entry) => {
        acc[entry.animeId] = {
          episode: entry.currentEpisode,
          status: fromServerWatchStatus(entry.status),
        };
        return acc;
      }, {}),
    );
  }, [authStatus, diaryEntries, user]);

  useEffect(() => {
    if (libraryRefreshKey === 0) return;
    refreshLibrary();
  }, [libraryRefreshKey, refreshLibrary]);

  return (
    <WatchLibraryContext.Provider
      value={{
        library,
        displayedSelected,
        routeAnimeLoading,
        watchState,
        openCatalogAnime,
        updateWatchState: updateState,
        refreshLibrary,
      }}
    >
      {children}
    </WatchLibraryContext.Provider>
  );
}

export function useWatchLibrary() {
  const context = useContext(WatchLibraryContext);
  if (!context) {
    throw new Error('useWatchLibrary must be used inside WatchLibraryProvider');
  }
  return context;
}
