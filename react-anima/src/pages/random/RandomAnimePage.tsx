import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getAnimeOriginalDisplayTitle, getLocalizedAnimeTitle } from '@anima/core';
import RandomDiceIcon from '@assets/random-dice.svg?react';
import trashIcon from '@assets/trash.svg';
import {
  getCatalogGenres,
  type CatalogGenre,
  type CatalogRequestOptions,
  type CatalogSearchResult,
} from '@/api';
import { useAuth } from '@features/auth/AuthProvider';
import { useWatchLibrary } from '@features/watch-library/WatchLibraryProvider';
import { useRandomAnime } from '@hooks/useRandomAnime';
import { useI18n } from '@shared/i18n/I18nProvider';
import { SplitScreenLayout } from '@shared/ui/SplitScreenLayout';
import styles from './RandomAnimePage.module.css';

const HISTORY_REMOVE_DURATION = 240;
const HISTORY_CLEAR_STAGGER = 55;

type RandomFilters = {
  kind: string;
  status: string;
  score: string;
  genre: string;
  rating: string;
};

const defaultRandomFilters: RandomFilters = {
  kind: 'all',
  status: 'all',
  score: 'all',
  genre: 'all',
  rating: 'all',
};

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
  const [genres, setGenres] = useState<CatalogGenre[]>([]);
  const [genresLoading, setGenresLoading] = useState(true);
  const [filters, setFilters] = useState<RandomFilters>(defaultRandomFilters);
  const historyPending = authStatus === 'loading' || randomHistoryLoading;
  const historyBusy = randomClearing || clearAnimating;
  const randomAnimeTitle = randomAnime ? getLocalizedAnimeTitle(randomAnime, language) : '';
  const randomAnimeOriginalTitle = randomAnime ? getAnimeOriginalDisplayTitle(randomAnime, language) : '';
  const selectedGenre = genres.find((genre) => String(genre.id) === filters.genre);
  const genreOptions = useMemo(() => genres.slice(0, 18), [genres]);
  const requestFilters = useMemo<CatalogRequestOptions>(() => ({
    kind: filters.kind === 'all' ? undefined : filters.kind,
    status: filters.status === 'all' ? undefined : filters.status,
    score: filters.score === 'all' ? undefined : filters.score,
    genre: filters.genre === 'all' ? undefined : filters.genre,
    rating: filters.rating === 'all' ? undefined : filters.rating,
  }), [filters]);

  useEffect(() => {
    let ignore = false;
    setGenresLoading(true);

    getCatalogGenres()
      .then((response) => {
        if (!ignore) setGenres(response.genres);
      })
      .catch(() => {
        if (!ignore) setGenres([]);
      })
      .finally(() => {
        if (!ignore) setGenresLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

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

  function setFilter<Key extends keyof RandomFilters>(key: Key, value: RandomFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
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
      <section className={styles.controlDeck} aria-label={t('random.filters')}>
        <div className={styles.filterColumn}>
          <FilterChips
            label={t('catalog.score')}
            options={[
              { value: 'all', label: t('catalog.filter.all') },
              { value: '6', label: '6+' },
              { value: '7', label: '7+' },
              { value: '8', label: '8+' },
            ]}
            value={filters.score}
            onChange={(value) => setFilter('score', value)}
          />
          <FilterChips
            label={t('catalog.kind')}
            options={[
              { value: 'all', label: t('catalog.filter.all') },
              { value: 'tv', label: 'TV' },
              { value: 'movie', label: t('catalog.kind.movie') },
              { value: 'ona', label: 'ONA' },
            ]}
            value={filters.kind}
            onChange={(value) => setFilter('kind', value)}
          />
        </div>

        <div className={styles.rollAction}>
          <button
            className={clsx(styles.diceButton, randomLoading && styles.diceButtonRolling)}
            type="button"
            onClick={() => handleRandomAnime(requestFilters)}
            disabled={randomLoading}
            aria-label={randomLoading ? t('random.rolling') : t('random.roll')}
          >
            <RandomDiceIcon className={styles.dice} aria-hidden="true" />
          </button>
          <span>{randomLoading ? t('random.rolling') : t('random.roll')}</span>
        </div>

        <div className={styles.filterColumn}>
          <FilterChips
            label={t('catalog.status')}
            options={[
              { value: 'all', label: t('catalog.filter.all') },
              { value: 'released', label: t('catalog.status.released') },
              { value: 'ongoing', label: t('catalog.status.ongoing') },
            ]}
            value={filters.status}
            onChange={(value) => setFilter('status', value)}
          />
          <FilterSelect
            disabled={genresLoading}
            label={t('catalog.genre')}
            options={[
              { value: 'all', label: genresLoading ? t('common.loading') : t('catalog.filter.all') },
              ...genreOptions.map((genre) => ({
                value: String(genre.id),
                label: language === 'ru' ? genre.titleRu ?? genre.name : genre.name,
              })),
            ]}
            value={filters.genre}
            onChange={(value) => setFilter('genre', value)}
          />
        </div>
      </section>

      <section className={styles.resultPanel} aria-busy={randomLoading}>
        {randomLoading ? (
          <ResultSkeleton />
        ) : randomAnime ? (
          <button
            key={`${randomAnime.provider}-${randomAnime.providerId}`}
            className={styles.resultCard}
            onClick={() => openCatalogAnime(randomAnime)}
            type="button"
          >
            {randomAnime.posterUrl ? <img src={randomAnime.posterUrl} alt="" /> : <div className={styles.cardPosterFallback} />}
            <span className={styles.resultContent}>
              <span className="eyebrow">{t('random.result')}</span>
              <strong>{randomAnimeTitle}</strong>
              {randomAnimeOriginalTitle ? <small>{randomAnimeOriginalTitle}</small> : null}
              <span className={styles.metaGrid}>
                <span>{randomAnime.score ?? t('common.noScore')}</span>
                <span>{randomAnime.episodes} {t('common.episodesShort')}</span>
                <span>{randomAnime.kind ?? t('catalog.filter.all')}</span>
                <span>{randomAnime.status ?? t('catalog.filter.all')}</span>
              </span>
              <span className={styles.resultTags}>
                {selectedGenre ? <i>{language === 'ru' ? selectedGenre.titleRu ?? selectedGenre.name : selectedGenre.name}</i> : null}
                {filters.score !== 'all' ? <i>{filters.score}+</i> : null}
                {filters.rating !== 'all' ? <i>{filters.rating.toUpperCase()}</i> : null}
              </span>
            </span>
          </button>
        ) : (
          <div className={styles.emptyResult}>
            <p className="eyebrow">{t('random.eyebrow')}</p>
            <h2>{t('random.title')}</h2>
            <p>{t('random.description')}</p>
          </div>
        )}
      </section>

      {randomStatus ? <p className={styles.status}>{randomStatus}</p> : null}
    </SplitScreenLayout>
  );
}

function FilterChips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.filterGroup}>
      <span>{label}</span>
      <div>
        {options.map((option) => (
          <button
            key={option.value}
            className={option.value === value ? styles.activeFilter : undefined}
            type="button"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function FilterSelect({
  disabled,
  label,
  options,
  value,
  onChange,
}: {
  disabled?: boolean;
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className={styles.filterSelect} ref={rootRef}>
      <span>{label}</span>
      <button
        className={styles.filterSelectTrigger}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected.label}</span>
        <span className={styles.filterSelectChevron} aria-hidden="true" />
      </button>
      {open ? (
        <div className={styles.filterSelectMenu} role="listbox" aria-label={label}>
          {options.map((option) => (
            <button
              key={option.value}
              className={option.value === value ? styles.selectedOption : undefined}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ResultSkeleton() {
  return (
    <div className={styles.resultSkeleton} aria-hidden="true">
      <span className={styles.resultSkeletonPoster} />
      <div>
        <span className={styles.resultSkeletonEyebrow} />
        <span className={styles.resultSkeletonTitle} />
        <span className={styles.resultSkeletonLine} />
        <span className={styles.resultSkeletonMeta} />
      </div>
    </div>
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
