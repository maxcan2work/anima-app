import { useEffect, useMemo, useState } from 'react';
import { fromServerWatchStatus } from '@anima/core';
import { AppProviders } from './app/AppProviders';
import { AppScreens } from './app/AppScreens';
import { useAuth } from './features/auth/AuthProvider';
import { useAppNavigation } from './hooks/useAppNavigation';
import { useAnimeLibrary } from './hooks/useAnimeLibrary';
import { useCatalogBrowse } from './hooks/useCatalogBrowse';
import { useRandomAnime } from './hooks/useRandomAnime';
import { useScreenTransition } from './hooks/useScreenTransition';
import { useWatchProgress } from './hooks/useWatchProgress';
import { useWatchPartyLeaveGuard } from './hooks/useWatchPartyLeaveGuard';
import { getRouteAnimeId, type AppView } from './shared/navigation';
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
    watchPartyCode,
    watchPartyCreateCode,
    watchPartyLeaveTarget,
    view,
    currentPath,
    routeAnimeId,
    setView,
    setWatchPartyCreateCode,
    requestRoute,
    requestAnimeRoute,
    openWatchParty,
    consumeWatchPartyCreate,
    leaveWatchParty,
    requestWatchView,
    closeWatchPartyLeaveModal,
    confirmLeaveWatchParty,
    redirectToWatchRoot,
    restoreScroll,
  } = useAppNavigation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(loadSidebarCollapsed);
  const screenKey = `${view}:${currentPath}`;
  const { screenAnimation, displayedScreenKey } = useScreenTransition(screenKey);
  const displayedScreenDivider = displayedScreenKey.indexOf(':');
  const displayedView = displayedScreenKey.slice(0, displayedScreenDivider) as AppView;
  const displayedPath = displayedScreenKey.slice(displayedScreenDivider + 1);
  const displayedRouteAnimeId = getRouteAnimeId(displayedPath);
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

  useEffect(() => {
    restoreScroll(displayedPath);
  }, [displayedPath, restoreScroll]);

  useWatchPartyLeaveGuard({
    active: Boolean(watchPartyLeaveTarget),
    onConfirm: confirmLeaveWatchParty,
    onCancel: closeWatchPartyLeaveModal,
  });

  return (
    <main className={sidebarCollapsed ? 'app-shell sidebar-collapsed' : 'app-shell'}>
      <AppSidebar
        view={view}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
        onOpenWatch={requestWatchView}
        onOpenRandom={() => requestRoute('/random', 'random')}
        onOpenWatchParty={() => openWatchParty(watchPartyCode ? `/watch-party/${watchPartyCode}` : '/watch-party')}
        onOpenSettings={() => requestRoute('/settings', 'settings')}
        onOpenProfile={() => {
          requestRoute('/profile', 'profile');
        }}
      />

      <section className="watch-area">
        <div className={`screen-transition ${screenAnimation}`}>
          <AppScreens
            displayedView={displayedView}
            displayedPath={displayedPath}
            displayedRouteAnimeId={displayedRouteAnimeId}
            displayedSelected={displayedSelected}
            watchState={watchState}
            watchPartyCreateCode={watchPartyCreateCode}
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
            onCreateWatchParty={(code) => {
              setWatchPartyCreateCode(code);
              openWatchParty(`/watch-party/${code}`);
            }}
            onJoinWatchParty={(code) => openWatchParty(`/watch-party/${code}`)}
            onLeaveWatchParty={leaveWatchParty}
            onCreateWatchPartyConsumed={consumeWatchPartyCreate}
            onSearchChange={setCatalogSearchQuery}
            onBrowsePageChange={setBrowsePage}
            onWatchStateChange={updateState}
          />
        </div>
      </section>
    </main>
  );
}
