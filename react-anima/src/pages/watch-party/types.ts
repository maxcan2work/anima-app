import type { ServerAnime } from '../../api';
import type { AnimeTitle } from '../../data';

export type WatchPartyParticipant = {
  id: string;
  name: string;
  avatarUrl: string | null;
  isHost: boolean;
};

export type WatchPartyRoomState = {
  participants: WatchPartyParticipant[];
  selectedAnime: ServerAnime | null;
  episode: number;
};

export type WatchPartyAnime = AnimeTitle | null;
