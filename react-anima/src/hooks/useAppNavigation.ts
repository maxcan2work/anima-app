import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getRouteAnimeId,
  getViewFromPath,
  getWatchPartyCodeFromPath,
  type AppView,
} from '../shared/navigation';

export function useAppNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const watchPartyCode = getWatchPartyCodeFromPath(currentPath);
  const view = getViewFromPath(currentPath);
  const routeAnimeId = getRouteAnimeId(currentPath);
  const [watchPartyCreateCode, setWatchPartyCreateCode] = useState('');
  const [watchPartyLeaveTarget, setWatchPartyLeaveTarget] = useState<{ path: string; view: AppView } | null>(null);
  const lastWatchPathRef = useRef(currentPath.startsWith('/anime') ? currentPath : '/anime');
  const scrollByPathRef = useRef<Record<string, number>>({});

  const navigateRemembered = useCallback((path: string, replace = false) => {
    scrollByPathRef.current[currentPath] = window.scrollY;
    if (currentPath !== path) {
      navigate(path, { replace });
    }
  }, [currentPath, navigate]);

  useEffect(() => {
    if (currentPath.startsWith('/anime')) {
      lastWatchPathRef.current = currentPath;
    }
  }, [currentPath]);

  const requestRoute = useCallback((path: string, nextView: AppView) => {
    if (watchPartyCode && nextView !== 'watchParty') {
      setWatchPartyLeaveTarget({ path, view: nextView });
      return;
    }

    navigateRemembered(path);
  }, [navigateRemembered, watchPartyCode]);

  const requestAnimeRoute = useCallback((path: string) => {
    requestRoute(path, 'watch');
  }, [requestRoute]);

  const openWatchParty = useCallback((path: string) => {
    navigateRemembered(path);
  }, [navigateRemembered]);

  const consumeWatchPartyCreate = useCallback(() => {
    setWatchPartyCreateCode('');
  }, []);

  const leaveWatchParty = useCallback(() => {
    setWatchPartyCreateCode('');
    setWatchPartyLeaveTarget(null);
    navigateRemembered('/watch-party', true);
  }, [navigateRemembered]);

  const requestWatchView = useCallback(() => {
    const nextPath = view === 'watch' && routeAnimeId ? '/anime' : lastWatchPathRef.current;
    requestAnimeRoute(nextPath);
  }, [requestAnimeRoute, routeAnimeId, view]);

  const closeWatchPartyLeaveModal = useCallback(() => {
    setWatchPartyLeaveTarget(null);
  }, []);

  const confirmLeaveWatchParty = useCallback(() => {
    const target = watchPartyLeaveTarget ?? { path: '/anime', view: 'watch' as AppView };
    setWatchPartyLeaveTarget(null);
    navigateRemembered(target.path, true);
  }, [navigateRemembered, watchPartyLeaveTarget]);

  const redirectToWatchRoot = useCallback(() => {
    navigateRemembered('/anime', true);
  }, [navigateRemembered]);

  const restoreScroll = useCallback((path: string) => {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: scrollByPathRef.current[path] ?? 0 });
    });
  }, []);

  const setView = useCallback((nextView: AppView) => {
    if (nextView === view) return;
    if (nextView === 'watch') {
      navigateRemembered('/anime');
    }
  }, [navigateRemembered, view]);

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
