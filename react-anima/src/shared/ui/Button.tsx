import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'tonal';
type ButtonSize = 'md' | 'sm';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ children, className, type = 'button', variant = 'primary', size = 'md', ...props }: ButtonProps) {
  return (
    <button className={clsx(styles.button, styles[variant], styles[size], className)} type={type} {...props}>
      {children}
    </button>
  );
}
