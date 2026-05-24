import type { ReactNode } from 'react';
import { ModalProvider } from '../shared/ui/ModalProvider';
import { ToastProvider } from '../shared/ui/ToastProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ModalProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </ModalProvider>
  );
}
