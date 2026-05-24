import { useEffect, useState } from 'react';

export function useToast(duration = 2400) {
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => setToast(''), duration);
    return () => window.clearTimeout(timer);
  }, [duration, toast]);

  return { toast, setToast };
}
