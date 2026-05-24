import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import { useScreenTransition } from '../../hooks/useScreenTransition';
import { useWatchPartyLeaveGuard } from '../../hooks/useWatchPartyLeaveGuard';
import { getRouteAnimeId, type AppView } from '../../shared/navigation';

type NavigationContextValue = ReturnType<typeof useAppNavigation> & {
  displayedView: AppView;
  displayedPath: string;
  displayedRouteAnimeId: string;
  screenAnimation: 'idle' | 'leaving' | 'entering';
};

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const navigation = useAppNavigation();
  const screenKey = `${navigation.view}:${navigation.currentPath}`;
  const { screenAnimation, displayedScreenKey } = useScreenTransition(screenKey);
  const displayedScreenDivider = displayedScreenKey.indexOf(':');
  const displayedView = displayedScreenKey.slice(0, displayedScreenDivider) as AppView;
  const displayedPath = displayedScreenKey.slice(displayedScreenDivider + 1);
  const displayedRouteAnimeId = getRouteAnimeId(displayedPath);

  useEffect(() => {
    navigation.restoreScroll(displayedPath);
  }, [displayedPath]);

  useWatchPartyLeaveGuard({
    active: Boolean(navigation.watchPartyLeaveTarget),
    onConfirm: navigation.confirmLeaveWatchParty,
    onCancel: navigation.closeWatchPartyLeaveModal,
  });

  return (
    <NavigationContext.Provider
      value={{
        ...navigation,
        displayedView,
        displayedPath,
        displayedRouteAnimeId,
        screenAnimation,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used inside NavigationProvider');
  }
  return context;
}
