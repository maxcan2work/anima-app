import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './IconButton.module.css';

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
};

export function IconButton({ children, className, type = 'button', size = 'lg', active, ...props }: IconButtonProps) {
  return (
    <button className={clsx(styles.button, styles[size], active && styles.active, className)} type={type} {...props}>
      {children}
    </button>
  );
}
