import { useId, type ReactNode } from 'react';

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
      className={closing ? 'modal-backdrop closing' : 'modal-backdrop'}
      role="presentation"
      onClick={onCancel}
    >
      <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => event.stopPropagation()}>
        <h3 id={titleId}>{title}</h3>
        <div className="confirm-modal-body">{children}</div>
        <div className="confirm-modal-actions">
          <button className="text-button" type="button" onClick={onCancel} disabled={closing}>
            {cancelLabel}
          </button>
          <button className={confirmVariant === 'danger' ? 'danger-button' : 'primary-button'} type="button" onClick={onConfirm} disabled={closing}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
