import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { type WatchStatus } from '@anima/core';
import {
  API_URL,
  browseCatalog,
  checkWatchPartyRoom,
  importCatalogAnime,
  searchCatalog,
  type CatalogSearchResult,
  type ServerAnime,
} from '../../api';
import copyIcon from '../../assets/copy.svg';
import crownIcon from '../../assets/crown.svg';
import kickIcon from '../../assets/kick.svg';
import leaveRoomIcon from '../../assets/leave-room.svg';
import watchPartyIcon from '../../assets/watch-party.svg';
import { CatalogBrowser } from '../../features/catalog/CatalogBrowser';
import type { AnimeTitle } from '../../data';
import { useAuth } from '../../features/auth/AuthProvider';
import { useToast } from '../../shared/ui/ToastProvider';

type WatchState = {
  episode: number;
  status: WatchStatus;
};

type WatchPartyParticipant = {
  id: string;
  name: string;
  avatarUrl: string | null;
  isHost: boolean;
};

type WatchPartyRoomState = {
  participants: WatchPartyParticipant[];
  selectedAnime: ServerAnime | null;
  episode: number;
};

type WatchPartyPageProps = {
  code: string;
  createRoom: boolean;
  onCreateRoom: (code: string) => void;
  onJoinRoom: (code: string) => void;
  onLeaveRoom: () => void;
  onCreateRoomConsumed: () => void;
  mapServerAnime: (anime: ServerAnime) => AnimeTitle;
  renderAnimeHero: (props: {
    anime: AnimeTitle;
    state: WatchState;
    onStateChange: (patch: Partial<WatchState>) => void;
    mode: 'watchParty';
    sidebarExtra: ReactNode;
    footerExtra: ReactNode;
  }) => ReactNode;
};

