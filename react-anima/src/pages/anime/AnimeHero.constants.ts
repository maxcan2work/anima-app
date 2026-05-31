import type { AnimePageMode, AnimePageTab, PlayerProvider } from './AnimeHero.types';

export const EPISODES_PER_PAGE = 12;

export const PLAYER_PROVIDER_OPTIONS: Array<{ value: PlayerProvider; label: string }> = [
  { value: 'kodik', label: 'Kodik' },
  { value: 'anilibria', label: 'AniLiberty' },
];

export const TAB_TO_MODE: Partial<Record<AnimePageTab, AnimePageMode>> = {
  overview: 'info',
  diary: 'diary',
};
