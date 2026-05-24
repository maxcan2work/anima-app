import { useCallback, useEffect, useRef, useState } from 'react';
import {
  browseCatalog,
  connectShikimori,
  clearMyRandomHistory,
  deleteRandomHistoryEntry,
  getAnimeById,
  getAnimeCatalog,
  getMyRandomHistory,
  importCatalogAnime,
  loginWithDiscord,
  saveRandomHistoryEntry,
  saveAnimeProgress,
  searchCatalog,
  type CatalogSearchResult,
} from './api';
import { type AnimeTitle } from './data';
import { useAuthSession } from './hooks/useAuthSession';
import { useCatalogBrowse } from './hooks/useCatalogBrowse';
import { AnimeHero } from './pages/anime/AnimeHero';
import { ProfilePage } from './pages/profile/ProfilePage';
import { RandomAnimePage } from './pages/random/RandomAnimePage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { WatchPartyPage } from './pages/watch-party/WatchPartyPage';
import { EmptyCatalog, WatchHome } from './pages/watch/WatchHome';
import {
  mapRandomHistoryEntry,
  mapServerAnime,
  mergeAnimeLibrary,
  upsertDiaryEntry,
} from './shared/animeMappers';
import {
  animeRouteFromCatalog,
  animeRouteSlug,
  findAnimeByRoute,
  findCatalogResultByRoute,
  getRouteAnimeId,
  getViewFromPath,
  getWatchPartyCodeFromPath,
  navigateToRemembered,
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
  const [randomAnime, setRandomAnime] = useState<CatalogSearchResult | null>(null);
  const [randomHistory, setRandomHistory] = useState<CatalogSearchResult[]>([]);
  const [randomLoading, setRandomLoading] = useState(false);
  const [randomStatus, setRandomStatus] = useState('');
  const [randomClearing, setRandomClearing] = useState(false);
  const [deletingRandomKey, setDeletingRandomKey] = useState('');
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
    onLogoutCleanup: () => {
      setRandomHistory([]);
      setRandomAnime(null);
    },
  });
  const [syncStatus, setSyncStatus] = useState('');
  const [toast, setToast] = useState('');
  const [watchPartyCode, setWatchPartyCode] = useState(getWatchPartyCodeFromPath(window.location.pathname));
  const [watchPartyCreateCode, setWatchPartyCreateCode] = useState('');
  const [watchPartyLeaveTarget, setWatchPartyLeaveTarget] = useState<{ path: string; view: AppView } | null>(null);
  const [watchPartyLeaveModalClosing, setWatchPartyLeaveModalClosing] = useState(false);
  const [view, setView] = useState<AppView>(() => getViewFromPath(window.location.pathname));
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(loadSidebarCollapsed);
  const lastWatchPathRef = useRef(window.location.pathname.startsWith('/anime') ? window.location.pathname : '/anime');
  const scrollByPathRef = useRef<Record<string, number>>({});
  const [screenAnimation, setScreenAnimation] = useState<'idle' | 'leaving' | 'entering'>('idle');
  const screenKey = `${view}:${currentPath}`;
  const [displayedScreenKey, setDisplayedScreenKey] = useState(screenKey);
  const displayedScreenDivider = displayedScreenKey.indexOf(':');
  const displayedView = displayedScreenKey.slice(0, displayedScreenDivider) as AppView;
  const displayedPath = displayedScreenKey.slice(displayedScreenDivider + 1);
  const displayedRouteAnimeId = getRouteAnimeId(displayedPath);
  const routeAnimeId = getRouteAnimeId(currentPath);

  const selected = library.find((anime) => anime.id === selectedId) ?? library[0] ?? null;
  const displayedSelected = displayedRouteAnimeId ? findAnimeByRoute(library, displayedRouteAnimeId) ?? selected : selected;

  useEffect(() => {
    function handlePopState() {
      setCurrentPath((current) => {
        scrollByPathRef.current[current] = window.scrollY;
        return window.location.pathname;
      });
      const nextView = getViewFromPath(window.location.pathname);
      if (nextView === 'watch') {
        lastWatchPathRef.current = window.location.pathname;
      }
      setWatchPartyCode(getWatchPartyCodeFromPath(window.location.pathname));
      setView(nextView);
    }

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    saveSidebarCollapsed(sidebarCollapsed);
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => setToast(''), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (displayedScreenKey === screenKey) return;

    setScreenAnimation('leaving');
    const enterTimer = window.setTimeout(() => {
      setDisplayedScreenKey(screenKey);
      setScreenAnimation('entering');
    }, 120);
    const idleTimer = window.setTimeout(() => setScreenAnimation('idle'), 300);

    return () => {
      window.clearTimeout(enterTimer);
      window.clearTimeout(idleTimer);
    };
  }, [displayedScreenKey, screenKey]);

  useEffect(() => {
    if (currentPath.startsWith('/anime')) {
      lastWatchPathRef.current = currentPath;
    }

  }, [currentPath]);

  useEffect(() => {
    if (authStatus === 'loading' || user || currentPath !== '/profile') return;

    const path = '/anime';
    setCurrentPath((current) => {
      scrollByPathRef.current[current] = window.scrollY;
      if (window.location.pathname !== path) {
        window.history.replaceState(null, '', path);
      }
      return path;
    });
    setView('watch');
  }, [authStatus, currentPath, user]);

  useEffect(() => {
    if (!user) return;
    let ignore = false;

    async function loadRandomHistory() {
      try {
        const { history } = await getMyRandomHistory();
        if (!ignore) {
          setRandomHistory(history.map(mapRandomHistoryEntry));
        }
      } catch {
        if (!ignore) {
          setRandomHistory([]);
        }
      }
    }

    loadRandomHistory();

    return () => {
      ignore = true;
    };
  }, [user]);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: scrollByPathRef.current[displayedPath] ?? 0 });
    });
  }, [displayedPath]);

  function requestRoute(path: string, nextView: AppView) {
    if (watchPartyCode && nextView !== 'watchParty') {
      setWatchPartyLeaveTarget({ path, view: nextView });
      return;
    }

    navigateToRemembered(path, setCurrentPath, scrollByPathRef);
    setView(nextView);
  }

  function requestAnimeRoute(path: string) {
    requestRoute(path, 'watch');
  }

  function openCatalogAnime(result: CatalogSearchResult) {
    requestAnimeRoute(animeRouteFromCatalog(result));
  }

  const openWatchParty = useCallback((path: string) => {
    setWatchPartyCode(getWatchPartyCodeFromPath(path));
    navigateToRemembered(path, setCurrentPath, scrollByPathRef);
    setView('watchParty');
  }, []);

  const consumeWatchPartyCreate = useCallback(() => {
    setWatchPartyCreateCode('');
  }, []);

  const leaveWatchParty = useCallback(() => {
    const path = '/watch-party';
    setWatchPartyCode('');
    setWatchPartyCreateCode('');
    setWatchPartyLeaveTarget(null);
    setWatchPartyLeaveModalClosing(false);
    setCurrentPath((current) => {
      scrollByPathRef.current[current] = window.scrollY;
      if (window.location.pathname !== path) {
        window.history.replaceState(null, '', path);
      }
      return path;
    });
    setView('watchParty');
  }, []);

  function requestWatchView() {
    const nextPath = view === 'watch' && routeAnimeId ? '/anime' : lastWatchPathRef.current;
    requestAnimeRoute(nextPath);
  }

  function closeWatchPartyLeaveModal() {
    if (watchPartyLeaveModalClosing) return;
    setWatchPartyLeaveModalClosing(true);
    window.setTimeout(() => {
      setWatchPartyLeaveTarget(null);
      setWatchPartyLeaveModalClosing(false);
    }, 140);
  }

  function confirmLeaveWatchParty() {
    if (watchPartyLeaveModalClosing) return;
    const target = watchPartyLeaveTarget ?? { path: '/anime', view: 'watch' as AppView };
    setWatchPartyLeaveTarget(null);
    setWatchPartyLeaveModalClosing(false);
    setWatchPartyCode('');
    setCurrentPath((current) => {
      scrollByPathRef.current[current] = window.scrollY;
      if (window.location.pathname !== target.path) {
        window.history.replaceState(null, '', target.path);
      }
      return target.path;
    });
    setView(target.view);
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

  async function handleRandomAnime() {
    setRandomLoading(true);
    setRandomStatus('');

    try {
      const page = Math.floor(Math.random() * 20) + 1;
      const response = await browseCatalog(page, 'ranked_random');
      const candidates = response.results.filter((item) => item.posterUrl);
      const pool = candidates.length > 0 ? candidates : response.results;
      const next = pool[Math.floor(Math.random() * pool.length)];

      if (!next) {
        setRandomStatus('Shikimori не вернул тайтлы для рандома.');
        return;
      }

      setRandomAnime(next);
      setRandomHistory((current) => {
        const withoutDuplicate = current.filter((item) => item.providerId !== next.providerId);
        return [next, ...withoutDuplicate].slice(0, 10);
      });

      if (user) {
        saveRandomHistoryEntry(next)
          .then(({ entry }) => {
            const saved = mapRandomHistoryEntry(entry);
            setRandomHistory((current) => {
              const withoutDuplicate = current.filter((item) => item.providerId !== saved.providerId);
              return [saved, ...withoutDuplicate].slice(0, 10);
            });
          })
          .catch(() => setRandomStatus('Случайный тайтл показан, но историю не удалось сохранить.'));
      }
    } catch {
      setRandomStatus('Не удалось получить случайное аниме.');
    } finally {
      setRandomLoading(false);
    }
  }

  async function handleClearRandomHistory() {
    if (randomHistory.length === 0 || randomClearing) return;

    setRandomClearing(true);
    setRandomStatus('');

    try {
      if (user) {
        await clearMyRandomHistory();
      }
      setRandomHistory([]);
    } catch {
      setRandomStatus('Не удалось очистить историю.');
    } finally {
      setRandomClearing(false);
    }
  }

  async function handleDeleteRandomHistoryEntry(entry: CatalogSearchResult) {
    const key = `${entry.provider}-${entry.providerId}`;
    if (deletingRandomKey) return;

    setDeletingRandomKey(key);
    setRandomStatus('');

    try {
      if (user) {
        await deleteRandomHistoryEntry(entry.provider, entry.providerId);
      }
      setRandomHistory((current) => current.filter((item) => `${item.provider}-${item.providerId}` !== key));
    } catch {
      setRandomStatus('Не удалось удалить запись из истории.');
    } finally {
      setDeletingRandomKey('');
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
