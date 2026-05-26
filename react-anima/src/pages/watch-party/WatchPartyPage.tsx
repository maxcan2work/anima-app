import clsx from 'clsx';
import { useState } from 'react';
import { AnimeHero } from '@pages/anime/AnimeHero';
import watchPartyIcon from '@assets/watch-party.svg';
import { CatalogBrowser } from '@features/catalog/CatalogBrowser';
import { mapServerAnime } from '@shared/animeMappers';
import { useI18n } from '@shared/i18n/I18nProvider';
import type { WatchState } from '@shared/storage';
import { WatchPartyEntry } from './WatchPartyEntry';
import { WatchPartyParticipants } from './WatchPartyParticipants';
import { WatchPartyRoomActions } from './WatchPartyRoomActions';
import { useWatchPartyCatalog } from './useWatchPartyCatalog';
import { useWatchPartyRoom } from './useWatchPartyRoom';
import styles from './WatchPartyPage.module.css';

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
  const { t } = useI18n();
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
    <section className={clsx(styles.page, !room.selectedAnime && styles.roomSelecting)}>
      <div className={styles.room}>
        {room.selectedAnime ? (
          <AnimeHero
            anime={room.selectedAnime}
            state={{ episode: room.partyEpisode, status: 'watching' }}
            onStateChange={(patch: Partial<WatchState>) => room.updatePartyState(patch)}
            mode="watchParty"
            playbackSync={{
              state: room.playbackState,
              canControl: room.isHost,
              onChange: room.updatePartyPlayback,
            }}
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
            className={styles.catalog}
            eyebrow={t('watchParty.title')}
            title={t('watchParty.chooseAnime')}
            note={t('watchParty.anilibriaOnly')}
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
          <div className={clsx(styles.stage, styles.waitingHost)}>
            <img className={styles.icon} src={watchPartyIcon} alt="" aria-hidden="true" />
            <p className="eyebrow">{t('watchParty.title')}</p>
            <h2>{t('watchParty.room', { code })}</h2>
            <p>{t('watchParty.waitingHost')}</p>
          </div>
        )}

        {!room.selectedAnime ? (
          <aside className={styles.panel}>
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
