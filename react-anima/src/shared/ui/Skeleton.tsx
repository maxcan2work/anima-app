import clsx from 'clsx';
import type { CSSProperties } from 'react';
import styles from './Skeleton.module.css';

type SkeletonProps = {
  className?: string;
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  rounded?: boolean;
};

export function Skeleton({ className, width, height, rounded = false }: SkeletonProps) {
  return <span className={clsx(styles.skeleton, rounded && styles.rounded, className)} style={{ width, height }} aria-hidden="true" />;
}
