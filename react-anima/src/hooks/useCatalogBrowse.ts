import { useEffect, useRef, useState } from 'react';
import { browseCatalog, searchCatalog, type CatalogRequestOptions, type CatalogSearchResult } from '@/api';

export type CatalogBrowseOrder = 'popularity' | 'ranked' | 'aired_on' | 'ranked_random';
export type CatalogBrowseFilters = {
  kinds: string[];
  status: string;
  seasons: string[];
  genres: string[];
  score: string;
  ratings: string[];
};

export const defaultCatalogBrowseFilters: CatalogBrowseFilters = {
  kinds: [],
  status: 'all',
  seasons: [],
  genres: [],
  score: 'all',
  ratings: [],
};

function requestFilters(filters: CatalogBrowseFilters, requestOptions: CatalogRequestOptions) {
  return {
    ...requestOptions,
    kind: filters.kinds.length ? filters.kinds.join(',') : undefined,
    status: filters.status === 'all' ? undefined : filters.status,
    season: filters.seasons.length ? filters.seasons.join(',') : undefined,
    genre: filters.genres.length ? filters.genres.join(',') : undefined,
    score: filters.score === 'all' ? undefined : filters.score,
    rating: filters.ratings.length ? filters.ratings.join(',') : undefined,
  };
}

function mergeCatalogResults(
  current: CatalogSearchResult[],
  incoming: CatalogSearchResult[],
  replace = false,
) {
  const next = replace ? incoming : [...current, ...incoming];
  const seen = new Set<number>();
  return next.filter((item) => {
    if (seen.has(item.providerId)) return false;
    seen.add(item.providerId);
    return true;
  });
}

export function useCatalogBrowse({
  enabled = true,
  requestOptions = {},
}: {
  enabled?: boolean;
  requestOptions?: CatalogRequestOptions;
} = {}) {
  const browseRequestIdRef = useRef(0);
  const [browseOrder, setBrowseOrder] = useState<CatalogBrowseOrder>('popularity');
  const [browseFilters, setBrowseFiltersState] = useState<CatalogBrowseFilters>(defaultCatalogBrowseFilters);
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
    setBrowseHasNext(true);
    setBrowsePage(1);
  }

  function setBrowseFilters(filters: CatalogBrowseFilters) {
    setBrowseFiltersState(filters);
    setBrowseHasNext(true);
    setBrowsePage(1);
  }

  useEffect(() => {
    if (!enabled) return;

    let ignore = false;
    const requestId = browseRequestIdRef.current + 1;
    browseRequestIdRef.current = requestId;

    async function loadBrowse() {
      setBrowseLoading(true);
      setBrowseStatus('');
      try {
        const response = await browseCatalog(browsePage, browseOrder, requestFilters(browseFilters, requestOptions));
        if (ignore || browseRequestIdRef.current !== requestId) return;

        setBrowseResults((current) => mergeCatalogResults(current, response.results, browsePage === 1));
        setBrowseHasNext(response.hasNextPage);
        setBrowseStatus('');
      } catch {
        if (!ignore && browseRequestIdRef.current === requestId) {
          setBrowseStatus('error');
        }
      } finally {
        if (!ignore && browseRequestIdRef.current === requestId) {
          setBrowseLoading(false);
        }
      }
    }

    loadBrowse();

    return () => {
      ignore = true;
    };
  }, [browseFilters, browseOrder, browsePage, enabled, requestOptions.playableProvider]);

  useEffect(() => {
    if (!enabled) return;

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
        const response = await searchCatalog(query, requestFilters(browseFilters, requestOptions));
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
  }, [browseFilters, catalogSearchQuery, enabled, requestOptions.playableProvider]);

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
