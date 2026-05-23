import { useEffect, useMemo, useState } from 'react';
import {
  getCurrentUser,
  getMyAnimeList,
  loginWithDiscord,
  logout,
  saveAnimeProgress,
  type CurrentUser,
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
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [authStatus, setAuthStatus] = useState<'loading' | 'guest' | 'ready'>('loading');
  const [syncStatus, setSyncStatus] = useState('');

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
          .then(() => setSyncStatus('Сохранено в профиле'))
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
          <span className="counter">{ANIME_LIBRARY.length}</span>
        </div>

        <AuthPanel
          user={user}
          authStatus={authStatus}
          syncStatus={syncStatus}
          onLogin={loginWithDiscord}
          onLogout={handleLogout}
        />

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
        <AnimeHero
          anime={selected}
          state={watchState[selected.id] ?? { episode: 1, status: 'planned' }}
          onStateChange={(patch) => updateState(selected.id, patch)}
        />
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
