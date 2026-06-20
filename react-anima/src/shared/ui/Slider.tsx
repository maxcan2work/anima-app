import clsx from 'clsx';
import type { CSSProperties, InputHTMLAttributes } from 'react';
import styles from './Slider.module.css';

type SliderProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
};

export function Slider({ className, value, min, max, onChange, style, ...props }: SliderProps) {
  const progress = max === min ? 0 : ((value - min) / (max - min)) * 100;
  const sliderStyle = { ...style, '--slider-progress': `${progress}%` } as CSSProperties;

  return (
    <input
      {...props}
      className={clsx(styles.slider, className)}
      style={sliderStyle}
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}
