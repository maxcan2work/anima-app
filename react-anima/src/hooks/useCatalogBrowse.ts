import { useEffect, useState } from 'react';
import { browseCatalog, searchCatalog, type CatalogSearchResult } from '@/api';

export type CatalogBrowseOrder = 'popularity' | 'ranked' | 'aired_on' | 'ranked_random';
export type CatalogBrowseFilters = {
  kind: string;
  status: string;
  scoredOnly: boolean;
  season: string;
  genre: string;
  score: string;
  rating: string;
};

const defaultFilters: CatalogBrowseFilters = {
  kind: 'all',
  status: 'all',
  scoredOnly: false,
  season: 'all',
  genre: 'all',
  score: 'all',
  rating: 'all',
};

export function useCatalogBrowse() {
  const [browseOrder, setBrowseOrder] = useState<CatalogBrowseOrder>('popularity');
  const [browseFilters, setBrowseFiltersState] = useState<CatalogBrowseFilters>(defaultFilters);
  const [browseResults, setBrowseResults] = useState<CatalogSearchResult[]>([]);
  const [browsePage, setBrowsePage] = useState(1);
  const [browseHasNext, setBrowseHasNext] = useState(true);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseStatus, setBrowseStatus] = useState('');
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [catalogSearchResults, setCatalogSearchResults] = useState<CatalogSearchResult[]>([]);
  const [catalogSearchLoading, setCatalogSearchLoading] = useState(false);
  const [catalogSearchStatus, setCatalogSearchStatus] = useState('');

  function updateBrowseOrder(order: CatalogBrowseOrder) {
    setBrowseOrder(order);
    setBrowseResults([]);
    setBrowseHasNext(true);
    setBrowsePage(1);
  }

  function setBrowseFilters(filters: CatalogBrowseFilters) {
    setBrowseFiltersState(filters);
    setBrowseResults([]);
    setBrowseHasNext(true);
    setBrowsePage(1);
  }

  useEffect(() => {
    let ignore = false;

    async function loadBrowse() {
      setBrowseLoading(true);
      setBrowseStatus('');
      try {
        const response = await browseCatalog(browsePage, browseOrder, {
          kind: browseFilters.kind === 'all' ? undefined : browseFilters.kind,
          status: browseFilters.status === 'all' ? undefined : browseFilters.status,
          scoredOnly: browseFilters.scoredOnly,
          season: browseFilters.season === 'all' ? undefined : browseFilters.season,
          genre: browseFilters.genre === 'all' ? undefined : browseFilters.genre,
          score: browseFilters.score === 'all' ? undefined : browseFilters.score,
          rating: browseFilters.rating === 'all' ? undefined : browseFilters.rating,
        });
        if (ignore) return;

        setBrowseResults((current) => {
          const next = browsePage === 1 ? response.results : [...current, ...response.results];
          const seen = new Set<number>();
          return next.filter((item) => {
            if (seen.has(item.providerId)) return false;
            seen.add(item.providerId);
            return true;
          });
        });
        setBrowseHasNext(response.hasNextPage);
        setBrowseStatus('');
      } catch {
        if (!ignore) {
          setBrowseResults([]);
          setBrowseStatus('error');
        }
      } finally {
        if (!ignore) {
          setBrowseLoading(false);
        }
      }
    }

    loadBrowse();

    return () => {
      ignore = true;
    };
  }, [browseFilters, browseOrder, browsePage]);

  useEffect(() => {
    const query = catalogSearchQuery.trim();

    if (query.length < 2) {
      setCatalogSearchResults([]);
      setCatalogSearchLoading(false);
      setCatalogSearchStatus('');
      return;
    }

    let ignore = false;
    setCatalogSearchLoading(true);
    setCatalogSearchStatus('');

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await searchCatalog(query, {
          kind: browseFilters.kind === 'all' ? undefined : browseFilters.kind,
          status: browseFilters.status === 'all' ? undefined : browseFilters.status,
          scoredOnly: browseFilters.scoredOnly,
          season: browseFilters.season === 'all' ? undefined : browseFilters.season,
          genre: browseFilters.genre === 'all' ? undefined : browseFilters.genre,
          score: browseFilters.score === 'all' ? undefined : browseFilters.score,
          rating: browseFilters.rating === 'all' ? undefined : browseFilters.rating,
        });
        if (ignore) return;

        setCatalogSearchResults(response.results);
        setCatalogSearchStatus(response.results.length ? '' : 'Ничего не найдено.');
      } catch {
        if (!ignore) {
          setCatalogSearchResults([]);
          setCatalogSearchStatus('Не удалось выполнить поиск.');
        }
      } finally {
        if (!ignore) {
          setCatalogSearchLoading(false);
        }
      }
    }, 350);

    return () => {
      ignore = true;
      window.clearTimeout(timeoutId);
    };
  }, [browseFilters, catalogSearchQuery]);

  return {
    browseResults,
    browseOrder,
    browseFilters,
    browsePage,
    browseHasNext,
    browseLoading,
    browseStatus,
    catalogSearchQuery,
    catalogSearchResults,
    catalogSearchLoading,
    catalogSearchStatus,
    setBrowsePage,
    setBrowseOrder: updateBrowseOrder,
    setBrowseFilters,
    setCatalogSearchQuery,
  };
}
