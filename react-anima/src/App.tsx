import { useEffect, useMemo, useRef, useState, type FormEvent, type MutableRefObject, type ReactNode } from 'react';
import Hls from 'hls.js';
import { io, type Socket } from 'socket.io-client';
import episodeArrowIcon from './assets/episode-arrow.svg';
import loginIcon from './assets/login.svg';
import musicNoteIcon from './assets/music-note.svg';
import nekoIcon from './assets/neko.svg';
import randomDiceIcon from './assets/random-dice.svg';
import sidebarExpandIcon from './assets/sidebar-expand.svg';
import sidebarShrinkIcon from './assets/sidebar-shrink.svg';
import trashIcon from './assets/trash.svg';
import watchPartyIcon from './assets/watch-party.svg';
import {
  API_URL,
  browseCatalog,
  clearMyRandomHistory,
  deleteRandomHistoryEntry,
  getAnimeById,
  getCurrentUser,
  getAnimeCatalog,
  getEpisodePlayers,
  getMyAnimeList,
  getMyRandomHistory,
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
type AppView = 'watch' | 'profile' | 'random' | 'watchParty';
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
  const [watchPartyCode, setWatchPartyCode] = useState(getWatchPartyCodeFromPath(window.location.pathname));
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
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: scrollByPathRef.current[displayedPath] ?? 0 });
    });
  }, [displayedPath]);

  function openCatalogAnime(result: CatalogSearchResult) {
    navigateToRemembered(animeRouteFromCatalog(result), setCurrentPath, scrollByPathRef);
    setView('watch');
  }

  function openWatchParty(path: string) {
    setWatchPartyCode(getWatchPartyCodeFromPath(path));
    navigateToRemembered(path, setCurrentPath, scrollByPathRef);
    setView('watchParty');
  }

  function leaveWatchParty() {
    const path = '/watch-party';
    setWatchPartyCode('');
    setCurrentPath((current) => {
      scrollByPathRef.current[current] = window.scrollY;
      if (window.location.pathname !== path) {
        window.history.replaceState(null, '', path);
      }
      return path;
    });
    setView('watchParty');
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
      setView('watch');
      pushAnimeRoute(animeRouteSlug(anime), setCurrentPath, scrollByPathRef);
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
            onClick={() => {
              const nextPath = view === 'watch' && routeAnimeId ? '/anime' : lastWatchPathRef.current;
              navigateToRemembered(nextPath, setCurrentPath, scrollByPathRef);
              setView('watch');
            }}
          />
          <SideNavButton
            active={view === 'random'}
            icon={randomDiceIcon}
            title="Случайное аниме"
            description="Подборка наугад"
            collapsed={sidebarCollapsed}
            onClick={() => {
              navigateToRemembered('/random', setCurrentPath, scrollByPathRef);
              setView('random');
            }}
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

        <AuthPanel
          user={user}
          authStatus={authStatus}
          collapsed={sidebarCollapsed}
          onLogin={loginWithDiscord}
          onProfile={() => {
            navigateToRemembered('/profile', setCurrentPath, scrollByPathRef);
            setView('profile');
          }}
        />
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
            user={user}
            onCreateRoom={(code) => openWatchParty(`/watch-party/${code}`)}
            onJoinRoom={(code) => openWatchParty(`/watch-party/${code}`)}
            onLeaveRoom={leaveWatchParty}
          />
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
          />
        )}
        </div>
      </section>
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
    return <div className="auth-panel muted">{collapsed ? '...' : 'Проверяем сессию...'}</div>;
  }

  if (!user) {
    if (collapsed) {
      return (
        <div className="auth-panel collapsed-auth">
          <button className="auth-icon-button" onClick={onLogin} data-tooltip="Войти через Discord" type="button">
            <img src={loginIcon} alt="" aria-hidden="true" />
          </button>
        </div>
      );
    }

    return (
      <div className="auth-panel">
        <button className="discord-button" onClick={onLogin}>Войти через Discord</button>
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
    <section className="watch-home">
      <header className="browse-header">
        <div>
          <p className="eyebrow">Shikimori</p>
          <h2>Каталог аниме</h2>
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

      {isSearching ? (
        null
      ) : (
        <div ref={sentinelRef} className="scroll-sentinel">
          {browseLoading ? 'Загружаем еще...' : browseHasNext ? 'Прокрути ниже для загрузки' : 'Больше тайтлов нет'}
        </div>
      )}

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
  user,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
}: {
  code: string;
  user: CurrentUser | null;
  onCreateRoom: (code: string) => void;
  onJoinRoom: (code: string) => void;
  onLeaveRoom: () => void;
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
  const [connectionStatus, setConnectionStatus] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const ownParticipant = participants.find((participant) => participant.id === ownParticipantId);
  const isHost = Boolean(ownParticipant?.isHost);

  useEffect(() => {
    setJoinCode(code);
  }, [code]);

  useEffect(() => {
    if (!code) {
      setParticipants([]);
      setOwnParticipantId('');
      setSelectedAnime(null);
      setPartyEpisode(1);
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
      socket.emit('watch-party:join', {
        code,
        name: user?.displayName ?? 'Гость',
        avatarUrl: user?.avatarUrl ?? null,
      });
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

    socketRef.current = socket;

    return () => {
      socketRef.current = null;
      socket.disconnect();
    };
  }, [code, user?.avatarUrl, user?.displayName]);

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

  function handleCreateRoom() {
    onCreateRoom(createWatchPartyCode());
  }

  function handleJoinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeWatchPartyCode(joinCode);
    if (normalized) {
      onJoinRoom(normalized);
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
      <section className="watch-party-page">
        <div className="watch-party-room">
          {selectedAnime ? (
            <AnimeHero
              anime={selectedAnime}
              state={{ episode: partyEpisode, status: 'watching' }}
              onStateChange={handlePartyStateChange}
              mode="watchParty"
              sidebarExtra={
                <WatchPartyParticipants
                  participants={participants}
                  connectionStatus={connectionStatus}
                  onLeaveRoom={onLeaveRoom}
                />
              }
            />
          ) : (
            <div className="watch-party-stage">
              <img className="watch-party-icon" src={watchPartyIcon} alt="" aria-hidden="true" />
              <p className="eyebrow">Совместный просмотр</p>
              <h2>Комната {code}</h2>
              {isHost ? (
                <div className="party-anime-picker">
                  <input
                    type="search"
                    value={animeQuery}
                    onChange={(event) => setAnimeQuery(event.target.value)}
                    placeholder="Найти аниме"
                  />
                  {animeSearchLoading ? <SearchLoader /> : null}
                  {animeSearchStatus ? <p className="catalog-status">{animeSearchStatus}</p> : null}
                  {animeResults.length > 0 ? (
                    <div className="party-anime-results">
                      {animeResults.map((result) => (
                        <button
                          key={`${result.provider}-${result.providerId}`}
                          type="button"
                          onClick={() => handleSelectAnime(result)}
                        >
                          {result.posterUrl ? <img src={result.posterUrl} alt="" /> : null}
                          <span>
                            <strong>{result.title}</strong>
                            <small>{result.originalTitle}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p>Ждём, пока хост выберет аниме для просмотра.</p>
              )}
              <div className="watch-party-code">
                <span>{code}</span>
                <button type="button" onClick={() => navigator.clipboard?.writeText(code)}>
                  Скопировать код
                </button>
              </div>
            </div>
          )}

          {!selectedAnime ? <aside className="watch-party-panel">
            <h3>Участники</h3>
            {connectionStatus ? <p className="party-status">{connectionStatus}</p> : null}
            {participants.map((participant) => (
              <div className="party-member" key={participant.id}>
                {participant.avatarUrl ? (
                  <img src={participant.avatarUrl} alt="" />
                ) : (
                  <div className="avatar-fallback">{participant.name[0] ?? 'G'}</div>
                )}
                <span>
                  <strong>{participant.name}</strong>
                  <small>{participant.isHost ? 'Хост' : 'Гость'}</small>
                </span>
              </div>
            ))}
            <button className="watch-party-leave" type="button" onClick={onLeaveRoom}>
              Выйти из комнаты
            </button>
          </aside> : null}
        </div>
      </section>
    );
  }

  return (
    <section className="watch-party-page">
      <div className="watch-party-entry">
        <img className="watch-party-icon" src={watchPartyIcon} alt="" aria-hidden="true" />
        <p className="eyebrow">Совместный просмотр</p>
        <h2>Собери комнату для просмотра</h2>
        <p>Создай лобби или подключись по коду. Позже здесь появится список активных комнат аккаунта.</p>

        <div className="watch-party-actions">
          <button className="random-button" type="button" onClick={handleCreateRoom}>
            Создать комнату
          </button>
          <form className="watch-party-join" onSubmit={handleJoinRoom}>
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              placeholder="Код комнаты"
              maxLength={12}
            />
            <button type="submit" disabled={!normalizeWatchPartyCode(joinCode)}>
              Подключиться
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

function WatchPartyParticipants({
  participants,
  connectionStatus,
  onLeaveRoom,
}: {
  participants: WatchPartyParticipant[];
  connectionStatus: string;
  onLeaveRoom: () => void;
}) {
  return (
    <>
      <h3>Участники</h3>
      {connectionStatus ? <p className="party-status">{connectionStatus}</p> : null}
      {participants.map((participant) => (
        <div className="party-member" key={participant.id}>
          {participant.avatarUrl ? (
            <img src={participant.avatarUrl} alt="" />
          ) : (
            <div className="avatar-fallback">{participant.name[0] ?? 'G'}</div>
          )}
          <span>
            <strong>{participant.name}</strong>
            <small>{participant.isHost ? 'Хост' : 'Гость'}</small>
          </span>
        </div>
      ))}
      <button className="watch-party-leave" type="button" onClick={onLeaveRoom}>
        Выйти из комнаты
      </button>
    </>
  );
}

function ProfilePage({
  user,
  authStatus,
  entries,
  onLogin,
}: {
  user: CurrentUser | null;
  authStatus: 'loading' | 'guest' | 'ready';
  entries: ServerWatchEntry[];
  onLogin: () => void;
}) {
  const watchedCount = entries.filter((entry) => entry.status === 'COMPLETED').length;
  const watchingCount = entries.filter((entry) => entry.status === 'WATCHING').length;
  const reviewedCount = entries.filter((entry) => entry.review).length;

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
      <header className="profile-header">
        {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <div className="avatar-fallback large">{user.displayName[0]}</div>}
        <div>
          <p className="eyebrow">Профиль</p>
          <h2>{user.displayName}</h2>
        </div>
      </header>

      <div className="profile-stats">
        <span>Смотрю<strong>{watchingCount}</strong></span>
        <span>Просмотрено<strong>{watchedCount}</strong></span>
        <span>Рецензии<strong>{reviewedCount}</strong></span>
      </div>

      <section className="diary-list">
          <h3>Дневник</h3>
          {entries.length === 0 ? (
            <p className="muted-copy">Пока нет записей. Выбери тайтл и сохрани первую запись.</p>
          ) : (
            entries.map((entry) => (
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

    </section>
  );
}

function AnimeHero({
  anime,
  state,
  onStateChange,
  mode = 'default',
  sidebarExtra,
}: {
  anime: AnimeTitle;
  state: WatchState;
  onStateChange: (patch: Partial<WatchState>) => void;
  mode?: 'default' | 'watchParty';
  sidebarExtra?: ReactNode;
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
        setPlayersStatus(response.providers.length ? '' : 'Провайдеры пока не нашли этот тайтл.');
      } catch {
        if (!ignore) {
          setPlayers([]);
          setPlayersStatus('Не удалось загрузить провайдеров.');
        }
      }
    }

    loadPlayers();

    return () => {
      ignore = true;
    };
  }, [anime.id, state.episode]);

  return (
    <>
      <div className={mode === 'watchParty' ? 'player-layout watch-party-player-layout' : 'player-layout'}>
        <section className="player">
          {selectedPlayer && isPlayablePlayer(selectedPlayer) ? (
            <VideoPlayer anime={anime} player={selectedPlayer} />
          ) : (
            <div className="video-frame">
              <PlayerLoader />
            </div>
          )}
          {(!selectedPlayer || !isPlayablePlayer(selectedPlayer)) && playersStatus ? (
            <p className="player-status">{playersStatus}</p>
          ) : null}

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

function pushAnimeRoute(
  animeId: string,
  setCurrentPath: (path: string | ((current: string) => string)) => void,
  scrollByPathRef: MutableRefObject<Record<string, number>>,
) {
  const path = `/anime/${encodeURIComponent(animeId)}`;
  navigateToRemembered(path, setCurrentPath, scrollByPathRef);
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
