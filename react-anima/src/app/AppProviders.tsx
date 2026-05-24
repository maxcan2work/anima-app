import type { ReactNode } from 'react';
import { AuthProvider } from '../features/auth/AuthProvider';
import { NavigationProvider } from '../features/navigation/NavigationProvider';
import { ModalProvider } from '../shared/ui/ModalProvider';
import { ToastProvider } from '../shared/ui/ToastProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ModalProvider>
      <ToastProvider>
        <AuthProvider>
          <NavigationProvider>
            {children}
          </NavigationProvider>
        </AuthProvider>
      </ToastProvider>
    </ModalProvider>
  );
}
