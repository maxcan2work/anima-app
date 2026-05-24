import type { CatalogSearchResult, CurrentUser, ServerWatchEntry } from '../api';
import { AnimeHero } from '../pages/anime/AnimeHero';
import { ProfilePage } from '../pages/profile/ProfilePage';
import { RandomAnimePage } from '../pages/random/RandomAnimePage';
import { SettingsPage } from '../pages/settings/SettingsPage';
import { WatchPartyPage } from '../pages/watch-party/WatchPartyPage';
import { EmptyCatalog, WatchHome } from '../pages/watch/WatchHome';
import type { AnimeTitle } from '../data';
import { mapServerAnime } from '../shared/animeMappers';
import { getWatchPartyCodeFromPath, type AppView } from '../shared/navigation';
import type { WatchState } from '../shared/storage';

type AppScreensProps = {
  displayedView: AppView;
  displayedPath: string;
  displayedRouteAnimeId: string;
  displayedSelected: AnimeTitle | null;
  watchState: Record<string, WatchState>;
  watchPartyCreateCode: string;
  user: CurrentUser | null;
  authStatus: 'loading' | 'guest' | 'ready';
  diaryEntries: ServerWatchEntry[];
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
  onCreateWatchParty: (code: string) => void;
  onJoinWatchParty: (code: string) => void;
  onLeaveWatchParty: () => void;
  onCreateWatchPartyConsumed: () => void;
  onSearchChange: (query: string) => void;
  onBrowsePageChange: (page: number) => void;
  onWatchStateChange: (animeId: string, patch: Partial<WatchState>) => void;
  onLogin: () => void;
  onLogout: () => void;
  onConnectShikimori: () => void;
  onDisconnectShikimori: () => Promise<void>;
  onImportShikimori: () => Promise<{
    imported: number;
    updated: number;
    skipped: number;
    total: number;
    errors?: Array<{ shikimoriId: number | null; reason: string }>;
  }>;
};

export function AppScreens({
  displayedView,
  displayedPath,
  displayedRouteAnimeId,
  displayedSelected,
  watchState,
  watchPartyCreateCode,
  user,
  authStatus,
  diaryEntries,
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
  onCreateWatchParty,
  onJoinWatchParty,
  onLeaveWatchParty,
  onCreateWatchPartyConsumed,
  onSearchChange,
  onBrowsePageChange,
  onWatchStateChange,
  onLogin,
  onLogout,
  onConnectShikimori,
  onDisconnectShikimori,
  onImportShikimori,
}: AppScreensProps) {
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
        user={user}
        onCreateRoom={onCreateWatchParty}
        onJoinRoom={onJoinWatchParty}
        onLeaveRoom={onLeaveWatchParty}
        onCreateRoomConsumed={onCreateWatchPartyConsumed}
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

  return (
    <ProfilePage
      user={user}
      authStatus={authStatus}
      entries={diaryEntries}
      onLogin={onLogin}
      onLogout={onLogout}
      onConnectShikimori={onConnectShikimori}
      onDisconnectShikimori={onDisconnectShikimori}
      onImportShikimori={onImportShikimori}
    />
  );
}
