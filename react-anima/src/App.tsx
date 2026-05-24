import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MutableRefObject, type ReactNode } from 'react';
import Hls from 'hls.js';
import { io, type Socket } from 'socket.io-client';
import copyIcon from './assets/copy.svg';
import crownIcon from './assets/crown.svg';
import discordIcon from './assets/discord.svg';
import detachIcon from './assets/detach.svg';
import episodeArrowIcon from './assets/episode-arrow.svg';
import importIcon from './assets/import.svg';
import kickIcon from './assets/kick.svg';
import leaveRoomIcon from './assets/leave-room.svg';
import musicNoteIcon from './assets/music-note.svg';
import nekoIcon from './assets/neko.svg';
import profileCheckIcon from './assets/profile-check.svg';
import profileEyeIcon from './assets/profile-eye.svg';
import profileNoteIcon from './assets/profile-note.svg';
import randomDiceIcon from './assets/random-dice.svg';
import sidebarExpandIcon from './assets/sidebar-expand.svg';
import sidebarShrinkIcon from './assets/sidebar-shrink.svg';
import settingsIcon from './assets/settings.svg';
import shikimoriIcon from './assets/shikimori.png';
import trashIcon from './assets/trash.svg';
import watchPartyIcon from './assets/watch-party.svg';
import {
  API_URL,
  browseCatalog,
  checkWatchPartyRoom,
  connectShikimori,
  clearMyRandomHistory,
  disconnectShikimori,
  deleteRandomHistoryEntry,
  getAnimeById,
  getCurrentUser,
  getAnimeCatalog,
  getEpisodePlayers,
  getMyAnimeList,
  getMyRandomHistory,
  importShikimoriList,
  importCatalogAnime,
  loginWithDiscord,
  logout,
  saveRandomHistoryEntry,
  saveAnimeProgress,
  searchCatalog,
  type CatalogSearchResult,
  type CurrentUser,
  type PlayerProviderResult,
  type ServerRandomHistoryEntry,
  type ServerAnime,
  type ServerWatchEntry,
} from './api';
import { type AnimeTitle } from './data';

type WatchState = {
  episode: number;
  status: 'planned' | 'watching' | 'completed' | 'dropped';
};

type PlayerProvider = PlayerProviderResult['provider'];
type AppView = 'watch' | 'profile' | 'random' | 'settings' | 'watchParty';
type WatchPartyParticipant = {
  id: string;
  name: string;
  avatarUrl: string | null;
  isHost: boolean;
};
type WatchPartyRoomState = {
  participants: WatchPartyParticipant[];
  selectedAnime: ServerAnime | null;
  episode: number;
};

const STORAGE_KEY = 'anima.watchState.v1';
const SIDEBAR_STORAGE_KEY = 'anima.sidebarCollapsed.v1';
const EPISODES_PER_PAGE = 12;
const PLAYER_PROVIDER_OPTIONS: Array<{ value: PlayerProvider; label: string }> = [
  { value: 'kodik', label: 'Kodik' },
  { value: 'anilibria', label: 'AniLiberty' },
];
const WATCH_STATUS_OPTIONS: Array<{ value: WatchState['status']; label: string }> = [
  { value: 'planned', label: 'В планах' },
  { value: 'watching', label: 'Смотрю' },
  { value: 'completed', label: 'Просмотрено' },
  { value: 'dropped', label: 'Брошено' },
];

