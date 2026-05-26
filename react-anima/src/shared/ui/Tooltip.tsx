import clsx from 'clsx';
import type { ReactNode } from 'react';
import styles from './Tooltip.module.css';

type TooltipPlacement = 'top' | 'right' | 'bottom' | 'left';

type TooltipProps = {
  label: string;
  children: ReactNode;
  placement?: TooltipPlacement;
  className?: string;
  open?: boolean;
  disabled?: boolean;
};

export function Tooltip({ label, children, placement = 'top', className, open, disabled = false }: TooltipProps) {
  return (
    <span className={clsx(styles.tooltip, styles[placement], open && styles.open, disabled && styles.disabled, className)}>
      {children}
      {!disabled ? (
        <span className={styles.content} role="tooltip">
          {label}
        </span>
      ) : null}
    </span>
  );
}
