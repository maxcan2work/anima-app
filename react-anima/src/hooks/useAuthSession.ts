import { useEffect, useState } from 'react';
import {
  disconnectShikimori,
  getCurrentUser,
  getMyAnimeList,
  importShikimoriList,
  logout,
  type CurrentUser,
  type ServerWatchEntry,
} from '../api';

export function useAuthSession() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [authStatus, setAuthStatus] = useState<'loading' | 'guest' | 'ready'>('loading');
  const [diaryEntries, setDiaryEntries] = useState<ServerWatchEntry[]>([]);
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;

    async function loadSession() {
      try {
        const [{ user: currentUser }, { list }] = await Promise.all([
          getCurrentUser(),
          getMyAnimeList(),
        ]);
        if (ignore) return;

        setUser(currentUser);
        setDiaryEntries(list);
        setAuthStatus('ready');
      } catch {
        if (!ignore) {
          setAuthStatus('guest');
        }
      }
    }

    loadSession();

    return () => {
      ignore = true;
    };
  }, []);

  async function handleLogout() {
    await logout();
    setUser(null);
    setAuthStatus('guest');
    setDiaryEntries([]);
  }

  async function handleDisconnectShikimori() {
    await disconnectShikimori();
    setUser((current) =>
      current
        ? {
            ...current,
            integrations: {
              ...current.integrations,
              shikimori: null,
            },
          }
        : current,
    );
  }

  async function handleImportShikimoriList() {
    const result = await importShikimoriList();
    const { list } = await getMyAnimeList();
    setDiaryEntries(list);
    setLibraryRefreshKey((current) => current + 1);
    return result;
  }

  return {
    user,
    authStatus,
    diaryEntries,
    libraryRefreshKey,
    setDiaryEntries,
    handleLogout,
    handleDisconnectShikimori,
    handleImportShikimoriList,
  };
}
