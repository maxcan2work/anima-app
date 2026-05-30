import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

type ButtonVariant = 'primary';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
};

export function Button({ children, className, type = 'button', variant = 'primary', ...props }: ButtonProps) {
  return (
    <button className={clsx(styles.button, styles[variant], className)} type={type} {...props}>
      {children}
    </button>
  );
}
