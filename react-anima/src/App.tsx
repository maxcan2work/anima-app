import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  getCurrentUser,
  getMyAnimeList,
  loginWithDiscord,
  logout,
  saveAnimeProgress,
  type CurrentUser,
  type ServerWatchEntry,
} from './api';
import { ANIME_LIBRARY, type AnimeTitle } from './data';

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
  const [selectedId, setSelectedId] = useState(ANIME_LIBRARY[0].id);
  const [watchState, setWatchState] = useState<Record<string, WatchState>>(loadWatchState);
  const [diaryEntries, setDiaryEntries] = useState<ServerWatchEntry[]>([]);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [authStatus, setAuthStatus] = useState<'loading' | 'guest' | 'ready'>('loading');
  const [syncStatus, setSyncStatus] = useState('');
  const [view, setView] = useState<'watch' | 'profile'>('watch');

  const selected = ANIME_LIBRARY.find((anime) => anime.id === selectedId) ?? ANIME_LIBRARY[0];

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
    if (!needle) return ANIME_LIBRARY;

    return ANIME_LIBRARY.filter((anime) => {
      return [anime.title, anime.originalTitle, anime.genres.join(' '), anime.studio]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [query]);

  function updateState(id: string, patch: Partial<WatchState>) {
    setWatchState((current) => {
      const anime = ANIME_LIBRARY.find((item) => item.id === id);
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
    const anime = ANIME_LIBRARY.find((item) => item.id === animeId);
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
          <span className="counter">{ANIME_LIBRARY.length}</span>
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

        <div className="title-list">
          {filtered.map((anime) => (
            <AnimeListItem
              key={anime.id}
              anime={anime}
              active={anime.id === selected.id}
              progress={watchState[anime.id]}
              onSelect={() => setSelectedId(anime.id)}
            />
          ))}
        </div>
      </aside>

      <section className="watch-area">
        {view === 'watch' ? (
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
  selectedAnime,
  watchState,
  onLogin,
  onSelectAnime,
  onSave,
}: {
  user: CurrentUser | null;
  authStatus: 'loading' | 'guest' | 'ready';
  entries: ServerWatchEntry[];
  selectedAnime: AnimeTitle;
  watchState: Record<string, WatchState>;
  onLogin: () => void;
  onSelectAnime: (id: string) => void;
  onSave: (animeId: string, entry: DiaryFormState) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState(selectedAnime.id);
  const editingAnime = ANIME_LIBRARY.find((anime) => anime.id === editingId) ?? selectedAnime;
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
                <img src={entry.anime?.posterUrl ?? ANIME_LIBRARY.find((anime) => anime.id === entry.animeId)?.poster} alt="" />
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

  return (
    <>
      <div className="player-layout">
        <section className="player">
          <div className="video-frame">
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

function upsertDiaryEntry(entries: ServerWatchEntry[], entry: ServerWatchEntry) {
  const exists = entries.some((item) => item.id === entry.id);
  if (!exists) {
    return [entry, ...entries];
  }

  return entries.map((item) => (item.id === entry.id ? entry : item));
}
