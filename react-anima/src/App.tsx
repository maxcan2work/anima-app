import { useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import episodeArrowIcon from './assets/episode-arrow.svg';
import loginIcon from './assets/login.svg';
import musicNoteIcon from './assets/music-note.svg';
import nekoIcon from './assets/neko.svg';
import randomDiceIcon from './assets/random-dice.svg';
import sidebarExpandIcon from './assets/sidebar-expand.svg';
import sidebarShrinkIcon from './assets/sidebar-shrink.svg';
import {
  browseCatalog,
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

const STORAGE_KEY = 'anima.watchState.v1';
const SIDEBAR_STORAGE_KEY = 'anima.sidebarCollapsed.v1';
const EPISODES_PER_PAGE = 15;
const PLAYER_PROVIDER_OPTIONS: Array<{ value: PlayerProvider; label: string }> = [
  { value: 'anilibria', label: 'AniLiberty' },
  { value: 'kodik', label: 'Kodik' },
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
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [authStatus, setAuthStatus] = useState<'loading' | 'guest' | 'ready'>('loading');
  const [syncStatus, setSyncStatus] = useState('');
  const [view, setView] = useState<'watch' | 'profile' | 'random'>(() => getViewFromPath(window.location.pathname));
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(loadSidebarCollapsed);
  const routeAnimeId = getRouteAnimeId(currentPath);

  const selected = library.find((anime) => anime.id === selectedId) ?? library[0] ?? null;

  useEffect(() => {
    function handlePopState() {
      setCurrentPath(window.location.pathname);
      setView(getViewFromPath(window.location.pathname));
    }

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    saveSidebarCollapsed(sidebarCollapsed);
  }, [sidebarCollapsed]);

  function openCatalogAnime(result: CatalogSearchResult) {
    navigateTo(animeRouteFromCatalog(result), setCurrentPath);
    setView('watch');
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
      try {
        const response = await getAnimeById(routeAnimeId);
        if (ignore) return;

        const anime = mapServerAnime(response.anime);
        setLibrary((current) => mergeAnimeLibrary(current, [anime]));
        setSelectedId(anime.id);
        setView('watch');
      } catch {
        const shikimoriId = parseShikimoriRouteId(routeAnimeId);
        if (!shikimoriId) return;

        try {
          const response = await importCatalogAnime('shikimori', shikimoriId);
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
  }, [routeAnimeId]);

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
      pushAnimeRoute(anime.id, setCurrentPath);
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
              navigateTo('/anime', setCurrentPath);
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
              navigateTo('/random', setCurrentPath);
              setView('random');
            }}
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
            navigateTo('/profile', setCurrentPath);
            setView('profile');
          }}
        />
      </aside>

      <section className="watch-area">
        {view === 'random' ? (
          <RandomAnimePage
            randomAnime={randomAnime}
            history={randomHistory}
            loading={randomLoading}
            status={randomStatus}
            onOpenAnime={openCatalogAnime}
            onRandomize={handleRandomAnime}
          />
        ) : view === 'watch' && !routeAnimeId ? (
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
        ) : !selected ? (
          <EmptyCatalog />
        ) : view === 'watch' ? (
          <AnimeHero
            anime={selected}
            state={watchState[selected.id] ?? { episode: 1, status: 'planned' }}
            onStateChange={(patch) => updateState(selected.id, patch)}
          />
        ) : (
          <ProfilePage
            user={user}
            authStatus={authStatus}
            entries={diaryEntries}
            onLogin={loginWithDiscord}
          />
        )}
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
  onOpenAnime,
  onRandomize,
}: {
  randomAnime: CatalogSearchResult | null;
  history: CatalogSearchResult[];
  loading: boolean;
  status: string;
  onOpenAnime: (result: CatalogSearchResult) => void;
  onRandomize: () => void;
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
        <h3>История</h3>
        {history.length === 0 ? (
          <p className="muted-copy">Здесь появятся последние варианты.</p>
        ) : (
          history.map((item) => (
            <button
              key={`${item.provider}-${item.providerId}`}
              className="random-history-row"
              onClick={() => onOpenAnime(item)}
              type="button"
            >
              {item.posterUrl ? <img src={item.posterUrl} alt="" /> : <div className="poster-fallback" />}
              <span>
                <strong>{item.title}</strong>
                <small>{item.score ?? 'без оценки'}</small>
              </span>
            </button>
          ))
        )}
      </aside>
    </section>
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
}: {
  anime: AnimeTitle;
  state: WatchState;
  onStateChange: (patch: Partial<WatchState>) => void;
}) {
  const [players, setPlayers] = useState<PlayerProviderResult[]>([]);
  const [playersStatus, setPlayersStatus] = useState('');
  const [selectedProviderName, setSelectedProviderName] = useState<PlayerProvider>('kodik');
  const [episodePage, setEpisodePage] = useState(0);
  const playablePlayers = players.filter(isPlayablePlayer);
  const selectedProviderPlayer = playablePlayers.find((player) => player.provider === selectedProviderName);
  const selectedPlayer = selectedProviderPlayer ?? playablePlayers[0] ?? players[0];
  const episodePages = Math.max(1, Math.ceil(anime.episodes / EPISODES_PER_PAGE));
  const visibleEpisodes = useMemo(() => {
    const start = episodePage * EPISODES_PER_PAGE + 1;
    const end = Math.min(anime.episodes, start + EPISODES_PER_PAGE - 1);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [anime.episodes, episodePage]);

  useEffect(() => {
    setEpisodePage(Math.min(episodePages - 1, Math.floor((state.episode - 1) / EPISODES_PER_PAGE)));
  }, [anime.id, episodePages, state.episode]);

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
      <div className="player-layout">
        <section className="player">
          {selectedPlayer && isPlayablePlayer(selectedPlayer) ? <VideoPlayer anime={anime} player={selectedPlayer} /> : null}
          <div className={selectedPlayer && isPlayablePlayer(selectedPlayer) ? 'video-frame hidden-frame' : 'video-frame'}>
            <img src={anime.backdrop} alt="" />
            <div className="play-overlay">
              <button aria-label="Запустить эпизод">▶</button>
              <span>
                Серия {state.episode}: {anime.sampleEpisodeTitle}
              </span>
            </div>
          </div>

          {!selectedPlayer?.streamUrl && playersStatus ? <p className="player-status">{playersStatus}</p> : null}

          <section className="episodes" aria-label="Серии">
            <button
              className="episode-scroll"
              type="button"
              onClick={() => setEpisodePage((page) => Math.max(0, page - 1))}
              disabled={episodePage === 0}
              aria-label="Предыдущие серии"
            >
              <img src={episodeArrowIcon} alt="" aria-hidden="true" />
            </button>
            <div className="episode-grid">
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
              onClick={() => setEpisodePage((page) => Math.min(episodePages - 1, page + 1))}
              disabled={episodePage >= episodePages - 1}
              aria-label="Следующие серии"
            >
              <img src={episodeArrowIcon} alt="" aria-hidden="true" />
            </button>

          </section>
        </section>

        <aside className="details-panel">
          <img className="poster" src={anime.poster} alt="" />
          <div>
            <p className="eyebrow">{anime.originalTitle}</p>
            <h2>{anime.title}</h2>
            <div className="genres">
              {anime.genres.map((genre) => (
                <span key={genre}>{genre}</span>
              ))}
            </div>
          </div>

          <div className="meta-grid">
            <span>Год<strong>{anime.year}</strong></span>
            <span>Серии<strong>{anime.episodes}</strong></span>
            <span>Студия<strong>{anime.studio}</strong></span>
            <span>Рейтинг<strong>{anime.rating}</strong></span>
          </div>

          <div className="watch-tools">
            <PlayerProviderSelect players={players} value={selectedProviderName} onChange={setSelectedProviderName} />
            <WatchStatusSelect value={state.status} onChange={(status) => onStateChange({ status })} />
          </div>
          <WatchSources anime={anime} />
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
  if (player.streamType === 'iframe' && player.embedUrl) {
    return (
      <div className="video-frame">
        <iframe
          src={player.embedUrl}
          title={player.title}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return <HlsPlayer anime={anime} player={player} />;
}

function HlsPlayer({ anime, player }: { anime: AnimeTitle; player: PlayerProviderResult }) {
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
      <video ref={videoRef} controls poster={anime.backdrop} />
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

function getViewFromPath(pathname: string): 'watch' | 'profile' | 'random' {
  if (pathname === '/profile') return 'profile';
  if (pathname === '/random') return 'random';
  return 'watch';
}

function parseShikimoriRouteId(animeId: string) {
  const match = animeId.match(/^shikimori-(\d+)$/);
  return match ? Number(match[1]) : null;
}

function animeRouteFromCatalog(result: CatalogSearchResult) {
  return `/anime/shikimori-${result.providerId}`;
}

function navigateTo(path: string, setCurrentPath: (path: string) => void) {
  if (window.location.pathname !== path) {
    window.history.pushState(null, '', path);
  }
  setCurrentPath(path);
}

function pushAnimeRoute(animeId: string, setCurrentPath: (path: string) => void) {
  const path = `/anime/${encodeURIComponent(animeId)}`;
  navigateTo(path, setCurrentPath);
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
