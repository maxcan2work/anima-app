import { useEffect, useState } from 'react';
import {
  browseCatalog,
  clearMyRandomHistory,
  deleteRandomHistoryEntry,
  getCatalogAnimeDetails,
  getMyRandomHistory,
  saveRandomHistoryEntry,
  type CatalogRequestOptions,
  type CatalogSearchResult,
  type CurrentUser,
} from '@/api';
import { mapRandomHistoryEntry } from '@shared/animeMappers';

export function useRandomAnime(user: CurrentUser | null) {
  const [randomAnime, setRandomAnime] = useState<CatalogSearchResult | null>(null);
  const [randomHistory, setRandomHistory] = useState<CatalogSearchResult[]>([]);
  const [randomLoading, setRandomLoading] = useState(false);
  const [randomHistoryLoading, setRandomHistoryLoading] = useState(false);
  const [randomHistoryLoaded, setRandomHistoryLoaded] = useState(false);
  const [randomStatus, setRandomStatus] = useState('');
  const [randomClearing, setRandomClearing] = useState(false);
  const [deletingRandomKey, setDeletingRandomKey] = useState('');

  useEffect(() => {
    if (!user) {
      setRandomHistoryLoading(false);
      setRandomHistoryLoaded(false);
      setRandomHistory([]);
      setRandomAnime(null);
      return;
    }

    let ignore = false;

    async function loadRandomHistory() {
      setRandomHistoryLoading(true);
      setRandomHistoryLoaded(false);
      try {
        const { history } = await getMyRandomHistory();
        if (!ignore) {
          setRandomHistory(history.map(mapRandomHistoryEntry));
        }
      } catch {
        if (!ignore) {
          setRandomHistory([]);
        }
      } finally {
        if (!ignore) {
          setRandomHistoryLoading(false);
          setRandomHistoryLoaded(true);
        }
      }
    }

    loadRandomHistory();

    return () => {
      ignore = true;
    };
  }, [user]);

  async function handleRandomAnime(filters: CatalogRequestOptions = {}) {
    setRandomLoading(true);
    setRandomStatus('');

    try {
      const page = Math.floor(Math.random() * 20) + 1;
      const response = await browseCatalog(page, 'ranked_random', filters);
      const candidates = response.results.filter((item) => item.posterUrl);
      const pool = candidates.length > 0 ? candidates : response.results;
      const picked = pool[Math.floor(Math.random() * pool.length)];

      if (!picked) {
        setRandomStatus('random.emptyPool');
        return;
      }

      const next = await getCatalogAnimeDetails(picked.provider, picked.providerId).then(
        ({ anime }) => anime,
        () => picked,
      );

      setRandomAnime(next);
      setRandomHistory((current) => {
        const withoutDuplicate = current.filter((item) => item.providerId !== next.providerId);
        return [next, ...withoutDuplicate].slice(0, 10);
      });

      if (user) {
        saveRandomHistoryEntry(next)
          .then(({ entry }) => {
            const saved = mapRandomHistoryEntry(entry);
            setRandomHistory((current) => {
              const withoutDuplicate = current.filter((item) => item.providerId !== saved.providerId);
              return [saved, ...withoutDuplicate].slice(0, 10);
            });
          })
          .catch(() => setRandomStatus('Случайный тайтл показан, но историю не удалось сохранить.'));
      }
    } catch {
      setRandomStatus('Не удалось получить случайное аниме.');
    } finally {
      setRandomLoading(false);
    }
  }

  async function handleClearRandomHistory() {
    if (randomHistory.length === 0 || randomClearing) return;

    setRandomClearing(true);
    setRandomStatus('');

    try {
      if (user) {
        await clearMyRandomHistory();
      }
      setRandomHistory([]);
    } catch {
      setRandomStatus('Не удалось очистить историю.');
    } finally {
      setRandomClearing(false);
    }
  }

  async function handleDeleteRandomHistoryEntry(entry: CatalogSearchResult) {
    const key = `${entry.provider}-${entry.providerId}`;
    if (deletingRandomKey) return;

    setDeletingRandomKey(key);
    setRandomStatus('');

    try {
      if (user) {
        await deleteRandomHistoryEntry(entry.provider, entry.providerId);
      }
      setRandomHistory((current) => current.filter((item) => `${item.provider}-${item.providerId}` !== key));
    } catch {
      setRandomStatus('Не удалось удалить запись из истории.');
    } finally {
      setDeletingRandomKey('');
    }
  }

  function clearRandomState() {
    setRandomHistory([]);
    setRandomAnime(null);
  }

  return {
    randomAnime,
    randomHistory,
    randomLoading,
    randomHistoryLoading: Boolean(user) && (!randomHistoryLoaded || randomHistoryLoading),
    randomStatus,
    randomClearing,
    deletingRandomKey,
    handleRandomAnime,
    handleClearRandomHistory,
    handleDeleteRandomHistoryEntry,
    clearRandomState,
  };
}