function loadWatchState(): Record<string, WatchState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveWatchState(value: Record<string, WatchState>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function loadSidebarCollapsed() {
  return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
}

function saveSidebarCollapsed(value: boolean) {
  localStorage.setItem(SIDEBAR_STORAGE_KEY, String(value));
}

export function App() {
  const [library, setLibrary] = useState<AnimeTitle[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [watchState, setWatchState] = useState<Record<string, WatchState>>(loadWatchState);
  const [diaryEntries, setDiaryEntries] = useState<ServerWatchEntry[]>([]);
  const [browseResults, setBrowseResults] = useState<CatalogSearchResult[]>([]);
  const [browsePage, setBrowsePage] = useState(1);
  const [browseHasNext, setBrowseHasNext] = useState(true);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseStatus, setBrowseStatus] = useState('Загружаем каталог Shikimori...');
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [catalogSearchResults, setCatalogSearchResults] = useState<CatalogSearchResult[]>([]);
  const [catalogSearchLoading, setCatalogSearchLoading] = useState(false);
  const [catalogSearchStatus, setCatalogSearchStatus] = useState('');
  const [randomAnime, setRandomAnime] = useState<CatalogSearchResult | null>(null);
  const [randomHistory, setRandomHistory] = useState<CatalogSearchResult[]>([]);
  const [randomLoading, setRandomLoading] = useState(false);
  const [randomStatus, setRandomStatus] = useState('');
  const [randomClearing, setRandomClearing] = useState(false);
  const [deletingRandomKey, setDeletingRandomKey] = useState('');
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [authStatus, setAuthStatus] = useState<'loading' | 'guest' | 'ready'>('loading');
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

  useEffect(() => {
    let ignore = false;

    async function loadBrowse() {
      setBrowseLoading(true);
      setBrowseStatus(browsePage === 1 ? 'Загружаем каталог Shikimori...' : '');
      try {
        const response = await browseCatalog(browsePage);
        if (ignore) return;

        setBrowseResults((current) => {
          const next = browsePage === 1 ? response.results : [...current, ...response.results];
          const seen = new Set<number>();
          return next.filter((item) => {
            if (seen.has(item.providerId)) return false;
            seen.add(item.providerId);
            return true;
          });
        });
        setBrowseHasNext(response.hasNextPage);
        setBrowseStatus('');
      } catch {
        if (!ignore) {
          setBrowseResults([]);
          setBrowseStatus('Не удалось загрузить каталог Shikimori.');
        }
      } finally {
        if (!ignore) {
          setBrowseLoading(false);
        }
      }
    }

    loadBrowse();

    return () => {
      ignore = true;
    };
  }, [browsePage]);

  useEffect(() => {
    const query = catalogSearchQuery.trim();

    if (query.length < 2) {
      setCatalogSearchResults([]);
      setCatalogSearchLoading(false);
      setCatalogSearchStatus('');
      return;
    }

    let ignore = false;
    setCatalogSearchLoading(true);
    setCatalogSearchStatus('');

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await searchCatalog(query);
        if (ignore) return;

        setCatalogSearchResults(response.results);
        setCatalogSearchStatus(response.results.length ? '' : 'Ничего не найдено.');
      } catch {
        if (!ignore) {
          setCatalogSearchResults([]);
          setCatalogSearchStatus('Не удалось выполнить поиск.');
        }
      } finally {
        if (!ignore) {
          setCatalogSearchLoading(false);
        }
      }
    }, 350);

    return () => {
      ignore = true;
      window.clearTimeout(timeoutId);
    };
  }, [catalogSearchQuery]);

  useEffect(() => {
    let ignore = false;

    async function loadSession() {
      try {
        const [{ user: currentUser }, { list }, { history }] = await Promise.all([
          getCurrentUser(),
          getMyAnimeList(),
          getMyRandomHistory(),
        ]);
        if (ignore) return;

        const serverState = list.reduce<Record<string, WatchState>>((acc, entry) => {
          acc[entry.animeId] = {
            episode: entry.currentEpisode,
            status: fromServerStatus(entry.status),
          };
          return acc;
        }, {});

        setUser(currentUser);
        setWatchState(serverState);
        setDiaryEntries(list);
        setRandomHistory(history.map(mapRandomHistoryEntry));
        setAuthStatus('ready');
      } catch {
        if (!ignore) {
          setAuthStatus('guest');
        }
      }
    }

    loadSession();

    return () => {
      ignore = true;
    };
  }, []);

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

  async function handleLogout() {
    await logout();
    setUser(null);
    setAuthStatus('guest');
    setDiaryEntries([]);
    setRandomHistory([]);
    setRandomAnime(null);
    setWatchState(loadWatchState());
  }

  async function handleDisconnectShikimori() {
    await disconnectShikimori();
    setUser((current) =>
      current
        ? {
            ...current,
            integrations: {
              ...current.integrations,
              shikimori: null,
            },
          }
        : current,
    );
  }

  async function handleImportShikimoriList() {
    const result = await importShikimoriList();
    const [{ list }, { anime }] = await Promise.all([getMyAnimeList(), getAnimeCatalog()]);
    setDiaryEntries(list);
    setLibrary(anime.map(mapServerAnimeToTitle));
    return result;
  }

  return (
    <main className={sidebarCollapsed ? 'app-shell sidebar-collapsed' : 'app-shell'}>
      <aside className="library-panel" aria-label="Каталог аниме">
        <div className="brand-row">
          <div>
            <p className="eyebrow">Anima</p>
          </div>
          <button
            className="sidebar-toggle"
            type="button"
            onClick={() => setSidebarCollapsed((current) => !current)}
            aria-label={sidebarCollapsed ? 'Развернуть сайдбар' : 'Свернуть сайдбар'}
            data-tooltip={sidebarCollapsed ? 'Развернуть' : 'Свернуть'}
          >
            <img src={sidebarCollapsed ? sidebarExpandIcon : sidebarShrinkIcon} alt="" aria-hidden="true" />
          </button>
        </div>

        <nav className="side-nav" aria-label="Разделы">
          <SideNavButton
            active={view === 'watch'}
            icon={nekoIcon}
            title="Просмотр"
            description="Список аниме"
            collapsed={sidebarCollapsed}
            onClick={requestWatchView}
          />
          <SideNavButton
            active={view === 'random'}
            icon={randomDiceIcon}
            title="Случайное аниме"
            description="Подборка наугад"
            collapsed={sidebarCollapsed}
            onClick={() => requestRoute('/random', 'random')}
          />
          <SideNavButton
            active={view === 'watchParty'}
            icon={watchPartyIcon}
            title="Совместный просмотр"
            description="Комнаты и коды"
            collapsed={sidebarCollapsed}
            onClick={() => openWatchParty(watchPartyCode ? `/watch-party/${watchPartyCode}` : '/watch-party')}
          />
          <SideNavButton
            disabled
            icon={musicNoteIcon}
            title="Угадай опенинг"
            description="Скоро"
            collapsed={sidebarCollapsed}
            onClick={() => undefined}
          />
        </nav>

        <div className="sidebar-footer">
          <button
            className={view === 'settings' ? 'sidebar-action active' : 'sidebar-action'}
            type="button"
            data-tooltip={sidebarCollapsed ? 'Настройки' : undefined}
            onClick={() => requestRoute('/settings', 'settings')}
          >
            <span className="nav-icon" aria-hidden="true">
              <img src={settingsIcon} alt="" />
            </span>
            <span className="nav-copy">
              <span>Настройки</span>
              <small>Скоро</small>
            </span>
          </button>
          <AuthPanel
            user={user}
            authStatus={authStatus}
            collapsed={sidebarCollapsed}
            onLogin={loginWithDiscord}
            onProfile={() => {
              requestRoute('/profile', 'profile');
            }}
          />
        </div>
      </aside>

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

function AuthPanel({
  user,
  authStatus,
  collapsed,
  onLogin,
  onProfile,
}: {
  user: CurrentUser | null;
  authStatus: 'loading' | 'guest' | 'ready';
  collapsed: boolean;
  onLogin: () => void;
  onProfile: () => void;
}) {
  if (authStatus === 'loading') {
    return (
      <div className={collapsed ? 'auth-panel auth-placeholder collapsed-auth' : 'auth-panel auth-placeholder'} aria-hidden="true">
        <span className="auth-placeholder-avatar" />
        {collapsed ? null : <span className="auth-placeholder-copy" />}
      </div>
    );
  }

  if (!user) {
    if (collapsed) {
      return (
        <div className="auth-panel collapsed-auth">
          <button className="auth-icon-button" onClick={onLogin} data-tooltip="Войти через Discord" type="button">
            <img src={discordIcon} alt="" aria-hidden="true" />
          </button>
        </div>
      );
    }

    return (
      <div className="auth-panel">
        <button className="discord-button" onClick={onLogin}>
          <img src={discordIcon} alt="" aria-hidden="true" />
          <span>Войти через Discord</span>
        </button>
      </div>
    );
  }

  return (
    <div className="auth-panel signed-in">
      <button className="profile-link" onClick={onProfile} data-tooltip={user.displayName}>
        {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <div className="avatar-fallback">{user.displayName[0]}</div>}
        <span>
          <strong>{user.displayName}</strong>
        </span>
      </button>
    </div>
  );
}

function SideNavButton({
  active,
  disabled,
  icon,
  title,
  description,
  collapsed,
  onClick,
}: {
  active?: boolean;
  disabled?: boolean;
  icon: string;
  title: string;
  description: string;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={active ? 'active' : ''}
      disabled={disabled}
      onClick={onClick}
      type="button"
      aria-label={title}
      data-tooltip={collapsed ? title : undefined}
    >
      <span className="nav-icon" aria-hidden="true">
        <img src={icon} alt="" />
      </span>
      <span className="nav-copy">
        <span>{title}</span>
        <small>{description}</small>
      </span>
    </button>
  );
}

function EmptyCatalog() {
  return (
    <section className="empty-catalog">
      <p className="eyebrow">Shikimori</p>
      <h2>Каталог пуст</h2>
      <p>Найди аниме через Shikimori и добавь его в Anima, чтобы вести просмотр, дневник и искать плееры AniLibria.</p>
    </section>
  );
}

function WatchHome({
  browseResults,
  browsePage,
  browseHasNext,
  browseLoading,
  browseStatus,
  searchQuery,
  searchResults,
  searchLoading,
  searchStatus,
  onSearchChange,
  onOpenAnime,
  onPageChange,
}: {
  browseResults: CatalogSearchResult[];
  browsePage: number;
  browseHasNext: boolean;
  browseLoading: boolean;
  browseStatus: string;
  searchQuery: string;
  searchResults: CatalogSearchResult[];
  searchLoading: boolean;
  searchStatus: string;
  onSearchChange: (query: string) => void;
  onOpenAnime: (result: CatalogSearchResult) => void;
  onPageChange: (page: number) => void;
}) {
  return (
    <CatalogBrowser
      className="watch-home"
      eyebrow="Shikimori"
      title="Каталог аниме"
      browseResults={browseResults}
      browsePage={browsePage}
      browseHasNext={browseHasNext}
      browseLoading={browseLoading}
      browseStatus={browseStatus}
      searchQuery={searchQuery}
      searchResults={searchResults}
      searchLoading={searchLoading}
      searchStatus={searchStatus}
      onSearchChange={onSearchChange}
      onOpenAnime={onOpenAnime}
      onPageChange={onPageChange}
    />
  );
}

function CatalogBrowser({
  className,
  eyebrow,
  title,
  browseResults,
  browsePage,
  browseHasNext,
  browseLoading,
  browseStatus,
  searchQuery,
  searchResults,
  searchLoading,
  searchStatus,
  onSearchChange,
  onOpenAnime,
  onPageChange,
}: {
  className: string;
  eyebrow: string;
  title: string;
  browseResults: CatalogSearchResult[];
  browsePage: number;
  browseHasNext: boolean;
  browseLoading: boolean;
  browseStatus: string;
  searchQuery: string;
  searchResults: CatalogSearchResult[];
  searchLoading: boolean;
  searchStatus: string;
  onSearchChange: (query: string) => void;
  onOpenAnime: (result: CatalogSearchResult) => void;
  onPageChange: (page: number) => void;
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const isSearching = searchQuery.trim().length >= 2;
  const visibleResults = isSearching ? searchResults : browseResults;
  const status = isSearching ? searchStatus : browseStatus;

  useEffect(() => {
    if (isSearching) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && browseHasNext && !browseLoading) {
          onPageChange(browsePage + 1);
        }
      },
      { rootMargin: '500px' },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [browseHasNext, browseLoading, browsePage, isSearching, onPageChange]);

  return (
    <section className={className}>
      <header className="browse-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <label className="catalog-search" aria-label="Найти аниме">
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Найти аниме"
          />
        </label>
      </header>

      {status ? <p className="catalog-status">{status}</p> : null}

      {searchLoading && isSearching ? (
        <SearchLoader />
      ) : (
        <div className="browse-grid">
          {visibleResults.map((result) => (
            <button
              key={`${result.provider}-${result.providerId}`}
              className="browse-card"
              onClick={() => onOpenAnime(result)}
              type="button"
            >
              {result.posterUrl ? <img src={result.posterUrl} alt="" /> : null}
              <div>
                <strong>{result.title}</strong>
                <small>{result.originalTitle}</small>
                <small>
                  {result.episodes} сер. · {result.score ?? 'без оценки'}
                </small>
              </div>
            </button>
          ))}
        </div>
      )}

      {!isSearching ? (
        <div ref={sentinelRef} className="scroll-sentinel">
          {browseLoading ? 'Загружаем еще...' : browseHasNext ? 'Прокрути ниже для загрузки' : 'Больше тайтлов нет'}
        </div>
      ) : null}
    </section>
  );
}

function SearchLoader() {
  return (
    <div className="search-loader" aria-label="Загрузка результатов">
      <svg viewBox="0 0 48 48" role="img" aria-hidden="true">
        <circle cx="24" cy="24" r="18" />
      </svg>
    </div>
  );
}

function RandomAnimePage({
  randomAnime,
  history,
  loading,
  status,
  clearing,
  deletingKey,
  onOpenAnime,
  onRandomize,
  onClearHistory,
  onDeleteHistoryEntry,
}: {
  randomAnime: CatalogSearchResult | null;
  history: CatalogSearchResult[];
  loading: boolean;
  status: string;
  clearing: boolean;
  deletingKey: string;
  onOpenAnime: (result: CatalogSearchResult) => void;
  onRandomize: () => void;
  onClearHistory: () => void;
  onDeleteHistoryEntry: (result: CatalogSearchResult) => void;
}) {
  return (
    <section className="random-page">
      <div className="random-stage">
        <img className="random-dice" src={randomDiceIcon} alt="" aria-hidden="true" />
        <p className="eyebrow">Рандомайзер</p>
        <h2>Не знаешь, что посмотреть?</h2>
        <p>Жми кнопку снизу, а Anima достанет случайный тайтл из каталога Shikimori.</p>

        {randomAnime ? (
          <button className="random-card" onClick={() => onOpenAnime(randomAnime)} type="button">
            {randomAnime.posterUrl ? <img src={randomAnime.posterUrl} alt="" /> : null}
            <div>
              <strong>{randomAnime.title}</strong>
              <small>{randomAnime.originalTitle}</small>
              <small>
                {randomAnime.episodes} сер. · {randomAnime.score ?? 'без оценки'}
              </small>
            </div>
          </button>
        ) : null}

        {status ? <p className="catalog-status">{status}</p> : null}

        <button className="random-button" onClick={onRandomize} disabled={loading}>
          {loading ? 'Рандомим...' : randomAnime ? 'Перерандомить' : 'Срандомить'}
        </button>
      </div>

      <aside className="random-history" aria-label="История случайных аниме">
        <div className="random-history-header">
          <h3>История</h3>
          {history.length > 0 ? (
            <button type="button" onClick={onClearHistory} disabled={clearing}>
              {clearing ? 'Очищаем...' : 'Очистить'}
            </button>
          ) : null}
        </div>
        {history.length === 0 ? (
          <p className="muted-copy">Здесь появятся последние варианты.</p>
        ) : (
          history.map((item) => {
            const key = `${item.provider}-${item.providerId}`;
            return (
              <div key={key} className="random-history-row">
                <button className="random-history-open" onClick={() => onOpenAnime(item)} type="button">
                  {item.posterUrl ? <img src={item.posterUrl} alt="" /> : <div className="poster-fallback" />}
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.score ?? 'без оценки'}</small>
                  </span>
                </button>
                <button
                  className="random-history-delete"
                  type="button"
                  aria-label={`Удалить ${item.title} из истории`}
                  disabled={deletingKey === key}
                  onClick={() => onDeleteHistoryEntry(item)}
                >
                  <img src={trashIcon} alt="" aria-hidden="true" />
                </button>
              </div>
            );
          })
        )}
      </aside>
    </section>
  );
}

