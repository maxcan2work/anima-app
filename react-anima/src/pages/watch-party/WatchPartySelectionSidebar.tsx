import { useState } from 'react';
import CopyIcon from '@assets/copy.svg?react';
import FiltersIcon from '@assets/filters.svg?react';
import GroupIcon from '@assets/circled-group.svg?react';
import LeaveIcon from '@assets/leave-room.svg?react';
import SettingsIcon from '@assets/settings.svg?react';
import { CatalogFiltersPanel } from '@features/catalog/CatalogFiltersPanel';
import type { CatalogBrowseFilters, CatalogBrowseOrder } from '@hooks/useCatalogBrowse';
import { useI18n } from '@shared/i18n/I18nProvider';
import { Tooltip } from '@shared/ui/Tooltip';
import { useToast } from '@shared/ui/ToastProvider';
import type { WatchPartyParticipant, WatchPartyRoomSettings as RoomSettings } from './types';
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
        <button className={styles.code} type="button" onClick={copyCode}>
          <span>{code}</span>
          <CopyIcon aria-hidden="true" />
        </button>

        <div className={canBrowse ? styles.tabsHost : styles.tabs}>
          <Tooltip label={t('watchParty.participants')} placement="top">
            <button className={tab === 'participants' ? styles.activeTab : undefined} type="button" onClick={() => setTab('participants')} aria-pressed={tab === 'participants'}>
              <GroupIcon aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip label={t('catalog.controls')} placement="top">
            <button className={tab === 'filters' ? styles.activeTab : undefined} type="button" onClick={() => setTab('filters')} disabled={!canBrowse} aria-pressed={tab === 'filters'}>
              <FiltersIcon aria-hidden="true" />
            </button>
          </Tooltip>
          {canBrowse ? (
            <Tooltip label={t('watchParty.roomSettings')} placement="top">
              <button className={tab === 'settings' ? styles.activeTab : undefined} type="button" onClick={() => setTab('settings')} aria-pressed={tab === 'settings'}>
                <SettingsIcon aria-hidden="true" />
              </button>
            </Tooltip>
          ) : null}
          <Tooltip label={t('watchParty.leaveRoom')} placement="top" align="end">
            <button type="button" onClick={onLeaveRoom}>
              <LeaveIcon aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
