import clsx from 'clsx';
import { useState } from 'react';
import randomDiceIcon from '@assets/random-dice.svg';
import trashIcon from '@assets/trash.svg';
import { useAuth } from '@features/auth/AuthProvider';
import { useWatchLibrary } from '@features/watch-library/WatchLibraryProvider';
import { useRandomAnime } from '@hooks/useRandomAnime';
import { SplitScreenLayout } from '@shared/ui/SplitScreenLayout';
import type { CatalogSearchResult } from '@/api';
import styles from './RandomAnimePage.module.css';

const HISTORY_REMOVE_DURATION = 240;
const HISTORY_CLEAR_STAGGER = 55;

export function RandomAnimePage() {
  const { user, authStatus } = useAuth();
  const { openCatalogAnime } = useWatchLibrary();
  const {
    randomAnime,
    randomHistory,
    randomLoading,
    randomHistoryLoading,
    randomStatus,
    randomClearing,
    deletingRandomKey,
    handleRandomAnime,
    handleClearRandomHistory,
    handleDeleteRandomHistoryEntry,
  } = useRandomAnime(user);
  const [removingHistoryKeys, setRemovingHistoryKeys] = useState<string[]>([]);
  const [clearAnimating, setClearAnimating] = useState(false);
  const historyPending = authStatus === 'loading' || randomHistoryLoading;
  const historyBusy = randomClearing || clearAnimating;

  async function handleDeleteHistoryEntry(item: CatalogSearchResult) {
    const key = getRandomHistoryKey(item);
    if (historyBusy || deletingRandomKey || removingHistoryKeys.includes(key)) return;

    setRemovingHistoryKeys((current) => [...current, key]);
    await wait(HISTORY_REMOVE_DURATION);

    try {
      await handleDeleteRandomHistoryEntry(item);
    } finally {
      setRemovingHistoryKeys((current) => current.filter((itemKey) => itemKey !== key));
    }
  }

  async function handleClearHistory() {
    if (historyBusy || randomHistory.length === 0) return;

    setClearAnimating(true);
    const keys = randomHistory.map(getRandomHistoryKey);

    keys.forEach((key, index) => {
      window.setTimeout(() => {
        setRemovingHistoryKeys((current) => (current.includes(key) ? current : [...current, key]));
      }, index * HISTORY_CLEAR_STAGGER);
    });

    await wait(HISTORY_REMOVE_DURATION + Math.max(0, keys.length - 1) * HISTORY_CLEAR_STAGGER);

    try {
      await handleClearRandomHistory();
    } finally {
      setRemovingHistoryKeys([]);
      setClearAnimating(false);
    }
  }

  return (
    <SplitScreenLayout
      fixed
      mainClassName={styles.stage}
      sidebarClassName={styles.history}
      sidebarLabel="История случайных аниме"
      sidebar={(
        <>
          <div className={styles.historyHeader}>
            <h3>История</h3>
            {randomHistory.length > 0 ? (
              <button type="button" onClick={handleClearHistory} disabled={historyBusy}>
                {historyBusy ? 'Очищаем...' : 'Очистить'}
              </button>
            ) : (
              <span className={styles.historyHeaderActionPlaceholder} aria-hidden="true" />
            )}
          </div>

          <div className={styles.historyList}>
            {historyPending ? (
              <div className={styles.historySkeleton} aria-hidden="true">
                {Array.from({ length: 5 }, (_, index) => (
                  <div className={styles.historySkeletonRow} key={`random-history-skeleton-${index}`}>
                    <span />
                    <div>
                      <strong />
                      <small />
                    </div>
                  </div>
                ))}
              </div>
            ) : randomHistory.length === 0 ? (
              <p className={styles.mutedCopy}>Здесь появятся последние варианты.</p>
            ) : (
              randomHistory.map((item) => {
                const key = getRandomHistoryKey(item);
                const removing = removingHistoryKeys.includes(key);
                return (
                  <div key={key} className={clsx(styles.historyRow, removing && styles.historyRowRemoving)}>
                    <button className={styles.historyOpen} onClick={() => openCatalogAnime(item)} type="button" disabled={removing || historyBusy}>
                      {item.posterUrl ? <img src={item.posterUrl} alt="" /> : <div className={styles.posterFallback} />}
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.score ?? 'без оценки'}</small>
                      </span>
                    </button>
                    <button
                      className={styles.historyDelete}
                      type="button"
                      aria-label={`Удалить ${item.title} из истории`}
                      disabled={removing || historyBusy || deletingRandomKey === key}
                      onClick={() => handleDeleteHistoryEntry(item)}
                    >
                      <img src={trashIcon} alt="" aria-hidden="true" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    >
      <img className={styles.dice} src={randomDiceIcon} alt="" aria-hidden="true" />
      <p className="eyebrow">Рандомайзер</p>
      <h2>Не знаешь, что посмотреть?</h2>
      <p>Жми кнопку снизу, а Anima достанет случайный тайтл из каталога Shikimori.</p>

      {randomAnime ? (
        <button className={styles.card} onClick={() => openCatalogAnime(randomAnime)} type="button">
          {randomAnime.posterUrl ? <img src={randomAnime.posterUrl} alt="" /> : null}
          <div>
            <strong>{randomAnime.title}</strong>
            <small>{randomAnime.originalTitle}</small>
            <small>
              {randomAnime.episodes} сер. · {randomAnime.score ?? 'без оценки'}
            </small>
          </div>
        </button>
      ) : null}

      {randomStatus ? <p className={styles.status}>{randomStatus}</p> : null}

      <button className={styles.button} onClick={handleRandomAnime} disabled={randomLoading}>
        {randomLoading ? 'Рандомим...' : randomAnime ? 'Перерандомить' : 'Срандомить'}
      </button>
    </SplitScreenLayout>
  );
}

function getRandomHistoryKey(item: CatalogSearchResult) {
  return `${item.provider}-${item.providerId}`;
}

function wait(duration: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, duration);
  });
}
