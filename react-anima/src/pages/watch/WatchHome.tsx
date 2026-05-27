import { type ComponentType, type CSSProperties, type ReactNode, type SVGProps, useEffect, useMemo, useRef, useState } from 'react';
import { useCatalog } from '@features/catalog/CatalogProvider';
import { CatalogBrowser } from '@features/catalog/CatalogBrowser';
import { useWatchLibrary } from '@features/watch-library/WatchLibraryProvider';
import { useI18n } from '@shared/i18n/I18nProvider';
import { SplitScreenLayout } from '@shared/ui/SplitScreenLayout';
import { getCatalogGenres, type CatalogGenre } from '@/api';
import RandomDiceIcon from '@assets/random-dice.svg?react';
import SortNewIcon from '@assets/sort-new.svg?react';
import SortPopularIcon from '@assets/sort-popular.svg?react';
import SortRatingIcon from '@assets/sort-rating.svg?react';
import type { CatalogBrowseOrder } from '@hooks/useCatalogBrowse';
import styles from './WatchHome.module.css';

export function EmptyCatalog() {
  const { t } = useI18n();

  return (
    <section className={styles.emptyCatalog}>
      <p className="eyebrow">Shikimori</p>
      <h2>{t('catalog.emptyTitle')}</h2>
      <p>{t('catalog.emptyDescription')}</p>
    </section>
  );
}

