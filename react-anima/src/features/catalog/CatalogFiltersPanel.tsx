import { type ComponentType, type CSSProperties, type ReactNode, type SVGProps, useEffect, useMemo, useRef, useState } from 'react';
import { getCatalogGenres, type CatalogGenre } from '@/api';
import type { CatalogBrowseFilters, CatalogBrowseOrder } from '@hooks/useCatalogBrowse';
import RandomDiceIcon from '@assets/random-dice.svg?react';
import SortNewIcon from '@assets/sort-new.svg?react';
import SortPopularIcon from '@assets/sort-popular.svg?react';
import SortRatingIcon from '@assets/sort-rating.svg?react';
import { useI18n } from '@shared/i18n/I18nProvider';
import styles from '@pages/watch/WatchHome.module.css';

type CatalogFiltersPanelProps = {
  browseFilters: CatalogBrowseFilters;
  browseOrder: CatalogBrowseOrder;
  searchQuery: string;
  onFiltersChange: (filters: CatalogBrowseFilters) => void;
  onOrderChange: (order: CatalogBrowseOrder) => void;
  onSearchChange: (query: string) => void;
};

export const defaultCatalogFilters: CatalogBrowseFilters = {
  kinds: [],
  status: 'all',
  seasons: [],
  genres: [],
  score: 'all',
  ratings: [],
};

