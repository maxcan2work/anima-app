import { useEffect, useState, type FormEvent } from 'react';
import { checkWatchPartyRoom } from '@/api';
import watchPartyIcon from '@assets/watch-party.svg';
import { normalizeWatchPartyCode } from '@shared/navigation';
import { useToast } from '@shared/ui/ToastProvider';

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
    <section className="watch-party-page">
      <div className="watch-party-entry">
        <header className="watch-party-entry-header">
          <img className="watch-party-icon" src={watchPartyIcon} alt="" aria-hidden="true" />
          <h2>Совместный просмотр</h2>
        </header>

        <div className="watch-party-entry-options">
          <section className="watch-party-entry-option">
            <h3>Создать комнату</h3>
            <p>Собери друзей в одной комнате, выбери аниме и управляй сериями как хост.</p>
            <button className="random-button" type="button" onClick={onCreateRoom}>
              Создать комнату
            </button>
          </section>

          <div className="watch-party-divider" aria-hidden="true">
            <span>или</span>
          </div>

          <section className="watch-party-entry-option">
            <h3>Войти по коду</h3>
            <p>Вставь код комнаты, который отправил хост, и подключайся к совместному просмотру.</p>
            <form className="watch-party-join" onSubmit={handleJoinRoom}>
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
