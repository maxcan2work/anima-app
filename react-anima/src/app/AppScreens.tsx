import { AnimeHero, AnimeHeroSkeleton } from '@pages/anime/AnimeHero';
import { ProfilePage } from '@pages/profile/ProfilePage';
import { RandomAnimePage } from '@pages/random/RandomAnimePage';
import { SettingsPage } from '@pages/settings/SettingsPage';
import { WatchPartyPage } from '@pages/watch-party/WatchPartyPage';
import { EmptyCatalog, WatchHome } from '@pages/watch/WatchHome';
import { useNavigation } from '@features/navigation/NavigationProvider';
import { useWatchLibrary } from '@features/watch-library/WatchLibraryProvider';
import { getWatchPartyCodeFromPath } from '@shared/navigation';

export function AppScreens() {
  const {
    displayedView,
    displayedPath,
    displayedRouteAnimeId,
    watchPartyCreateCode,
    setWatchPartyCreateCode,
    openWatchParty,
    leaveWatchParty,
    consumeWatchPartyCreate,
  } = useNavigation();
  const { displayedSelected, routeAnimeLoading, watchState, updateWatchState } = useWatchLibrary();

  if (displayedView === 'random') {
    return <RandomAnimePage />;
  }

  if (displayedView === 'watchParty') {
    const code = getWatchPartyCodeFromPath(displayedPath);

    return (
      <WatchPartyPage
        code={code}
        createRoom={watchPartyCreateCode === code}
        onCreateRoom={(roomCode) => {
          setWatchPartyCreateCode(roomCode);
          openWatchParty(`/watch-party/${roomCode}`);
        }}
        onJoinRoom={(roomCode) => openWatchParty(`/watch-party/${roomCode}`)}
        onLeaveRoom={leaveWatchParty}
        onCreateRoomConsumed={consumeWatchPartyCreate}
      />
    );
  }

  if (displayedView === 'settings') {
    return <SettingsPage />;
  }

  if (displayedView === 'watch' && !displayedRouteAnimeId) {
    return <WatchHome />;
  }

  if (displayedView === 'watch' && (routeAnimeLoading || (displayedRouteAnimeId && !displayedSelected))) {
    return <AnimeHeroSkeleton />;
  }

  if (!displayedSelected) {
    return <EmptyCatalog />;
  }

  if (displayedView === 'watch') {
    return (
      <AnimeHero
        anime={displayedSelected}
        state={watchState[displayedSelected.id] ?? { episode: 1, status: 'planned' }}
        onStateChange={(patch) => updateWatchState(displayedSelected.id, patch)}
      />
    );
  }

  return <ProfilePage />;
}
