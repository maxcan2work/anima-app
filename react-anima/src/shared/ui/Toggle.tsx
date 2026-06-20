import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Toggle.module.css';

type ToggleProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'onClick'> & {
  checked: boolean;
  label: ReactNode;
  description?: ReactNode;
  onChange: (checked: boolean) => void;
};

export function Toggle({ checked, label, description, className, disabled, onChange, ...props }: ToggleProps) {
  return (
    <button
      className={clsx(styles.row, className)}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      {...props}
    >
      <span className={styles.copy}>
        <span className={styles.label}>{label}</span>
        {description ? <span className={styles.description}>{description}</span> : null}
      </span>
      <span className={styles.toggle} aria-hidden="true"><span /></span>
    </button>
  );
}
