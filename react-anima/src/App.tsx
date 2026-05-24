import { useEffect, useMemo, useState } from 'react';
import { fromServerWatchStatus } from '@anima/core';
import { AppProviders } from './app/AppProviders';
import { AppScreens } from './app/AppScreens';
import { useAuth } from './features/auth/AuthProvider';
import { useNavigation } from './features/navigation/NavigationProvider';
import { useAnimeLibrary } from './hooks/useAnimeLibrary';
import { useCatalogBrowse } from './hooks/useCatalogBrowse';
import { useRandomAnime } from './hooks/useRandomAnime';
import { useWatchProgress } from './hooks/useWatchProgress';
import { loadSidebarCollapsed, loadWatchState, saveSidebarCollapsed, type WatchState } from './shared/storage';
import { AppSidebar } from './widgets/app-sidebar/AppSidebar';

export function App() {
  return (
    <AppProviders>
      <AppContent />
    </AppProviders>
  );
}

function AppContent() {
  const [watchState, setWatchState] = useState<Record<string, WatchState>>(loadWatchState);
  const {
    user,
    authStatus,
    diaryEntries,
    libraryRefreshKey,
    setDiaryEntries,
  } = useAuth();
  const {
    browseResults,
    browsePage,
    browseHasNext,
    browseLoading,
    browseStatus,
    catalogSearchQuery,
    catalogSearchResults,
    catalogSearchLoading,
    catalogSearchStatus,
    setBrowsePage,
    setCatalogSearchQuery,
  } = useCatalogBrowse();
  const {
    currentPath,
    routeAnimeId,
    setView,
    requestAnimeRoute,
    redirectToWatchRoot,
    displayedRouteAnimeId,
    screenAnimation,
  } = useNavigation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(loadSidebarCollapsed);
  const catalogCandidates = useMemo(
    () => [...catalogSearchResults, ...browseResults],
    [browseResults, catalogSearchResults],
  );
  const {
    library,
    displayedSelected,
    openCatalogAnime,
    refreshLibrary,
  } = useAnimeLibrary({
    routeAnimeId,
    displayedRouteAnimeId,
    catalogCandidates,
    requestAnimeRoute,
    setView,
  });
  const {
    randomAnime,
    randomHistory,
    randomLoading,
    randomStatus,
    randomClearing,
    deletingRandomKey,
    handleRandomAnime,
    handleClearRandomHistory,
    handleDeleteRandomHistoryEntry,
  } = useRandomAnime(user);
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

  useEffect(() => {
    saveSidebarCollapsed(sidebarCollapsed);
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (authStatus === 'loading' || user || currentPath !== '/profile') return;
    redirectToWatchRoot();
  }, [authStatus, currentPath, redirectToWatchRoot, user]);

  return (
    <main className={sidebarCollapsed ? 'app-shell sidebar-collapsed' : 'app-shell'}>
      <AppSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
      />

      <section className="watch-area">
        <div className={`screen-transition ${screenAnimation}`}>
          <AppScreens
            displayedSelected={displayedSelected}
            watchState={watchState}
            browseResults={browseResults}
            browsePage={browsePage}
            browseHasNext={browseHasNext}
            browseLoading={browseLoading}
            browseStatus={browseStatus}
            catalogSearchQuery={catalogSearchQuery}
            catalogSearchResults={catalogSearchResults}
            catalogSearchLoading={catalogSearchLoading}
            catalogSearchStatus={catalogSearchStatus}
            randomAnime={randomAnime}
            randomHistory={randomHistory}
            randomLoading={randomLoading}
            randomStatus={randomStatus}
            randomClearing={randomClearing}
            deletingRandomKey={deletingRandomKey}
            onOpenAnime={openCatalogAnime}
            onRandomize={handleRandomAnime}
            onClearRandomHistory={handleClearRandomHistory}
            onDeleteRandomHistoryEntry={handleDeleteRandomHistoryEntry}
            onSearchChange={setCatalogSearchQuery}
            onBrowsePageChange={setBrowsePage}
            onWatchStateChange={updateState}
          />
        </div>
      </section>
    </main>
  );
}
