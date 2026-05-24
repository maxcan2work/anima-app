import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL, type ServerAnime } from '../../api';
import type { AnimeTitle } from '../../data';
import { useAuth } from '../../features/auth/AuthProvider';
import { useToast } from '../../shared/ui/ToastProvider';
import type { WatchState } from '../../shared/storage';
import type { WatchPartyParticipant, WatchPartyRoomState } from './types';

type UseWatchPartyRoomOptions = {
  code: string;
  createRoom: boolean;
  onCreateRoomConsumed: () => void;
  onLeaveRoom: () => void;
  mapServerAnime: (anime: ServerAnime) => AnimeTitle;
};

export function useWatchPartyRoom({
  code,
  createRoom,
  onCreateRoomConsumed,
  onLeaveRoom,
  mapServerAnime,
}: UseWatchPartyRoomOptions) {
  const toast = useToast();
  const { user } = useAuth();
  const [participants, setParticipants] = useState<WatchPartyParticipant[]>([]);
  const [ownParticipantId, setOwnParticipantId] = useState('');
  const [selectedAnime, setSelectedAnime] = useState<AnimeTitle | null>(null);
  const [partyEpisode, setPartyEpisode] = useState(1);
  const [connectionStatus, setConnectionStatus] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const createRoomRef = useRef(createRoom);
  const ownParticipant = participants.find((participant) => participant.id === ownParticipantId);
  const isHost = Boolean(ownParticipant?.isHost);

  useEffect(() => {
    createRoomRef.current = createRoom;
  }, [createRoom]);

  useEffect(() => {
    if (!code) {
      setParticipants([]);
      setOwnParticipantId('');
      setSelectedAnime(null);
      setPartyEpisode(1);
      setConnectionStatus('');
      return;
    }

    setConnectionStatus('Подключаемся...');
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
        name: user?.displayName ?? 'Гость',
        avatarUrl: user?.avatarUrl ?? null,
      });
      if (shouldCreateRoom) {
        onCreateRoomConsumed();
      }
    });

    socket.on('watch-party:state', (state: WatchPartyRoomState) => {
      setConnectionStatus('');
      setParticipants(state.participants ?? []);
      setSelectedAnime(state.selectedAnime ? mapServerAnime(state.selectedAnime) : null);
      setPartyEpisode(state.episode ?? 1);
    });

    socket.on('connect_error', () => {
      setConnectionStatus('Не удалось подключиться к комнате.');
    });

    socket.on('watch-party:kicked', () => {
      toast({ message: 'Тебя исключили из комнаты', variant: 'warning' });
      onLeaveRoom();
    });

    socket.on('watch-party:join-rejected', (payload: { reason?: string }) => {
      const message = payload.reason === 'room-full'
        ? 'Комната заполнена'
        : payload.reason === 'room-not-found'
          ? 'Комната с таким кодом не найдена'
          : 'Не удалось войти в комнату';
      toast({ message, variant: 'warning' });
      onLeaveRoom();
    });

    socketRef.current = socket;

    return () => {
      socketRef.current = null;
      socket.disconnect();
    };
  }, [code, mapServerAnime, onCreateRoomConsumed, onLeaveRoom, toast, user?.avatarUrl, user?.displayName]);

  function kickParticipant(participantId: string) {
    socketRef.current?.emit('watch-party:kick', { code, participantId });
  }

  function selectAnime(anime: ServerAnime) {
    socketRef.current?.emit('watch-party:select-anime', { code, anime });
  }

  function updatePartyState(patch: Partial<WatchState>) {
    if (!socketRef.current || !isHost || !selectedAnime) return;
    const nextEpisode = patch.episode ?? partyEpisode;
    socketRef.current.emit('watch-party:set-episode', {
      code,
      episode: nextEpisode,
    });
  }

  return {
    participants,
    ownParticipantId,
    selectedAnime,
    partyEpisode,
    connectionStatus,
    isHost,
    kickParticipant,
    selectAnime,
    updatePartyState,
  };
}
