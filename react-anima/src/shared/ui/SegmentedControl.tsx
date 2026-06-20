import clsx from 'clsx';
import type { ReactNode } from 'react';
import styles from './SegmentedControl.module.css';

export type SegmentedOption<Value extends string> = {
  value: Value;
  label: ReactNode;
  disabled?: boolean;
};

type SegmentedControlProps<Value extends string> = {
  value: Value;
  options: Array<SegmentedOption<Value>>;
  onChange: (value: Value) => void;
  ariaLabel?: string;
  className?: string;
};

export function SegmentedControl<Value extends string>({ value, options, onChange, ariaLabel, className }: SegmentedControlProps<Value>) {
  return (
    <div className={clsx(styles.control, className)} role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          className={value === option.value ? styles.selected : undefined}
          type="button"
          key={option.value}
          disabled={option.disabled}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
