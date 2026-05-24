import { useEffect, useState } from 'react';
import { fromServerWatchStatus } from '@anima/core';
import {
  disconnectShikimori,
  getAnimeCatalog,
  getCurrentUser,
  getMyAnimeList,
  importShikimoriList,
  logout,
  type CurrentUser,
  type ServerWatchEntry,
} from '../api';
import type { AnimeTitle } from '../data';
import { mapServerAnimeToTitle } from '../shared/animeMappers';
import { loadWatchState, type WatchState } from '../shared/storage';

type UseAuthSessionOptions = {
  setWatchState: (value: Record<string, WatchState> | ((current: Record<string, WatchState>) => Record<string, WatchState>)) => void;
  setLibrary: (value: AnimeTitle[] | ((current: AnimeTitle[]) => AnimeTitle[])) => void;
};

export function useAuthSession({ setWatchState, setLibrary }: UseAuthSessionOptions) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [authStatus, setAuthStatus] = useState<'loading' | 'guest' | 'ready'>('loading');
  const [diaryEntries, setDiaryEntries] = useState<ServerWatchEntry[]>([]);

  useEffect(() => {
    let ignore = false;

    async function loadSession() {
      try {
        const [{ user: currentUser }, { list }] = await Promise.all([
          getCurrentUser(),
          getMyAnimeList(),
        ]);
        if (ignore) return;

        const serverState = list.reduce<Record<string, WatchState>>((acc, entry) => {
          acc[entry.animeId] = {
            episode: entry.currentEpisode,
            status: fromServerWatchStatus(entry.status),
          };
          return acc;
        }, {});

        setUser(currentUser);
        setWatchState(serverState);
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
  }, [setWatchState]);

  async function handleLogout() {
    await logout();
    setUser(null);
    setAuthStatus('guest');
    setDiaryEntries([]);
    setWatchState(loadWatchState());
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
    const [{ list }, { anime }] = await Promise.all([getMyAnimeList(), getAnimeCatalog()]);
    setDiaryEntries(list);
    setLibrary(anime.map(mapServerAnimeToTitle));
    return result;
  }

  return {
    user,
    authStatus,
    diaryEntries,
    setDiaryEntries,
    handleLogout,
    handleDisconnectShikimori,
    handleImportShikimoriList,
  };
}
