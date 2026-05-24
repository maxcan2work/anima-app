import copyIcon from '@assets/copy.svg';
import leaveRoomIcon from '@assets/leave-room.svg';
import { useToast } from '@shared/ui/ToastProvider';
import styles from './WatchPartyRoomActions.module.css';

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
    <div className={styles.row}>
      <button className={styles.code} type="button" onClick={handleCopyCode}>
        <span>{code}</span>
        <img src={copyIcon} alt="" aria-hidden="true" />
      </button>
      <button className={styles.leave} type="button" onClick={onLeaveRoom} aria-label="Выйти из комнаты">
        <img src={leaveRoomIcon} alt="" aria-hidden="true" />
      </button>
    </div>
  );
}
