import { useEffect, useState } from 'react';
import {
  browseCatalog,
  importCatalogAnime,
  searchCatalog,
  type CatalogSearchResult,
  type ServerAnime,
} from '../../api';

type UseWatchPartyCatalogOptions = {
  code: string;
  enabled: boolean;
  selectedAnime: unknown;
  onSelectAnime: (anime: ServerAnime) => void;
};

export function useWatchPartyCatalog({
  code,
  enabled,
  selectedAnime,
  onSelectAnime,
}: UseWatchPartyCatalogOptions) {
  const [animeQuery, setAnimeQuery] = useState('');
  const [animeResults, setAnimeResults] = useState<CatalogSearchResult[]>([]);
  const [animeSearchStatus, setAnimeSearchStatus] = useState('');
  const [animeSearchLoading, setAnimeSearchLoading] = useState(false);
  const [partyCatalogResults, setPartyCatalogResults] = useState<CatalogSearchResult[]>([]);
  const [partyCatalogPage, setPartyCatalogPage] = useState(1);
  const [partyCatalogHasNext, setPartyCatalogHasNext] = useState(true);
  const [partyCatalogStatus, setPartyCatalogStatus] = useState('');
  const [partyCatalogLoading, setPartyCatalogLoading] = useState(false);

  useEffect(() => {
    setPartyCatalogResults([]);
    setPartyCatalogPage(1);
    setPartyCatalogHasNext(true);
  }, [code]);

  useEffect(() => {
    if (!code || !enabled) return;

    const query = animeQuery.trim();
    if (query.length < 2) {
      setAnimeResults([]);
      setAnimeSearchStatus('');
      setAnimeSearchLoading(false);
      return;
    }

    let ignore = false;
    setAnimeSearchLoading(true);
    setAnimeSearchStatus('');

    const timer = window.setTimeout(async () => {
      try {
        const response = await searchCatalog(query);
        if (ignore) return;

        setAnimeResults(response.results);
        setAnimeSearchStatus(response.results.length ? '' : 'Ничего не нашли.');
      } catch {
        if (!ignore) {
          setAnimeResults([]);
          setAnimeSearchStatus('Не удалось найти аниме.');
        }
      } finally {
        if (!ignore) {
          setAnimeSearchLoading(false);
        }
      }
    }, 260);

    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [animeQuery, code, enabled]);

  useEffect(() => {
    if (!code || !enabled || selectedAnime) return;

    let ignore = false;
    setPartyCatalogLoading(true);
    setPartyCatalogStatus('');

    async function loadPartyCatalog() {
      try {
        const response = await browseCatalog(partyCatalogPage, 'popularity');
        if (ignore) return;

        setPartyCatalogResults((current) => {
          const next = partyCatalogPage === 1 ? response.results : [...current, ...response.results];
          const seen = new Set<number>();
          return next.filter((item) => {
            if (seen.has(item.providerId)) return false;
            seen.add(item.providerId);
            return true;
          });
        });
        setPartyCatalogHasNext(response.hasNextPage);
        setPartyCatalogStatus('');
      } catch {
        if (!ignore) {
          if (partyCatalogPage === 1) {
            setPartyCatalogResults([]);
          }
          setPartyCatalogStatus('error');
        }
      } finally {
        if (!ignore) {
          setPartyCatalogLoading(false);
        }
      }
    }

    loadPartyCatalog();

    return () => {
      ignore = true;
    };
  }, [code, enabled, partyCatalogPage, selectedAnime]);

  async function handleSelectAnime(result: CatalogSearchResult) {
    if (!enabled) return;

    setAnimeSearchStatus('Загружаем тайтл...');
    try {
      const response = await importCatalogAnime(result.provider, result.providerId);
      onSelectAnime(response.anime);
      setAnimeQuery('');
      setAnimeResults([]);
      setAnimeSearchStatus('');
    } catch {
      setAnimeSearchStatus('Не удалось выбрать аниме.');
    }
  }

  return {
    animeQuery,
    animeResults,
    animeSearchStatus,
    animeSearchLoading,
    partyCatalogResults,
    partyCatalogPage,
    partyCatalogHasNext,
    partyCatalogStatus,
    partyCatalogLoading,
    setAnimeQuery,
    setPartyCatalogPage,
    handleSelectAnime,
  };
}