export function WatchPartyPage({
  code,
  createRoom,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onCreateRoomConsumed,
  mapServerAnime,
  renderAnimeHero,
}: WatchPartyPageProps) {
  const toast = useToast();
  const { user } = useAuth();
  const [joinCode, setJoinCode] = useState(code);
  const [participants, setParticipants] = useState<WatchPartyParticipant[]>([]);
  const [ownParticipantId, setOwnParticipantId] = useState('');
  const [selectedAnime, setSelectedAnime] = useState<AnimeTitle | null>(null);
  const [partyEpisode, setPartyEpisode] = useState(1);
  const [animeQuery, setAnimeQuery] = useState('');
  const [animeResults, setAnimeResults] = useState<CatalogSearchResult[]>([]);
  const [animeSearchStatus, setAnimeSearchStatus] = useState('');
  const [animeSearchLoading, setAnimeSearchLoading] = useState(false);
  const [partyCatalogResults, setPartyCatalogResults] = useState<CatalogSearchResult[]>([]);
  const [partyCatalogPage, setPartyCatalogPage] = useState(1);
  const [partyCatalogHasNext, setPartyCatalogHasNext] = useState(true);
  const [partyCatalogStatus, setPartyCatalogStatus] = useState('');
  const [partyCatalogLoading, setPartyCatalogLoading] = useState(false);
  const [joinChecking, setJoinChecking] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const createRoomRef = useRef(createRoom);
  const ownParticipant = participants.find((participant) => participant.id === ownParticipantId);
  const isHost = Boolean(ownParticipant?.isHost);

  useEffect(() => {
    createRoomRef.current = createRoom;
  }, [createRoom]);

  useEffect(() => {
    setJoinCode(code);
  }, [code]);

  useEffect(() => {
    if (!code) {
      setParticipants([]);
      setOwnParticipantId('');
      setSelectedAnime(null);
      setPartyEpisode(1);
      setPartyCatalogResults([]);
      setPartyCatalogPage(1);
      setPartyCatalogHasNext(true);
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

  useEffect(() => {
    setPartyCatalogResults([]);
    setPartyCatalogPage(1);
    setPartyCatalogHasNext(true);
  }, [code]);

  useEffect(() => {
    if (!code || !isHost) return;

    const query = animeQuery.trim();
    if (query.length < 2) {
      setAnimeResults([]);
      setAnimeSearchStatus('');
      setAnimeSearchLoading(false);
      return;
    }

    let ignore = false;
    setAnimeSearchLoading(true);
    setAnimeSearchStatus('');

    const timer = window.setTimeout(async () => {
      try {
        const response = await searchCatalog(query);
        if (ignore) return;

        setAnimeResults(response.results);
        setAnimeSearchStatus(response.results.length ? '' : 'Ничего не нашли.');
      } catch {
        if (!ignore) {
          setAnimeResults([]);
          setAnimeSearchStatus('Не удалось найти аниме.');
        }
      } finally {
        if (!ignore) {
          setAnimeSearchLoading(false);
        }
      }
    }, 260);

    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [animeQuery, code, isHost]);

  useEffect(() => {
    if (!code || !isHost || selectedAnime) return;

    let ignore = false;
    setPartyCatalogLoading(true);
    setPartyCatalogStatus(partyCatalogPage === 1 ? 'Загружаем каталог Shikimori...' : '');

    async function loadPartyCatalog() {
      try {
        const response = await browseCatalog(partyCatalogPage, 'popularity');
        if (ignore) return;

        setPartyCatalogResults((current) => {
          const next = partyCatalogPage === 1 ? response.results : [...current, ...response.results];
          const seen = new Set<number>();
          return next.filter((item) => {
            if (seen.has(item.providerId)) return false;
            seen.add(item.providerId);
            return true;
          });
        });
        setPartyCatalogHasNext(response.hasNextPage);
        setPartyCatalogStatus('');
      } catch {
        if (!ignore) {
          if (partyCatalogPage === 1) {
            setPartyCatalogResults([]);
          }
          setPartyCatalogStatus('Не удалось загрузить каталог.');
        }
      } finally {
        if (!ignore) {
          setPartyCatalogLoading(false);
        }
      }
    }

    loadPartyCatalog();

    return () => {
      ignore = true;
    };
  }, [code, isHost, partyCatalogPage, selectedAnime]);

  function handleCreateRoom() {
    onCreateRoom(createWatchPartyCode());
  }

  async function handleJoinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeWatchPartyCode(joinCode);
    if (normalized && !joinChecking) {
      setJoinChecking(true);
      try {
        const { exists } = await checkWatchPartyRoom(normalized);
        if (!exists) {
          toast({ message: 'Комната с таким кодом не найдена', variant: 'warning' });
          return;
        }

        setConnectionStatus('');
        setParticipants([]);
        setOwnParticipantId('');
        setSelectedAnime(null);
        onJoinRoom(normalized);
      } catch {
        toast({ message: 'Не удалось проверить комнату', variant: 'danger' });
      } finally {
        setJoinChecking(false);
      }
    }
  }

  async function handleSelectAnime(result: CatalogSearchResult) {
    if (!socketRef.current || !isHost) return;

    setAnimeSearchStatus('Загружаем тайтл...');
    try {
      const response = await importCatalogAnime(result.provider, result.providerId);
      socketRef.current.emit('watch-party:select-anime', {
        code,
        anime: response.anime,
      });
      setAnimeQuery('');
      setAnimeResults([]);
      setAnimeSearchStatus('');
    } catch {
      setAnimeSearchStatus('Не удалось выбрать аниме.');
    }
  }

  function handlePartyStateChange(patch: Partial<WatchState>) {
    if (!socketRef.current || !isHost || !selectedAnime) return;
    const nextEpisode = patch.episode ?? partyEpisode;
    socketRef.current.emit('watch-party:set-episode', {
      code,
      episode: nextEpisode,
    });
  }

  if (code) {
    return (
      <section className={selectedAnime ? 'watch-party-page' : 'watch-party-page room-selecting'}>
        <div className="watch-party-room">
          {selectedAnime ? (
            renderAnimeHero({
              anime: selectedAnime,
              state: { episode: partyEpisode, status: 'watching' },
              onStateChange: handlePartyStateChange,
              mode: 'watchParty',
              sidebarExtra: (
                <WatchPartyParticipants
                  code={code}
                  participants={participants}
                  connectionStatus={connectionStatus}
                  canKick={isHost}
                  ownParticipantId={ownParticipantId}
                  onKickParticipant={(participantId) => socketRef.current?.emit('watch-party:kick', { code, participantId })}
                  onLeaveRoom={onLeaveRoom}
                  showActions={false}
                />
              ),
              footerExtra: (
                <WatchPartyRoomActions
                  code={code}
                  onLeaveRoom={onLeaveRoom}
                />
              ),
            })
          ) : isHost ? (
            <CatalogBrowser
              className="watch-party-catalog"
              eyebrow="Совместный просмотр"
              title="Выбери аниме"
              browseResults={partyCatalogResults}
              browsePage={partyCatalogPage}
              browseHasNext={partyCatalogHasNext}
              browseLoading={partyCatalogLoading}
              browseStatus={partyCatalogStatus}
              searchQuery={animeQuery}
              searchResults={animeResults}
              searchLoading={animeSearchLoading}
              searchStatus={animeSearchStatus}
              onSearchChange={setAnimeQuery}
              onOpenAnime={handleSelectAnime}
              onPageChange={setPartyCatalogPage}
            />
          ) : (
            <div className="watch-party-stage waiting-host">
              <img className="watch-party-icon" src={watchPartyIcon} alt="" aria-hidden="true" />
              <p className="eyebrow">Совместный просмотр</p>
              <h2>Комната {code}</h2>
              <p>Ждём, пока хост выберет аниме для просмотра.</p>
            </div>
          )}

          {!selectedAnime ? <aside className="watch-party-panel">
            <WatchPartyParticipants
              code={code}
              participants={participants}
              connectionStatus={connectionStatus}
              canKick={isHost}
              ownParticipantId={ownParticipantId}
              onKickParticipant={(participantId) => socketRef.current?.emit('watch-party:kick', { code, participantId })}
              onLeaveRoom={onLeaveRoom}
            />
          </aside> : null}
        </div>
      </section>
    );
  }

  return (
    <section className="watch-party-page">
      <div className="watch-party-entry">
        <header className="watch-party-entry-header">
          <img className="watch-party-icon" src={watchPartyIcon} alt="" aria-hidden="true" />
          <h2>Совместный просмотр</h2>
        </header>

        <div className="watch-party-entry-options">
          <section className="watch-party-entry-option">
            <h3>Создать комнату</h3>
            <p>Собери друзей в одной комнате, выбери аниме и управляй сериями как хост.</p>
            <button className="random-button" type="button" onClick={handleCreateRoom}>
              Создать комнату
            </button>
          </section>

          <div className="watch-party-divider" aria-hidden="true">
            <span>или</span>
          </div>

          <section className="watch-party-entry-option">
            <h3>Войти по коду</h3>
            <p>Вставь код комнаты, который отправил хост, и подключайся к совместному просмотру.</p>
            <form className="watch-party-join" onSubmit={handleJoinRoom}>
              <input
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value)}
                placeholder="Код комнаты"
                maxLength={12}
              />
              <button type="submit" disabled={!normalizeWatchPartyCode(joinCode)} aria-busy={joinChecking}>
                Подключиться
              </button>
            </form>
          </section>
        </div>
      </div>
    </section>
  );
}

function WatchPartyRoomActions({
  code,
  onLeaveRoom,
}: {
  code: string;
  onLeaveRoom: () => void;
}) {
  const toast = useToast();

  async function handleCopyCode() {
    await navigator.clipboard?.writeText(code);
    toast({ message: 'Код скопирован', variant: 'success' });
  }

  return (
    <div className="watch-party-actions-row">
      <button className="watch-party-code compact" type="button" onClick={handleCopyCode}>
        <span>{code}</span>
        <img src={copyIcon} alt="" aria-hidden="true" />
      </button>
      <button className="watch-party-leave" type="button" onClick={onLeaveRoom} aria-label="Выйти из комнаты">
        <img src={leaveRoomIcon} alt="" aria-hidden="true" />
      </button>
    </div>
  );
}

function WatchPartyParticipants({
  code,
  participants,
  connectionStatus,
  canKick,
  ownParticipantId,
  onKickParticipant,
  onLeaveRoom,
  showActions = true,
}: {
  code: string;
  participants: WatchPartyParticipant[];
  connectionStatus: string;
  canKick: boolean;
  ownParticipantId: string;
  onKickParticipant: (participantId: string) => void;
  onLeaveRoom: () => void;
  showActions?: boolean;
}) {
  return (
    <>
      <h3>Участники ({participants.length}/16)</h3>
      {connectionStatus ? <p className="party-status">{connectionStatus}</p> : null}
      <div className="party-members">
        {participants.map((participant) => (
          <div className="party-member" key={participant.id}>
            {participant.avatarUrl ? (
              <img src={participant.avatarUrl} alt="" />
            ) : (
              <div className="avatar-fallback">{participant.name[0] ?? 'G'}</div>
            )}
            <strong>{participant.name}</strong>
            <span className="party-member-actions">
              {participant.isHost ? (
                <span className="party-host-badge" aria-label="Хост" title="Хост">
                  <img className="party-host-icon" src={crownIcon} alt="" aria-hidden="true" />
                </span>
              ) : null}
              {canKick && !participant.isHost && participant.id !== ownParticipantId ? (
                <button type="button" onClick={() => onKickParticipant(participant.id)} aria-label={`Кикнуть ${participant.name}`}>
                  <img src={kickIcon} alt="" aria-hidden="true" />
                </button>
              ) : null}
            </span>
          </div>
        ))}
      </div>
      {showActions ? (
        <WatchPartyRoomActions code={code} onLeaveRoom={onLeaveRoom} />
      ) : null}
    </>
  );
}

function createWatchPartyCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function normalizeWatchPartyCode(value: string) {
  return value.replace(/[^a-z0-9]/gi, '').slice(0, 12).toUpperCase();
}
