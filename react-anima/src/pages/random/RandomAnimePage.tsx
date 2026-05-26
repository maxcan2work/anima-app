import clsx from 'clsx';
import { useState } from 'react';
import { getAnimeOriginalDisplayTitle, getLocalizedAnimeTitle } from '@anima/core';
import RandomDiceIcon from '@assets/random-dice.svg?react';
import trashIcon from '@assets/trash.svg';
import { useAuth } from '@features/auth/AuthProvider';
import { useWatchLibrary } from '@features/watch-library/WatchLibraryProvider';
import { useRandomAnime } from '@hooks/useRandomAnime';
import { useI18n } from '@shared/i18n/I18nProvider';
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
  const { language, t } = useI18n();
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
      sidebarLabel={t('random.sidebarLabel')}
      sidebar={(
        <>
          <div className={styles.historyHeader}>
            <h3>{t('random.history')}</h3>
            {randomHistory.length > 0 ? (
              <button type="button" onClick={handleClearHistory} disabled={historyBusy}>
                {historyBusy ? t('common.clearing') : t('common.clear')}
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
              <p className={styles.mutedCopy}>{t('random.emptyHistory')}</p>
            ) : (
              randomHistory.map((item) => {
                const key = getRandomHistoryKey(item);
                const removing = removingHistoryKeys.includes(key);
                const title = getLocalizedAnimeTitle(item, language);
                return (
                  <div key={key} className={clsx(styles.historyRow, removing && styles.historyRowRemoving)}>
                    <button className={styles.historyOpen} onClick={() => openCatalogAnime(item)} type="button" disabled={removing || historyBusy}>
                      {item.posterUrl ? <img src={item.posterUrl} alt="" /> : <div className={styles.posterFallback} />}
                      <span>
                        <strong>{title}</strong>
                        <small>{item.score ?? t('common.noScore')}</small>
                      </span>
                    </button>
                    <button
                      className={styles.historyDelete}
                      type="button"
                      aria-label={t('random.removeFromHistory', { title })}
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
      <RandomDiceIcon className={styles.dice} aria-hidden="true" />
      <p className="eyebrow">{t('random.eyebrow')}</p>
      <h2>{t('random.title')}</h2>
      <p>{t('random.description')}</p>

      {randomAnime ? (
        <button className={styles.card} onClick={() => openCatalogAnime(randomAnime)} type="button">
          {randomAnime.posterUrl ? <img src={randomAnime.posterUrl} alt="" /> : null}
          <div>
            <strong>{getLocalizedAnimeTitle(randomAnime, language)}</strong>
            {getAnimeOriginalDisplayTitle(randomAnime, language) ? <small>{getAnimeOriginalDisplayTitle(randomAnime, language)}</small> : null}
            <small>
              {randomAnime.episodes} {t('common.episodesShort')} · {randomAnime.score ?? t('common.noScore')}
            </small>
          </div>
        </button>
      ) : null}

      {randomStatus ? <p className={styles.status}>{randomStatus}</p> : null}

      <button className={styles.button} onClick={handleRandomAnime} disabled={randomLoading}>
        {randomLoading ? t('random.rolling') : randomAnime ? t('random.reroll') : t('random.roll')}
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
