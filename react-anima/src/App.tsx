import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { AppProviders } from '@app/AppProviders';
import { AppScreens } from '@app/AppScreens';
import { useAuth } from '@features/auth/AuthProvider';
import { useNavigation } from '@features/navigation/NavigationProvider';
import { loadSidebarCollapsed, saveSidebarCollapsed } from '@shared/storage';
import { AppSidebar } from '@widgets/app-sidebar/AppSidebar';
import styles from './App.module.css';

export function App() {
  return (
    <AppProviders>
      <AppContent />
    </AppProviders>
  );
}

function AppContent() {
  const { user, authStatus } = useAuth();
  const { currentPath, redirectToWatchRoot, screenAnimation } = useNavigation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(loadSidebarCollapsed);

  useEffect(() => {
    saveSidebarCollapsed(sidebarCollapsed);
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (authStatus === 'loading' || user || currentPath !== '/profile') return;
    redirectToWatchRoot();
  }, [authStatus, currentPath, redirectToWatchRoot, user]);

  return (
    <main className={clsx(styles.shell, sidebarCollapsed && styles.collapsed)}>
      <AppSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
      />

      <section className={styles.watchArea}>
        <div className={clsx(styles.screenTransition, screenAnimation === 'leaving' && styles.leaving, screenAnimation === 'entering' && styles.entering)}>
          <AppScreens />
        </div>
      </section>
    </main>
  );
}
