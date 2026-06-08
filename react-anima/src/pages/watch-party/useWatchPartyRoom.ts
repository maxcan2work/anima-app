import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL, type ServerAnime } from '@/api';
import type { AnimeTitle } from '@/data';
import { useAuth } from '@features/auth/AuthProvider';
import { useI18n } from '@shared/i18n/I18nProvider';
import type { WatchState } from '@shared/storage';
import { useToast } from '@shared/ui/ToastProvider';
import type { WatchPartyParticipant, WatchPartyPlaybackState, WatchPartyRoomSettings, WatchPartyRoomState } from './types';

type UseWatchPartyRoomOptions = {
  code: string;
  createRoom: boolean;
  password: string;
  onCreateRoomConsumed: () => void;
  onLeaveRoom: () => void;
  mapServerAnime: (anime: ServerAnime) => AnimeTitle;
};

export function useWatchPartyRoom({
  code,
  createRoom,
  password,
  onCreateRoomConsumed,
  onLeaveRoom,
  mapServerAnime,
}: UseWatchPartyRoomOptions) {
  const toast = useToast();
  const { t } = useI18n();
  const { user } = useAuth();
  const [participants, setParticipants] = useState<WatchPartyParticipant[]>([]);
  const [ownParticipantId, setOwnParticipantId] = useState('');
  const [selectedAnime, setSelectedAnime] = useState<AnimeTitle | null>(null);
  const [partyEpisode, setPartyEpisode] = useState(1);
  const [playbackState, setPlaybackState] = useState<WatchPartyPlaybackState>(createInitialPlaybackState);
  const [settings, setSettings] = useState<WatchPartyRoomSettings>(createDefaultRoomSettings);
  const [connectionStatus, setConnectionStatus] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const createRoomRef = useRef(createRoom);
  const onCreateRoomConsumedRef = useRef(onCreateRoomConsumed);
  const onLeaveRoomRef = useRef(onLeaveRoom);
  const ownParticipant = participants.find((participant) => participant.id === ownParticipantId);
  const isHost = Boolean(ownParticipant?.isHost);
  const canSelectAnime = isHost || settings.animeSelection === 'everyone';
  const canSwitchEpisode = isHost || settings.episodeControl === 'everyone';
  const canControlPlayback = isHost || settings.playbackControl === 'everyone';

  useEffect(() => {
    createRoomRef.current = createRoom;
  }, [createRoom]);

  useEffect(() => {
    onCreateRoomConsumedRef.current = onCreateRoomConsumed;
  }, [onCreateRoomConsumed]);

  useEffect(() => {
    onLeaveRoomRef.current = onLeaveRoom;
  }, [onLeaveRoom]);

  useEffect(() => {
    if (!code) {
      setParticipants([]);
      setOwnParticipantId('');
      setSelectedAnime(null);
      setPartyEpisode(1);
      setPlaybackState(createInitialPlaybackState());
      setSettings(createDefaultRoomSettings());
      setConnectionStatus('');
      return;
    }

    setConnectionStatus(t('watchParty.connecting'));
    const socket = io(API_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      setOwnParticipantId(socket.id ?? '');
      setConnectionStatus('');
      const shouldCreateRoom = createRoomRef.current;
      socket.emit('watch-party:join', {
        code,
        create: shouldCreateRoom,
        name: user?.displayName ?? t('watchParty.guest'),
        avatarUrl: user?.avatarUrl ?? null,
        password,
      });
      if (shouldCreateRoom) onCreateRoomConsumedRef.current();
    });

    socket.on('watch-party:state', (state: WatchPartyRoomState) => {
      setConnectionStatus('');
      setParticipants(state.participants ?? []);
      setSelectedAnime(state.selectedAnime ? mapServerAnime(state.selectedAnime) : null);
      setPartyEpisode(state.episode ?? 1);
      setPlaybackState(state.playback ?? createInitialPlaybackState());
      setSettings(state.settings ?? createDefaultRoomSettings());
    });

    socket.on('connect_error', () => {
      setConnectionStatus(t('watchParty.connectFailed'));
    });

    socket.on('watch-party:kicked', () => {
      toast({ message: t('watchParty.kicked'), variant: 'warning' });
      onLeaveRoomRef.current();
    });

    socket.on('watch-party:room-closed', () => {
      toast({ message: t('watchParty.roomClosed'), variant: 'warning' });
      onLeaveRoomRef.current();
    });

    socket.on('watch-party:settings-rejected', (payload: { reason?: string }) => {
      toast({
        message: payload.reason === 'limit-below-participants'
          ? t('watchParty.limitBelowParticipants')
          : t('watchParty.settingsSaveFailed'),
        variant: 'warning',
      });
    });

    socket.on('watch-party:join-rejected', (payload: { reason?: string }) => {
      const message = payload.reason === 'room-full'
        ? t('watchParty.roomFull')
        : payload.reason === 'room-not-found'
          ? t('watchParty.notFound')
          : payload.reason === 'invalid-password'
            ? t('watchParty.invalidPassword')
            : payload.reason === 'room-started'
              ? t('watchParty.roomStarted')
              : t('watchParty.checkFailed');
      toast({ message, variant: 'warning' });
      onLeaveRoomRef.current();
    });

    socketRef.current = socket;
    return () => {
      socketRef.current = null;
      socket.disconnect();
    };
  }, [code, mapServerAnime, password, t, toast, user?.avatarUrl, user?.displayName]);

  function kickParticipant(participantId: string) {
    socketRef.current?.emit('watch-party:kick', { code, participantId });
  }

  function selectAnime(anime: ServerAnime) {
    if (!canSelectAnime) return;
    socketRef.current?.emit('watch-party:select-anime', { code, anime });
  }

  function updatePartyState(patch: Partial<WatchState>) {
    if (!socketRef.current || !canSwitchEpisode || !selectedAnime) return;
    socketRef.current.emit('watch-party:set-episode', {
      code,
      episode: patch.episode ?? partyEpisode,
    });
  }

  function updatePartyPlayback(patch: Pick<WatchPartyPlaybackState, 'status' | 'position'>) {
    if (!socketRef.current || !canControlPlayback || !selectedAnime) return;
    socketRef.current.emit('watch-party:set-playback', {
      code,
      status: patch.status,
      position: patch.position,
    });
  }

  function updateSettings(nextSettings: WatchPartyRoomSettings, nextPassword?: string | null) {
    if (!socketRef.current || !isHost) return;
    socketRef.current.emit('watch-party:update-settings', {
      code,
      settings: {
        ...nextSettings,
        ...(nextPassword !== undefined ? { password: nextPassword } : {}),
      },
    });
  }

  function closeRoom() {
    if (!socketRef.current || !isHost) return;
    socketRef.current.emit('watch-party:close', { code });
  }

  return {
    participants,
    ownParticipantId,
    selectedAnime,
    partyEpisode,
    playbackState,
    settings,
    connectionStatus,
    isHost,
    canSelectAnime,
    canSwitchEpisode,
    canControlPlayback,
    kickParticipant,
    selectAnime,
    updatePartyState,
    updatePartyPlayback,
    updateSettings,
    closeRoom,
  };
}

function createDefaultRoomSettings(): WatchPartyRoomSettings {
  return {
    name: '',
    maxParticipants: 16,
    visibility: 'code',
    passwordProtected: false,
    animeSelection: 'host',
    episodeControl: 'host',
    playbackControl: 'host',
    transferHost: true,
    autoPlay: false,
    allowJoinAfterStart: true,
  };
}

function createInitialPlaybackState(): WatchPartyPlaybackState {
  return {
    status: 'paused',
    position: 0,
    updatedAt: Date.now(),
  };
}
