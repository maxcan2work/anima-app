import clsx from 'clsx';
import type { TextareaHTMLAttributes } from 'react';
import styles from './Textarea.module.css';

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(styles.textarea, className)} {...props} />;
}
