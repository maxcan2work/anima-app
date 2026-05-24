import { useEffect, useMemo, useRef, useState } from 'react';
import {
  connectShikimori,
  loginWithDiscord,
} from './api';
import { useAppNavigation } from './hooks/useAppNavigation';
import { useAnimeLibrary } from './hooks/useAnimeLibrary';
import { useAuthSession } from './hooks/useAuthSession';
import { useCatalogBrowse } from './hooks/useCatalogBrowse';
import { useRandomAnime } from './hooks/useRandomAnime';
import { useScreenTransition } from './hooks/useScreenTransition';
import { useWatchProgress } from './hooks/useWatchProgress';
import { AnimeHero } from './pages/anime/AnimeHero';
import { ProfilePage } from './pages/profile/ProfilePage';
import { RandomAnimePage } from './pages/random/RandomAnimePage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { WatchPartyPage } from './pages/watch-party/WatchPartyPage';
import { EmptyCatalog, WatchHome } from './pages/watch/WatchHome';
import { mapServerAnime } from './shared/animeMappers';
import { getRouteAnimeId, getWatchPartyCodeFromPath, type AppView } from './shared/navigation';
import { loadSidebarCollapsed, loadWatchState, saveSidebarCollapsed, type WatchState } from './shared/storage';
import { ModalProvider, useConfirmModal } from './shared/ui/ModalProvider';
import { ToastProvider, useToast } from './shared/ui/ToastProvider';
import { AppSidebar } from './widgets/app-sidebar/AppSidebar';

export function App() {
  return (
    <ModalProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ModalProvider>
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
  const confirm = useConfirmModal();
  const leaveConfirmOpenRef = useRef(false);
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
  const {
    user,
    authStatus,
    diaryEntries,
    setDiaryEntries,
    handleLogout,
    handleDisconnectShikimori,
    handleImportShikimoriList,
  } = useAuthSession({
    setWatchState,
    setLibrary,
    onLogoutCleanup: () => clearRandomState(),
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
    clearRandomState,
  } = useRandomAnime(user);
  const { updateState } = useWatchProgress({ library, user, setWatchState, setDiaryEntries });
  const toast = useToast();

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

  useEffect(() => {
    if (!watchPartyLeaveTarget || leaveConfirmOpenRef.current) return;

    leaveConfirmOpenRef.current = true;
    confirm({
      title: 'Покинуть совместный просмотр?',
      content: <p>Чтобы перейти в другой раздел, нужно выйти из комнаты. Текущий совместный просмотр будет отключен для тебя.</p>,
      cancelLabel: 'Остаться',
      confirmLabel: 'Выйти и перейти',
      confirmVariant: 'danger',
    }).then((confirmed) => {
      leaveConfirmOpenRef.current = false;
      if (confirmed) {
        confirmLeaveWatchParty();
      } else {
        closeWatchPartyLeaveModal();
      }
    });
  }, [closeWatchPartyLeaveModal, confirm, confirmLeaveWatchParty, watchPartyLeaveTarget]);

  return (
    <main className={sidebarCollapsed ? 'app-shell sidebar-collapsed' : 'app-shell'}>
      <AppSidebar
        view={view}
        collapsed={sidebarCollapsed}
        user={user}
        authStatus={authStatus}
        onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
        onOpenWatch={requestWatchView}
        onOpenRandom={() => requestRoute('/random', 'random')}
        onOpenWatchParty={() => openWatchParty(watchPartyCode ? `/watch-party/${watchPartyCode}` : '/watch-party')}
        onOpenSettings={() => requestRoute('/settings', 'settings')}
        onLogin={loginWithDiscord}
        onOpenProfile={() => {
          requestRoute('/profile', 'profile');
        }}
      />

      <section className="watch-area">
        <div className={`screen-transition ${screenAnimation}`}>
        {displayedView === 'random' ? (
          <RandomAnimePage
            randomAnime={randomAnime}
            history={randomHistory}
            loading={randomLoading}
            status={randomStatus}
            clearing={randomClearing}
            deletingKey={deletingRandomKey}
            onOpenAnime={openCatalogAnime}
            onRandomize={handleRandomAnime}
            onClearHistory={handleClearRandomHistory}
            onDeleteHistoryEntry={handleDeleteRandomHistoryEntry}
          />
        ) : displayedView === 'watchParty' ? (
          <WatchPartyPage
            code={getWatchPartyCodeFromPath(displayedPath)}
            createRoom={watchPartyCreateCode === getWatchPartyCodeFromPath(displayedPath)}
            user={user}
            onCreateRoom={(code) => {
              setWatchPartyCreateCode(code);
              openWatchParty(`/watch-party/${code}`);
            }}
            onJoinRoom={(code) => openWatchParty(`/watch-party/${code}`)}
            onLeaveRoom={leaveWatchParty}
            onCreateRoomConsumed={consumeWatchPartyCreate}
            onToast={toast}
            mapServerAnime={mapServerAnime}
            renderAnimeHero={(props) => <AnimeHero {...props} />}
          />
        ) : displayedView === 'settings' ? (
          <SettingsPage />
        ) : displayedView === 'watch' && !displayedRouteAnimeId ? (
          <WatchHome
            browseResults={browseResults}
            browsePage={browsePage}
            browseHasNext={browseHasNext}
            browseLoading={browseLoading}
            browseStatus={browseStatus}
            searchQuery={catalogSearchQuery}
            searchResults={catalogSearchResults}
            searchLoading={catalogSearchLoading}
            searchStatus={catalogSearchStatus}
            onSearchChange={setCatalogSearchQuery}
            onOpenAnime={openCatalogAnime}
            onPageChange={setBrowsePage}
          />
        ) : !displayedSelected ? (
          <EmptyCatalog />
        ) : displayedView === 'watch' ? (
          <AnimeHero
            anime={displayedSelected}
            state={watchState[displayedSelected.id] ?? { episode: 1, status: 'planned' }}
            onStateChange={(patch) => updateState(displayedSelected.id, patch)}
          />
        ) : (
          <ProfilePage
            user={user}
            authStatus={authStatus}
            entries={diaryEntries}
            onLogin={loginWithDiscord}
            onLogout={handleLogout}
            onConnectShikimori={connectShikimori}
            onDisconnectShikimori={handleDisconnectShikimori}
            onImportShikimori={handleImportShikimoriList}
            onToast={toast}
          />
        )}
        </div>
      </section>
    </main>
  );
}
