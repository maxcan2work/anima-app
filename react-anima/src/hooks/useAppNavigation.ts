import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getRouteAnimeId,
  getViewFromPath,
  getWatchPartyCodeFromPath,
  navigateToRemembered,
  type AppView,
} from '../shared/navigation';

export function useAppNavigation() {
  const [watchPartyCode, setWatchPartyCode] = useState(getWatchPartyCodeFromPath(window.location.pathname));
  const [watchPartyCreateCode, setWatchPartyCreateCode] = useState('');
  const [watchPartyLeaveTarget, setWatchPartyLeaveTarget] = useState<{ path: string; view: AppView } | null>(null);
  const [view, setView] = useState<AppView>(() => getViewFromPath(window.location.pathname));
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const lastWatchPathRef = useRef(window.location.pathname.startsWith('/anime') ? window.location.pathname : '/anime');
  const scrollByPathRef = useRef<Record<string, number>>({});
  const routeAnimeId = getRouteAnimeId(currentPath);

  useEffect(() => {
    function handlePopState() {
      setCurrentPath((current) => {
        scrollByPathRef.current[current] = window.scrollY;
        return window.location.pathname;
      });
      const nextView = getViewFromPath(window.location.pathname);
      if (nextView === 'watch') {
        lastWatchPathRef.current = window.location.pathname;
      }
      setWatchPartyCode(getWatchPartyCodeFromPath(window.location.pathname));
      setView(nextView);
    }

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    if (currentPath.startsWith('/anime')) {
      lastWatchPathRef.current = currentPath;
    }
  }, [currentPath]);

  function requestRoute(path: string, nextView: AppView) {
    if (watchPartyCode && nextView !== 'watchParty') {
      setWatchPartyLeaveTarget({ path, view: nextView });
      return;
    }

    navigateToRemembered(path, setCurrentPath, scrollByPathRef);
    setView(nextView);
  }

  function requestAnimeRoute(path: string) {
    requestRoute(path, 'watch');
  }

  const openWatchParty = useCallback((path: string) => {
    setWatchPartyCode(getWatchPartyCodeFromPath(path));
    navigateToRemembered(path, setCurrentPath, scrollByPathRef);
    setView('watchParty');
  }, []);

  const consumeWatchPartyCreate = useCallback(() => {
    setWatchPartyCreateCode('');
  }, []);

  const leaveWatchParty = useCallback(() => {
    const path = '/watch-party';
    setWatchPartyCode('');
    setWatchPartyCreateCode('');
    setWatchPartyLeaveTarget(null);
    setCurrentPath((current) => {
      scrollByPathRef.current[current] = window.scrollY;
      if (window.location.pathname !== path) {
        window.history.replaceState(null, '', path);
      }
      return path;
    });
    setView('watchParty');
  }, []);

  function requestWatchView() {
    const nextPath = view === 'watch' && routeAnimeId ? '/anime' : lastWatchPathRef.current;
    requestAnimeRoute(nextPath);
  }

  function closeWatchPartyLeaveModal() {
    setWatchPartyLeaveTarget(null);
  }

  function confirmLeaveWatchParty() {
    const target = watchPartyLeaveTarget ?? { path: '/anime', view: 'watch' as AppView };
    setWatchPartyLeaveTarget(null);
    setWatchPartyCode('');
    setCurrentPath((current) => {
      scrollByPathRef.current[current] = window.scrollY;
      if (window.location.pathname !== target.path) {
        window.history.replaceState(null, '', target.path);
      }
      return target.path;
    });
    setView(target.view);
  }

  function redirectToWatchRoot() {
    const path = '/anime';
    setCurrentPath((current) => {
      scrollByPathRef.current[current] = window.scrollY;
      if (window.location.pathname !== path) {
        window.history.replaceState(null, '', path);
      }
      return path;
    });
    setView('watch');
  }

  function restoreScroll(path: string) {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: scrollByPathRef.current[path] ?? 0 });
    });
  }

  return {
    watchPartyCode,
    watchPartyCreateCode,
    watchPartyLeaveTarget,
    view,
    currentPath,
    routeAnimeId,
    setView,
    setWatchPartyCreateCode,
    requestRoute,
    requestAnimeRoute,
    openWatchParty,
    consumeWatchPartyCreate,
    leaveWatchParty,
    requestWatchView,
    closeWatchPartyLeaveModal,
    confirmLeaveWatchParty,
    redirectToWatchRoot,
    restoreScroll,
  };
}
