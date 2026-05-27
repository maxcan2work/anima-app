import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { getAnimeOriginalDisplayTitle, getLocalizedAnimeTitle } from '@anima/core';
import RandomDiceIcon from '@assets/random-dice.svg?react';
import clockIcon from '@assets/clock-three.svg';
import starIcon from '@assets/star.svg';
import trashIcon from '@assets/trash.svg';
import tvIcon from '@assets/tv-alt.svg';
import statusIcon from '@assets/profile-check.svg';
import CalendarIcon from '@assets/calendar.svg?react';
import FiltersIcon from '@assets/filters.svg?react';
import HistoryIcon from '@assets/history.svg?react';
import {
  getCatalogGenres,
  importCatalogAnime,
  saveAnimeProgress,
  type CatalogGenre,
  type CatalogRequestOptions,
  type CatalogSearchResult,
} from '@/api';
import { useAuth } from '@features/auth/AuthProvider';
import { useWatchLibrary } from '@features/watch-library/WatchLibraryProvider';
import { useRandomAnime } from '@hooks/useRandomAnime';
import { useI18n } from '@shared/i18n/I18nProvider';
import { GenreMarquee } from '@shared/ui/GenreMarquee';
import { SplitScreenLayout } from '@shared/ui/SplitScreenLayout';
import { Tooltip } from '@shared/ui/Tooltip';
import { useToast } from '@shared/ui/ToastProvider';
import { upsertDiaryEntry } from '@shared/animeMappers';
import styles from './RandomAnimePage.module.css';

const HISTORY_REMOVE_DURATION = 240;
const HISTORY_CLEAR_STAGGER = 55;

type RandomFilters = {
  kinds: string[];
  status: string;
  score: string;
  genres: string[];
  ratings: string[];
};

type RandomSidebarTab = 'filters' | 'history';

const defaultRandomFilters: RandomFilters = {
  kinds: [],
  status: 'all',
  score: 'all',
  genres: [],
  ratings: [],
};

