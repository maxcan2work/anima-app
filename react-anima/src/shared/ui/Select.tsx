import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import styles from './Select.module.css';

export type SelectOption<Value extends string> = {
  value: Value;
  label: string;
  disabled?: boolean;
};

type SelectProps<Value extends string> = {
  label: string;
  value: Value;
  options: Array<SelectOption<Value>>;
  onChange: (value: Value) => void;
  className?: string;
  disabled?: boolean;
};

export function Select<Value extends string>({ label, value, options, onChange, className, disabled }: SelectProps<Value>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div className={clsx(styles.select, className)} ref={rootRef}>
      <button className={styles.trigger} type="button" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span>{selected?.label}</span>
        <span className={styles.chevron} aria-hidden="true" />
      </button>
      {open ? (
        <div className={styles.menu} role="listbox" aria-label={label}>
          {options.map((option) => (
            <button
              className={option.value === value ? styles.selected : undefined}
              type="button"
              role="option"
              key={option.value}
              disabled={option.disabled}
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
