import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  browseCatalog,
  getCurrentUser,
  getAnimeCatalog,
  getEpisodePlayers,
  getMyAnimeList,
  importCatalogAnime,
  loginWithDiscord,
  logout,
  saveAnimeProgress,
  searchCatalog,
  type CatalogSearchResult,
  type CurrentUser,
  type PlayerProviderResult,
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
  const [query, setQuery] = useState('');
  const [library, setLibrary] = useState<AnimeTitle[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [watchState, setWatchState] = useState<Record<string, WatchState>>(loadWatchState);
  const [diaryEntries, setDiaryEntries] = useState<ServerWatchEntry[]>([]);
  const [catalogResults, setCatalogResults] = useState<CatalogSearchResult[]>([]);
  const [browseResults, setBrowseResults] = useState<CatalogSearchResult[]>([]);
  const [browsePage, setBrowsePage] = useState(1);
  const [browseHasNext, setBrowseHasNext] = useState(true);
  const [browseStatus, setBrowseStatus] = useState('Загружаем каталог Shikimori...');
  const [catalogStatus, setCatalogStatus] = useState('');
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [authStatus, setAuthStatus] = useState<'loading' | 'guest' | 'ready'>('loading');
  const [syncStatus, setSyncStatus] = useState('');
  const [view, setView] = useState<'watch' | 'profile'>('watch');

  const selected = library.find((anime) => anime.id === selectedId) ?? library[0] ?? null;

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
          setCatalogStatus('Не удалось загрузить локальный каталог.');
        }
      }
    }

    loadCatalog();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadBrowse() {
      setBrowseStatus('Загружаем каталог Shikimori...');
      try {
        const response = await browseCatalog(browsePage);
        if (ignore) return;

        setBrowseResults(response.results);
        setBrowseHasNext(response.hasNextPage);
        setBrowseStatus('');
      } catch {
        if (!ignore) {
          setBrowseResults([]);
          setBrowseStatus('Не удалось загрузить каталог Shikimori.');
        }
      }
    }

    loadBrowse();

    return () => {
      ignore = true;
    };
  }, [browsePage]);

  useEffect(() => {
    let ignore = false;

    async function loadSession() {
      try {
        const [{ user: currentUser }, { list }] = await Promise.all([getCurrentUser(), getMyAnimeList()]);
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

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return library;

    return library.filter((anime) => {
      return [anime.title, anime.originalTitle, anime.genres.join(' '), anime.studio]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [library, query]);

  async function handleCatalogSearch() {
    const needle = query.trim();
    if (needle.length < 2) {
      setCatalogStatus('Введите минимум 2 символа.');
      return;
    }

    setCatalogStatus('Ищем в Shikimori...');
    try {
      const response = await searchCatalog(needle);
      setCatalogResults(response.results);
      setCatalogStatus(response.results.length ? '' : 'Во внешнем каталоге ничего не найдено.');
    } catch {
      setCatalogResults([]);
      setCatalogStatus('Не удалось выполнить поиск.');
    }
  }

  async function handleImportCatalogAnime(result: CatalogSearchResult) {
    if (!user) {
      setCatalogStatus('Для импорта и дневника нужно войти через Discord.');
      return;
    }

    setCatalogStatus('Добавляем в каталог...');
    try {
      const response = await importCatalogAnime(result.provider, result.providerId);
      const anime = mapServerAnime(response.anime);
      setLibrary((current) => mergeAnimeLibrary(current, [anime]));
      setSelectedId(anime.id);
      setView('watch');
      setCatalogStatus('Тайтл добавлен в каталог.');
    } catch {
      setCatalogStatus('Не удалось добавить тайтл.');
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
    setWatchState(loadWatchState());
  }

  async function handleDiarySave(animeId: string, entry: DiaryFormState) {
    const anime = library.find((item) => item.id === animeId);
    const currentEpisode = Math.min(Math.max(Number(entry.currentEpisode) || 1, 1), anime?.episodes ?? 1);

    setSyncStatus('Сохраняем дневник...');
    const response = await saveAnimeProgress(animeId, {
      status: entry.status,
      currentEpisode,
      score: entry.score ? Number(entry.score) : null,
      startedAt: entry.startedAt || null,
      completedAt: entry.completedAt || null,
      review: entry.review || null,
    });

    setDiaryEntries((entries) => upsertDiaryEntry(entries, response.entry));
    setWatchState((current) => ({
      ...current,
      [animeId]: {
        episode: response.entry.currentEpisode,
        status: fromServerStatus(response.entry.status),
      },
    }));
    setSyncStatus('Дневник сохранен');
  }

  return (
    <main className="app-shell">
      <aside className="library-panel" aria-label="Каталог аниме">
        <div className="brand-row">
          <div>
            <p className="eyebrow">Anima</p>
            <h1>Просмотр</h1>
          </div>
          <span className="counter">{library.length}</span>
        </div>

        <AuthPanel
          user={user}
          authStatus={authStatus}
          syncStatus={syncStatus}
          onLogin={loginWithDiscord}
          onLogout={handleLogout}
        />

        <nav className="view-tabs" aria-label="Разделы">
          <button className={view === 'watch' ? 'active' : ''} onClick={() => setView('watch')}>Просмотр</button>
          <button className={view === 'profile' ? 'active' : ''} onClick={() => setView('profile')}>Профиль</button>
        </nav>

        <label className="search-field">
          <span>Поиск</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Название, жанр, студия"
          />
        </label>

        <button className="catalog-search-button" onClick={handleCatalogSearch}>Искать в Shikimori</button>
        {catalogStatus ? <p className="catalog-status">{catalogStatus}</p> : null}

        <div className="title-list">
          {filtered.map((anime) => (
            <AnimeListItem
              key={anime.id}
              anime={anime}
              active={anime.id === selected?.id}
              progress={watchState[anime.id]}
              onSelect={() => setSelectedId(anime.id)}
            />
          ))}
        </div>

        {catalogResults.length > 0 ? (
          <div className="catalog-results">
            <h3>Shikimori</h3>
            {catalogResults.map((result) => (
              <button key={`${result.provider}-${result.providerId}`} className="catalog-result" onClick={() => handleImportCatalogAnime(result)}>
                {result.posterUrl ? <img src={result.posterUrl} alt="" /> : null}
                <span>
                  <strong>{result.title}</strong>
                  <small>
                    {result.originalTitle} · {result.episodes} сер.
                  </small>
                  <small>
                    MAL {result.malId ?? '-'} · {result.score ?? 'без оценки'}
                  </small>
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </aside>

      <section className="watch-area">
        {view === 'watch' ? (
          <WatchHome
            selected={selected}
            browseResults={browseResults}
            browsePage={browsePage}
            browseHasNext={browseHasNext}
            browseStatus={browseStatus}
            onPageChange={setBrowsePage}
            onImport={handleImportCatalogAnime}
            renderSelected={() =>
              selected ? (
                <AnimeHero
                  anime={selected}
                  state={watchState[selected.id] ?? { episode: 1, status: 'planned' }}
                  onStateChange={(patch) => updateState(selected.id, patch)}
                />
              ) : null
            }
          />
        ) : !selected ? (
          <EmptyCatalog onSearch={handleCatalogSearch} />
        ) : (
          <ProfilePage
            user={user}
            authStatus={authStatus}
            library={library}
            entries={diaryEntries}
            selectedAnime={selected}
            watchState={watchState}
            onLogin={loginWithDiscord}
            onSelectAnime={(id) => {
              setSelectedId(id);
              setView('watch');
            }}
            onSave={handleDiarySave}
          />
        )}
      </section>
    </main>
  );
}

function AuthPanel({
  user,
  authStatus,
  syncStatus,
  onLogin,
  onLogout,
}: {
  user: CurrentUser | null;
  authStatus: 'loading' | 'guest' | 'ready';
  syncStatus: string;
  onLogin: () => void;
  onLogout: () => void;
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
      {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <div className="avatar-fallback">{user.displayName[0]}</div>}
      <div>
        <strong>{user.displayName}</strong>
        <span>{syncStatus || 'Прогресс синхронизируется'}</span>
      </div>
      <button className="text-button" onClick={onLogout}>Выйти</button>
    </div>
  );
}

function EmptyCatalog({ onSearch }: { onSearch: () => void }) {
  return (
    <section className="empty-catalog">
      <p className="eyebrow">Shikimori</p>
      <h2>Каталог пуст</h2>
      <p>Найди аниме через Shikimori и добавь его в Anima, чтобы вести просмотр, дневник и искать плееры AniLibria.</p>
      <button className="catalog-search-button" onClick={onSearch}>Искать по запросу</button>
    </section>
  );
}

function WatchHome({
  selected,
  browseResults,
  browsePage,
  browseHasNext,
  browseStatus,
  onPageChange,
  onImport,
  renderSelected,
}: {
  selected: AnimeTitle | null;
  browseResults: CatalogSearchResult[];
  browsePage: number;
  browseHasNext: boolean;
  browseStatus: string;
  onPageChange: (page: number) => void;
  onImport: (result: CatalogSearchResult) => void;
  renderSelected: () => ReactNode;
}) {
  return (
    <section className="watch-home">
      <header className="browse-header">
        <div>
          <p className="eyebrow">Shikimori</p>
          <h2>Каталог аниме</h2>
        </div>
        <div className="browse-pager">
          <button disabled={browsePage <= 1} onClick={() => onPageChange(browsePage - 1)}>Назад</button>
          <span>Страница {browsePage}</span>
          <button disabled={!browseHasNext} onClick={() => onPageChange(browsePage + 1)}>Дальше</button>
        </div>
      </header>

      {browseStatus ? <p className="catalog-status">{browseStatus}</p> : null}

      <div className="browse-grid">
        {browseResults.map((result) => (
          <article key={`${result.provider}-${result.providerId}`} className="browse-card">
            {result.posterUrl ? <img src={result.posterUrl} alt="" /> : null}
            <div>
              <strong>{result.title}</strong>
              <small>{result.originalTitle}</small>
              <small>
                {result.episodes} сер. · {result.score ?? 'без оценки'}
              </small>
            </div>
            <button onClick={() => onImport(result)}>Добавить</button>
          </article>
        ))}
      </div>

      {selected ? (
        <div className="selected-watch-block">
          <header className="section-heading">
            <h3>Выбранный тайтл</h3>
          </header>
          {renderSelected()}
        </div>
      ) : null}
    </section>
  );
}

type DiaryFormState = {
  status: WatchState['status'];
  currentEpisode: number;
  score: string;
  startedAt: string;
  completedAt: string;
  review: string;
};

function ProfilePage({
  user,
  authStatus,
  entries,
  library,
  selectedAnime,
  watchState,
  onLogin,
  onSelectAnime,
  onSave,
}: {
  user: CurrentUser | null;
  authStatus: 'loading' | 'guest' | 'ready';
  library: AnimeTitle[];
  entries: ServerWatchEntry[];
  selectedAnime: AnimeTitle;
  watchState: Record<string, WatchState>;
  onLogin: () => void;
  onSelectAnime: (id: string) => void;
  onSave: (animeId: string, entry: DiaryFormState) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState(selectedAnime.id);
  const editingAnime = library.find((anime) => anime.id === editingId) ?? selectedAnime;
  const editingEntry = entries.find((entry) => entry.animeId === editingAnime.id);
  const currentState = watchState[editingAnime.id] ?? { episode: 1, status: 'planned' };
  const [form, setForm] = useState<DiaryFormState>(() => createDiaryForm(editingEntry, currentState));
  const watchedCount = entries.filter((entry) => entry.status === 'COMPLETED').length;
  const watchingCount = entries.filter((entry) => entry.status === 'WATCHING').length;
  const reviewedCount = entries.filter((entry) => entry.review).length;

  useEffect(() => {
    setEditingId(selectedAnime.id);
  }, [selectedAnime.id]);

  useEffect(() => {
    setForm(createDiaryForm(editingEntry, currentState));
  }, [editingAnime.id, editingEntry, currentState.episode, currentState.status]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSave(editingAnime.id, form);
  }

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

      <div className="diary-layout">
        <section className="diary-list">
          <h3>Дневник</h3>
          {entries.length === 0 ? (
            <p className="muted-copy">Пока нет записей. Выбери тайтл и сохрани первую запись.</p>
          ) : (
            entries.map((entry) => (
              <button key={entry.id} className={entry.animeId === editingAnime.id ? 'diary-row active' : 'diary-row'} onClick={() => setEditingId(entry.animeId)}>
                <img src={entry.anime?.posterUrl ?? library.find((anime) => anime.id === entry.animeId)?.poster} alt="" />
                <span>
                  <strong>{entry.anime?.title ?? entry.animeId}</strong>
                  <small>{statusLabel(fromServerStatus(entry.status))} · серия {entry.currentEpisode}</small>
                </span>
                {entry.score ? <em>{entry.score}/10</em> : null}
              </button>
            ))
          )}
        </section>

        <form className="diary-editor" onSubmit={submit}>
          <div className="editor-title">
            <img src={editingAnime.poster} alt="" />
            <div>
              <p className="eyebrow">Запись дневника</p>
              <h3>{editingAnime.title}</h3>
              <button type="button" className="text-button" onClick={() => onSelectAnime(editingAnime.id)}>Открыть просмотр</button>
            </div>
          </div>

          <div className="form-grid">
            <label>
              Статус
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as WatchState['status'] })}>
                <option value="planned">В планах</option>
                <option value="watching">Смотрю</option>
                <option value="completed">Просмотрено</option>
                <option value="dropped">Брошено</option>
              </select>
            </label>
            <label>
              Серия
              <input
                type="number"
                min="1"
                max={editingAnime.episodes}
                value={form.currentEpisode}
                onChange={(event) => setForm({ ...form, currentEpisode: Number(event.target.value) })}
              />
            </label>
            <label>
              Оценка
              <input
                type="number"
                min="1"
                max="10"
                value={form.score}
                onChange={(event) => setForm({ ...form, score: event.target.value })}
                placeholder="1-10"
              />
            </label>
            <label>
              Начал
              <input type="date" value={form.startedAt} onChange={(event) => setForm({ ...form, startedAt: event.target.value })} />
            </label>
            <label>
              Закончил
              <input type="date" value={form.completedAt} onChange={(event) => setForm({ ...form, completedAt: event.target.value })} />
            </label>
          </div>

          <label className="review-field">
            Рецензия
            <textarea
              value={form.review}
              onChange={(event) => setForm({ ...form, review: event.target.value })}
              placeholder="Что понравилось, что не сработало, стоит ли советовать"
            />
          </label>

          <button className="save-button" type="submit">Сохранить запись</button>
        </form>
      </div>
    </section>
  );
}

function AnimeListItem({
  anime,
  active,
  progress,
  onSelect,
}: {
  anime: AnimeTitle;
  active: boolean;
  progress?: WatchState;
  onSelect: () => void;
}) {
  return (
    <button className={`anime-row ${active ? 'active' : ''}`} onClick={onSelect}>
      <img src={anime.poster} alt="" />
      <span>
        <strong>{anime.title}</strong>
        <small>
          {anime.year} · {anime.genres.slice(0, 2).join(', ')}
        </small>
      </span>
      {progress ? <em>{progress.episode}/{anime.episodes}</em> : null}
    </button>
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
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const playablePlayers = players.filter((player) => player.streamUrl);
  const selectedPlayer = players.find((player) => player.providerTitleId === selectedPlayerId) ?? playablePlayers[0] ?? players[0];

  useEffect(() => {
    let ignore = false;

    async function loadPlayers() {
      setPlayersStatus('Ищем плееры провайдеров...');
      try {
        const response = await getEpisodePlayers(anime.id, state.episode);
        if (ignore) return;

        setPlayers(response.providers);
        setSelectedPlayerId(response.providers.find((player) => player.streamUrl)?.providerTitleId ?? response.providers[0]?.providerTitleId ?? '');
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
          <ProviderPlayers
            players={players}
            status={playersStatus}
            selectedPlayerId={selectedPlayer?.providerTitleId ?? ''}
            onSelect={setSelectedPlayerId}
          />
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

function ProviderPlayers({
  players,
  status,
  selectedPlayerId,
  onSelect,
}: {
  players: PlayerProviderResult[];
  status: string;
  selectedPlayerId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="provider-players">
      <div className="section-heading">
        <h3>Плееры провайдеров</h3>
        {status ? <span>{status}</span> : null}
      </div>
      <div className="provider-grid">
        {players.map((player) => (
          <button
            key={`${player.provider}-${player.providerTitleId}`}
            className={`provider-card ${player.providerTitleId === selectedPlayerId ? 'active' : ''}`}
            onClick={() => onSelect(player.providerTitleId)}
            type="button"
          >
            {player.posterUrl ? <img src={player.posterUrl} alt="" /> : null}
            <span>
              <strong>{player.title}</strong>
              <small>{player.originalTitle ?? 'AniLibria / AniLiberty'}</small>
              <small>
                Серия {player.requestedEpisode}
                {player.episodeCount ? ` из ${player.episodeCount}` : ''} · {player.streamUrl ? qualityLabel(player.quality) : 'открыть у провайдера'}
              </small>
            </span>
            {player.streamUrl ? <em>В Anima</em> : <a href={player.watchUrl} target="_blank" rel="noreferrer">Сайт</a>}
          </button>
        ))}
      </div>
    </section>
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

function createDiaryForm(entry: ServerWatchEntry | undefined, fallback: WatchState): DiaryFormState {
  return {
    status: entry ? fromServerStatus(entry.status) : fallback.status,
    currentEpisode: entry?.currentEpisode ?? fallback.episode,
    score: entry?.score ? String(entry.score) : '',
    startedAt: toDateInput(entry?.startedAt),
    completedAt: toDateInput(entry?.completedAt),
    review: entry?.review ?? '',
  };
}

function toDateInput(value: string | null | undefined) {
  if (!value) return '';
  return value.slice(0, 10);
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
