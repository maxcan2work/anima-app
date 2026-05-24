import { useEffect, useState } from 'react';
import {
  connectShikimori,
  getAnimeById,
  getAnimeCatalog,
  importCatalogAnime,
  loginWithDiscord,
  saveAnimeProgress,
  searchCatalog,
  type CatalogSearchResult,
} from './api';
import { type AnimeTitle } from './data';
import { useAppNavigation } from './hooks/useAppNavigation';
import { useAuthSession } from './hooks/useAuthSession';
import { useCatalogBrowse } from './hooks/useCatalogBrowse';
import { useRandomAnime } from './hooks/useRandomAnime';
import { useScreenTransition } from './hooks/useScreenTransition';
import { useToast } from './hooks/useToast';
import { AnimeHero } from './pages/anime/AnimeHero';
import { ProfilePage } from './pages/profile/ProfilePage';
import { RandomAnimePage } from './pages/random/RandomAnimePage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { WatchPartyPage } from './pages/watch-party/WatchPartyPage';
import { EmptyCatalog, WatchHome } from './pages/watch/WatchHome';
import { mapServerAnime, mergeAnimeLibrary, upsertDiaryEntry } from './shared/animeMappers';
import {
  animeRouteFromCatalog,
  animeRouteSlug,
  findAnimeByRoute,
  findCatalogResultByRoute,
  getRouteAnimeId,
  getWatchPartyCodeFromPath,
  parseShikimoriRouteId,
  type AppView,
} from './shared/navigation';
import { loadSidebarCollapsed, loadWatchState, saveSidebarCollapsed, saveWatchState, type WatchState } from './shared/storage';
import { AppSidebar } from './widgets/app-sidebar/AppSidebar';

export function App() {
  const [library, setLibrary] = useState<AnimeTitle[]>([]);
  const [selectedId, setSelectedId] = useState('');
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
  const [syncStatus, setSyncStatus] = useState('');
  const { toast, setToast } = useToast();
  const {
    watchPartyCode,
    watchPartyCreateCode,
    watchPartyLeaveTarget,
    watchPartyLeaveModalClosing,
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

  const selected = library.find((anime) => anime.id === selectedId) ?? library[0] ?? null;
  const displayedSelected = displayedRouteAnimeId ? findAnimeByRoute(library, displayedRouteAnimeId) ?? selected : selected;

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

  function openCatalogAnime(result: CatalogSearchResult) {
    requestAnimeRoute(animeRouteFromCatalog(result));
  }

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
          : findCatalogResultByRoute([...catalogSearchResults, ...browseResults, ...randomHistory], routeAnimeId) ??
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
  }, [browseResults, catalogSearchResults, library, randomHistory, routeAnimeId]);

  async function handleImportCatalogAnime(result: CatalogSearchResult) {
    try {
      const response = await importCatalogAnime(result.provider, result.providerId);
      const anime = mapServerAnime(response.anime);
      setLibrary((current) => mergeAnimeLibrary(current, [anime]));
      setSelectedId(anime.id);
      requestAnimeRoute(`/anime/${encodeURIComponent(animeRouteSlug(anime))}`);
    } catch {
      console.warn('Failed to import catalog anime');
    }
  }

  function updateState(id: string, patch: Partial<WatchState>) {
    setWatchState((current) => {
      const anime = library.find((item) => item.id === id);
      if (!anime) return current;
      const previous = current[id] ?? { episode: 1, status: 'planned' };
      const nextEpisode = Math.min(Math.max(patch.episode ?? previous.episode, 1), anime?.episodes ?? 1);
      const nextEntry = {
        ...previous,
        ...patch,
        episode: nextEpisode,
      };
      const next = {
        ...current,
        [id]: nextEntry,
      };

      if (user) {
        setSyncStatus('Сохраняем...');
        saveAnimeProgress(id, {
          status: nextEntry.status,
          currentEpisode: nextEntry.episode,
        })
          .then(({ entry }) => {
            setDiaryEntries((entries) => upsertDiaryEntry(entries, entry));
            setSyncStatus('Сохранено в профиле');
          })
          .catch(() => setSyncStatus('Не удалось сохранить'));
      } else {
        saveWatchState(next);
        setSyncStatus('Сохранено локально');
      }

      return next;
    });
  }

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
            onToast={setToast}
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
            onToast={setToast}
          />
        )}
        </div>
      </section>
      {watchPartyLeaveTarget ? (
        <div
          className={watchPartyLeaveModalClosing ? 'modal-backdrop closing' : 'modal-backdrop'}
          role="presentation"
          onClick={closeWatchPartyLeaveModal}
        >
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="leave-watch-party-title" onClick={(event) => event.stopPropagation()}>
            <h3 id="leave-watch-party-title">Покинуть совместный просмотр?</h3>
            <p>Чтобы перейти в другой раздел, нужно выйти из комнаты. Текущий совместный просмотр будет отключен для тебя.</p>
            <div className="confirm-modal-actions">
              <button className="text-button" type="button" onClick={closeWatchPartyLeaveModal} disabled={watchPartyLeaveModalClosing}>
                Остаться
              </button>
              <button className="danger-button" type="button" onClick={confirmLeaveWatchParty} disabled={watchPartyLeaveModalClosing}>
                Выйти и перейти
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {toast ? <div className="app-toast">{toast}</div> : null}
    </main>
  );
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
