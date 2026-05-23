import { useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import randomDiceIcon from './assets/random-dice.svg';
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

const STORAGE_KEY = 'anima.watchState.v1';

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
    <main className="app-shell">
      <aside className="library-panel" aria-label="Каталог аниме">
        <div className="brand-row">
          <div>
            <p className="eyebrow">Anima</p>
            <h1>Просмотр</h1>
          </div>
        </div>

        <AuthPanel
          user={user}
          authStatus={authStatus}
          onLogin={loginWithDiscord}
          onProfile={() => {
            navigateTo('/profile', setCurrentPath);
            setView('profile');
          }}
        />

        <nav className="side-nav" aria-label="Разделы">
          <button
            className={view === 'watch' ? 'active' : ''}
            onClick={() => {
              navigateTo('/anime', setCurrentPath);
              setView('watch');
            }}
          >
            <span>Просмотр</span>
            <small>Каталог Shikimori</small>
          </button>
          <button
            className={view === 'random' ? 'active' : ''}
            onClick={() => {
              navigateTo('/random', setCurrentPath);
              setView('random');
            }}
          >
            <span>Случайное аниме</span>
            <small>Подборка наугад</small>
          </button>
          <button disabled>
            <span>Угадай опенинг</span>
            <small>Скоро</small>
          </button>
        </nav>
      </aside>

      <section className="watch-area">
        {view === 'random' ? (
          <RandomAnimePage
            randomAnime={randomAnime}
            history={randomHistory}
            loading={randomLoading}
            status={randomStatus}
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
  onLogin,
  onProfile,
}: {
  user: CurrentUser | null;
  authStatus: 'loading' | 'guest' | 'ready';
  onLogin: () => void;
  onProfile: () => void;
}) {
  if (authStatus === 'loading') {
    return <div className="auth-panel muted">Проверяем сессию...</div>;
  }

  if (!user) {
    return (
      <div className="auth-panel">
        <div>
          <strong>Гостевой режим</strong>
          <span>Прогресс хранится только в этом браузере</span>
        </div>
        <button className="discord-button" onClick={onLogin}>Войти через Discord</button>
      </div>
    );
  }

  return (
    <div className="auth-panel signed-in">
      <button className="profile-link" onClick={onProfile}>
        {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <div className="avatar-fallback">{user.displayName[0]}</div>}
        <span>
          <strong>{user.displayName}</strong>
        </span>
      </button>
    </div>
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
            <a key={`${result.provider}-${result.providerId}`} className="browse-card" href={animeRouteFromCatalog(result)}>
              {result.posterUrl ? <img src={result.posterUrl} alt="" /> : null}
              <div>
                <strong>{result.title}</strong>
                <small>{result.originalTitle}</small>
                <small>
                  {result.episodes} сер. · {result.score ?? 'без оценки'}
                </small>
              </div>
            </a>
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
  onRandomize,
}: {
  randomAnime: CatalogSearchResult | null;
  history: CatalogSearchResult[];
  loading: boolean;
  status: string;
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
          <a className="random-card" href={animeRouteFromCatalog(randomAnime)}>
            {randomAnime.posterUrl ? <img src={randomAnime.posterUrl} alt="" /> : null}
            <div>
              <strong>{randomAnime.title}</strong>
              <small>{randomAnime.originalTitle}</small>
              <small>
                {randomAnime.episodes} сер. · {randomAnime.score ?? 'без оценки'}
              </small>
            </div>
          </a>
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
            <a key={`${item.provider}-${item.providerId}`} href={animeRouteFromCatalog(item)} className="random-history-row">
              {item.posterUrl ? <img src={item.posterUrl} alt="" /> : <div className="poster-fallback" />}
              <span>
                <strong>{item.title}</strong>
                <small>{item.score ?? 'без оценки'}</small>
              </span>
            </a>
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
  const progress = Math.round((state.episode / anime.episodes) * 100);
  const [players, setPlayers] = useState<PlayerProviderResult[]>([]);
  const [playersStatus, setPlayersStatus] = useState('Ищем плееры провайдеров...');
  const playablePlayers = players.filter((player) => player.streamUrl);
  const selectedPlayer = playablePlayers[0] ?? players[0];

  useEffect(() => {
    let ignore = false;

    async function loadPlayers() {
      setPlayersStatus('Ищем плееры провайдеров...');
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
          {selectedPlayer?.streamUrl ? <HlsPlayer anime={anime} player={selectedPlayer} /> : null}
          <div className={selectedPlayer?.streamUrl ? 'video-frame hidden-frame' : 'video-frame'}>
            <img src={anime.backdrop} alt="" />
            <div className="play-overlay">
              <button aria-label="Запустить эпизод">▶</button>
              <span>
                Серия {state.episode}: {anime.sampleEpisodeTitle}
              </span>
            </div>
          </div>

          <div className="episode-controls">
            <button onClick={() => onStateChange({ episode: state.episode - 1 })}>Назад</button>
            <label>
              Серия
              <input
                type="number"
                min="1"
                max={anime.episodes}
                value={state.episode}
                onChange={(event) => onStateChange({ episode: Number(event.target.value) })}
              />
            </label>
            <button onClick={() => onStateChange({ episode: state.episode + 1 })}>Дальше</button>
          </div>
          {!selectedPlayer?.streamUrl && playersStatus ? <p className="player-status">{playersStatus}</p> : null}
        </section>

        <aside className="details-panel">
          <img className="poster" src={anime.poster} alt="" />
          <div>
            <p className="eyebrow">{anime.originalTitle}</p>
            <h2>{anime.title}</h2>
            <p className="description">{anime.description}</p>
          </div>

          <div className="meta-grid">
            <span>Год<strong>{anime.year}</strong></span>
            <span>Серии<strong>{anime.episodes}</strong></span>
            <span>Студия<strong>{anime.studio}</strong></span>
            <span>Рейтинг<strong>{anime.rating}</strong></span>
          </div>

          <div className="genres">
            {anime.genres.map((genre) => (
              <span key={genre}>{genre}</span>
            ))}
          </div>

          <div className="watch-tools">
            <select value={state.status} onChange={(event) => onStateChange({ status: event.target.value as WatchState['status'] })}>
              <option value="planned">В планах</option>
              <option value="watching">Смотрю</option>
              <option value="completed">Просмотрено</option>
              <option value="dropped">Брошено</option>
            </select>
            <button onClick={() => onStateChange({ status: 'watching' })}>Продолжить</button>
          </div>

          <div className="progress-block">
            <span>Прогресс {progress}%</span>
            <div>
              <i style={{ width: `${progress}%` }} />
            </div>
          </div>
          <WatchSources anime={anime} />
        </aside>
      </div>

      <section className="episodes">
        <h3>Серии</h3>
        <div className="episode-grid">
          {Array.from({ length: anime.episodes }, (_, index) => index + 1).map((episode) => (
            <button
              key={episode}
              className={episode === state.episode ? 'current' : ''}
              onClick={() => onStateChange({ episode, status: 'watching' })}
            >
              {episode}
            </button>
          ))}
        </div>
      </section>
    </>
  );
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
      <div className="player-badge">
        {player.title} · {qualityLabel(player.quality)}
      </div>
    </div>
  );
}

function WatchSources({ anime }: { anime: AnimeTitle }) {
  return (
    <div className="sources-block">
      <h3>Источники просмотра</h3>
      {anime.watchSources.map((source) => (
        <a key={source.name} href={source.url} target="_blank" rel="noreferrer" className="source-link">
          <span>
            <strong>{source.name}</strong>
            <small>{source.note}</small>
          </span>
          <em>{source.subtitles.join(', ')}</em>
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

function qualityLabel(quality: PlayerProviderResult['quality']) {
  switch (quality) {
    case 'fhd':
      return '1080p HLS';
    case 'hd':
      return '720p HLS';
    case 'sd':
      return '480p HLS';
    default:
      return 'HLS';
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
    genres: [anime.kind ?? 'Аниме'],
    description: anime.sourceUrl ? `Импортировано из Shikimori${anime.malId ? ` · MAL ${anime.malId}` : ''}` : 'Импортированный тайтл.',
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
