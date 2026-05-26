import { useEffect, useState, type FormEvent } from 'react';
import { checkWatchPartyRoom } from '@/api';
import WatchPartyIcon from '@assets/watch-party.svg?react';
import { useI18n } from '@shared/i18n/I18nProvider';
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
  const { t } = useI18n();
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
        toast({ message: t('watchParty.notFound'), variant: 'warning' });
        return;
      }

      onJoinRoom(normalized);
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
            <button className={styles.createButton} type="button" onClick={onCreateRoom}>
              {t('watchParty.createAction')}
            </button>
          </section>

          <div className={styles.divider} aria-hidden="true">
            <span>{t('watchParty.or')}</span>
          </div>

          <section className={styles.option}>
            <h3>{t('watchParty.joinTitle')}</h3>
            <p>{t('watchParty.joinDescription')}</p>
            <form className={styles.join} onSubmit={handleJoinRoom}>
              <input
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value)}
                placeholder={t('watchParty.roomCode')}
                maxLength={12}
              />
              <button type="submit" disabled={!normalizeWatchPartyCode(joinCode)} aria-busy={joinChecking}>
                {t('watchParty.joinAction')}
              </button>
            </form>
          </section>
        </div>
      </div>
    </section>
  );
}
