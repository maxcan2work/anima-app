import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { AppProviders } from '@app/AppProviders';
import { AppScreens } from '@app/AppScreens';
import { useAuth } from '@features/auth/AuthProvider';
import { useNavigation } from '@features/navigation/NavigationProvider';
import { profileRoute } from '@shared/navigation';
import { loadSidebarCollapsed, saveSidebarCollapsed } from '@shared/storage';
import { ErrorBoundary } from '@shared/ui/ErrorBoundary';
import { AppSidebar } from '@widgets/app-sidebar/AppSidebar';
import styles from './App.module.css';

export function App() {
  return (
    <ErrorBoundary>
      <AppProviders>
        <AppContent />
      </AppProviders>
    </ErrorBoundary>
  );
}

function AppContent() {
  const { user, authStatus } = useAuth();
  const { currentPath, redirectToProfile, redirectToWatchRoot, screenAnimation } = useNavigation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(loadSidebarCollapsed);

  useEffect(() => {
    saveSidebarCollapsed(sidebarCollapsed);
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (authStatus === 'loading' || user || !currentPath.startsWith('/profile')) return;
    redirectToWatchRoot();
  }, [authStatus, currentPath, redirectToWatchRoot, user]);

  useEffect(() => {
    if (authStatus !== 'ready' || !user || currentPath !== '/profile') return;
    redirectToProfile(profileRoute(user.id));
  }, [authStatus, currentPath, redirectToProfile, user]);

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
