import clsx from 'clsx';
import type { InputHTMLAttributes, ReactNode } from 'react';
import styles from './Checkbox.module.css';

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: ReactNode;
};

export function Checkbox({ label, className, ...props }: CheckboxProps) {
  return (
    <label className={clsx(styles.checkbox, className)}>
      <input type="checkbox" {...props} />
      <span className={styles.indicator} aria-hidden="true" />
      <span className={styles.label}>{label}</span>
    </label>
  );
}
