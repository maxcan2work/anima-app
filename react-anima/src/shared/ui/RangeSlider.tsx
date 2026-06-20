import type { CSSProperties, InputHTMLAttributes, ReactNode } from 'react';
import styles from './RangeSlider.module.css';

type RangeSliderProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => ReactNode;
  marks?: ReactNode[];
};

export function RangeSlider({ value, min, max, onChange, formatValue = String, marks, ...props }: RangeSliderProps) {
  const ratio = max === min ? 0 : (value - min) / (max - min);
  const progress = ratio * 100;
  const style = {
    '--range-progress': `${progress}%`,
    '--range-thumb-position': `calc(${progress}% + ${(0.5 - ratio) * 20}px)`,
  } as CSSProperties;

  return (
    <label className={styles.range} style={style}>
      <span className={styles.track}>
        <span className={styles.tooltip}>{formatValue(value)}</span>
        <input {...props} type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      </span>
      {marks?.length ? <span className={styles.marks} aria-hidden="true">{marks.map((mark, index) => <span key={index}>{mark}</span>)}</span> : null}
    </label>
  );
}
