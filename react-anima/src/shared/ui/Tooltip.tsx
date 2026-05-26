import clsx from 'clsx';
import type { ReactNode } from 'react';
import styles from './Tooltip.module.css';

type TooltipPlacement = 'top' | 'right' | 'bottom' | 'left';

type TooltipProps = {
  label: string;
  children: ReactNode;
  placement?: TooltipPlacement;
  className?: string;
};

export function Tooltip({ label, children, placement = 'top', className }: TooltipProps) {
  return (
    <span className={clsx(styles.tooltip, styles[placement], className)}>
      {children}
      <span className={styles.content} role="tooltip">
        {label}
      </span>
    </span>
  );
}
