import LeaveRoomIcon from '@assets/leave-room.svg?react';
import SettingsIcon from '@assets/settings.svg?react';
import { useI18n } from '@shared/i18n/I18nProvider';
import { IconButton, Tooltip } from '@shared/ui';
import { useToast } from '@shared/ui/ToastProvider';
import { WatchPartyCodeButton } from './WatchPartyCodeButton';
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
      <WatchPartyCodeButton code={code} onCopy={handleCopyCode} />
      {onToggleSettings ? (
        <Tooltip label={t('watchParty.roomSettings')} placement="top">
          <IconButton active={settingsActive} onClick={onToggleSettings} aria-pressed={settingsActive}>
            <SettingsIcon aria-hidden="true" />
          </IconButton>
        </Tooltip>
      ) : null}
      <Tooltip label={t('watchParty.leaveRoom')} placement="top" align="end">
        <IconButton onClick={onLeaveRoom}>
          <LeaveRoomIcon aria-hidden="true" />
        </IconButton>
      </Tooltip>
    </div>
  );
}
