import { useEffect, useState } from 'react';
import { AppProviders } from '@app/AppProviders';
import { AppScreens } from '@app/AppScreens';
import { useAuth } from '@features/auth/AuthProvider';
import { useNavigation } from '@features/navigation/NavigationProvider';
import { loadSidebarCollapsed, saveSidebarCollapsed } from '@shared/storage';
import { AppSidebar } from '@widgets/app-sidebar/AppSidebar';

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
    <main className={sidebarCollapsed ? 'app-shell sidebar-collapsed' : 'app-shell'}>
      <AppSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
      />

      <section className="watch-area">
        <div className={`screen-transition ${screenAnimation}`}>
          <AppScreens />
        </div>
      </section>
    </main>
  );
}
