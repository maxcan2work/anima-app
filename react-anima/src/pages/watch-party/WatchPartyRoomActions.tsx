import copyIcon from '../../assets/copy.svg';
import leaveRoomIcon from '../../assets/leave-room.svg';
import { useToast } from '../../shared/ui/ToastProvider';

export function WatchPartyRoomActions({
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
