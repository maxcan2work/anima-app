import { useEffect, useState } from 'react';

export function useScreenTransition(screenKey: string) {
  const [screenAnimation, setScreenAnimation] = useState<'idle' | 'leaving' | 'entering'>('idle');
  const [displayedScreenKey, setDisplayedScreenKey] = useState(screenKey);

  useEffect(() => {
    if (displayedScreenKey === screenKey) return;

    setScreenAnimation('leaving');
    const enterTimer = window.setTimeout(() => {
      setDisplayedScreenKey(screenKey);
      setScreenAnimation('entering');
    }, 120);
    const idleTimer = window.setTimeout(() => setScreenAnimation('idle'), 300);

    return () => {
      window.clearTimeout(enterTimer);
      window.clearTimeout(idleTimer);
    };
  }, [displayedScreenKey, screenKey]);

  return { screenAnimation, displayedScreenKey };
}
