import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { WATCH_STATUS_OPTIONS } from '@anima/core';
import { type PlayerProviderResult } from '@/api';
import shikimoriIcon from '@assets/shikimori.png';
import type { AnimeTitle } from '@/data';
import { useI18n } from '@shared/i18n/I18nProvider';
import { ControlledVideoPlayer, type PlaybackSync } from './ControlledVideoPlayer';
import { PLAYER_PROVIDER_OPTIONS } from './AnimeHero.constants';
import type { PlayerProvider, WatchState } from './AnimeHero.types';
import styles from './AnimeHero.module.css';

export function PlayerProviderSelect({
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

export function WatchStatusSelect({
  value,
  onChange,
}: {
  value: WatchState['status'];
  onChange: (value: WatchState['status']) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = WATCH_STATUS_OPTIONS.find((option) => option.value === value) ?? WATCH_STATUS_OPTIONS[0];
  const selectedLabel = t(`profile.status.${selected.value}`);

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
        <span>{selectedLabel}</span>
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
              {t(`profile.status.${option.value}`)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function VideoPlayer({
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

export function PlayerLoader() {
  return (
    <div className={clsx(styles.playerLoader, styles.playerLoaderSkeleton)} aria-label="Загрузка плеера">
      <span />
    </div>
  );
}

export function PlayerMessage({ message }: { message: string }) {
  return (
    <div className={styles.playerMessage} role="status">
      <p>{message}</p>
    </div>
  );
}

export function isPlayablePlayer(player: PlayerProviderResult) {
  return Boolean(player.streamUrl || player.embedUrl);
}

export function orderWatchPartyPlayers(players: PlayerProviderResult[]) {
  return [...players].sort((left, right) => watchPartyProviderPriority(left.provider) - watchPartyProviderPriority(right.provider));
}

function watchPartyProviderPriority(provider: PlayerProvider) {
  return provider === 'anilibria' ? 0 : 1;
}

export function WatchSources({ anime }: { anime: AnimeTitle }) {
  return (
    <div className={styles.sourcesBlock}>
      <h3>Источники</h3>
      {anime.watchSources.map((source) => {
        const isShikimoriSource = source.name.toLocaleLowerCase().includes('shikimori');

        return (
          <a key={source.name} href={source.url} target="_blank" rel="noreferrer" className={styles.sourceLink}>
            {isShikimoriSource ? <img src={shikimoriIcon} alt="" aria-hidden="true" /> : null}
            <span>
              <strong>{source.name}</strong>
            </span>
          </a>
        );
      })}
    </div>
  );
}
