import { useEffect, useState, type FormEvent } from 'react';
import { checkWatchPartyRoom, getPublicWatchPartyRooms, type PublicWatchPartyRoom } from '@/api';
import WatchPartyIcon from '@assets/watch-party.svg?react';
import { useI18n } from '@shared/i18n/I18nProvider';
import { normalizeWatchPartyCode } from '@shared/navigation';
import { Button, Input } from '@shared/ui';
import { useToast } from '@shared/ui/ToastProvider';
import styles from './WatchPartyEntry.module.css';

type WatchPartyEntryProps = {
  code: string;
  joinChecking: boolean;
  onCreateRoom: () => void;
  onJoinRoom: (code: string, password: string) => void;
  onJoinCheckingChange: (checking: boolean) => void;
};

export function WatchPartyEntry({
  code,
  joinChecking,
  onCreateRoom,
  onJoinRoom,
  onJoinCheckingChange,
}: WatchPartyEntryProps) {
  const toast = useToast();
  const { t } = useI18n();
  const [joinCode, setJoinCode] = useState(code);
  const [password, setPassword] = useState('');
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [publicRooms, setPublicRooms] = useState<PublicWatchPartyRoom[]>([]);

  useEffect(() => {
    setJoinCode(code);
  }, [code]);

  useEffect(() => {
    let ignore = false;
    getPublicWatchPartyRooms()
      .then(({ rooms }) => {
        if (!ignore) setPublicRooms(rooms);
      })
      .catch(() => {
        if (!ignore) setPublicRooms([]);
      });
    return () => {
      ignore = true;
    };
  }, []);

  function choosePublicRoom(room: PublicWatchPartyRoom) {
    setJoinCode(room.code);
    if (room.passwordProtected) {
      setRequiresPassword(true);
      return;
    }
    onJoinRoom(room.code, '');
  }

  async function handleJoinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeWatchPartyCode(joinCode);
    if (!normalized || joinChecking) return;

    onJoinCheckingChange(true);
    try {
      const result = await checkWatchPartyRoom(normalized);
      const { exists } = result;
      if (!exists) {
        toast({ message: t('watchParty.notFound'), variant: 'warning' });
        return;
      }

      if (result.requiresPassword && !password) {
        setRequiresPassword(true);
        return;
      }

      onJoinRoom(normalized, password);
    } catch {
      toast({ message: t('watchParty.checkFailed'), variant: 'danger' });
    } finally {
      onJoinCheckingChange(false);
    }
  }

  return (
    <section className={styles.page}>
      <div className={styles.entry}>
        <header className={styles.header}>
          <WatchPartyIcon className={styles.icon} aria-hidden="true" />
          <h2>{t('watchParty.title')}</h2>
        </header>

        <div className={styles.options}>
          <section className={styles.option}>
            <h3>{t('watchParty.createTitle')}</h3>
            <p>{t('watchParty.createDescription')}</p>
            <Button className={styles.createButton} onClick={onCreateRoom}>
              {t('watchParty.createAction')}
            </Button>
          </section>

          <div className={styles.divider} aria-hidden="true">
            <span>{t('watchParty.or')}</span>
          </div>

          <section className={styles.option}>
            <h3>{t('watchParty.joinTitle')}</h3>
            <p>{t('watchParty.joinDescription')}</p>
            <form className={styles.join} onSubmit={handleJoinRoom}>
              <Input
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value)}
                placeholder={t('watchParty.roomCode')}
                maxLength={12}
              />
              {requiresPassword ? (
                <Input
                  type="password"
                  value={password}
                  autoFocus
                  placeholder={t('watchParty.password')}
                  onChange={(event) => setPassword(event.target.value)}
                />
              ) : null}
              <Button type="submit" variant="neutral" disabled={!normalizeWatchPartyCode(joinCode)} aria-busy={joinChecking}>
                {t('watchParty.joinAction')}
              </Button>
            </form>
          </section>
        </div>

        {publicRooms.length ? (
          <section className={styles.publicRooms}>
            <h3>{t('watchParty.publicRooms')}</h3>
            <div className={styles.publicRoomList}>
              {publicRooms.map((room) => (
                <button type="button" key={room.code} onClick={() => choosePublicRoom(room)}>
                  <span>
                    <strong>{room.name || t('watchParty.unnamedRoom')}</strong>
                    <small>{room.hasStarted ? t('watchParty.inProgress') : t('watchParty.waiting')}</small>
                  </span>
                  <b>{room.participantCount}/{room.maxParticipants}</b>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}
