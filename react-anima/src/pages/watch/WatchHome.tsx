import { useEffect, useMemo, useState } from 'react';
import { useCatalog } from '@features/catalog/CatalogProvider';
import { CatalogBrowser } from '@features/catalog/CatalogBrowser';
import { useWatchLibrary } from '@features/watch-library/WatchLibraryProvider';
import { useI18n } from '@shared/i18n/I18nProvider';
import { SplitScreenLayout } from '@shared/ui/SplitScreenLayout';
import { getCatalogGenres, type CatalogGenre } from '@/api';
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
  const { language, t } = useI18n();
  const [genres, setGenres] = useState<CatalogGenre[]>([]);
  const yearOptions = useMemo(() => buildYearOptions(), []);
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
  const seasonOptions = [
    { value: 'all', label: t('catalog.filter.all') },
    ...yearOptions.map((year) => ({ value: String(year), label: String(year) })),
  ];
  const scoreOptions = [
    { value: 'all', label: t('catalog.filter.all') },
    ...[6, 7, 8, 9].map((score) => ({ value: String(score), label: `${score}+` })),
  ];
  const ratingOptions = [
    { value: 'all', label: t('catalog.filter.all') },
    { value: 'g', label: 'G' },
    { value: 'pg', label: 'PG' },
    { value: 'pg_13', label: 'PG-13' },
    { value: 'r', label: 'R-17' },
    { value: 'r_plus', label: 'R+' },
  ];

  useEffect(() => {
    let ignore = false;

    getCatalogGenres()
      .then((response) => {
        if (!ignore) setGenres(response.genres);
      })
      .catch(() => {
        if (!ignore) setGenres([]);
      });

    return () => {
      ignore = true;
    };
  }, []);

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
            <h3>{t('catalog.season')}</h3>
            <label className={styles.selectControl}>
              <select
                value={browseFilters.season}
                onChange={(event) => setBrowseFilters({ ...browseFilters, season: event.target.value })}
                aria-label={t('catalog.season')}
              >
                {seasonOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </section>

          <section className={styles.controlGroup}>
            <h3>{t('catalog.genre')}</h3>
            <label className={styles.selectControl}>
              <select
                value={browseFilters.genre}
                onChange={(event) => setBrowseFilters({ ...browseFilters, genre: event.target.value })}
                aria-label={t('catalog.genre')}
              >
                <option value="all">{t('catalog.filter.all')}</option>
                {genres.map((genre) => (
                  <option key={genre.id} value={String(genre.id)}>
                    {language === 'ru' ? genre.titleRu ?? genre.name : genre.name}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className={styles.controlGroup}>
            <h3>{t('catalog.score')}</h3>
            <div className={styles.chips}>
              {scoreOptions.map((option) => (
                <button
                  key={option.value}
                  className={browseFilters.score === option.value ? styles.activeOption : undefined}
                  type="button"
                  onClick={() => setBrowseFilters({ ...browseFilters, score: option.value })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className={styles.controlGroup}>
            <h3>{t('catalog.rating')}</h3>
            <div className={styles.chips}>
              {ratingOptions.map((option) => (
                <button
                  key={option.value}
                  className={browseFilters.rating === option.value ? styles.activeOption : undefined}
                  type="button"
                  onClick={() => setBrowseFilters({ ...browseFilters, rating: option.value })}
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

function buildYearOptions() {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 16 }, (_, index) => currentYear - index);
}
