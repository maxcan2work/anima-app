import { useEffect, useRef } from 'react';
import { useConfirmModal } from '../shared/ui/ModalProvider';

type UseWatchPartyLeaveGuardOptions = {
  active: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function useWatchPartyLeaveGuard({ active, onConfirm, onCancel }: UseWatchPartyLeaveGuardOptions) {
  const confirm = useConfirmModal();
  const confirmOpenRef = useRef(false);

  useEffect(() => {
    if (!active || confirmOpenRef.current) return;

    confirmOpenRef.current = true;
    confirm({
      title: 'Покинуть совместный просмотр?',
      content: <p>Чтобы перейти в другой раздел, нужно выйти из комнаты. Текущий совместный просмотр будет отключен для тебя.</p>,
      cancelLabel: 'Остаться',
      confirmLabel: 'Выйти и перейти',
      confirmVariant: 'danger',
    }).then((confirmed) => {
      confirmOpenRef.current = false;
      if (confirmed) {
        onConfirm();
      } else {
        onCancel();
      }
    });
  }, [active, confirm, onCancel, onConfirm]);
}