function WatchPartyPage({
  code,
  createRoom,
  user,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onCreateRoomConsumed,
  onToast,
}: {
  code: string;
  createRoom: boolean;
  user: CurrentUser | null;
  onCreateRoom: (code: string) => void;
  onJoinRoom: (code: string) => void;
  onLeaveRoom: () => void;
  onCreateRoomConsumed: () => void;
  onToast: (message: string) => void;
}) {
  const [joinCode, setJoinCode] = useState(code);
  const [participants, setParticipants] = useState<WatchPartyParticipant[]>([]);
  const [ownParticipantId, setOwnParticipantId] = useState('');
  const [selectedAnime, setSelectedAnime] = useState<AnimeTitle | null>(null);
  const [partyEpisode, setPartyEpisode] = useState(1);
  const [animeQuery, setAnimeQuery] = useState('');
  const [animeResults, setAnimeResults] = useState<CatalogSearchResult[]>([]);
  const [animeSearchStatus, setAnimeSearchStatus] = useState('');
  const [animeSearchLoading, setAnimeSearchLoading] = useState(false);
  const [partyCatalogResults, setPartyCatalogResults] = useState<CatalogSearchResult[]>([]);
  const [partyCatalogPage, setPartyCatalogPage] = useState(1);
  const [partyCatalogHasNext, setPartyCatalogHasNext] = useState(true);
  const [partyCatalogStatus, setPartyCatalogStatus] = useState('');
  const [partyCatalogLoading, setPartyCatalogLoading] = useState(false);
  const [joinChecking, setJoinChecking] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const createRoomRef = useRef(createRoom);
  const ownParticipant = participants.find((participant) => participant.id === ownParticipantId);
  const isHost = Boolean(ownParticipant?.isHost);

  useEffect(() => {
    createRoomRef.current = createRoom;
  }, [createRoom]);

  useEffect(() => {
    setJoinCode(code);
  }, [code]);

  useEffect(() => {
    if (!code) {
      setParticipants([]);
      setOwnParticipantId('');
      setSelectedAnime(null);
      setPartyEpisode(1);
      setPartyCatalogResults([]);
      setPartyCatalogPage(1);
      setPartyCatalogHasNext(true);
      setConnectionStatus('');
      return;
    }

    setConnectionStatus('Подключаемся...');
    const socket = io(API_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      setOwnParticipantId(socket.id ?? '');
      setConnectionStatus('');
      const shouldCreateRoom = createRoomRef.current;
      socket.emit('watch-party:join', {
        code,
        create: shouldCreateRoom,
        name: user?.displayName ?? 'Гость',
        avatarUrl: user?.avatarUrl ?? null,
      });
      if (shouldCreateRoom) {
        onCreateRoomConsumed();
      }
    });

    socket.on('watch-party:state', (state: WatchPartyRoomState) => {
      setConnectionStatus('');
      setParticipants(state.participants ?? []);
      setSelectedAnime(state.selectedAnime ? mapServerAnime(state.selectedAnime) : null);
      setPartyEpisode(state.episode ?? 1);
    });

    socket.on('connect_error', () => {
      setConnectionStatus('Не удалось подключиться к комнате.');
    });

    socket.on('watch-party:kicked', () => {
      onToast('Тебя исключили из комнаты');
      onLeaveRoom();
    });

    socket.on('watch-party:join-rejected', (payload: { reason?: string }) => {
      const message = payload.reason === 'room-full'
        ? 'Комната заполнена'
        : payload.reason === 'room-not-found'
          ? 'Комната с таким кодом не найдена'
          : 'Не удалось войти в комнату';
      onToast(message);
      onLeaveRoom();
    });

    socketRef.current = socket;

    return () => {
      socketRef.current = null;
      socket.disconnect();
    };
  }, [code, onCreateRoomConsumed, onLeaveRoom, onToast, user?.avatarUrl, user?.displayName]);

  useEffect(() => {
    setPartyCatalogResults([]);
    setPartyCatalogPage(1);
    setPartyCatalogHasNext(true);
  }, [code]);

  useEffect(() => {
    if (!code || !isHost) return;

    const query = animeQuery.trim();
    if (query.length < 2) {
      setAnimeResults([]);
      setAnimeSearchStatus('');
      setAnimeSearchLoading(false);
      return;
    }

    let ignore = false;
    setAnimeSearchLoading(true);
    setAnimeSearchStatus('');

    const timer = window.setTimeout(async () => {
      try {
        const response = await searchCatalog(query);
        if (ignore) return;

        setAnimeResults(response.results);
        setAnimeSearchStatus(response.results.length ? '' : 'Ничего не нашли.');
      } catch {
        if (!ignore) {
          setAnimeResults([]);
          setAnimeSearchStatus('Не удалось найти аниме.');
        }
      } finally {
        if (!ignore) {
          setAnimeSearchLoading(false);
        }
      }
    }, 260);

    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [animeQuery, code, isHost]);

  useEffect(() => {
    if (!code || !isHost || selectedAnime) return;

    let ignore = false;
    setPartyCatalogLoading(true);
    setPartyCatalogStatus(partyCatalogPage === 1 ? 'Загружаем каталог Shikimori...' : '');

    async function loadPartyCatalog() {
      try {
        const response = await browseCatalog(partyCatalogPage, 'popularity');
        if (ignore) return;

        setPartyCatalogResults((current) => {
          const next = partyCatalogPage === 1 ? response.results : [...current, ...response.results];
          const seen = new Set<number>();
          return next.filter((item) => {
            if (seen.has(item.providerId)) return false;
            seen.add(item.providerId);
            return true;
          });
        });
        setPartyCatalogHasNext(response.hasNextPage);
        setPartyCatalogStatus('');
      } catch {
        if (!ignore) {
          if (partyCatalogPage === 1) {
            setPartyCatalogResults([]);
          }
          setPartyCatalogStatus('Не удалось загрузить каталог.');
        }
      } finally {
        if (!ignore) {
          setPartyCatalogLoading(false);
        }
      }
    }

    loadPartyCatalog();

    return () => {
      ignore = true;
    };
  }, [code, isHost, partyCatalogPage, selectedAnime]);

  function handleCreateRoom() {
    onCreateRoom(createWatchPartyCode());
  }

  async function handleJoinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeWatchPartyCode(joinCode);
    if (normalized && !joinChecking) {
      setJoinChecking(true);
      try {
        const { exists } = await checkWatchPartyRoom(normalized);
        if (!exists) {
          onToast('Комната с таким кодом не найдена');
          return;
        }

        setConnectionStatus('');
        setParticipants([]);
        setOwnParticipantId('');
        setSelectedAnime(null);
        onJoinRoom(normalized);
      } catch {
        onToast('Не удалось проверить комнату');
      } finally {
        setJoinChecking(false);
      }
    }
  }

  async function handleSelectAnime(result: CatalogSearchResult) {
    if (!socketRef.current || !isHost) return;

    setAnimeSearchStatus('Загружаем тайтл...');
    try {
      const response = await importCatalogAnime(result.provider, result.providerId);
      socketRef.current.emit('watch-party:select-anime', {
        code,
        anime: response.anime,
      });
      setAnimeQuery('');
      setAnimeResults([]);
      setAnimeSearchStatus('');
    } catch {
      setAnimeSearchStatus('Не удалось выбрать аниме.');
    }
  }

  function handlePartyStateChange(patch: Partial<WatchState>) {
    if (!socketRef.current || !isHost || !selectedAnime) return;
    const nextEpisode = patch.episode ?? partyEpisode;
    socketRef.current.emit('watch-party:set-episode', {
      code,
      episode: nextEpisode,
    });
  }

  if (code) {
    return (
      <section className={selectedAnime ? 'watch-party-page' : 'watch-party-page room-selecting'}>
        <div className="watch-party-room">
          {selectedAnime ? (
            <AnimeHero
              anime={selectedAnime}
              state={{ episode: partyEpisode, status: 'watching' }}
              onStateChange={handlePartyStateChange}
              mode="watchParty"
              sidebarExtra={
                <WatchPartyParticipants
                  code={code}
                  participants={participants}
                  connectionStatus={connectionStatus}
                  canKick={isHost}
                  ownParticipantId={ownParticipantId}
                  onKickParticipant={(participantId) => socketRef.current?.emit('watch-party:kick', { code, participantId })}
                  onLeaveRoom={onLeaveRoom}
                  onToast={onToast}
                  showActions={false}
                />
              }
              footerExtra={
                <WatchPartyRoomActions
                  code={code}
                  onLeaveRoom={onLeaveRoom}
                  onToast={onToast}
                />
              }
            />
          ) : isHost ? (
            <CatalogBrowser
              className="watch-party-catalog"
              eyebrow="Совместный просмотр"
              title="Выбери аниме"
              browseResults={partyCatalogResults}
              browsePage={partyCatalogPage}
              browseHasNext={partyCatalogHasNext}
              browseLoading={partyCatalogLoading}
              browseStatus={partyCatalogStatus}
              searchQuery={animeQuery}
              searchResults={animeResults}
              searchLoading={animeSearchLoading}
              searchStatus={animeSearchStatus}
              onSearchChange={setAnimeQuery}
              onOpenAnime={handleSelectAnime}
              onPageChange={setPartyCatalogPage}
            />
          ) : (
            <div className="watch-party-stage waiting-host">
              <img className="watch-party-icon" src={watchPartyIcon} alt="" aria-hidden="true" />
              <p className="eyebrow">Совместный просмотр</p>
              <h2>Комната {code}</h2>
              <p>Ждём, пока хост выберет аниме для просмотра.</p>
            </div>
          )}

          {!selectedAnime ? <aside className="watch-party-panel">
            <WatchPartyParticipants
              code={code}
              participants={participants}
              connectionStatus={connectionStatus}
              canKick={isHost}
              ownParticipantId={ownParticipantId}
              onKickParticipant={(participantId) => socketRef.current?.emit('watch-party:kick', { code, participantId })}
              onLeaveRoom={onLeaveRoom}
              onToast={onToast}
            />
          </aside> : null}
        </div>
      </section>
    );
  }

  return (
    <section className="watch-party-page">
      <div className="watch-party-entry">
        <header className="watch-party-entry-header">
          <img className="watch-party-icon" src={watchPartyIcon} alt="" aria-hidden="true" />
          <h2>Совместный просмотр</h2>
        </header>

        <div className="watch-party-entry-options">
          <section className="watch-party-entry-option">
            <h3>Создать комнату</h3>
            <p>Собери друзей в одной комнате, выбери аниме и управляй сериями как хост.</p>
            <button className="random-button" type="button" onClick={handleCreateRoom}>
              Создать комнату
            </button>
          </section>

          <div className="watch-party-divider" aria-hidden="true">
            <span>или</span>
          </div>

          <section className="watch-party-entry-option">
            <h3>Войти по коду</h3>
            <p>Вставь код комнаты, который отправил хост, и подключайся к совместному просмотру.</p>
            <form className="watch-party-join" onSubmit={handleJoinRoom}>
              <input
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value)}
                placeholder="Код комнаты"
                maxLength={12}
              />
              <button type="submit" disabled={!normalizeWatchPartyCode(joinCode)} aria-busy={joinChecking}>
                Подключиться
              </button>
            </form>
          </section>
        </div>
      </div>
    </section>
  );
}

