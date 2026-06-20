import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

type ButtonVariant = 'accent' | 'danger' | 'discord' | 'tonal' | 'neutral';
type ButtonSize = 'md' | 'sm';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  active?: boolean;
};

export function Button({ active, children, className, type = 'button', variant = 'accent', size = 'md', ...props }: ButtonProps) {
  return (
    <button className={clsx(styles.button, styles[variant], styles[size], active && styles.active, className)} type={type} {...props}>
      {children}
    </button>
  );
}
