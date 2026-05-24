import crownIcon from '@assets/crown.svg';
import kickIcon from '@assets/kick.svg';
import type { WatchPartyParticipant } from './types';
import { WatchPartyRoomActions } from './WatchPartyRoomActions';

export function WatchPartyParticipants({
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