function WatchPartyRoomActions({
  code,
  onLeaveRoom,
  onToast,
}: {
  code: string;
  onLeaveRoom: () => void;
  onToast: (message: string) => void;
}) {
  async function handleCopyCode() {
    await navigator.clipboard?.writeText(code);
    onToast('Код скопирован');
  }

  return (
    <div className="watch-party-actions-row">
      <button className="watch-party-code compact" type="button" onClick={handleCopyCode}>
        <span>{code}</span>
        <img src={copyIcon} alt="" aria-hidden="true" />
      </button>
      <button className="watch-party-leave" type="button" onClick={onLeaveRoom} aria-label="Выйти из комнаты">
        <img src={leaveRoomIcon} alt="" aria-hidden="true" />
      </button>
    </div>
  );
}

function WatchPartyParticipants({
  code,
  participants,
  connectionStatus,
  canKick,
  ownParticipantId,
  onKickParticipant,
  onLeaveRoom,
  onToast,
  showActions = true,
}: {
  code: string;
  participants: WatchPartyParticipant[];
  connectionStatus: string;
  canKick: boolean;
  ownParticipantId: string;
  onKickParticipant: (participantId: string) => void;
  onLeaveRoom: () => void;
  onToast: (message: string) => void;
  showActions?: boolean;
}) {
  return (
    <>
      <h3>Участники ({participants.length}/16)</h3>
      {connectionStatus ? <p className="party-status">{connectionStatus}</p> : null}
      <div className="party-members">
        {participants.map((participant) => (
          <div className="party-member" key={participant.id}>
            {participant.avatarUrl ? (
              <img src={participant.avatarUrl} alt="" />
            ) : (
              <div className="avatar-fallback">{participant.name[0] ?? 'G'}</div>
            )}
            <strong>{participant.name}</strong>
            <span className="party-member-actions">
              {participant.isHost ? (
                <span className="party-host-badge" aria-label="Хост" title="Хост">
                  <img className="party-host-icon" src={crownIcon} alt="" aria-hidden="true" />
                </span>
              ) : null}
              {canKick && !participant.isHost && participant.id !== ownParticipantId ? (
                <button type="button" onClick={() => onKickParticipant(participant.id)} aria-label={`Кикнуть ${participant.name}`}>
                  <img src={kickIcon} alt="" aria-hidden="true" />
                </button>
              ) : null}
            </span>
          </div>
        ))}
      </div>
      {showActions ? (
        <WatchPartyRoomActions code={code} onLeaveRoom={onLeaveRoom} onToast={onToast} />
      ) : null}
    </>
  );
}

