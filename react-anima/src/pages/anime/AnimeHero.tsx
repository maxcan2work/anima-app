import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getAnimeOriginalDisplayTitle, getLocalizedAnimeTitle, WATCH_STATUS_OPTIONS, type WatchStatus } from '@anima/core';
import { getEpisodePlayers, type PlayerProviderResult } from '@/api';
import episodeArrowIcon from '@assets/episode-arrow.svg';
import type { AnimeTitle } from '@/data';
import { useI18n } from '@shared/i18n/I18nProvider';
import { ControlledVideoPlayer, type PlaybackSync, type PlaybackSyncState } from './ControlledVideoPlayer';
import styles from './AnimeHero.module.css';

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
  playbackSync?: PlaybackSync;
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
  playbackSync,
  sidebarExtra,
  footerExtra,
}: AnimeHeroProps) {
  const { language } = useI18n();
  const [players, setPlayers] = useState<PlayerProviderResult[]>([]);
  const [playersStatus, setPlayersStatus] = useState('');
  const [selectedProviderName, setSelectedProviderName] = useState<PlayerProvider>('kodik');
  const [episodePage, setEpisodePage] = useState(0);
  const [episodePageDirection, setEpisodePageDirection] = useState<'next' | 'prev'>('next');
  const playablePlayers = players.filter(isPlayablePlayer);
  const preferredPlayers = mode === 'watchParty' ? orderWatchPartyPlayers(playablePlayers) : playablePlayers;
  const selectedProviderPlayer = preferredPlayers.find((player) => player.provider === selectedProviderName);
  const selectedPlayer = mode === 'watchParty'
    ? preferredPlayers[0]
    : selectedProviderPlayer ?? preferredPlayers[0] ?? players[0];
  const activeProviderName = selectedPlayer?.provider ?? selectedProviderName;
  const animeTitle = getLocalizedAnimeTitle(anime, language);
  const animeSecondaryTitle = getAnimeOriginalDisplayTitle(anime, language);
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
          setPlayersStatus('Не удалось загрузить плеер');
        }
      }
    }

    loadPlayers();

    return () => {
      ignore = true;
    };
  }, [anime.id, state.episode]);

  const episodeControls = (
    <section className={styles.episodes} aria-label="Серии">
      <button
        className={styles.episodeScroll}
        type="button"
        onClick={() => changeEpisodePage(episodePage - 1)}
        disabled={episodePage === 0}
        aria-label="Предыдущие серии"
      >
        <img src={episodeArrowIcon} alt="" aria-hidden="true" />
      </button>
      <div key={episodePage} className={clsx(styles.episodeGrid, episodePageDirection === 'next' ? styles.pageNext : styles.pagePrev)}>
        {visibleEpisodes.map((episode) => (
          <button
            key={episode}
            className={clsx(episode === state.episode && styles.currentEpisode)}
            onClick={() => onStateChange({ episode, status: 'watching' })}
          >
            {episode}
          </button>
        ))}
      </div>
      <button
        className={clsx(styles.episodeScroll, styles.episodeScrollNext)}
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
    <div className={clsx(styles.layout, mode === 'watchParty' && styles.watchPartyLayout)}>
      <section className={styles.player}>
        {selectedPlayer && isPlayablePlayer(selectedPlayer) ? (
          <VideoPlayer anime={anime} player={selectedPlayer} playbackSync={mode === 'watchParty' ? playbackSync : undefined} />
        ) : (
          <div className={styles.videoFrame}>
            {playersStatus ? <PlayerMessage message={playersStatus} /> : <PlayerLoader />}
          </div>
        )}

        {mode === 'default' ? episodeControls : null}
      </section>

      <aside className={styles.detailsPanel}>
        <div className={styles.detailsPoster}>
          <img src={anime.poster} alt="" />
          <div>
            {animeSecondaryTitle ? <p className="eyebrow">{animeSecondaryTitle}</p> : null}
            <h2>{animeTitle}</h2>
          </div>
        </div>
        <div className={styles.detailsContent}>
          <div className={styles.genres} tabIndex={0} aria-label="Жанры">
            <div className={styles.genresTrack}>
              {anime.genres.map((genre) => (
                <span key={genre}>{genre}</span>
              ))}
            </div>
          </div>
        </div>

        {mode === 'default' ? (
          <>
            <div className={styles.metaGrid}>
              <span>Год<strong>{anime.year}</strong></span>
              <span>Серии<strong>{anime.episodes}</strong></span>
              <span>Студия<strong>{anime.studio}</strong></span>
              <span>Рейтинг<strong>{anime.rating}</strong></span>
            </div>

            <div className={styles.watchTools}>
              <PlayerProviderSelect players={players} value={activeProviderName} onChange={setSelectedProviderName} />
              <WatchStatusSelect value={state.status} onChange={(status) => onStateChange({ status })} />
            </div>
            <WatchSources anime={anime} />
          </>
        ) : null}
        {sidebarExtra ? <div className={styles.watchPartyPanel}>{sidebarExtra}</div> : null}
      </aside>
      {mode === 'watchParty' ? (
        <div className={styles.watchPartyFooter}>
          {episodeControls}
          {footerExtra ? <div className={styles.watchPartyActions}>{footerExtra}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

export function AnimeHeroSkeleton() {
  return (
    <div className={clsx(styles.layout)} aria-busy="true">
      <section className={styles.player}>
        <div className={clsx(styles.videoFrame, styles.playerFrameSkeleton)}>
          <span />
        </div>
        <section className={clsx(styles.episodes, styles.episodesSkeleton)} aria-hidden="true">
          <span className={clsx(styles.episodeScroll, styles.skeletonBlock)} />
          <div className={styles.episodeGrid}>
            {Array.from({ length: EPISODES_PER_PAGE }, (_, index) => (
              <span className={styles.skeletonBlock} key={`episode-skeleton-${index}`} />
            ))}
          </div>
          <span className={clsx(styles.episodeScroll, styles.skeletonBlock)} />
        </section>
      </section>

      <aside className={clsx(styles.detailsPanel, styles.detailsPanelSkeleton)}>
        <div className={clsx(styles.detailsPoster, styles.skeletonPanel)} />
        <div className={styles.genres} aria-hidden="true">
          <div className={styles.genresTrack}>
            {Array.from({ length: 5 }, (_, index) => (
              <span className={styles.skeletonPill} key={`genre-skeleton-${index}`} />
            ))}
          </div>
        </div>
        <div className={styles.metaGrid}>
          {Array.from({ length: 4 }, (_, index) => (
            <span className={styles.skeletonMeta} key={`meta-skeleton-${index}`} />
          ))}
        </div>
        <div className={styles.watchTools}>
          <span className={styles.skeletonControl} />
          <span className={styles.skeletonControl} />
        </div>
        <div className={styles.sourcesBlock}>
          <span className={styles.skeletonSource} />
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
    <div className={styles.providerSelect} aria-label="Плеер">
      {PLAYER_PROVIDER_OPTIONS.map((option) => {
        const available = players.some((player) => player.provider === option.value && isPlayablePlayer(player));
        return (
          <button
            key={option.value}
            className={clsx(option.value === value && styles.selectedProvider)}
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
    <div className={styles.statusSelect} ref={rootRef}>
      <button
        className={styles.statusSelectTrigger}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected.label}</span>
        <span className={styles.statusSelectChevron} aria-hidden="true" />
      </button>

      {open ? (
        <div className={styles.statusSelectMenu} role="listbox" aria-label="Статус просмотра">
          {WATCH_STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={clsx(option.value === value && styles.selectedStatus)}
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

function VideoPlayer({
  anime,
  player,
  playbackSync,
}: {
  anime: AnimeTitle;
  player: PlayerProviderResult;
  playbackSync?: PlaybackSync;
}) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
  }, [player.embedUrl, player.streamUrl]);

  if (player.streamType === 'iframe' && player.embedUrl) {
    return (
      <div className={styles.videoFrame}>
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

  return (
    <ControlledVideoPlayer
      anime={anime}
      player={player}
      isLoading={isLoading}
      onReady={() => setIsLoading(false)}
      playbackSync={playbackSync}
    />
  );
}

function PlayerLoader() {
  return (
    <div className={clsx(styles.playerLoader, styles.playerLoaderSkeleton)} aria-label="Загрузка плеера">
      <span />
    </div>
  );
}

function PlayerMessage({ message }: { message: string }) {
  return (
    <div className={styles.playerMessage} role="status">
      <p>{message}</p>
    </div>
  );
}

function isPlayablePlayer(player: PlayerProviderResult) {
  return Boolean(player.streamUrl || player.embedUrl);
}

function orderWatchPartyPlayers(players: PlayerProviderResult[]) {
  return [...players].sort((left, right) => watchPartyProviderPriority(left.provider) - watchPartyProviderPriority(right.provider));
}

function watchPartyProviderPriority(provider: PlayerProvider) {
  return provider === 'anilibria' ? 0 : 1;
}

function WatchSources({ anime }: { anime: AnimeTitle }) {
  return (
    <div className={styles.sourcesBlock}>
      <h3>Источники</h3>
      {anime.watchSources.map((source) => (
        <a key={source.name} href={source.url} target="_blank" rel="noreferrer" className={styles.sourceLink}>
          <span>
            <strong>{source.name}</strong>
          </span>
        </a>
      ))}
    </div>
  );
}
