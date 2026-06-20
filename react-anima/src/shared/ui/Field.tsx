import clsx from 'clsx';
import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import styles from './Field.module.css';

type FieldProps = {
  label: ReactNode;
  children: ReactNode;
  className?: string;
  description?: ReactNode;
};

type InputFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: ReactNode;
  description?: ReactNode;
  inputClassName?: string;
};

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(styles.input, className)} {...props} />;
}

export function Field({ label, children, className, description }: FieldProps) {
  return (
    <label className={clsx(styles.field, className)}>
      <span className={styles.label}>{label}</span>
      {children}
      {description ? <span className={styles.description}>{description}</span> : null}
    </label>
  );
}

export function InputField({ label, description, inputClassName, ...props }: InputFieldProps) {
  const id = useId();
  return (
    <label className={styles.field} htmlFor={id}>
      <span className={styles.label}>{label}</span>
      <Input className={inputClassName} id={id} {...props} />
      {description ? <span className={styles.description}>{description}</span> : null}
    </label>
  );
}