function ProfilePage({
  user,
  authStatus,
  entries,
  onLogin,
  onLogout,
  onConnectShikimori,
  onDisconnectShikimori,
  onImportShikimori,
  onToast,
}: {
  user: CurrentUser | null;
  authStatus: 'loading' | 'guest' | 'ready';
  entries: ServerWatchEntry[];
  onLogin: () => void;
  onLogout: () => void;
  onConnectShikimori: () => void;
  onDisconnectShikimori: () => Promise<void>;
  onImportShikimori: () => Promise<{
    imported: number;
    updated: number;
    skipped: number;
    total: number;
    errors?: Array<{ shikimoriId: number | null; reason: string }>;
  }>;
  onToast: (message: string) => void;
}) {
  const profileFilters: Array<{ status: WatchState['status']; label: string; count: number; icon: string }> = [
    { status: 'watching', label: 'Смотрю', count: entries.filter((entry) => entry.status === 'WATCHING').length, icon: profileEyeIcon },
    { status: 'completed', label: 'Просмотрено', count: entries.filter((entry) => entry.status === 'COMPLETED').length, icon: profileCheckIcon },
    { status: 'dropped', label: 'Брошено', count: entries.filter((entry) => entry.status === 'DROPPED').length, icon: trashIcon },
    { status: 'planned', label: 'В планах', count: entries.filter((entry) => entry.status === 'PLANNED').length, icon: profileNoteIcon },
  ];
  const profileFriends = [
    { id: 'mira', name: 'Mira', status: 'online' },
    { id: 'kira', name: 'Kira', status: 'online' },
    { id: 'ren', name: 'Ren', status: 'offline' },
    { id: 'yuki', name: 'Yuki', status: 'offline' },
    { id: 'sora', name: 'Sora', status: 'offline' },
  ];
  const sortedFriends = [...profileFriends].sort((left, right) => Number(right.status === 'online') - Number(left.status === 'online'));
  const [selectedStatus, setSelectedStatus] = useState<WatchState['status']>('watching');
  const [sidebarMode, setSidebarMode] = useState<'overview' | 'settings'>('overview');
  const selectedFilter = profileFilters.find((filter) => filter.status === selectedStatus) ?? profileFilters[0];
  const filteredEntries = entries.filter((entry) => fromServerStatus(entry.status) === selectedStatus);

  if (authStatus === 'loading') {
    return <section className="profile-page empty-state">Загружаем профиль...</section>;
  }

  if (!user) {
    return (
      <section className="profile-page empty-state">
        <h2>Профиль</h2>
        <p>Войди через Discord, чтобы вести дневник просмотра, оценки и рецензии.</p>
        <button className="discord-button" onClick={onLogin}>Войти через Discord</button>
      </section>
    );
  }

  return (
    <section className="profile-page">
      <section className="diary-list">
          <h3>{selectedFilter.label}</h3>
          {entries.length === 0 ? (
            <p className="muted-copy">Пока нет записей. Выбери тайтл и сохрани первую запись.</p>
          ) : filteredEntries.length === 0 ? (
            <p className="muted-copy">В этом разделе пока нет аниме.</p>
          ) : (
            filteredEntries.map((entry) => (
              <article key={entry.id} className="diary-row">
                {entry.anime?.posterUrl ? <img src={entry.anime.posterUrl} alt="" /> : <div className="poster-fallback" />}
                <span>
                  <strong>{entry.anime?.title ?? entry.animeId}</strong>
                  <small>{statusLabel(fromServerStatus(entry.status))} · серия {entry.currentEpisode}</small>
                  {entry.review ? <small className="diary-review">{entry.review}</small> : null}
                </span>
                {entry.score ? <em>{entry.score}/10</em> : null}
              </article>
            ))
          )}
        </section>

      <aside className="profile-sidebar">
        <header className="profile-header">
          <div className="profile-avatar-frame">
            {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <div className="avatar-fallback large">{user.displayName[0]}</div>}
            <h2>{user.displayName}</h2>
          </div>
        </header>

        <div className={`profile-sidebar-content ${sidebarMode === 'settings' ? 'slide-up' : 'slide-down'}`} key={sidebarMode}>
          {sidebarMode === 'overview' ? (
            <>
              <section className="profile-sidebar-section" aria-labelledby="profile-watch-section">
                <h3 id="profile-watch-section">Просмотр</h3>
                <div className="profile-stats" aria-label="Фильтр дневника">
                  {profileFilters.map((filter) => (
                    <button
                      key={filter.status}
                      className={filter.status === selectedStatus ? 'active' : ''}
                      type="button"
                      onClick={() => setSelectedStatus(filter.status)}
                    >
                      <img className="profile-stat-icon" src={filter.icon} alt="" aria-hidden="true" />
                      <span>{filter.label}</span>
                      <strong>{filter.count}</strong>
                    </button>
                  ))}
                </div>
              </section>

              <section className="profile-sidebar-section profile-friends-section" aria-labelledby="profile-friends-section">
                <div className="profile-section-title">
                  <h3 id="profile-friends-section">Друзья</h3>
                  <span>{profileFriends.length}</span>
                </div>
                <div className="profile-friends-list">
                  {sortedFriends.slice(0, 5).map((friend) => (
                    <article key={friend.id} className="profile-friend-row">
                      <span className="profile-friend-avatar">{friend.name[0]}</span>
                      <span className="profile-friend-name">{friend.name}</span>
                      <span className={`profile-friend-status ${friend.status}`}>{friend.status === 'online' ? 'Онлайн' : 'Оффлайн'}</span>
                    </article>
                  ))}
                </div>
                <button className="profile-show-all" type="button">
                  Показать всех
                </button>
              </section>
            </>
          ) : (
            <>
              <section className="profile-sidebar-section" aria-labelledby="profile-edit-section">
                <h3 id="profile-edit-section">Профиль</h3>
                <div className="profile-settings-card">
                  <span>Редактирование ника и аватарки появится позже.</span>
                </div>
              </section>

              <section className="profile-sidebar-section profile-integration-section" aria-labelledby="profile-integrations-section">
                <h3 id="profile-integrations-section">Интеграции</h3>
                <ShikimoriIntegration
                  authStatus={authStatus}
                  user={user}
                  onConnectShikimori={onConnectShikimori}
                  onDisconnectShikimori={onDisconnectShikimori}
                  onImportShikimori={onImportShikimori}
                  onToast={onToast}
                />
              </section>
            </>
          )}
        </div>

        <div className="profile-sidebar-actions">
          <button
            className={sidebarMode === 'settings' ? 'profile-settings-toggle active' : 'profile-settings-toggle'}
            type="button"
            onClick={() => setSidebarMode((current) => (current === 'settings' ? 'overview' : 'settings'))}
            aria-label={sidebarMode === 'settings' ? 'Вернуться к профилю' : 'Настройки профиля'}
          >
            <img src={settingsIcon} alt="" aria-hidden="true" />
          </button>
          <button className="profile-logout" type="button" onClick={onLogout}>
            Выйти
          </button>
        </div>
      </aside>
    </section>
  );
}

