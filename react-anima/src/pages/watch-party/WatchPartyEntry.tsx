import { useEffect, useState, type FormEvent } from 'react';
import { checkWatchPartyRoom } from '@/api';
import watchPartyIcon from '@assets/watch-party.svg';
import { normalizeWatchPartyCode } from '@shared/navigation';
import { useToast } from '@shared/ui/ToastProvider';
import styles from './WatchPartyEntry.module.css';

type WatchPartyEntryProps = {
  code: string;
  joinChecking: boolean;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
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
  const [joinCode, setJoinCode] = useState(code);

  useEffect(() => {
    setJoinCode(code);
  }, [code]);

  async function handleJoinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeWatchPartyCode(joinCode);
    if (!normalized || joinChecking) return;

    onJoinCheckingChange(true);
    try {
      const { exists } = await checkWatchPartyRoom(normalized);
      if (!exists) {
        toast({ message: 'Комната с таким кодом не найдена', variant: 'warning' });
        return;
      }

      onJoinRoom(normalized);
    } catch {
      toast({ message: 'Не удалось проверить комнату', variant: 'danger' });
    } finally {
      onJoinCheckingChange(false);
    }
  }

  return (
    <section className={styles.page}>
      <div className={styles.entry}>
        <header className={styles.header}>
          <img className={styles.icon} src={watchPartyIcon} alt="" aria-hidden="true" />
          <h2>Совместный просмотр</h2>
        </header>

        <div className={styles.options}>
          <section className={styles.option}>
            <h3>Создать комнату</h3>
            <p>Собери друзей в одной комнате, выбери аниме и управляй сериями как хост.</p>
            <button className={styles.createButton} type="button" onClick={onCreateRoom}>
              Создать комнату
            </button>
          </section>

          <div className={styles.divider} aria-hidden="true">
            <span>или</span>
          </div>

          <section className={styles.option}>
            <h3>Войти по коду</h3>
            <p>Вставь код комнаты, который отправил хост, и подключайся к совместному просмотру.</p>
            <form className={styles.join} onSubmit={handleJoinRoom}>
              <input
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value)}
                placeholder="Код комнаты"
                maxLength={12}
              />
              <button type="submit" disabled={!normalizeWatchPartyCode(joinCode)} aria-busy={joinChecking}>
                Подключиться
              </button>
            </form>
          </section>
        </div>
      </div>
    </section>
  );
}
