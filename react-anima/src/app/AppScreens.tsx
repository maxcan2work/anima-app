import { AnimeHero, AnimeHeroSkeleton } from '@pages/anime/AnimeHero';
import { ProfilePage } from '@pages/profile/ProfilePage';
import { RandomAnimePage } from '@pages/random/RandomAnimePage';
import { SettingsPage } from '@pages/settings/SettingsPage';
import { WatchPartyPage } from '@pages/watch-party/WatchPartyPage';
import { EmptyCatalog, WatchHome } from '@pages/watch/WatchHome';
import { useAuth } from '@features/auth/AuthProvider';
import { useNavigation } from '@features/navigation/NavigationProvider';
import { useWatchLibrary } from '@features/watch-library/WatchLibraryProvider';
import { upsertDiaryEntry } from '@shared/animeMappers';
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
  const { diaryEntries, setDiaryEntries } = useAuth();

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

  if (displayedView === 'profile') {
    return <ProfilePage />;
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
    const diaryEntry = diaryEntries.find((entry) => entry.animeId === displayedSelected.id) ?? null;

    return (
      <AnimeHero
        anime={displayedSelected}
        state={watchState[displayedSelected.id] ?? { episode: 1, status: 'none' }}
        diaryScore={diaryEntry?.score ?? null}
        diaryReview={diaryEntry?.review ?? null}
        onDiaryEntrySaved={(entry) => setDiaryEntries((current) => upsertDiaryEntry(current, entry))}
        onStateChange={(patch) => updateWatchState(displayedSelected.id, patch)}
      />
    );
  }

  return <EmptyCatalog />;
}
