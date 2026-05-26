import { useEffect, useRef } from 'react';
import { useI18n } from '@shared/i18n/I18nProvider';
import { useConfirmModal } from '@shared/ui/ModalProvider';

type UseWatchPartyLeaveGuardOptions = {
  active: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function useWatchPartyLeaveGuard({ active, onConfirm, onCancel }: UseWatchPartyLeaveGuardOptions) {
  const confirm = useConfirmModal();
  const { t } = useI18n();
  const confirmOpenRef = useRef(false);

  useEffect(() => {
    if (!active || confirmOpenRef.current) return;

    confirmOpenRef.current = true;
    confirm({
      title: t('watchParty.leaveTitle'),
      content: <p>{t('watchParty.leaveDescription')}</p>,
      cancelLabel: t('watchParty.stay'),
      confirmLabel: t('watchParty.leaveAndGo'),
      confirmVariant: 'danger',
    }).then((confirmed) => {
      confirmOpenRef.current = false;
      if (confirmed) {
        onConfirm();
      } else {
        onCancel();
      }
    });
  }, [active, confirm, onCancel, onConfirm, t]);
}
