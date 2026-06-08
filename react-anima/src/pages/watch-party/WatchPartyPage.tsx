import clsx from 'clsx';
import { useState } from 'react';
import { AnimeHero } from '@pages/anime/AnimeHero';
import WatchPartyIcon from '@assets/watch-party.svg?react';
import { CatalogBrowser } from '@features/catalog/CatalogBrowser';
import { mapServerAnime } from '@shared/animeMappers';
import { useI18n } from '@shared/i18n/I18nProvider';
import type { WatchState } from '@shared/storage';
import { WatchPartyEntry } from './WatchPartyEntry';
import { WatchPartyParticipants } from './WatchPartyParticipants';
import { WatchPartyRoomActions } from './WatchPartyRoomActions';
import { WatchPartyRoomSettings } from './WatchPartyRoomSettings';
import { WatchPartySelectionSidebar } from './WatchPartySelectionSidebar';
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
  const [joinPassword, setJoinPassword] = useState('');
  const [showActiveRoomSettings, setShowActiveRoomSettings] = useState(false);
  const { t } = useI18n();
  const room = useWatchPartyRoom({
    code,
    createRoom,
    password: joinPassword,
    onCreateRoomConsumed,
    onLeaveRoom,
    mapServerAnime,
  });
  const catalog = useWatchPartyCatalog({
    code,
    enabled: room.canSelectAnime,
    selectedAnime: room.selectedAnime,
    onSelectAnime: room.selectAnime,
  });

  if (!code) {
    return (
      <WatchPartyEntry
        code={code}
        joinChecking={joinChecking}
        onCreateRoom={() => onCreateRoom(createWatchPartyCode())}
        onJoinRoom={(roomCode, password) => {
          setJoinPassword(password);
          onJoinRoom(roomCode);
        }}
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
            canChangeEpisode={room.canSwitchEpisode}
            playbackSync={{
              state: room.playbackState,
              canControl: room.canControlPlayback,
              onChange: room.updatePartyPlayback,
            }}
            sidebarExtra={(
              showActiveRoomSettings && room.isHost ? (
                <WatchPartyRoomSettings
                  settings={room.settings}
                  participantCount={room.participants.length}
                  onSave={room.updateSettings}
                  onClose={room.closeRoom}
                />
              ) : (
                <WatchPartyParticipants
                  code={code}
                  participants={room.participants}
                  connectionStatus={room.connectionStatus}
                  canKick={room.isHost}
                  ownParticipantId={room.ownParticipantId}
                  maxParticipants={room.settings.maxParticipants}
                  onKickParticipant={room.kickParticipant}
                  onLeaveRoom={onLeaveRoom}
                  showActions={false}
                />
              )
            )}
            footerExtra={(
              <WatchPartyRoomActions
                code={code}
                settingsActive={showActiveRoomSettings}
                onToggleSettings={room.isHost ? () => setShowActiveRoomSettings((current) => !current) : undefined}
                onLeaveRoom={onLeaveRoom}
              />
            )}
          />
        ) : room.canSelectAnime ? (
          <CatalogBrowser
            className={styles.catalog}
            eyebrow={t('watchParty.title')}
            title={t('watchParty.chooseAnime')}
            note={t('watchParty.anilibriaOnly')}
            browseResults={catalog.browseResults}
            browsePage={catalog.browsePage}
            browseHasNext={catalog.browseHasNext}
            browseLoading={catalog.browseLoading}
            browseStatus={catalog.browseStatus}
            searchQuery={catalog.catalogSearchQuery}
            searchResults={catalog.catalogSearchResults}
            searchLoading={catalog.catalogSearchLoading}
            searchStatus={catalog.catalogSearchStatus}
            hideSearch
            onSearchChange={catalog.setCatalogSearchQuery}
            onOpenAnime={catalog.handleSelectAnime}
            onPageChange={catalog.setBrowsePage}
          />
        ) : (
          <div className={clsx(styles.stage, styles.waitingHost)}>
            <WatchPartyIcon className={styles.icon} aria-hidden="true" />
            <p className="eyebrow">{t('watchParty.title')}</p>
            <h2>{t('watchParty.room', { code })}</h2>
            <p>{t('watchParty.waitingHost')}</p>
          </div>
        )}

        {!room.selectedAnime ? (
          <aside className={styles.panel}>
            <WatchPartySelectionSidebar
              code={code}
              participants={room.participants}
              connectionStatus={room.connectionStatus}
              canKick={room.isHost}
              canBrowse={room.isHost}
              ownParticipantId={room.ownParticipantId}
              roomSettings={room.settings}
              browseFilters={catalog.browseFilters}
              browseOrder={catalog.browseOrder}
              searchQuery={catalog.catalogSearchQuery}
              onFiltersChange={catalog.setBrowseFilters}
              onOrderChange={catalog.setBrowseOrder}
              onSearchChange={catalog.setCatalogSearchQuery}
              onKickParticipant={room.kickParticipant}
              onLeaveRoom={onLeaveRoom}
              onSettingsChange={room.updateSettings}
              onCloseRoom={room.closeRoom}
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
