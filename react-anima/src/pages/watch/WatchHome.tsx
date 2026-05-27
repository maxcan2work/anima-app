import { useCatalog } from '@features/catalog/CatalogProvider';
import { CatalogBrowser } from '@features/catalog/CatalogBrowser';
import { useWatchLibrary } from '@features/watch-library/WatchLibraryProvider';
import { useI18n } from '@shared/i18n/I18nProvider';
import { SplitScreenLayout } from '@shared/ui/SplitScreenLayout';
import type { CatalogBrowseOrder } from '@hooks/useCatalogBrowse';
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
    browseOrder,
    browseFilters,
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
    setBrowseOrder,
    setBrowseFilters,
  } = useCatalog();
  const { openCatalogAnime } = useWatchLibrary();
  const { t } = useI18n();
  const orderOptions: Array<{ value: CatalogBrowseOrder; label: string }> = [
    { value: 'popularity', label: t('catalog.order.popularity') },
    { value: 'ranked', label: t('catalog.order.ranked') },
    { value: 'aired_on', label: t('catalog.order.airedOn') },
    { value: 'ranked_random', label: t('catalog.order.random') },
  ];
  const kindOptions = [
    { value: 'all', label: t('catalog.filter.all') },
    { value: 'tv', label: 'TV' },
    { value: 'movie', label: t('catalog.kind.movie') },
    { value: 'ova', label: 'OVA' },
    { value: 'ona', label: 'ONA' },
    { value: 'special', label: t('catalog.kind.special') },
  ];
  const statusOptions = [
    { value: 'all', label: t('catalog.filter.all') },
    { value: 'released', label: t('catalog.status.released') },
    { value: 'ongoing', label: t('catalog.status.ongoing') },
    { value: 'anons', label: t('catalog.status.anons') },
  ];

  return (
    <SplitScreenLayout
      className={styles.layout}
      mainClassName={styles.main}
      sidebarClassName={styles.sidebar}
      sidebarLabel={t('catalog.controls')}
      sidebar={(
        <div className={styles.controls}>
          <section className={styles.controlGroup}>
            <h3>{t('catalog.search')}</h3>
            <label className={styles.search} aria-label={t('catalog.search')}>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t('catalog.search')}
              />
            </label>
          </section>

          <section className={styles.controlGroup}>
            <h3>{t('catalog.sort')}</h3>
            <div className={styles.segmented}>
              {orderOptions.map((option) => (
                <button
                  key={option.value}
                  className={browseOrder === option.value ? styles.activeOption : undefined}
                  type="button"
                  onClick={() => setBrowseOrder(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className={styles.controlGroup}>
            <h3>{t('catalog.kind')}</h3>
            <div className={styles.chips}>
              {kindOptions.map((option) => (
                <button
                  key={option.value}
                  className={browseFilters.kind === option.value ? styles.activeOption : undefined}
                  type="button"
                  onClick={() => setBrowseFilters({ ...browseFilters, kind: option.value })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className={styles.controlGroup}>
            <h3>{t('catalog.status')}</h3>
            <div className={styles.chips}>
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  className={browseFilters.status === option.value ? styles.activeOption : undefined}
                  type="button"
                  onClick={() => setBrowseFilters({ ...browseFilters, status: option.value })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className={styles.controlGroup}>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={browseFilters.scoredOnly}
                onChange={(event) => setBrowseFilters({ ...browseFilters, scoredOnly: event.target.checked })}
              />
              <span>{t('catalog.filter.scoredOnly')}</span>
            </label>
          </section>
        </div>
      )}
    >
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
        hideSearch
        onSearchChange={setSearchQuery}
        onOpenAnime={openCatalogAnime}
        onPageChange={setBrowsePage}
      />
    </SplitScreenLayout>
  );
}
