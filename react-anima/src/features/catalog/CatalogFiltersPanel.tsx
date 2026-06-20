import { type ComponentType, type SVGProps, useEffect, useMemo, useRef, useState } from 'react';
import { getCatalogGenres, type CatalogGenre } from '@/api';
import type { CatalogBrowseFilters, CatalogBrowseOrder } from '@hooks/useCatalogBrowse';
import RandomDiceIcon from '@assets/random-dice.svg?react';
import SortNewIcon from '@assets/sort-new.svg?react';
import SortPopularIcon from '@assets/sort-popular.svg?react';
import SortRatingIcon from '@assets/sort-rating.svg?react';
import { useI18n } from '@shared/i18n/I18nProvider';
import { Button, Checkbox, CollapsibleSection, InputField, RangeSlider, Select, Skeleton } from '@shared/ui';
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
          <InputField label={t('catalog.searchTitle')} type="search" value={searchQuery} onChange={(event) => onSearchChange(event.target.value)} placeholder={t('catalog.searchPlaceholder')} />
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

        <CollapsibleSection activeCount={browseFilters.status === 'all' ? 0 : 1} collapsed={Boolean(collapsedSections.status)} id="catalog-status" title={t('catalog.status')} onToggle={() => toggleSection('status')}>
          <div className={styles.selectBuffer}>
            <Select label={t('catalog.status')} options={statusOptions} value={browseFilters.status} onChange={(value) => setSingleFilter('status', value)} />
          </div>
        </CollapsibleSection>

        <CollapsibleSection activeCount={browseFilters.score === 'all' ? 0 : 1} collapsed={Boolean(collapsedSections.score)} id="catalog-score" title={t('catalog.score')} onToggle={() => toggleSection('score')}>
          <ScoreRange allLabel={t('catalog.filter.all')} value={browseFilters.score} onChange={(value) => setSingleFilter('score', value)} />
        </CollapsibleSection>

        <CollapsibleSection activeCount={browseFilters.kinds.length} collapsed={Boolean(collapsedSections.kind)} id="catalog-kind" title={t('catalog.kind')} onToggle={() => toggleSection('kind')}>
          <div className={styles.optionGrid}>
            {kindOptions.map((option) => <FilterCheck key={option.value} checked={browseFilters.kinds.includes(option.value)} label={option.label} onChange={() => toggleMultiFilter('kinds', option.value)} />)}
          </div>
        </CollapsibleSection>

        <CollapsibleSection activeCount={browseFilters.genres.length} collapsed={Boolean(collapsedSections.genre)} id="catalog-genre" title={t('catalog.genre')} onToggle={() => toggleSection('genre')}>
          <div className={styles.genreGrid}>
            {genresLoading
              ? Array.from({ length: 8 }, (_, index) => <Skeleton className={styles.filterCheckPlaceholder} key={index} />)
              : visibleGenres.map((genre) => {
                const genreId = String(genre.id);
                return <FilterCheck key={genre.id} checked={browseFilters.genres.includes(genreId)} label={language === 'ru' ? genre.titleRu ?? genre.name : genre.name} onChange={() => toggleMultiFilter('genres', genreId)} />;
              })}
          </div>
        </CollapsibleSection>

        <CollapsibleSection activeCount={browseFilters.seasons.length} collapsed={Boolean(collapsedSections.season)} id="catalog-season" title={t('catalog.season')} onToggle={() => toggleSection('season')}>
          <div className={styles.optionGrid}>
            {yearOptions.map((year) => <FilterCheck key={year} checked={browseFilters.seasons.includes(String(year))} label={String(year)} onChange={() => toggleMultiFilter('seasons', String(year))} />)}
          </div>
        </CollapsibleSection>

        <CollapsibleSection activeCount={browseFilters.ratings.length} collapsed={Boolean(collapsedSections.rating)} id="catalog-rating" title={t('catalog.rating')} onToggle={() => toggleSection('rating')}>
          <div className={styles.optionGrid}>
            {ratingOptions.map((option) => <FilterCheck key={option.value} checked={browseFilters.ratings.includes(option.value)} label={option.label} onChange={() => toggleMultiFilter('ratings', option.value)} />)}
          </div>
        </CollapsibleSection>
      </div>
      <div className={styles.filterFooter}>
        <Button
          className={styles.resetButton}
          variant="tonal"
          onClick={() => {
            onSearchChange('');
            onOrderChange('popularity');
            onFiltersChange(defaultCatalogFilters);
          }}
        >
          {t('common.reset')}
        </Button>
      </div>
    </div>
  );
}

function buildYearOptions() {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 16 }, (_, index) => currentYear - index);
}

function FilterCheck({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return <Checkbox checked={checked} label={label} onChange={onChange} />;
}

function ScoreRange({ allLabel, value, onChange }: { allLabel: string; value: string; onChange: (value: string) => void }) {
  const onChangeRef = useRef(onChange);
  const numericValue = value === 'all' ? 0 : Number(value);
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
  const [draftValue, setDraftValue] = useState(safeValue);
  const draftFilterValue = draftValue === 0 ? 'all' : String(draftValue);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { setDraftValue(safeValue); }, [safeValue]);
  useEffect(() => {
    if (draftFilterValue === value) return;
    const timeoutId = window.setTimeout(() => onChangeRef.current(draftFilterValue), 450);
    return () => window.clearTimeout(timeoutId);
  }, [draftFilterValue, value]);
  return (
    <RangeSlider
      min={0}
      max={9}
      step={1}
      value={draftValue}
      aria-label={allLabel}
      marks={[allLabel, '3', '6', '9']}
      formatValue={(current) => current === 0 ? allLabel : `${current}+`}
      onChange={(current) => setDraftValue(current || 0)}
    />
  );
}
