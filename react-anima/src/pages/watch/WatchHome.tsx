import { useCatalog } from '@features/catalog/CatalogProvider';
import { CatalogBrowser } from '@features/catalog/CatalogBrowser';
import { useWatchLibrary } from '@features/watch-library/WatchLibraryProvider';
import { useI18n } from '@shared/i18n/I18nProvider';
import styles from './WatchHome.module.css';

export function EmptyCatalog() {
  const { t } = useI18n();

  return (
    <section className={styles.emptyCatalog}>
      <p className="eyebrow">Shikimori</p>
      <h2>{t('catalog.emptyTitle')}</h2>
      <p>{t('catalog.emptyDescription')}</p>
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
  const { t } = useI18n();

  return (
    <CatalogBrowser
      className={styles.watchHome}
      eyebrow="Shikimori"
      title={t('catalog.title')}
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
