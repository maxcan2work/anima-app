import clsx from 'clsx';
import type { CSSProperties, ReactNode } from 'react';
import styles from './SplitScreenLayout.module.css';

type SplitScreenLayoutProps = {
  children: ReactNode;
  sidebar?: ReactNode;
  sidebarLabel?: string;
  sidebarWidth?: number;
  fixed?: boolean;
  className?: string;
  mainClassName?: string;
  sidebarClassName?: string;
};

export function SplitScreenLayout({
  children,
  sidebar,
  sidebarLabel,
  sidebarWidth = 300,
  fixed = false,
  className,
  mainClassName,
  sidebarClassName,
}: SplitScreenLayoutProps) {
  const style = { '--split-sidebar-width': `${sidebarWidth}px` } as CSSProperties;

  return (
    <section className={clsx(styles.layout, fixed && styles.fixed, className)} style={style}>
      <div className={clsx(styles.main, mainClassName)}>{children}</div>
      {sidebar ? (
        <aside className={clsx(styles.sidebar, sidebarClassName)} aria-label={sidebarLabel}>
          {sidebar}
        </aside>
      ) : null}
    </section>
  );
}
