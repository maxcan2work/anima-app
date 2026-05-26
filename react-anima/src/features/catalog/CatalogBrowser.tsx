import { useEffect, useRef } from 'react';
import type { CatalogSearchResult } from '@/api';
import { useI18n } from '@shared/i18n/I18nProvider';
import styles from './CatalogBrowser.module.css';

type CatalogBrowserProps = {
  className: string;
  eyebrow: string;
  title: string;
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

export function CatalogBrowser({
  className,
  eyebrow,
  title,
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
}: CatalogBrowserProps) {
  const { t } = useI18n();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const isSearching = searchQuery.trim().length >= 2;
  const visibleResults = isSearching ? searchResults : browseResults;
  const isInitialBrowseLoading = !isSearching && browseLoading && browseResults.length === 0;
  const hasBrowseError = !isSearching && Boolean(browseStatus) && !browseLoading && browseResults.length === 0;
  const isLoadingMore = !isSearching && browseLoading && browseResults.length > 0;
  const isSearchLoading = isSearching && searchLoading;

  useEffect(() => {
    if (isSearching) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && browseHasNext && !browseLoading) {
          onPageChange(browsePage + 1);
        }
      },
      { rootMargin: '500px' },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [browseHasNext, browseLoading, browsePage, isSearching, onPageChange]);

  return (
    <section className={className}>
      <header className={styles.header}>
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <label className={styles.search} aria-label={t('catalog.search')}>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t('catalog.search')}
          />
        </label>
      </header>

      <div className={styles.grid} aria-busy={isInitialBrowseLoading || isLoadingMore || isSearchLoading}>
        {isSearchLoading || isInitialBrowseLoading || hasBrowseError ? (
          <CatalogSkeletonCards count={12} />
        ) : (
          visibleResults.map((result) => (
            <button
              key={`${result.provider}-${result.providerId}`}
              className={styles.card}
              onClick={() => onOpenAnime(result)}
              type="button"
            >
              {result.posterUrl ? <img src={result.posterUrl} alt="" /> : null}
              <div>
                <strong>{result.title}</strong>
                <small>{result.originalTitle}</small>
                <small>
                  {result.episodes} {t('common.episodesShort')} · {result.score ?? t('common.noScore')}
                </small>
              </div>
            </button>
          ))
        )}
        {isLoadingMore ? <CatalogSkeletonCards count={6} /> : null}
      </div>

      {!isSearching ? <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" /> : null}
    </section>
  );
}

function CatalogSkeletonCards({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div className={`${styles.card} ${styles.skeletonCard}`} key={`catalog-skeleton-${index}`}>
          <span className={styles.skeletonPoster} />
          <span className={`${styles.skeletonLine} ${styles.skeletonLineTitle}`} />
          <span className={styles.skeletonLine} />
          <span className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
        </div>
      ))}
    </>
  );
}
