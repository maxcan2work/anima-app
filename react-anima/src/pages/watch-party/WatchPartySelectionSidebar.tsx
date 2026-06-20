import { useState } from 'react';
import FiltersIcon from '@assets/filters.svg?react';
import GroupIcon from '@assets/circled-group.svg?react';
import LeaveIcon from '@assets/leave-room.svg?react';
import SettingsIcon from '@assets/settings.svg?react';
import { CatalogFiltersPanel } from '@features/catalog/CatalogFiltersPanel';
import type { CatalogBrowseFilters, CatalogBrowseOrder } from '@hooks/useCatalogBrowse';
import { useI18n } from '@shared/i18n/I18nProvider';
import { IconButton, Tooltip } from '@shared/ui';
import { useToast } from '@shared/ui/ToastProvider';
import type { WatchPartyParticipant, WatchPartyRoomSettings as RoomSettings } from './types';
import { WatchPartyCodeButton } from './WatchPartyCodeButton';
import { WatchPartyParticipants } from './WatchPartyParticipants';
import { WatchPartyRoomSettings } from './WatchPartyRoomSettings';
import styles from './WatchPartySelectionSidebar.module.css';

type SidebarTab = 'participants' | 'filters' | 'settings';

type WatchPartySelectionSidebarProps = {
  code: string;
  participants: WatchPartyParticipant[];
  connectionStatus: string;
  canKick: boolean;
  canBrowse: boolean;
  ownParticipantId: string;
  roomSettings: RoomSettings;
  browseFilters: CatalogBrowseFilters;
  browseOrder: CatalogBrowseOrder;
  searchQuery: string;
  onFiltersChange: (filters: CatalogBrowseFilters) => void;
  onOrderChange: (order: CatalogBrowseOrder) => void;
  onSearchChange: (query: string) => void;
  onKickParticipant: (participantId: string) => void;
  onLeaveRoom: () => void;
  onSettingsChange: (settings: RoomSettings, password?: string | null) => void;
  onCloseRoom: () => void;
};

export function WatchPartySelectionSidebar({
  code,
  participants,
  connectionStatus,
  canKick,
  canBrowse,
  ownParticipantId,
  roomSettings,
  browseFilters,
  browseOrder,
  searchQuery,
  onFiltersChange,
  onOrderChange,
  onSearchChange,
  onKickParticipant,
  onLeaveRoom,
  onSettingsChange,
  onCloseRoom,
}: WatchPartySelectionSidebarProps) {
  const [tab, setTab] = useState<SidebarTab>('participants');
  const { t } = useI18n();
  const toast = useToast();

  async function copyCode() {
    await navigator.clipboard?.writeText(code);
    toast({ message: t('watchParty.codeCopied'), variant: 'success' });
  }

  return (
    <div className={styles.sidebar}>
      <div className={styles.content}>
        {tab === 'filters' && canBrowse ? (
          <CatalogFiltersPanel
            browseFilters={browseFilters}
            browseOrder={browseOrder}
            searchQuery={searchQuery}
            onFiltersChange={onFiltersChange}
            onOrderChange={onOrderChange}
            onSearchChange={onSearchChange}
          />
        ) : tab === 'settings' && canBrowse ? (
          <WatchPartyRoomSettings settings={roomSettings} participantCount={participants.length} onSave={onSettingsChange} onClose={onCloseRoom} />
        ) : (
          <WatchPartyParticipants
            code={code}
            participants={participants}
            connectionStatus={connectionStatus}
            canKick={canKick}
            ownParticipantId={ownParticipantId}
            maxParticipants={roomSettings.maxParticipants}
            onKickParticipant={onKickParticipant}
            onLeaveRoom={onLeaveRoom}
            showActions={false}
          />
        )}
      </div>

      <div className={styles.footer}>
        <WatchPartyCodeButton code={code} onCopy={copyCode} />

        <div className={canBrowse ? styles.tabsHost : styles.tabs}>
          <Tooltip label={t('watchParty.participants')} placement="top">
            <IconButton className={styles.tabButton} active={tab === 'participants'} onClick={() => setTab('participants')} aria-pressed={tab === 'participants'}>
              <GroupIcon aria-hidden="true" />
            </IconButton>
          </Tooltip>
          <Tooltip label={t('catalog.controls')} placement="top">
            <IconButton className={styles.tabButton} active={tab === 'filters'} onClick={() => setTab('filters')} disabled={!canBrowse} aria-pressed={tab === 'filters'}>
              <FiltersIcon aria-hidden="true" />
            </IconButton>
          </Tooltip>
          {canBrowse ? (
            <Tooltip label={t('watchParty.roomSettings')} placement="top">
              <IconButton className={styles.tabButton} active={tab === 'settings'} onClick={() => setTab('settings')} aria-pressed={tab === 'settings'}>
                <SettingsIcon aria-hidden="true" />
              </IconButton>
            </Tooltip>
          ) : null}
          <Tooltip label={t('watchParty.leaveRoom')} placement="top" align="end">
            <IconButton className={styles.tabButton} onClick={onLeaveRoom}>
              <LeaveIcon aria-hidden="true" />
            </IconButton>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
