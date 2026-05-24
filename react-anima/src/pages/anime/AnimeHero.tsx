import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { WATCH_STATUS_OPTIONS, type WatchStatus } from '@anima/core';
import Hls from 'hls.js';
import { getEpisodePlayers, type PlayerProviderResult } from '../../api';
import episodeArrowIcon from '../../assets/episode-arrow.svg';
import type { AnimeTitle } from '../../data';

type PlayerProvider = PlayerProviderResult['provider'];

type WatchState = {
  episode: number;
  status: WatchStatus;
};

type AnimeHeroProps = {
  anime: AnimeTitle;
  state: WatchState;
  onStateChange: (patch: Partial<WatchState>) => void;
  mode?: 'default' | 'watchParty';
  sidebarExtra?: ReactNode;
  footerExtra?: ReactNode;
};

const EPISODES_PER_PAGE = 12;
const PLAYER_PROVIDER_OPTIONS: Array<{ value: PlayerProvider; label: string }> = [
  { value: 'kodik', label: 'Kodik' },
  { value: 'anilibria', label: 'AniLiberty' },
];

export function AnimeHero({
  anime,
  state,
  onStateChange,
  mode = 'default',
  sidebarExtra,
  footerExtra,
}: AnimeHeroProps) {
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

export function AnimeHeroSkeleton() {
  return (
    <div className="player-layout anime-page-skeleton" aria-busy="true">
      <section className="player">
        <div className="video-frame player-frame-skeleton">
          <span />
        </div>
        <section className="episodes episodes-skeleton" aria-hidden="true">
          <span className="episode-scroll skeleton-block" />
          <div className="episode-grid">
            {Array.from({ length: EPISODES_PER_PAGE }, (_, index) => (
              <span className="skeleton-block" key={`episode-skeleton-${index}`} />
            ))}
          </div>
          <span className="episode-scroll skeleton-block" />
        </section>
      </section>

      <aside className="details-panel details-panel-skeleton">
        <div className="details-poster skeleton-panel" />
        <div className="genres skeleton-genres" aria-hidden="true">
          <div className="genres-track">
            {Array.from({ length: 5 }, (_, index) => (
              <span className="skeleton-pill" key={`genre-skeleton-${index}`} />
            ))}
          </div>
        </div>
        <div className="meta-grid">
          {Array.from({ length: 4 }, (_, index) => (
            <span className="skeleton-meta" key={`meta-skeleton-${index}`} />
          ))}
        </div>
        <div className="watch-tools">
          <span className="skeleton-control" />
          <span className="skeleton-control" />
        </div>
        <div className="sources-block">
          <span className="skeleton-source" />
        </div>
      </aside>
    </div>
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
    <div className="player-loader player-loader-skeleton" aria-label="Loading player">
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
