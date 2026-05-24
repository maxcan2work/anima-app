import clsx from 'clsx';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './ToastProvider.module.css';

type ToastVariant = 'default' | 'success' | 'danger' | 'warning';

type ToastOptions = {
  message: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastInput = string | ToastOptions;

type ToastItem = Required<ToastOptions> & {
  id: number;
  closing: boolean;
};

const DEFAULT_TOAST_DURATION = 2400;
const TOAST_EXIT_DURATION = 180;
const ToastContext = createContext<((toast: ToastInput) => number) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextIdRef = useRef(1);
  const timersRef = useRef<number[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((current) => current.map((toast) => (toast.id === id ? { ...toast, closing: true } : toast)));
    const removeTimer = window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, TOAST_EXIT_DURATION);
    timersRef.current.push(removeTimer);
  }, []);

  const pushToast = useCallback((input: ToastInput) => {
    const options = typeof input === 'string' ? { message: input } : input;
    const id = nextIdRef.current++;
    const toast: ToastItem = {
      id,
      message: options.message,
      variant: options.variant ?? 'default',
      duration: options.duration ?? DEFAULT_TOAST_DURATION,
      closing: false,
    };

    setToasts((current) => [...current, toast]);
    const closeTimer = window.setTimeout(() => removeToast(id), toast.duration);
    timersRef.current.push(closeTimer);
    return id;
  }, [removeToast]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
    };
  }, []);

  return (
    <ToastContext.Provider value={pushToast}>
      {children}
      <ToastViewport toasts={toasts} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return context;
}

function ToastViewport({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) return null;

  return (
    <div className={styles.viewport} aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={clsx(
            styles.toast,
            toast.closing && styles.closing,
            toast.variant === 'success' && styles.success,
            toast.variant === 'danger' && styles.danger,
            toast.variant === 'warning' && styles.warning,
          )}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
