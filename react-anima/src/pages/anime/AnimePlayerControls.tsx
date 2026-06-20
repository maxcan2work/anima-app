import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { WATCH_STATUS_OPTIONS, type WatchStatus } from '@anima/core';
import { type PlayerProviderResult } from '@/api';
import shikimoriIcon from '@assets/shikimori.png';
import type { AnimeTitle } from '@/data';
import { useI18n } from '@shared/i18n/I18nProvider';
import { SegmentedControl, Select } from '@shared/ui';
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
  const { t } = useI18n();
  const options = PLAYER_PROVIDER_OPTIONS.map((option) => ({
    ...option,
    disabled: !players.some((player) => player.provider === option.value && isPlayablePlayer(player)),
  }));

  return (
    <SegmentedControl value={value} options={options} onChange={onChange} ariaLabel={t('anime.provider')} />
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
  const statusOptions: Array<{ value: WatchState['status']; label: string }> = [
    { value: 'none', label: t('profile.status.none') },
    ...WATCH_STATUS_OPTIONS.map((option) => ({
      value: option.value,
      label: t(`profile.status.${option.value}` as `profile.status.${WatchStatus}`),
    })),
  ];
  return (
    <Select label={t('catalog.status')} value={value} options={statusOptions} onChange={onChange} />
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
