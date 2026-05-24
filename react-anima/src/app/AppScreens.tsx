import type { CatalogSearchResult } from '../api';
import { AnimeHero } from '../pages/anime/AnimeHero';
import { ProfilePage } from '../pages/profile/ProfilePage';
import { RandomAnimePage } from '../pages/random/RandomAnimePage';
import { SettingsPage } from '../pages/settings/SettingsPage';
import { WatchPartyPage } from '../pages/watch-party/WatchPartyPage';
import { EmptyCatalog, WatchHome } from '../pages/watch/WatchHome';
import type { AnimeTitle } from '../data';
import { useNavigation } from '../features/navigation/NavigationProvider';
import { mapServerAnime } from '../shared/animeMappers';
import { getWatchPartyCodeFromPath } from '../shared/navigation';
import type { WatchState } from '../shared/storage';

type AppScreensProps = {
  displayedSelected: AnimeTitle | null;
  watchState: Record<string, WatchState>;
  browseResults: CatalogSearchResult[];
  browsePage: number;
  browseHasNext: boolean;
  browseLoading: boolean;
  browseStatus: string;
  catalogSearchQuery: string;
  catalogSearchResults: CatalogSearchResult[];
  catalogSearchLoading: boolean;
  catalogSearchStatus: string;
  randomAnime: CatalogSearchResult | null;
  randomHistory: CatalogSearchResult[];
  randomLoading: boolean;
  randomStatus: string;
  randomClearing: boolean;
  deletingRandomKey: string;
  onOpenAnime: (anime: CatalogSearchResult) => void;
  onRandomize: () => void;
  onClearRandomHistory: () => void;
  onDeleteRandomHistoryEntry: (anime: CatalogSearchResult) => void;
  onSearchChange: (query: string) => void;
  onBrowsePageChange: (page: number) => void;
  onWatchStateChange: (animeId: string, patch: Partial<WatchState>) => void;
};

export function AppScreens({
  displayedSelected,
  watchState,
  browseResults,
  browsePage,
  browseHasNext,
  browseLoading,
  browseStatus,
  catalogSearchQuery,
  catalogSearchResults,
  catalogSearchLoading,
  catalogSearchStatus,
  randomAnime,
  randomHistory,
  randomLoading,
  randomStatus,
  randomClearing,
  deletingRandomKey,
  onOpenAnime,
  onRandomize,
  onClearRandomHistory,
  onDeleteRandomHistoryEntry,
  onSearchChange,
  onBrowsePageChange,
  onWatchStateChange,
}: AppScreensProps) {
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

  if (displayedView === 'random') {
    return (
      <RandomAnimePage
        randomAnime={randomAnime}
        history={randomHistory}
        loading={randomLoading}
        status={randomStatus}
        clearing={randomClearing}
        deletingKey={deletingRandomKey}
        onOpenAnime={onOpenAnime}
        onRandomize={onRandomize}
        onClearHistory={onClearRandomHistory}
        onDeleteHistoryEntry={onDeleteRandomHistoryEntry}
      />
    );
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
        mapServerAnime={mapServerAnime}
        renderAnimeHero={(props) => <AnimeHero {...props} />}
      />
    );
  }

  if (displayedView === 'settings') {
    return <SettingsPage />;
  }

  if (displayedView === 'watch' && !displayedRouteAnimeId) {
    return (
      <WatchHome
        browseResults={browseResults}
        browsePage={browsePage}
        browseHasNext={browseHasNext}
        browseLoading={browseLoading}
        browseStatus={browseStatus}
        searchQuery={catalogSearchQuery}
        searchResults={catalogSearchResults}
        searchLoading={catalogSearchLoading}
        searchStatus={catalogSearchStatus}
        onSearchChange={onSearchChange}
        onOpenAnime={onOpenAnime}
        onPageChange={onBrowsePageChange}
      />
    );
  }

  if (!displayedSelected) {
    return <EmptyCatalog />;
  }

  if (displayedView === 'watch') {
    return (
      <AnimeHero
        anime={displayedSelected}
        state={watchState[displayedSelected.id] ?? { episode: 1, status: 'planned' }}
        onStateChange={(patch) => onWatchStateChange(displayedSelected.id, patch)}
      />
    );
  }

  return <ProfilePage />;
}
