import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ConfirmModal, type ConfirmModalVariant } from './ConfirmModal';

type ConfirmModalOptions = {
  title: string;
  content: ReactNode;
  cancelLabel?: string;
  confirmLabel?: string;
  confirmVariant?: ConfirmModalVariant;
};

type PendingConfirm = ConfirmModalOptions & {
  resolve: (confirmed: boolean) => void;
};

type ModalContextValue = {
  confirm: (options: ConfirmModalOptions) => Promise<boolean>;
};

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [closing, setClosing] = useState(false);

  const confirm = useCallback((options: ConfirmModalOptions) => {
    return new Promise<boolean>((resolve) => {
      setPendingConfirm({ ...options, resolve });
      setClosing(false);
    });
  }, []);

  const closeConfirm = useCallback((confirmed: boolean) => {
    if (!pendingConfirm || closing) return;

    setClosing(true);
    window.setTimeout(() => {
      pendingConfirm.resolve(confirmed);
      setPendingConfirm(null);
      setClosing(false);
    }, 140);
  }, [closing, pendingConfirm]);

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ModalContext.Provider value={value}>
      {children}
      <ConfirmModal
        open={Boolean(pendingConfirm)}
        closing={closing}
        title={pendingConfirm?.title ?? ''}
        cancelLabel={pendingConfirm?.cancelLabel}
        confirmLabel={pendingConfirm?.confirmLabel}
        confirmVariant={pendingConfirm?.confirmVariant}
        onCancel={() => closeConfirm(false)}
        onConfirm={() => closeConfirm(true)}
      >
        {pendingConfirm?.content ?? null}
      </ConfirmModal>
    </ModalContext.Provider>
  );
}

export function useConfirmModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useConfirmModal must be used inside ModalProvider');
  }
  return context.confirm;
}
