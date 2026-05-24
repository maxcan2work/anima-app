import { useEffect, useMemo, useState } from 'react';
import type { CatalogSearchResult } from './api';
import { AppProviders } from './app/AppProviders';
import { AppScreens } from './app/AppScreens';
import { AuthProvider, useAuth } from './features/auth/AuthProvider';
import { useAppNavigation } from './hooks/useAppNavigation';
import { useAnimeLibrary } from './hooks/useAnimeLibrary';
import { useCatalogBrowse } from './hooks/useCatalogBrowse';
import { useRandomAnime } from './hooks/useRandomAnime';
import { useScreenTransition } from './hooks/useScreenTransition';
import { useWatchProgress } from './hooks/useWatchProgress';
import { useWatchPartyLeaveGuard } from './hooks/useWatchPartyLeaveGuard';
import type { AnimeTitle } from './data';
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
    setLibrary,
    displayedSelected,
    openCatalogAnime,
  } = useAnimeLibrary({
    routeAnimeId,
    displayedRouteAnimeId,
    catalogCandidates,
    requestAnimeRoute,
    setView,
  });
  return (
    <AuthProvider setWatchState={setWatchState} setLibrary={setLibrary}>
      <AppShell
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
        setBrowsePage={setBrowsePage}
        setCatalogSearchQuery={setCatalogSearchQuery}
        watchPartyCode={watchPartyCode}
        watchPartyCreateCode={watchPartyCreateCode}
        watchPartyLeaveTarget={watchPartyLeaveTarget}
        view={view}
        currentPath={currentPath}
        displayedView={displayedView}
        displayedPath={displayedPath}
        displayedRouteAnimeId={displayedRouteAnimeId}
        displayedSelected={displayedSelected}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        screenAnimation={screenAnimation}
        library={library}
        openCatalogAnime={openCatalogAnime}
        setWatchPartyCreateCode={setWatchPartyCreateCode}
        requestRoute={requestRoute}
        openWatchParty={openWatchParty}
        consumeWatchPartyCreate={consumeWatchPartyCreate}
        leaveWatchParty={leaveWatchParty}
        requestWatchView={requestWatchView}
        closeWatchPartyLeaveModal={closeWatchPartyLeaveModal}
        confirmLeaveWatchParty={confirmLeaveWatchParty}
        redirectToWatchRoot={redirectToWatchRoot}
        restoreScroll={restoreScroll}
        setWatchState={setWatchState}
      />
    </AuthProvider>
  );
}

type AppShellProps = {
  watchState: Record<string, WatchState>;
  browseResults: CatalogSearchResult[];
  browsePage: number;
  browseHasNext: boolean;
  browseLoading: boolean;
  browseStatus: string;
  catalogSearchQuery: string;
  catalogSearchResults: CatalogSearchResult[];
  catalogSearchLoading: boolean;
  catalogSearchStatus: string;
  setBrowsePage: (page: number) => void;
  setCatalogSearchQuery: (query: string) => void;
  watchPartyCode: string;
  watchPartyCreateCode: string;
  watchPartyLeaveTarget: { path: string; view: AppView } | null;
  view: AppView;
  currentPath: string;
  displayedView: AppView;
  displayedPath: string;
  displayedRouteAnimeId: string;
  displayedSelected: AnimeTitle | null;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (updater: boolean | ((current: boolean) => boolean)) => void;
  screenAnimation: string;
  library: AnimeTitle[];
  openCatalogAnime: (anime: CatalogSearchResult) => void;
  setWatchPartyCreateCode: (code: string) => void;
  requestRoute: (path: string, nextView: AppView) => void;
  openWatchParty: (path: string) => void;
  consumeWatchPartyCreate: () => void;
  leaveWatchParty: () => void;
  requestWatchView: () => void;
  closeWatchPartyLeaveModal: () => void;
  confirmLeaveWatchParty: () => void;
  redirectToWatchRoot: () => void;
  restoreScroll: (path: string) => void;
  setWatchState: (updater: (current: Record<string, WatchState>) => Record<string, WatchState>) => void;
};

function AppShell({
  watchState,
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
  watchPartyCode,
  watchPartyCreateCode,
  watchPartyLeaveTarget,
  view,
  currentPath,
  displayedView,
  displayedPath,
  displayedRouteAnimeId,
  displayedSelected,
  sidebarCollapsed,
  setSidebarCollapsed,
  screenAnimation,
  library,
  openCatalogAnime,
  setWatchPartyCreateCode,
  requestRoute,
  openWatchParty,
  consumeWatchPartyCreate,
  leaveWatchParty,
  requestWatchView,
  closeWatchPartyLeaveModal,
  confirmLeaveWatchParty,
  redirectToWatchRoot,
  restoreScroll,
  setWatchState,
}: AppShellProps) {
  const { user, authStatus, setDiaryEntries } = useAuth();
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
