import { CatalogBrowser } from '@features/catalog/CatalogBrowser';
import { CatalogFiltersPanel } from '@features/catalog/CatalogFiltersPanel';
import { useCatalog } from '@features/catalog/CatalogProvider';
import { useWatchLibrary } from '@features/watch-library/WatchLibraryProvider';
import { useI18n } from '@shared/i18n/I18nProvider';
import { SplitScreenLayout } from '@shared/ui/SplitScreenLayout';
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
  const catalog = useCatalog();
  const { openCatalogAnime } = useWatchLibrary();
  const { t } = useI18n();

  return (
    <SplitScreenLayout
      className={styles.layout}
      mainClassName={styles.main}
      sidebarClassName={styles.sidebar}
      sidebarLabel={t('catalog.controls')}
      sidebar={(
        <CatalogFiltersPanel
          browseFilters={catalog.browseFilters}
          browseOrder={catalog.browseOrder}
          searchQuery={catalog.searchQuery}
          onFiltersChange={catalog.setBrowseFilters}
          onOrderChange={catalog.setBrowseOrder}
          onSearchChange={catalog.setSearchQuery}
        />
      )}
    >
      <CatalogBrowser
        className={styles.watchHome}
        browseResults={catalog.browseResults}
        browsePage={catalog.browsePage}
        browseHasNext={catalog.browseHasNext}
        browseLoading={catalog.browseLoading}
        browseStatus={catalog.browseStatus}
        searchQuery={catalog.searchQuery}
        searchResults={catalog.searchResults}
        searchLoading={catalog.searchLoading}
        searchStatus={catalog.searchStatus}
        hideSearch
        onSearchChange={catalog.setSearchQuery}
        onOpenAnime={openCatalogAnime}
        onPageChange={catalog.setBrowsePage}
      />
    </SplitScreenLayout>
  );
}
