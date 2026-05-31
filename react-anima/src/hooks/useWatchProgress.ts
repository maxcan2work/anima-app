import { useState } from 'react';
import { deleteAnimeProgress, saveAnimeProgress, type CurrentUser, type ServerWatchEntry } from '@/api';
import type { AnimeTitle } from '@/data';
import { upsertDiaryEntry } from '@shared/animeMappers';
import { saveWatchState, type WatchState } from '@shared/storage';

type UseWatchProgressOptions = {
  library: AnimeTitle[];
  user: CurrentUser | null;
  setWatchState: (updater: (current: Record<string, WatchState>) => Record<string, WatchState>) => void;
  setDiaryEntries: (updater: (entries: ServerWatchEntry[]) => ServerWatchEntry[]) => void;
};

export function useWatchProgress({ library, user, setWatchState, setDiaryEntries }: UseWatchProgressOptions) {
  const [syncStatus, setSyncStatus] = useState('');

  function updateState(id: string, patch: Partial<WatchState>) {
    setWatchState((current) => {
      const anime = library.find((item) => item.id === id);
      if (!anime) return current;
      const previous = current[id] ?? { episode: 1, status: 'none' };
      const nextEpisode = Math.min(Math.max(patch.episode ?? previous.episode, 1), anime?.episodes ?? 1);
      const nextEntry = {
        ...previous,
        ...patch,
        episode: nextEpisode,
      };
      const next = { ...current };
      next[id] = nextEntry;

      if (user) {
        setSyncStatus('Сохраняем...');
        const request = nextEntry.status === 'none'
          ? deleteAnimeProgress(id).then(() => ({ entry: null }))
          : saveAnimeProgress(id, {
            status: nextEntry.status,
            currentEpisode: nextEntry.episode,
          });

        request
          .then(({ entry }) => {
            setDiaryEntries((entries) => entry
              ? upsertDiaryEntry(entries, entry)
              : entries.filter((item) => item.animeId !== id));
            setSyncStatus('Сохранено в профиле');
          })
          .catch(() => setSyncStatus('Не удалось сохранить'));
      } else {
        const persisted = { ...next };
        if (nextEntry.status === 'none') {
          delete persisted[id];
        }
        saveWatchState(persisted);
        setSyncStatus('Сохранено локально');
      }

      return next;
    });
  }

  return { syncStatus, updateState };
}
