import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@features/auth/AuthProvider';
import { CatalogProvider } from '@features/catalog/CatalogProvider';
import { NavigationProvider } from '@features/navigation/NavigationProvider';
import { WatchLibraryProvider } from '@features/watch-library/WatchLibraryProvider';
import { I18nProvider } from '@shared/i18n/I18nProvider';
import { ModalProvider } from '@shared/ui/ModalProvider';
import { ToastProvider } from '@shared/ui/ToastProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <BrowserRouter>
      <I18nProvider>
        <ModalProvider>
          <ToastProvider>
            <AuthProvider>
              <NavigationProvider>
                <CatalogProvider>
                  <WatchLibraryProvider>
                    {children}
                  </WatchLibraryProvider>
                </CatalogProvider>
              </NavigationProvider>
            </AuthProvider>
          </ToastProvider>
        </ModalProvider>
      </I18nProvider>
    </BrowserRouter>
  );
}
