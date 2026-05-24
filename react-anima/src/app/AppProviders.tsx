import type { ReactNode } from 'react';
import { AuthProvider } from '../features/auth/AuthProvider';
import { ModalProvider } from '../shared/ui/ModalProvider';
import { ToastProvider } from '../shared/ui/ToastProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ModalProvider>
      <ToastProvider>
        <AuthProvider>
          {children}
        </AuthProvider>
      </ToastProvider>
    </ModalProvider>
  );
}