export function CatalogFiltersPanel({
  browseFilters,
  browseOrder,
  searchQuery,
  onFiltersChange,
  onOrderChange,
  onSearchChange,
}: CatalogFiltersPanelProps) {
  const { language, t } = useI18n();
  const [genres, setGenres] = useState<CatalogGenre[]>([]);
  const [genresLoading, setGenresLoading] = useState(true);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const yearOptions = useMemo(() => buildYearOptions(), []);
  const orderOptions: Array<{ value: CatalogBrowseOrder; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }> = [
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
  const ratingOptions = [
    { value: 'g', label: 'G' },
    { value: 'pg', label: 'PG' },
    { value: 'pg_13', label: 'PG-13' },
    { value: 'r', label: 'R-17' },
    { value: 'r_plus', label: 'R+' },
  ];
  const visibleGenres = genres.slice(0, 18);

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

  const setSingleFilter = <Key extends 'status' | 'score'>(key: Key, value: string) => {
    onFiltersChange({ ...browseFilters, [key]: value });
  };
  const toggleMultiFilter = (key: 'kinds' | 'seasons' | 'genres' | 'ratings', value: string) => {
    const current = browseFilters[key];
    onFiltersChange({
      ...browseFilters,
      [key]: current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    });
  };
  const toggleSection = (sectionId: string) => {
    setCollapsedSections((current) => ({ ...current, [sectionId]: !current[sectionId] }));
  };

  return (
    <div className={styles.filterPanel}>
      <div className={styles.controls}>
        <section className={styles.controlGroup}>
          <h3>{t('catalog.searchTitle')}</h3>
          <label className={styles.search} aria-label={t('catalog.searchTitle')}>
            <input type="search" value={searchQuery} onChange={(event) => onSearchChange(event.target.value)} placeholder={t('catalog.searchPlaceholder')} />
          </label>
        </section>

        <section className={styles.controlGroup} aria-label={t('catalog.sort')}>
          <div className={styles.segmented}>
            {orderOptions.map((option) => (
              <button key={option.value} className={browseOrder === option.value ? styles.activeOption : undefined} type="button" onClick={() => onOrderChange(option.value)}>
                <option.Icon className={styles.orderIcon} aria-hidden="true" />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </section>

        <FilterSection activeCount={browseFilters.status === 'all' ? 0 : 1} collapsed={Boolean(collapsedSections.status)} id="status" title={t('catalog.status')} onToggle={() => toggleSection('status')}>
          <div className={styles.selectBuffer}>
            <FilterSelect label={t('catalog.status')} options={statusOptions} value={browseFilters.status} onChange={(value) => setSingleFilter('status', value)} />
          </div>
        </FilterSection>

        <FilterSection activeCount={browseFilters.score === 'all' ? 0 : 1} collapsed={Boolean(collapsedSections.score)} id="score" title={t('catalog.score')} onToggle={() => toggleSection('score')}>
          <ScoreRange allLabel={t('catalog.filter.all')} value={browseFilters.score} onChange={(value) => setSingleFilter('score', value)} />
        </FilterSection>

        <FilterSection activeCount={browseFilters.kinds.length} collapsed={Boolean(collapsedSections.kind)} id="kind" title={t('catalog.kind')} onToggle={() => toggleSection('kind')}>
          <div className={styles.optionGrid}>
            {kindOptions.map((option) => <FilterCheck key={option.value} checked={browseFilters.kinds.includes(option.value)} label={option.label} onChange={() => toggleMultiFilter('kinds', option.value)} />)}
          </div>
        </FilterSection>

        <FilterSection activeCount={browseFilters.genres.length} collapsed={Boolean(collapsedSections.genre)} id="genre" title={t('catalog.genre')} onToggle={() => toggleSection('genre')}>
          <div className={styles.genreGrid}>
            {genresLoading
              ? Array.from({ length: 8 }, (_, index) => <span className={styles.filterCheckPlaceholder} key={index} />)
              : visibleGenres.map((genre) => {
                const genreId = String(genre.id);
                return <FilterCheck key={genre.id} checked={browseFilters.genres.includes(genreId)} label={language === 'ru' ? genre.titleRu ?? genre.name : genre.name} onChange={() => toggleMultiFilter('genres', genreId)} />;
              })}
          </div>
        </FilterSection>

        <FilterSection activeCount={browseFilters.seasons.length} collapsed={Boolean(collapsedSections.season)} id="season" title={t('catalog.season')} onToggle={() => toggleSection('season')}>
          <div className={styles.optionGrid}>
            {yearOptions.map((year) => <FilterCheck key={year} checked={browseFilters.seasons.includes(String(year))} label={String(year)} onChange={() => toggleMultiFilter('seasons', String(year))} />)}
          </div>
        </FilterSection>

        <FilterSection activeCount={browseFilters.ratings.length} collapsed={Boolean(collapsedSections.rating)} id="rating" title={t('catalog.rating')} onToggle={() => toggleSection('rating')}>
          <div className={styles.optionGrid}>
            {ratingOptions.map((option) => <FilterCheck key={option.value} checked={browseFilters.ratings.includes(option.value)} label={option.label} onChange={() => toggleMultiFilter('ratings', option.value)} />)}
          </div>
        </FilterSection>
      </div>
      <div className={styles.filterFooter}>
        <button
          className={styles.resetButton}
          type="button"
          onClick={() => {
            onSearchChange('');
            onOrderChange('popularity');
            onFiltersChange(defaultCatalogFilters);
          }}
        >
          {t('common.reset')}
        </button>
      </div>
    </div>
  );
}

function buildYearOptions() {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 16 }, (_, index) => currentYear - index);
}

function FilterSection({ activeCount = 0, children, collapsed, id, title, onToggle }: { activeCount?: number; children: ReactNode; collapsed: boolean; id: string; title: string; onToggle: () => void }) {
  const contentId = `catalog-filter-${id}`;
  return (
    <section className={styles.controlGroup}>
      <button className={styles.filterSectionHeader} type="button" aria-expanded={!collapsed} aria-controls={contentId} onClick={onToggle}>
        <span className={styles.filterSectionTitle}>
          <span>{title}</span>
          {collapsed && activeCount > 0 ? <span className={styles.filterSectionBadge}>{activeCount}</span> : null}
        </span>
        <span className={styles.filterSectionChevron} aria-hidden="true" />
      </button>
      <div className={styles.filterSectionBody} id={contentId} aria-hidden={collapsed} data-collapsed={collapsed ? 'true' : 'false'}>
        <div className={styles.filterSectionBodyInner}>{children}</div>
      </div>
    </section>
  );
}

function FilterCheck({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return <label className={styles.filterCheck}><input type="checkbox" checked={checked} onChange={onChange} /><span>{label}</span></label>;
}

function ScoreRange({ allLabel, value, onChange }: { allLabel: string; value: string; onChange: (value: string) => void }) {
  const onChangeRef = useRef(onChange);
  const numericValue = value === 'all' ? 0 : Number(value);
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
  const [draftValue, setDraftValue] = useState(safeValue);
  const draftFilterValue = draftValue === 0 ? 'all' : String(draftValue);
  const draftProgress = (draftValue / 9) * 100;
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { setDraftValue(safeValue); }, [safeValue]);
  useEffect(() => {
    if (draftFilterValue === value) return;
    const timeoutId = window.setTimeout(() => onChangeRef.current(draftFilterValue), 450);
    return () => window.clearTimeout(timeoutId);
  }, [draftFilterValue, value]);
  return (
    <label className={styles.scoreRange} style={{ '--score-progress': `${draftProgress}%`, '--score-thumb-position': `calc(${draftProgress}% + ${(0.5 - draftValue / 9) * 20}px)` } as CSSProperties}>
      <span className={styles.scoreRangeTrack}>
        <span className={styles.scoreRangeTooltip}>{draftValue === 0 ? allLabel : `${draftValue}+`}</span>
        <input type="range" min="0" max="9" step="1" value={draftValue} aria-label={allLabel} onChange={(event) => setDraftValue(Number(event.target.value) || 0)} />
      </span>
      <span className={styles.scoreRangeScale} aria-hidden="true"><span>{allLabel}</span><span>3</span><span>6</span><span>9</span></span>
    </label>
  );
}

function FilterSelect({ label, options, value, onChange }: { label: string; options: Array<{ value: string; label: string }>; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);
  return (
    <div className={styles.filterSelect} ref={rootRef}>
      <button className={styles.filterSelectTrigger} type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span>{selected.label}</span><span className={styles.filterSelectChevron} aria-hidden="true" />
      </button>
      {open ? (
        <div className={styles.filterSelectMenu} role="listbox" aria-label={label}>
          {options.map((option) => (
            <button key={option.value} className={option.value === value ? styles.selectedOption : undefined} type="button" role="option" aria-selected={option.value === value} onClick={() => { onChange(option.value); setOpen(false); }}>
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
