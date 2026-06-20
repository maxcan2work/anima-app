import clsx from 'clsx';
import type { ReactNode } from 'react';
import styles from './CollapsibleSection.module.css';

type CollapsibleSectionProps = {
  activeCount?: number;
  children: ReactNode;
  collapsed: boolean;
  id: string;
  title: ReactNode;
  className?: string;
  onToggle: () => void;
};

export function CollapsibleSection({ activeCount = 0, children, collapsed, id, title, className, onToggle }: CollapsibleSectionProps) {
  const contentId = `collapsible-section-${id}`;
  return (
    <section className={clsx(styles.section, className)}>
      <button className={styles.header} type="button" aria-expanded={!collapsed} aria-controls={contentId} onClick={onToggle}>
        <span className={styles.title}>
          <span>{title}</span>
          {collapsed && activeCount > 0 ? <span className={styles.badge}>{activeCount}</span> : null}
        </span>
        <span className={styles.chevron} aria-hidden="true" />
      </button>
      <div className={styles.body} id={contentId} aria-hidden={collapsed} data-collapsed={collapsed ? 'true' : 'false'}>
        <div className={styles.bodyInner}>{children}</div>
      </div>
    </section>
  );
}