function ShikimoriIntegration({
  authStatus,
  user,
  onConnectShikimori,
  onDisconnectShikimori,
  onImportShikimori,
  onToast,
}: {
  authStatus: 'loading' | 'guest' | 'ready';
  user: CurrentUser | null;
  onConnectShikimori: () => void;
  onDisconnectShikimori: () => Promise<void>;
  onImportShikimori: () => Promise<{
    imported: number;
    updated: number;
    skipped: number;
    total: number;
    errors?: Array<{ shikimoriId: number | null; reason: string }>;
  }>;
  onToast: (message: string) => void;
}) {
  const canConnect = authStatus === 'ready' && Boolean(user);
  const shikimori = user?.integrations.shikimori ?? null;
  const isAuthLoading = authStatus === 'loading';
  const [disconnecting, setDisconnecting] = useState(false);
  const [importing, setImporting] = useState(false);

  async function handleDisconnect() {
    if (disconnecting) return;

    setDisconnecting(true);
    try {
      await onDisconnectShikimori();
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleImport() {
    if (importing) return;

    setImporting(true);
    onToast('Импортируем список Shikimori. Не закрывай страницу.');

    try {
      const result = await onImportShikimori();
      const firstError = result.errors?.[0];
      const changed = result.imported + result.updated;

      if (changed > 0) {
        onToast(`Импорт завершён: ${result.imported} новых, ${result.updated} обновлено, ${result.skipped} пропущено`);
      } else {
        const reason = firstError ? ` Причина: ${firstError.reason}` : '';
        onToast(`Не удалось импортировать список Shikimori.${reason}`);
      }
    } catch {
      onToast('Не удалось импортировать список Shikimori. Попробуй подключить профиль заново.');
    } finally {
      setImporting(false);
    }
  }

  if (isAuthLoading) {
    return (
      <div className="connected-account settings-account-placeholder" aria-hidden="true">
        <span className="settings-placeholder-avatar" />
        <span className="settings-placeholder-copy">
          <span />
          <strong />
        </span>
      </div>
    );
  }

  if (shikimori) {
    return (
      <div className="connected-account">
        <a className="connected-account-main" href={shikimori.profileUrl} target="_blank" rel="noreferrer">
          <span className="connected-account-avatar">
            {shikimori.avatarUrl ? <img src={shikimori.avatarUrl} alt="" /> : <span className="connected-account-fallback">{shikimori.nickname[0]}</span>}
            <img className="connected-account-badge" src={shikimoriIcon} alt="" aria-hidden="true" />
          </span>
          <span>
            <strong>{shikimori.nickname}</strong>
          </span>
        </a>
        <div className="connected-account-actions">
          <button className="settings-icon-button" type="button" onClick={handleImport} disabled={importing} data-tooltip={importing ? 'Импортируем...' : 'Импортировать список'}>
            {importing ? <span className="settings-button-loader" aria-hidden="true" /> : <img src={importIcon} alt="" aria-hidden="true" />}
          </button>
          <button className="settings-icon-button" type="button" onClick={handleDisconnect} disabled={disconnecting} data-tooltip={disconnecting ? 'Отключаем...' : 'Отвязать профиль'}>
            <img src={detachIcon} alt="" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-integration-empty">
      <p>Подключи Shikimori, чтобы импортировать список просмотра.</p>
      <button className="settings-connect-button" type="button" onClick={onConnectShikimori} disabled={!canConnect}>
        {canConnect ? 'Подключить' : 'Нужен вход'}
      </button>
    </div>
  );
}

function SettingsPage() {
  return (
    <section className="settings-page">
      <header className="settings-hero">
        <span className="settings-icon" aria-hidden="true">
          <img src={settingsIcon} alt="" />
        </span>
        <div>
          <p className="eyebrow">Anima</p>
          <h2>Настройки</h2>
          <p>Здесь будут общие параметры приложения.</p>
        </div>
      </header>

      <section className="settings-panel">
        <div>
          <h3>Тема</h3>
          <p>Позже добавим выбор светлой, тёмной и системной темы.</p>
        </div>
        <button type="button" disabled>
          Скоро
        </button>
      </section>

      <section className="settings-panel">
        <div>
          <h3>Язык</h3>
          <p>Здесь будет выбор языка интерфейса.</p>
        </div>
        <button type="button" disabled>
          Скоро
        </button>
      </section>
    </section>
  );
}

function AnimeHero({
  anime,
  state,
  onStateChange,
  mode = 'default',
  sidebarExtra,
  footerExtra,
}: {
  anime: AnimeTitle;
  state: WatchState;
  onStateChange: (patch: Partial<WatchState>) => void;
  mode?: 'default' | 'watchParty';
  sidebarExtra?: ReactNode;
  footerExtra?: ReactNode;
}) {
  const [players, setPlayers] = useState<PlayerProviderResult[]>([]);
  const [playersStatus, setPlayersStatus] = useState('');
  const [selectedProviderName, setSelectedProviderName] = useState<PlayerProvider>('kodik');
  const [episodePage, setEpisodePage] = useState(0);
  const [episodePageDirection, setEpisodePageDirection] = useState<'next' | 'prev'>('next');
  const playablePlayers = players.filter((player) => isPlayablePlayer(player) && (mode === 'default' || player.provider === 'kodik'));
  const selectedProviderPlayer = playablePlayers.find((player) => player.provider === selectedProviderName);
  const selectedPlayer = selectedProviderPlayer ?? playablePlayers[0] ?? (mode === 'default' ? players[0] : undefined);
  const activeProviderName = selectedPlayer?.provider ?? selectedProviderName;
  const episodePages = Math.max(1, Math.ceil(anime.episodes / EPISODES_PER_PAGE));
  const visibleEpisodes = useMemo(() => {
    const start = episodePage * EPISODES_PER_PAGE + 1;
    const end = Math.min(anime.episodes, start + EPISODES_PER_PAGE - 1);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [anime.episodes, episodePage]);

  useEffect(() => {
    setEpisodePage((currentPage) => {
      const nextPage = Math.min(episodePages - 1, Math.floor((state.episode - 1) / EPISODES_PER_PAGE));
      if (nextPage !== currentPage) {
        setEpisodePageDirection(nextPage > currentPage ? 'next' : 'prev');
      }
      return nextPage;
    });
  }, [anime.id, episodePages, state.episode]);

  function changeEpisodePage(nextPage: number) {
    setEpisodePage((currentPage) => {
      const clampedPage = Math.min(Math.max(nextPage, 0), episodePages - 1);
      if (clampedPage !== currentPage) {
        setEpisodePageDirection(clampedPage > currentPage ? 'next' : 'prev');
      }
      return clampedPage;
    });
  }

  useEffect(() => {
    let ignore = false;

    async function loadPlayers() {
      setPlayers([]);
      setPlayersStatus('');
      try {
        const response = await getEpisodePlayers(anime.id, state.episode);
        if (ignore) return;

        setPlayers(response.providers);
        setPlayersStatus(response.providers.length ? '' : 'Видео с данным тайтлом не найдено');
      } catch {
        if (!ignore) {
          setPlayers([]);
          setPlayersStatus('Не удалось загрузить плеер.');
        }
      }
    }

    loadPlayers();

    return () => {
      ignore = true;
    };
  }, [anime.id, state.episode]);

  const episodeControls = (
    <section className="episodes" aria-label="Серии">
      <button
        className="episode-scroll"
        type="button"
        onClick={() => changeEpisodePage(episodePage - 1)}
        disabled={episodePage === 0}
        aria-label="Предыдущие серии"
      >
        <img src={episodeArrowIcon} alt="" aria-hidden="true" />
      </button>
      <div key={episodePage} className={`episode-grid page-${episodePageDirection}`}>
        {visibleEpisodes.map((episode) => (
          <button
            key={episode}
            className={episode === state.episode ? 'current' : ''}
            onClick={() => onStateChange({ episode, status: 'watching' })}
          >
            {episode}
          </button>
        ))}
      </div>
      <button
        className="episode-scroll"
        type="button"
        onClick={() => changeEpisodePage(episodePage + 1)}
        disabled={episodePage >= episodePages - 1}
        aria-label="Следующие серии"
      >
        <img src={episodeArrowIcon} alt="" aria-hidden="true" />
      </button>
    </section>
  );

  return (
    <>
      <div className={mode === 'watchParty' ? 'player-layout watch-party-player-layout' : 'player-layout'}>
        <section className="player">
          {selectedPlayer && isPlayablePlayer(selectedPlayer) ? (
            <VideoPlayer anime={anime} player={selectedPlayer} />
          ) : (
            <div className="video-frame">
              {playersStatus ? <PlayerMessage message={playersStatus} /> : <PlayerLoader />}
            </div>
          )}

          {mode === 'default' ? episodeControls : null}
        </section>

        <aside className="details-panel">
          <div className="details-poster">
            <img src={anime.poster} alt="" />
            <div>
              <p className="eyebrow">{anime.originalTitle}</p>
              <h2>{anime.title}</h2>
            </div>
          </div>
          <div className="details-content">
            <div className="genres" tabIndex={0} aria-label="Жанры">
              <div className="genres-track">
                {anime.genres.map((genre) => (
                  <span key={genre}>{genre}</span>
                ))}
              </div>
            </div>
          </div>

          {mode === 'default' ? (
            <>
              <div className="meta-grid">
                <span>Год<strong>{anime.year}</strong></span>
                <span>Серии<strong>{anime.episodes}</strong></span>
                <span>Студия<strong>{anime.studio}</strong></span>
                <span>Рейтинг<strong>{anime.rating}</strong></span>
              </div>

              <div className="watch-tools">
                <PlayerProviderSelect players={players} value={activeProviderName} onChange={setSelectedProviderName} />
                <WatchStatusSelect value={state.status} onChange={(status) => onStateChange({ status })} />
              </div>
              <WatchSources anime={anime} />
            </>
          ) : null}
          {sidebarExtra ? <div className="watch-party-panel in-player">{sidebarExtra}</div> : null}
        </aside>
        {mode === 'watchParty' ? (
          <div className="watch-party-player-footer">
            {episodeControls}
            {footerExtra ? <div className="watch-party-player-actions">{footerExtra}</div> : null}
          </div>
        ) : null}
      </div>

    </>
  );
}

function PlayerProviderSelect({
  players,
  value,
  onChange,
}: {
  players: PlayerProviderResult[];
  value: PlayerProvider;
  onChange: (value: PlayerProvider) => void;
}) {
  return (
    <div className="provider-select" aria-label="Плеер">
      {PLAYER_PROVIDER_OPTIONS.map((option) => {
        const available = players.some((player) => player.provider === option.value && isPlayablePlayer(player));
        return (
          <button
            key={option.value}
            className={option.value === value ? 'selected' : ''}
            type="button"
            disabled={!available}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function WatchStatusSelect({
  value,
  onChange,
}: {
  value: WatchState['status'];
  onChange: (value: WatchState['status']) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = WATCH_STATUS_OPTIONS.find((option) => option.value === value) ?? WATCH_STATUS_OPTIONS[0];

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className="status-select" ref={rootRef}>
      <button
        className="status-select-trigger"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected.label}</span>
        <span className="status-select-chevron" aria-hidden="true" />
      </button>

      {open ? (
        <div className="status-select-menu" role="listbox" aria-label="Статус просмотра">
          {WATCH_STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={option.value === value ? 'selected' : ''}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function VideoPlayer({ anime, player }: { anime: AnimeTitle; player: PlayerProviderResult }) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
  }, [player.embedUrl, player.streamUrl]);

  if (player.streamType === 'iframe' && player.embedUrl) {
    return (
      <div className="video-frame">
        <iframe
          src={player.embedUrl}
          title={player.title}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          onLoad={() => setIsLoading(false)}
        />
        {isLoading ? <PlayerLoader /> : null}
      </div>
    );
  }

  return <HlsPlayer anime={anime} player={player} isLoading={isLoading} onReady={() => setIsLoading(false)} />;
}

function PlayerLoader() {
  return (
    <div className="player-loader" aria-label="Loading player">
      <span />
    </div>
  );
}

function PlayerMessage({ message }: { message: string }) {
  return (
    <div className="player-message" role="status">
      <p>{message}</p>
    </div>
  );
}

function HlsPlayer({
  anime,
  player,
  isLoading,
  onReady,
}: {
  anime: AnimeTitle;
  player: PlayerProviderResult;
  isLoading: boolean;
  onReady: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !player.streamUrl) return;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = player.streamUrl;
      return;
    }

    if (!Hls.isSupported()) return;

    const hls = new Hls();
    hls.loadSource(player.streamUrl);
    hls.attachMedia(video);

    return () => {
      hls.destroy();
    };
  }, [player.streamUrl]);

  return (
    <div className="video-frame">
      <video ref={videoRef} controls poster={anime.backdrop} onCanPlay={onReady} />
      {isLoading ? <PlayerLoader /> : null}
    </div>
  );
}

function isPlayablePlayer(player: PlayerProviderResult) {
  return Boolean(player.streamUrl || player.embedUrl);
}

function WatchSources({ anime }: { anime: AnimeTitle }) {
  return (
    <div className="sources-block">
      <h3>Источники</h3>
      {anime.watchSources.map((source) => (
        <a key={source.name} href={source.url} target="_blank" rel="noreferrer" className="source-link">
          <span>
            <strong>{source.name}</strong>
          </span>
        </a>
      ))}
    </div>
  );
}

function fromServerStatus(status: string): WatchState['status'] {
  switch (status) {
    case 'WATCHING':
      return 'watching';
    case 'COMPLETED':
      return 'completed';
    case 'DROPPED':
      return 'dropped';
    default:
      return 'planned';
  }
}

function statusLabel(status: WatchState['status']) {
  switch (status) {
    case 'watching':
      return 'Смотрю';
    case 'completed':
      return 'Просмотрено';
    case 'dropped':
      return 'Брошено';
    default:
      return 'В планах';
  }
}

function getRouteAnimeId(pathname: string) {
  if (pathname === '/anime') return '';
  const match = pathname.match(/^\/anime\/([^/]+)$/);
  return match?.[1] ? decodeURIComponent(match[1]) : '';
}

function getViewFromPath(pathname: string): AppView {
  if (pathname === '/profile') return 'profile';
  if (pathname === '/random') return 'random';
  if (pathname === '/settings') return 'settings';
  if (pathname === '/watch-party' || pathname.startsWith('/watch-party/')) return 'watchParty';
  return 'watch';
}

function getWatchPartyCodeFromPath(pathname: string) {
  const match = pathname.match(/^\/watch-party\/([^/]+)$/);
  return match?.[1] ? normalizeWatchPartyCode(decodeURIComponent(match[1])) : '';
}

function createWatchPartyCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function normalizeWatchPartyCode(value: string) {
  return value.replace(/[^a-z0-9]/gi, '').slice(0, 12).toUpperCase();
}

function parseShikimoriRouteId(animeId: string) {
  const match = animeId.match(/^shikimori-(\d+)$/);
  return match ? Number(match[1]) : null;
}

function animeRouteFromCatalog(result: CatalogSearchResult) {
  return `/anime/${catalogRouteSlug(result)}`;
}

function animeRouteSlug(anime: AnimeTitle) {
  return slugifyAnimeTitle(anime.originalTitle || anime.title || anime.id);
}

function catalogRouteSlug(result: CatalogSearchResult) {
  return slugifyAnimeTitle(result.originalTitle || result.title || `${result.provider}-${result.providerId}`);
}

function findAnimeByRoute(library: AnimeTitle[], routeId: string) {
  return library.find((anime) => anime.id === routeId || animeRouteSlug(anime) === routeId) ?? null;
}

function findCatalogResultByRoute(results: CatalogSearchResult[], routeId: string) {
  return results.find((result) => catalogRouteSlug(result) === routeId) ?? null;
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

function slugifyAnimeTitle(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function navigateToRemembered(
  path: string,
  setCurrentPath: (path: string | ((current: string) => string)) => void,
  scrollByPathRef: MutableRefObject<Record<string, number>>,
) {
  setCurrentPath((current) => {
    scrollByPathRef.current[current] = window.scrollY;
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
    return path;
  });
}

function mapServerAnime(anime: ServerAnime): AnimeTitle {
  const year = anime.airedOn ? Number(anime.airedOn.slice(0, 4)) : 0;

  return {
    id: anime.id,
    title: anime.title,
    originalTitle: anime.originalTitle ?? anime.title,
    year: Number.isFinite(year) && year > 0 ? year : new Date().getFullYear(),
    episodes: anime.episodes || 1,
    studio: anime.sourceUrl ? 'Shikimori' : 'Anima',
    rating: anime.score ?? '-',
    genres: parseAnimeGenres(anime.genres, anime.kind),
    description: '',
    poster: anime.posterUrl ?? 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80',
    backdrop: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=1600&q=80',
    sampleEpisodeTitle: 'Просмотр',
    watchSources: anime.sourceUrl
      ? [
          {
            name: 'Shikimori',
            url: anime.sourceUrl,
            kind: 'streaming',
            subtitles: ['метаданные'],
            note: 'Страница тайтла в каталоге Shikimori.',
          },
        ]
      : [],
  };
}

function parseAnimeGenres(value: string | null | undefined, fallback: string | null | undefined) {
  if (value) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        const genres = parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
        if (genres.length > 0) return genres;
      }
    } catch {
      return [fallback ?? 'Аниме'];
    }
  }

  return [fallback ?? 'Аниме'];
}

function mapRandomHistoryEntry(entry: ServerRandomHistoryEntry): CatalogSearchResult {
  return {
    provider: entry.provider,
    providerId: entry.providerId,
    title: entry.title,
    originalTitle: entry.originalTitle,
    episodes: entry.episodes,
    posterUrl: entry.posterUrl,
    kind: entry.kind,
    score: entry.score,
    status: entry.status,
    malId: entry.malId,
    sourceUrl: entry.sourceUrl,
  };
}

function mergeAnimeLibrary(current: AnimeTitle[], incoming: AnimeTitle[]) {
  const byId = new Map(current.map((anime) => [anime.id, anime]));
  for (const anime of incoming) {
    byId.set(anime.id, anime);
  }

  return [...byId.values()].sort((a, b) => a.title.localeCompare(b.title, 'ru'));
}

function upsertDiaryEntry(entries: ServerWatchEntry[], entry: ServerWatchEntry) {
  const exists = entries.some((item) => item.id === entry.id);
  if (!exists) {
    return [entry, ...entries];
  }

  return entries.map((item) => (item.id === entry.id ? entry : item));
}