export function WatchHome() {
  const {
    browseResults,
    browseOrder,
    browseFilters,
    browsePage,
    browseHasNext,
    browseLoading,
    browseStatus,
    searchQuery,
    searchResults,
    searchLoading,
    searchStatus,
    setSearchQuery,
    setBrowsePage,
    setBrowseOrder,
    setBrowseFilters,
  } = useCatalog();
  const { openCatalogAnime } = useWatchLibrary();
  const { language, t } = useI18n();
  const [genres, setGenres] = useState<CatalogGenre[]>([]);
  const [genresLoading, setGenresLoading] = useState(true);
  const yearOptions = useMemo(() => buildYearOptions(), []);
  const orderOptions: Array<{
    value: CatalogBrowseOrder;
    label: string;
    Icon: ComponentType<SVGProps<SVGSVGElement>>;
  }> = [
    { value: 'popularity', label: t('catalog.order.popularity'), Icon: SortPopularIcon },
    { value: 'ranked', label: t('catalog.order.ranked'), Icon: SortRatingIcon },
    { value: 'aired_on', label: t('catalog.order.airedOn'), Icon: SortNewIcon },
    { value: 'ranked_random', label: t('catalog.order.random'), Icon: RandomDiceIcon },
  ];
  const kindOptions = [
    { value: 'tv', label: 'TV' },
    { value: 'movie', label: t('catalog.kind.movie') },
    { value: 'ova', label: 'OVA' },
    { value: 'ona', label: 'ONA' },
    { value: 'special', label: t('catalog.kind.special') },
  ];
  const statusOptions = [
    { value: 'all', label: t('catalog.filter.all') },
    { value: 'released', label: t('catalog.status.released') },
    { value: 'ongoing', label: t('catalog.status.ongoing') },
    { value: 'anons', label: t('catalog.status.anons') },
  ];
  const seasonOptions = [
    { value: 'all', label: t('catalog.filter.all') },
    ...yearOptions.map((year) => ({ value: String(year), label: String(year) })),
  ];
  const ratingOptions = [
    { value: 'g', label: 'G' },
    { value: 'pg', label: 'PG' },
    { value: 'pg_13', label: 'PG-13' },
    { value: 'r', label: 'R-17' },
    { value: 'r_plus', label: 'R+' },
  ];
  const visibleGenres = genres.slice(0, 18);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const setSingleFilter = <Key extends 'status' | 'score'>(key: Key, value: string) => {
    setBrowseFilters({ ...browseFilters, [key]: value });
  };
  const toggleMultiFilter = (key: 'kinds' | 'seasons' | 'genres' | 'ratings', value: string) => {
    const current = browseFilters[key];
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    setBrowseFilters({ ...browseFilters, [key]: next });
  };
  const toggleSection = (sectionId: string) => {
    setCollapsedSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  };
  const resetFilters = () => {
    setSearchQuery('');
    setBrowseOrder('popularity');
    setBrowseFilters({
      kinds: [],
      status: 'all',
      seasons: [],
      genres: [],
      score: 'all',
      ratings: [],
    });
  };

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

  return (
    <SplitScreenLayout
      className={styles.layout}
      mainClassName={styles.main}
      sidebarClassName={styles.sidebar}
      sidebarLabel={t('catalog.controls')}
      sidebar={(
        <div className={styles.filterPanel}>
          <div className={styles.controls}>
            <section className={styles.controlGroup}>
              <h3>{t('catalog.searchTitle')}</h3>
              <label className={styles.search} aria-label={t('catalog.searchTitle')}>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t('catalog.searchPlaceholder')}
                />
              </label>
            </section>

            <section className={styles.controlGroup} aria-label={t('catalog.sort')}>
              <div className={styles.segmented}>
                {orderOptions.map((option) => (
                  <button
                    key={option.value}
                    className={browseOrder === option.value ? styles.activeOption : undefined}
                    type="button"
                    onClick={() => setBrowseOrder(option.value)}
                  >
                    <option.Icon className={styles.orderIcon} aria-hidden="true" />
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </section>

            <FilterSection
              activeCount={browseFilters.status === 'all' ? 0 : 1}
              collapsed={Boolean(collapsedSections.status)}
              id="status"
              title={t('catalog.status')}
              onToggle={() => toggleSection('status')}
            >
              <div className={styles.selectBuffer}>
                <FilterSelect
                  label={t('catalog.status')}
                  options={statusOptions}
                  value={browseFilters.status}
                  onChange={(value) => setSingleFilter('status', value)}
                />
              </div>
            </FilterSection>

            <FilterSection
              activeCount={browseFilters.score === 'all' ? 0 : 1}
              collapsed={Boolean(collapsedSections.score)}
              id="score"
              title={t('catalog.score')}
              onToggle={() => toggleSection('score')}
            >
              <ScoreRange
                allLabel={t('catalog.filter.all')}
                value={browseFilters.score}
                onChange={(value) => setSingleFilter('score', value)}
              />
            </FilterSection>

            <FilterSection
              activeCount={browseFilters.kinds.length}
              collapsed={Boolean(collapsedSections.kind)}
              id="kind"
              title={t('catalog.kind')}
              onToggle={() => toggleSection('kind')}
            >
              <div className={styles.optionGrid}>
                {kindOptions.map((option) => (
                  <FilterCheck
                    key={option.value}
                    checked={browseFilters.kinds.includes(option.value)}
                    label={option.label}
                    onChange={() => toggleMultiFilter('kinds', option.value)}
                  />
                ))}
              </div>
            </FilterSection>

            <FilterSection
              activeCount={browseFilters.genres.length}
              collapsed={Boolean(collapsedSections.genre)}
              id="genre"
              title={t('catalog.genre')}
              onToggle={() => toggleSection('genre')}
            >
              <div className={styles.genreGrid}>
                {genresLoading
                  ? Array.from({ length: 8 }, (_, index) => (
                    <span className={styles.filterCheckPlaceholder} key={index} />
                  ))
                  : visibleGenres.map((genre) => {
                    const genreId = String(genre.id);
                    return (
                      <FilterCheck
                        key={genre.id}
                        checked={browseFilters.genres.includes(genreId)}
                        label={language === 'ru' ? genre.titleRu ?? genre.name : genre.name}
                        onChange={() => toggleMultiFilter('genres', genreId)}
                      />
                    );
                  })}
              </div>
            </FilterSection>

            <FilterSection
              activeCount={browseFilters.seasons.length}
              collapsed={Boolean(collapsedSections.season)}
              id="season"
              title={t('catalog.season')}
              onToggle={() => toggleSection('season')}
            >
              <div className={styles.optionGrid}>
                {seasonOptions.slice(1).map((option) => (
                  <FilterCheck
                    key={option.value}
                    checked={browseFilters.seasons.includes(option.value)}
                    label={option.label}
                    onChange={() => toggleMultiFilter('seasons', option.value)}
                  />
                ))}
              </div>
            </FilterSection>

            <FilterSection
              activeCount={browseFilters.ratings.length}
              collapsed={Boolean(collapsedSections.rating)}
              id="rating"
              title={t('catalog.rating')}
              onToggle={() => toggleSection('rating')}
            >
              <div className={styles.optionGrid}>
                {ratingOptions.map((option) => (
                  <FilterCheck
                    key={option.value}
                    checked={browseFilters.ratings.includes(option.value)}
                    label={option.label}
                    onChange={() => toggleMultiFilter('ratings', option.value)}
                  />
                ))}
              </div>
            </FilterSection>
          </div>
          <div className={styles.filterFooter}>
            <button className={styles.resetButton} type="button" onClick={resetFilters}>
              {t('common.reset')}
            </button>
          </div>
        </div>
      )}
    >
      <CatalogBrowser
        className={styles.watchHome}
        browseResults={browseResults}
        browsePage={browsePage}
        browseHasNext={browseHasNext}
        browseLoading={browseLoading}
        browseStatus={browseStatus}
        searchQuery={searchQuery}
        searchResults={searchResults}
        searchLoading={searchLoading}
        searchStatus={searchStatus}
        hideSearch
        onSearchChange={setSearchQuery}
        onOpenAnime={openCatalogAnime}
        onPageChange={setBrowsePage}
      />
    </SplitScreenLayout>
  );
}

function buildYearOptions() {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 16 }, (_, index) => currentYear - index);
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
  const contentId = `catalog-filter-${id}`;
  const showActiveBadge = collapsed && activeCount > 0;

  return (
    <section className={styles.controlGroup}>
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
