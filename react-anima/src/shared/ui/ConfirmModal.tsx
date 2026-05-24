import clsx from 'clsx';
import { useId, type ReactNode } from 'react';
import styles from './ConfirmModal.module.css';

export type ConfirmModalVariant = 'danger' | 'primary';

type ConfirmModalProps = {
  open: boolean;
  closing?: boolean;
  title: string;
  children: ReactNode;
  cancelLabel?: string;
  confirmLabel?: string;
  confirmVariant?: ConfirmModalVariant;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmModal({
  open,
  closing = false,
  title,
  children,
  cancelLabel = 'Отмена',
  confirmLabel = 'Подтвердить',
  confirmVariant = 'primary',
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  const titleId = useId();

  if (!open) return null;

  return (
    <div
      className={clsx(styles.backdrop, closing && styles.backdropClosing)}
      role="presentation"
      onClick={onCancel}
    >
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => event.stopPropagation()}>
        <h3 id={titleId}>{title}</h3>
        <div>{children}</div>
        <div className={styles.actions}>
          <button className={styles.textButton} type="button" onClick={onCancel} disabled={closing}>
            {cancelLabel}
          </button>
          <button className={confirmVariant === 'danger' ? styles.dangerButton : styles.primaryButton} type="button" onClick={onConfirm} disabled={closing}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
