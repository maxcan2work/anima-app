import type { ServerAnime } from '@/api';
import type { AnimeTitle } from '@/data';

export type WatchPartyParticipant = {
  id: string;
  name: string;
  avatarUrl: string | null;
  isHost: boolean;
};

export type WatchPartyRoomState = {
  participants: WatchPartyParticipant[];
  settings: WatchPartyRoomSettings;
  selectedAnime: ServerAnime | null;
  episode: number;
  playback: WatchPartyPlaybackState;
};

export type WatchPartyPermission = 'host' | 'everyone';

export type WatchPartyRoomSettings = {
  name: string;
  maxParticipants: number;
  visibility: 'public' | 'code';
  passwordProtected: boolean;
  animeSelection: WatchPartyPermission;
  episodeControl: WatchPartyPermission;
  playbackControl: WatchPartyPermission;
  transferHost: boolean;
  autoPlay: boolean;
  allowJoinAfterStart: boolean;
};

export type WatchPartyAnime = AnimeTitle | null;

export type WatchPartyPlaybackState = {
  status: 'paused' | 'playing';
  position: number;
  updatedAt: number;
};