export function RandomAnimePage() {
  const { user, authStatus, diaryEntries, setDiaryEntries } = useAuth();
  const { openCatalogAnime, refreshLibrary } = useWatchLibrary();
  const toast = useToast();
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
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [sidebarTab, setSidebarTab] = useState<RandomSidebarTab>('history');
  const [addingToPlans, setAddingToPlans] = useState(false);
  const [historyScrollable, setHistoryScrollable] = useState(false);
  const historyListRef = useRef<HTMLDivElement | null>(null);
  const historyPending = authStatus === 'loading' || randomHistoryLoading;
  const historyBusy = randomClearing || clearAnimating;
  const randomAnimeTitle = randomAnime ? getLocalizedAnimeTitle(randomAnime, language) : '';
  const randomAnimeOriginalTitle = randomAnime ? getAnimeOriginalDisplayTitle(randomAnime, language) : '';
  const selectedGenres = genres.filter((genre) => filters.genres.includes(String(genre.id)));
  const resultGenres = randomAnime?.genres?.length
    ? randomAnime.genres
    : selectedGenres.length > 0
      ? selectedGenres.map((genre) => (language === 'ru' ? genre.titleRu ?? genre.name : genre.name))
      : [];
  const randomAnimeStatus = randomAnime?.status ? getCatalogStatusLabel(randomAnime.status, t) : t('catalog.filter.all');
  const randomAnimeKind = randomAnime?.kind ? getCatalogKindLabel(randomAnime.kind, t) : t('catalog.filter.all');
  const randomAnimePlanned = randomAnime
    ? diaryEntries.some((entry) => entry.animeId === `${randomAnime.provider}-${randomAnime.providerId}` && entry.status === 'PLANNED')
    : false;
  const randomAnimeReleaseYear = randomAnime?.airedOn ? getReleaseYear(randomAnime.airedOn) : null;
  const genreOptions = useMemo(() => genres.slice(0, 18), [genres]);
  const requestFilters = useMemo<CatalogRequestOptions>(() => ({
    kind: toCatalogFilter(filters.kinds),
    status: filters.status === 'all' ? undefined : filters.status,
    score: filters.score === 'all' ? undefined : filters.score,
    genre: toCatalogFilter(filters.genres),
    rating: toCatalogFilter(filters.ratings),
  }), [filters]);
  const activeFilterCount = [
    filters.status === 'all' ? 0 : 1,
    filters.score === 'all' ? 0 : 1,
    filters.kinds.length,
    filters.genres.length,
    filters.ratings.length,
  ].reduce((sum, count) => sum + count, 0);

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

  useEffect(() => {
    if (sidebarTab !== 'history') {
      setHistoryScrollable(false);
      return undefined;
    }

    const node = historyListRef.current;
    if (!node) return undefined;

    let frameId = 0;
    const updateScrollable = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        setHistoryScrollable(node.scrollHeight > node.clientHeight + 1);
      });
    };

    updateScrollable();

    const resizeObserver = new ResizeObserver(updateScrollable);
    resizeObserver.observe(node);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
    };
  }, [historyPending, randomHistory.length, removingHistoryKeys.length, sidebarTab]);

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

  function toggleMultiFilter(key: 'kinds' | 'genres' | 'ratings', value: string) {
    setFilters((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value],
    }));
  }

  function toggleSection(section: string) {
    setCollapsedSections((current) => ({ ...current, [section]: !current[section] }));
  }

  async function handleAddToPlans(anime: CatalogSearchResult) {
    if (addingToPlans || randomAnimePlanned) return;

    if (!user) {
      toast({ message: t('random.loginToPlan'), variant: 'warning' });
      return;
    }

    setAddingToPlans(true);
    try {
      const { anime: importedAnime } = await importCatalogAnime(anime.provider, anime.providerId);
      const { entry } = await saveAnimeProgress(importedAnime.id, {
        status: 'planned',
        currentEpisode: 1,
      });
      setDiaryEntries((current) => upsertDiaryEntry(current, entry));
      await refreshLibrary();
      toast({ message: t('random.addedToPlans'), variant: 'success' });
    } catch {
      toast({ message: t('random.addToPlansFailed'), variant: 'danger' });
    } finally {
      setAddingToPlans(false);
    }
  }

  return (
    <SplitScreenLayout
      fixed
      mainClassName={styles.stage}
      sidebarClassName={styles.history}
      sidebarLabel={t('random.sidebarLabel')}
      sidebar={(
        <div className={styles.sidebarShell}>
          <div className={styles.sidebarBody}>
            {sidebarTab === 'filters' ? (
              <div className={styles.filtersPanel}>
                <div className={styles.historyHeader}>
                  <h3>{t('random.filtersShort')}</h3>
                  <button type="button" onClick={() => setFilters(defaultRandomFilters)} disabled={activeFilterCount === 0}>
                    {t('common.clear')}
                  </button>
                </div>
                <div className={styles.filtersList}>
                  <FilterSection
                    activeCount={filters.status === 'all' ? 0 : 1}
                    collapsed={Boolean(collapsedSections.status)}
                    id="random-status"
                    title={t('catalog.status')}
                    onToggle={() => toggleSection('status')}
                  >
                    <div className={styles.selectBuffer}>
                      <FilterSelect
                        label={t('catalog.status')}
                        options={[
                          { value: 'all', label: t('catalog.filter.all') },
                          { value: 'released', label: t('catalog.status.released') },
                          { value: 'ongoing', label: t('catalog.status.ongoing') },
                          { value: 'anons', label: t('catalog.status.anons') },
                        ]}
                        value={filters.status}
                        onChange={(value) => setFilter('status', value)}
                      />
                    </div>
                  </FilterSection>
                  <FilterSection
                    activeCount={filters.score === 'all' ? 0 : 1}
                    collapsed={Boolean(collapsedSections.score)}
                    id="random-score"
                    title={t('catalog.score')}
                    onToggle={() => toggleSection('score')}
                  >
                    <ScoreRange
                      allLabel={t('catalog.filter.all')}
                      value={filters.score}
                      onChange={(value) => setFilter('score', value)}
                    />
                  </FilterSection>
                  <FilterSection
                    activeCount={filters.kinds.length}
                    collapsed={Boolean(collapsedSections.kind)}
                    id="random-kind"
                    title={t('catalog.kind')}
                    onToggle={() => toggleSection('kind')}
                  >
                    <div className={styles.optionGrid}>
                      {[
                        { value: 'tv', label: 'TV' },
                        { value: 'movie', label: t('catalog.kind.movie') },
                        { value: 'ova', label: 'OVA' },
                        { value: 'ona', label: 'ONA' },
                        { value: 'special', label: t('catalog.kind.special') },
                      ].map((option) => (
                        <FilterCheck
                          key={option.value}
                          checked={filters.kinds.includes(option.value)}
                          label={option.label}
                          onChange={() => toggleMultiFilter('kinds', option.value)}
                        />
                      ))}
                    </div>
                  </FilterSection>
                  <FilterSection
                    activeCount={filters.genres.length}
                    collapsed={Boolean(collapsedSections.genre)}
                    id="random-genre"
                    title={t('catalog.genre')}
                    onToggle={() => toggleSection('genre')}
                  >
                    <div className={styles.genreGrid}>
                      {genresLoading
                        ? Array.from({ length: 8 }, (_, index) => (
                          <span className={styles.filterCheckPlaceholder} key={index} />
                        ))
                        : genreOptions.map((genre) => {
                          const genreId = String(genre.id);
                          return (
                            <FilterCheck
                              key={genre.id}
                              checked={filters.genres.includes(genreId)}
                              label={language === 'ru' ? genre.titleRu ?? genre.name : genre.name}
                              onChange={() => toggleMultiFilter('genres', genreId)}
                            />
                          );
                        })}
                    </div>
                  </FilterSection>
                  <FilterSection
                    activeCount={filters.ratings.length}
                    collapsed={Boolean(collapsedSections.rating)}
                    id="random-rating"
                    title={t('catalog.rating')}
                    onToggle={() => toggleSection('rating')}
                  >
                    <div className={styles.optionGrid}>
                      {[
                        { value: 'g', label: 'G' },
                        { value: 'pg', label: 'PG' },
                        { value: 'pg_13', label: 'PG-13' },
                        { value: 'r', label: 'R-17' },
                        { value: 'r_plus', label: 'R+' },
                      ].map((option) => (
                        <FilterCheck
                          key={option.value}
                          checked={filters.ratings.includes(option.value)}
                          label={option.label}
                          onChange={() => toggleMultiFilter('ratings', option.value)}
                        />
                      ))}
                    </div>
                  </FilterSection>
                </div>
              </div>
            ) : (
              <div className={styles.historyPanel}>
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

                <div ref={historyListRef} className={clsx(styles.historyList, historyScrollable && styles.historyListScrollable)}>
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
              </div>
            )}
          </div>

          <div className={styles.sidebarTabs}>
            <Tooltip className={styles.sidebarTabTooltip} label={t('random.history')} placement="top">
              <button className={sidebarTab === 'history' ? styles.sidebarTabActive : undefined} type="button" onClick={() => setSidebarTab('history')} aria-label={t('random.history')}>
                <HistoryIcon aria-hidden="true" />
              </button>
            </Tooltip>
            <Tooltip className={styles.sidebarTabTooltip} label={t('random.filtersShort')} placement="top">
              <button className={sidebarTab === 'filters' ? styles.sidebarTabActive : undefined} type="button" onClick={() => setSidebarTab('filters')} aria-label={t('random.filtersShort')}>
                <FiltersIcon aria-hidden="true" />
                {activeFilterCount > 0 ? <span className={styles.sidebarTabBadge}>{activeFilterCount}</span> : null}
              </button>
            </Tooltip>
          </div>
        </div>
      )}
    >
      <section className={styles.controlDeck} aria-label={t('random.filters')}>
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
      </section>

      <section className={styles.resultPanel} aria-busy={randomLoading}>
        {randomLoading ? (
          <ResultSkeleton />
        ) : randomAnime ? (
          <article
            key={`${randomAnime.provider}-${randomAnime.providerId}`}
            className={styles.resultCard}
          >
            <span className={styles.resultAside}>
              {randomAnime.posterUrl ? <img src={randomAnime.posterUrl} alt="" /> : <div className={styles.cardPosterFallback} />}
              {resultGenres.length > 0 ? (
                <GenreMarquee className={styles.resultGenres} genres={resultGenres.slice(0, 8)} ariaLabel={t('catalog.genre')} />
              ) : null}
              <span className={styles.metaGrid}>
                <span className={styles.metaCard}>
                  <img src={tvIcon} alt="" aria-hidden="true" />
                  <small>{t('common.episodesShort')}</small>
                  <strong>{randomAnime.episodes}</strong>
                </span>
                <span className={styles.metaCard}>
                  <img src={starIcon} alt="" aria-hidden="true" />
                  <small>{t('catalog.score')}</small>
                  <strong>{randomAnime.score ?? t('common.noScore')}</strong>
                </span>
                <span className={styles.metaCard}>
                  <img src={statusIcon} alt="" aria-hidden="true" />
                  <small>{t('catalog.status')}</small>
                  <strong>{randomAnimeStatus}</strong>
                </span>
                <span className={styles.metaCard}>
                  <img src={clockIcon} alt="" aria-hidden="true" />
                  <small>{t('catalog.kind')}</small>
                  <strong>{randomAnimeKind}</strong>
                </span>
              </span>
              <span className={styles.releaseYearCard}>
                <CalendarIcon aria-hidden="true" />
                <small>{t('catalog.season')}</small>
                <strong>{randomAnimeReleaseYear ?? t('common.none')}</strong>
              </span>
            </span>
            <span className={styles.resultContent}>
              <span className="eyebrow">{t('random.result')}</span>
              <strong>{randomAnimeTitle}</strong>
              {randomAnimeOriginalTitle ? <small>{randomAnimeOriginalTitle}</small> : null}
              <p>{randomAnime.description ?? t('random.noDescription')}</p>
              <span className={styles.resultActions}>
                <button
                  className={clsx(randomAnimePlanned && styles.alreadyPlannedButton)}
                  type="button"
                  onClick={() => handleAddToPlans(randomAnime)}
                  disabled={addingToPlans || randomAnimePlanned}
                >
                  {randomAnimePlanned ? t('random.alreadyPlanned') : addingToPlans ? t('common.loading') : t('random.addToPlans')}
                </button>
                <button type="button" onClick={() => openCatalogAnime(randomAnime)}>
                  {t('random.openWatch')}
                </button>
              </span>
            </span>
          </article>
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

function FilterSection({
  activeCount = 0,
  children,
  collapsed,
  id,
  title,
  onToggle,
}: {
  activeCount?: number;
  children: ReactNode;
  collapsed: boolean;
  id: string;
  title: string;
  onToggle: () => void;
}) {
  const contentId = `random-filter-${id}`;
  const showActiveBadge = collapsed && activeCount > 0;

  return (
    <section className={styles.filterSection}>
      <button
        className={styles.filterSectionHeader}
        type="button"
        aria-expanded={!collapsed}
        aria-controls={contentId}
        onClick={onToggle}
      >
        <span className={styles.filterSectionTitle}>
          <span>{title}</span>
          {showActiveBadge ? <span className={styles.filterSectionBadge}>{activeCount}</span> : null}
        </span>
        <span className={styles.filterSectionChevron} aria-hidden="true" />
      </button>
      <div
        className={styles.filterSectionBody}
        id={contentId}
        aria-hidden={collapsed}
        data-collapsed={collapsed ? 'true' : 'false'}
      >
        <div className={styles.filterSectionBodyInner}>
          {children}
        </div>
      </div>
    </section>
  );
}

function FilterCheck({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <label className={styles.filterCheck}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}

function ScoreRange({
  allLabel,
  value,
  onChange,
}: {
  allLabel: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const onChangeRef = useRef(onChange);
  const numericValue = value === 'all' ? 0 : Number(value);
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
  const [draftValue, setDraftValue] = useState(safeValue);
  const draftFilterValue = draftValue === 0 ? 'all' : String(draftValue);
  const draftProgress = (draftValue / 9) * 100;
  const draftLabel = draftValue === 0 ? allLabel : `${draftValue}+`;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    setDraftValue(safeValue);
  }, [safeValue]);

  useEffect(() => {
    if (draftFilterValue === value) return;

    const timeoutId = window.setTimeout(() => {
      onChangeRef.current(draftFilterValue);
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [draftFilterValue, value]);

  return (
    <label
      className={styles.scoreRange}
      style={{
        '--score-progress': `${draftProgress}%`,
        '--score-thumb-position': `calc(${draftProgress}% + ${(0.5 - draftValue / 9) * 20}px)`,
      } as CSSProperties}
    >
      <span className={styles.scoreRangeTrack}>
        <span className={styles.scoreRangeTooltip}>{draftLabel}</span>
        <input
          type="range"
          min="0"
          max="9"
          step="1"
          value={draftValue}
          aria-label={allLabel}
          onChange={(event) => {
            const nextValue = Number(event.target.value);
            setDraftValue(Number.isFinite(nextValue) ? nextValue : 0);
          }}
        />
      </span>
      <span className={styles.scoreRangeScale} aria-hidden="true">
        <span>{allLabel}</span>
        <span>3</span>
        <span>6</span>
        <span>9</span>
      </span>
    </label>
  );
}

function FilterSelect({
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
      <button
        className={styles.filterSelectTrigger}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
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

function getCatalogStatusLabel(status: string, t: (key: string) => string) {
  switch (status) {
    case 'released':
      return t('catalog.status.released');
    case 'ongoing':
      return t('catalog.status.ongoing');
    case 'anons':
      return t('catalog.status.anons');
    default:
      return status;
  }
}

function getCatalogKindLabel(kind: string, t: (key: string) => string) {
  switch (kind) {
    case 'movie':
      return t('catalog.kind.movie');
    case 'special':
    case 'tv_special':
      return t('catalog.kind.special');
    case 'tv':
      return 'TV';
    case 'ova':
      return 'OVA';
    case 'ona':
      return 'ONA';
    default:
      return kind;
  }
}

function getReleaseYear(airedOn: string) {
  const year = new Date(airedOn).getFullYear();
  return Number.isFinite(year) ? String(year) : null;
}

function toCatalogFilter(values: string[]) {
  return values.length > 0 ? values.join(',') : undefined;
}

function ResultSkeleton() {
  return (
    <div className={styles.resultSkeleton} aria-hidden="true">
      <span className={styles.resultSkeletonAside}>
        <span className={styles.resultSkeletonPoster} />
        <span className={styles.resultSkeletonGenres} />
        <span className={styles.resultSkeletonMetaGrid}>
          {Array.from({ length: 4 }, (_, index) => (
            <span className={styles.resultSkeletonMetaCard} key={`random-result-meta-${index}`} />
          ))}
        </span>
        <span className={styles.resultSkeletonYear} />
      </span>
      <span className={styles.resultSkeletonContent}>
        <span className={styles.resultSkeletonEyebrow} />
        <span className={styles.resultSkeletonTitle} />
        <span className={styles.resultSkeletonLine} />
        <span className={styles.resultSkeletonDescription} />
        <span className={styles.resultSkeletonActions}>
          <span />
          <span />
        </span>
      </span>
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
