import { useCatalog } from '@features/catalog/CatalogProvider';
import { CatalogBrowser } from '@features/catalog/CatalogBrowser';
import { useWatchLibrary } from '@features/watch-library/WatchLibraryProvider';
import styles from './WatchHome.module.css';

export function EmptyCatalog() {
  return (
    <section className={styles.emptyCatalog}>
      <p className="eyebrow">Shikimori</p>
      <h2>Каталог пуст</h2>
      <p>Найди аниме через Shikimori и добавь его в Anima, чтобы вести просмотр, дневник и искать плееры AniLibria.</p>
    </section>
  );
}

export function WatchHome() {
  const {
    browseResults,
    browsePage,
    browseHasNext,
    browseLoading,
    browseStatus,
    searchQuery,
    searchResults,
    searchLoading,
    searchStatus,
    setSearchQuery,
    setBrowsePage,
  } = useCatalog();
  const { openCatalogAnime } = useWatchLibrary();

  return (
    <CatalogBrowser
      className={styles.watchHome}
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
      onSearchChange={setSearchQuery}
      onOpenAnime={openCatalogAnime}
      onPageChange={setBrowsePage}
    />
  );
}
