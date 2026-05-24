import type { CatalogSearchResult } from '../../api';
import { CatalogBrowser } from '../../features/catalog/CatalogBrowser';

type WatchHomeProps = {
  browseResults: CatalogSearchResult[];
  browsePage: number;
  browseHasNext: boolean;
  browseLoading: boolean;
  browseStatus: string;
  searchQuery: string;
  searchResults: CatalogSearchResult[];
  searchLoading: boolean;
  searchStatus: string;
  onSearchChange: (query: string) => void;
  onOpenAnime: (result: CatalogSearchResult) => void;
  onPageChange: (page: number) => void;
};

export function EmptyCatalog() {
  return (
    <section className="empty-catalog">
      <p className="eyebrow">Shikimori</p>
      <h2>Каталог пуст</h2>
      <p>Найди аниме через Shikimori и добавь его в Anima, чтобы вести просмотр, дневник и искать плееры AniLibria.</p>
    </section>
  );
}

export function WatchHome({
  browseResults,
  browsePage,
  browseHasNext,
  browseLoading,
  browseStatus,
  searchQuery,
  searchResults,
  searchLoading,
  searchStatus,
  onSearchChange,
  onOpenAnime,
  onPageChange,
}: WatchHomeProps) {
  return (
    <CatalogBrowser
      className="watch-home"
      eyebrow="Shikimori"
      title="Каталог аниме"
      browseResults={browseResults}
      browsePage={browsePage}
      browseHasNext={browseHasNext}
      browseLoading={browseLoading}
      browseStatus={browseStatus}
      searchQuery={searchQuery}
      searchResults={searchResults}
      searchLoading={searchLoading}
      searchStatus={searchStatus}
      onSearchChange={onSearchChange}
      onOpenAnime={onOpenAnime}
      onPageChange={onPageChange}
    />
  );
}
