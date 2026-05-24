import { useState } from 'react';
import { saveAnimeProgress, type CurrentUser, type ServerWatchEntry } from '@/api';
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
      const previous = current[id] ?? { episode: 1, status: 'planned' };
      const nextEpisode = Math.min(Math.max(patch.episode ?? previous.episode, 1), anime?.episodes ?? 1);
      const nextEntry = {
        ...previous,
        ...patch,
        episode: nextEpisode,
      };
      const next = {
        ...current,
        [id]: nextEntry,
      };

      if (user) {
        setSyncStatus('Сохраняем...');
        saveAnimeProgress(id, {
          status: nextEntry.status,
          currentEpisode: nextEntry.episode,
        })
          .then(({ entry }) => {
            setDiaryEntries((entries) => upsertDiaryEntry(entries, entry));
            setSyncStatus('Сохранено в профиле');
          })
          .catch(() => setSyncStatus('Не удалось сохранить'));
      } else {
        saveWatchState(next);
        setSyncStatus('Сохранено локально');
      }

      return next;
    });
  }

  return { syncStatus, updateState };
}
