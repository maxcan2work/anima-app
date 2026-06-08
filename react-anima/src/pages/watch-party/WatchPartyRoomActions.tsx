import CopyIcon from '@assets/copy.svg?react';
import LeaveRoomIcon from '@assets/leave-room.svg?react';
import SettingsIcon from '@assets/settings.svg?react';
import { useI18n } from '@shared/i18n/I18nProvider';
import { Tooltip } from '@shared/ui/Tooltip';
import { useToast } from '@shared/ui/ToastProvider';
import styles from './WatchPartyRoomActions.module.css';

export function WatchPartyRoomActions({
  code,
  settingsActive = false,
  onToggleSettings,
  onLeaveRoom,
}: {
  code: string;
  settingsActive?: boolean;
  onToggleSettings?: () => void;
  onLeaveRoom: () => void;
}) {
  const toast = useToast();
  const { t } = useI18n();

  async function handleCopyCode() {
    await navigator.clipboard?.writeText(code);
    toast({ message: t('watchParty.codeCopied'), variant: 'success' });
  }

  return (
    <div className={`${styles.row} ${onToggleSettings ? styles.withSettings : ''}`}>
      <button className={styles.code} type="button" onClick={handleCopyCode}>
        <span>{code}</span>
        <CopyIcon aria-hidden="true" />
      </button>
      {onToggleSettings ? (
        <Tooltip label={t('watchParty.roomSettings')} placement="top">
          <button className={settingsActive ? styles.active : undefined} type="button" onClick={onToggleSettings} aria-pressed={settingsActive}>
            <SettingsIcon aria-hidden="true" />
          </button>
        </Tooltip>
      ) : null}
      <Tooltip label={t('watchParty.leaveRoom')} placement="top" align="end">
        <button type="button" onClick={onLeaveRoom}>
          <LeaveRoomIcon aria-hidden="true" />
        </button>
      </Tooltip>
    </div>
  );
}
