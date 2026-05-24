import { useState } from 'react';
import { AnimeHero } from '@pages/anime/AnimeHero';
import watchPartyIcon from '@assets/watch-party.svg';
import { CatalogBrowser } from '@features/catalog/CatalogBrowser';
import { mapServerAnime } from '@shared/animeMappers';
import type { WatchState } from '@shared/storage';
import { WatchPartyEntry } from './WatchPartyEntry';
import { WatchPartyParticipants } from './WatchPartyParticipants';
import { WatchPartyRoomActions } from './WatchPartyRoomActions';
import { useWatchPartyCatalog } from './useWatchPartyCatalog';
import { useWatchPartyRoom } from './useWatchPartyRoom';

type WatchPartyPageProps = {
  code: string;
  createRoom: boolean;
  onCreateRoom: (code: string) => void;
  onJoinRoom: (code: string) => void;
  onLeaveRoom: () => void;
  onCreateRoomConsumed: () => void;
};

export function WatchPartyPage({
  code,
  createRoom,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onCreateRoomConsumed,
}: WatchPartyPageProps) {
  const [joinChecking, setJoinChecking] = useState(false);
  const room = useWatchPartyRoom({
    code,
    createRoom,
    onCreateRoomConsumed,
    onLeaveRoom,
    mapServerAnime,
  });
  const catalog = useWatchPartyCatalog({
    code,
    enabled: room.isHost,
    selectedAnime: room.selectedAnime,
    onSelectAnime: room.selectAnime,
  });

  if (!code) {
    return (
      <WatchPartyEntry
        code={code}
        joinChecking={joinChecking}
        onCreateRoom={() => onCreateRoom(createWatchPartyCode())}
        onJoinRoom={onJoinRoom}
        onJoinCheckingChange={setJoinChecking}
      />
    );
  }

  return (
    <section className={room.selectedAnime ? 'watch-party-page' : 'watch-party-page room-selecting'}>
      <div className="watch-party-room">
        {room.selectedAnime ? (
          <AnimeHero
            anime={room.selectedAnime}
            state={{ episode: room.partyEpisode, status: 'watching' }}
            onStateChange={(patch: Partial<WatchState>) => room.updatePartyState(patch)}
            mode="watchParty"
            sidebarExtra={(
              <WatchPartyParticipants
                code={code}
                participants={room.participants}
                connectionStatus={room.connectionStatus}
                canKick={room.isHost}
                ownParticipantId={room.ownParticipantId}
                onKickParticipant={room.kickParticipant}
                onLeaveRoom={onLeaveRoom}
                showActions={false}
              />
            )}
            footerExtra={(
              <WatchPartyRoomActions
                code={code}
                onLeaveRoom={onLeaveRoom}
              />
            )}
          />
        ) : room.isHost ? (
          <CatalogBrowser
            className="watch-party-catalog"
            eyebrow="Совместный просмотр"
            title="Выбери аниме"
            browseResults={catalog.partyCatalogResults}
            browsePage={catalog.partyCatalogPage}
            browseHasNext={catalog.partyCatalogHasNext}
            browseLoading={catalog.partyCatalogLoading}
            browseStatus={catalog.partyCatalogStatus}
            searchQuery={catalog.animeQuery}
            searchResults={catalog.animeResults}
            searchLoading={catalog.animeSearchLoading}
            searchStatus={catalog.animeSearchStatus}
            onSearchChange={catalog.setAnimeQuery}
            onOpenAnime={catalog.handleSelectAnime}
            onPageChange={catalog.setPartyCatalogPage}
          />
        ) : (
          <div className="watch-party-stage waiting-host">
            <img className="watch-party-icon" src={watchPartyIcon} alt="" aria-hidden="true" />
            <p className="eyebrow">Совместный просмотр</p>
            <h2>Комната {code}</h2>
            <p>Ждём, пока хост выберет аниме для просмотра.</p>
          </div>
        )}

        {!room.selectedAnime ? (
          <aside className="watch-party-panel">
            <WatchPartyParticipants
              code={code}
              participants={room.participants}
              connectionStatus={room.connectionStatus}
              canKick={room.isHost}
              ownParticipantId={room.ownParticipantId}
              onKickParticipant={room.kickParticipant}
              onLeaveRoom={onLeaveRoom}
            />
          </aside>
        ) : null}
      </div>
    </section>
  );
}

function createWatchPartyCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
