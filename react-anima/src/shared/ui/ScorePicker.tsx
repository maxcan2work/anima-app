import clsx from 'clsx';
import type { MouseEvent } from 'react';
import styles from './ScorePicker.module.css';

type ScorePickerProps = {
  value: number | null;
  noneLabel: string;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  className?: string;
  max?: number;
};

export function ScorePicker({ value, noneLabel, onChange, disabled, className, max = 10 }: ScorePickerProps) {
  function selectScore(event: MouseEvent<HTMLButtonElement>, score: number | null) {
    event.stopPropagation();
    onChange(score);
  }

  return (
    <div className={clsx(styles.picker, className)} onClick={(event) => event.stopPropagation()}>
      {Array.from({ length: max }, (_, index) => index + 1).map((score) => (
        <button
          key={score}
          className={value === score ? styles.active : undefined}
          type="button"
          onClick={(event) => selectScore(event, score)}
          disabled={disabled}
          aria-pressed={value === score}
        >
          {score}
        </button>
      ))}
      <button
        className={value == null ? styles.active : undefined}
        type="button"
        onClick={(event) => selectScore(event, null)}
        disabled={disabled}
        aria-pressed={value == null}
      >
        {noneLabel}
      </button>
    </div>
  );
}
