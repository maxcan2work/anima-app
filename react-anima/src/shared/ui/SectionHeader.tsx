import clsx from 'clsx';
import type { ElementType, ReactNode } from 'react';
import styles from './SectionHeader.module.css';

type SectionHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  level?: 'section' | 'subsection';
  className?: string;
};

export function SectionHeader({ title, description, action, level = 'section', className }: SectionHeaderProps) {
  const Heading = (level === 'section' ? 'h3' : 'h4') as ElementType;
  return (
    <header className={clsx(styles.header, styles[level], className)}>
      <span className={styles.copy}>
        <Heading>{title}</Heading>
        {description ? <p>{description}</p> : null}
      </span>
      {action ? <span className={styles.action}>{action}</span> : null}
    </header>
  );
}
