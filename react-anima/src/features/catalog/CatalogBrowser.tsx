import { useEffect, useRef } from 'react';
import type { CatalogSearchResult } from '../../api';

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
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const isSearching = searchQuery.trim().length >= 2;
  const visibleResults = isSearching ? searchResults : browseResults;
  const status = isSearching ? searchStatus : browseStatus;

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
      <header className="browse-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <label className="catalog-search" aria-label="Найти аниме">
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Найти аниме"
          />
        </label>
      </header>

      {status ? <p className="catalog-status">{status}</p> : null}

      {searchLoading && isSearching ? (
        <SearchLoader />
      ) : (
        <div className="browse-grid">
          {visibleResults.map((result) => (
            <button
              key={`${result.provider}-${result.providerId}`}
              className="browse-card"
              onClick={() => onOpenAnime(result)}
              type="button"
            >
              {result.posterUrl ? <img src={result.posterUrl} alt="" /> : null}
              <div>
                <strong>{result.title}</strong>
                <small>{result.originalTitle}</small>
                <small>
                  {result.episodes} сер. · {result.score ?? 'без оценки'}
                </small>
              </div>
            </button>
          ))}
        </div>
      )}

      {!isSearching ? (
        <div ref={sentinelRef} className="scroll-sentinel">
          {browseLoading ? 'Загружаем еще...' : browseHasNext ? 'Прокрути ниже для загрузки' : 'Больше тайтлов нет'}
        </div>
      ) : null}
    </section>
  );
}

function SearchLoader() {
  return (
    <div className="search-loader" aria-label="Загрузка результатов">
      <svg viewBox="0 0 48 48" role="img" aria-hidden="true">
        <circle cx="24" cy="24" r="18" />
      </svg>
    </div>
  );
}
