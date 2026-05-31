import type { ReactNode } from 'react';
import type { WatchStatus } from '@anima/core';
import type { AnimeReviewScores, PlayerProviderResult, ServerWatchEntry } from '@/api';
import type { AnimeTitle } from '@/data';
import type { PlaybackSync } from './ControlledVideoPlayer';

export type PlayerProvider = PlayerProviderResult['provider'];

export type WatchState = {
  episode: number;
  status: WatchStatus;
};

export type AnimePageTab = 'watch' | 'overview' | 'diary';
export type AnimePageMode = 'info' | 'diary';
export type ReviewSortKey = 'recent' | 'score' | 'reaction';
export type SortDirection = 'desc' | 'asc';

export type ReviewDraft = {
  title: string;
  body: string;
  overallScore: number;
  recommended: boolean;
  hasSpoilers: boolean;
  aspectScores: AnimeReviewScores;
};

export type AnimeHeroProps = {
  anime: AnimeTitle;
  state: WatchState;
  diaryScore?: number | null;
  diaryReview?: string | null;
  onDiaryEntrySaved?: (entry: ServerWatchEntry) => void;
  onStateChange: (patch: Partial<WatchState>) => void;
  mode?: 'default' | 'watchParty';
  playbackSync?: PlaybackSync;
  sidebarExtra?: ReactNode;
  footerExtra?: ReactNode;
};
