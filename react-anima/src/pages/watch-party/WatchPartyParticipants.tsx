import crownIcon from '@assets/crown.svg';
import kickIcon from '@assets/kick.svg';
import { useI18n } from '@shared/i18n/I18nProvider';
import { IconButton, Tooltip } from '@shared/ui';
import type { WatchPartyParticipant } from './types';
import { WatchPartyRoomActions } from './WatchPartyRoomActions';
import styles from './WatchPartyParticipants.module.css';

export function WatchPartyParticipants({
  code,
  participants,
  connectionStatus,
  canKick,
  ownParticipantId,
  maxParticipants = 16,
  onKickParticipant,
  onLeaveRoom,
  showActions = true,
}: {
  code: string;
  participants: WatchPartyParticipant[];
  connectionStatus: string;
  canKick: boolean;
  ownParticipantId: string;
  maxParticipants?: number;
  onKickParticipant: (participantId: string) => void;
  onLeaveRoom: () => void;
  showActions?: boolean;
}) {
  const { t } = useI18n();

  return (
    <>
      <h3 className={styles.title}>{t('watchParty.participants')} ({participants.length}/{maxParticipants})</h3>
      {connectionStatus ? <p className={styles.status}>{connectionStatus}</p> : null}
      <div className={styles.members}>
        {participants.map((participant) => (
          <div className={styles.member} key={participant.id}>
            {participant.avatarUrl ? (
              <img src={participant.avatarUrl} alt="" />
            ) : (
              <div className={styles.avatarFallback}>{participant.name[0] ?? 'G'}</div>
            )}
            <strong>{participant.name}</strong>
            <span className={styles.actions}>
              {participant.isHost ? (
                <Tooltip label={t('watchParty.host')} placement="left">
                  <span className={styles.hostBadge} aria-label={t('watchParty.host')}>
                    <img className={styles.hostIcon} src={crownIcon} alt="" aria-hidden="true" />
                  </span>
                </Tooltip>
              ) : null}
              {canKick && !participant.isHost && participant.id !== ownParticipantId ? (
                <IconButton
                  className={styles.kickButton}
                  size="xs"
                  onClick={() => onKickParticipant(participant.id)}
                  aria-label={t('watchParty.kickParticipant', { name: participant.name })}
                >
                  <img src={kickIcon} alt="" aria-hidden="true" />
                </IconButton>
              ) : null}
            </span>
          </div>
        ))}
      </div>
      {showActions ? <WatchPartyRoomActions code={code} onLeaveRoom={onLeaveRoom} /> : null}
    </>
  );
}
