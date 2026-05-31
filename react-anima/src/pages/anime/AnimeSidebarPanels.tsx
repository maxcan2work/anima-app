import clsx from 'clsx';
import type { CSSProperties } from 'react';
import { getAnimeOriginalDisplayTitle, getLocalizedAnimeTitle } from '@anima/core';
import type { AnimeExtendedDetails, PlayerProviderResult } from '@/api';
import CalendarIcon from '@assets/calendar.svg?react';
import DiaryIcon from '@assets/pencil.svg?react';
import InfoIcon from '@assets/description.svg?react';
import starIcon from '@assets/star.svg';
import StudioIcon from '@assets/studio.svg?react';
import WatchTabIcon from '@assets/tv-alt.svg?react';
import tvIcon from '@assets/tv-alt.svg';
import type { AnimeTitle } from '@/data';
import { useI18n } from '@shared/i18n/I18nProvider';
import { Tooltip } from '@shared/ui/Tooltip';
import { AnimeDetailsSections } from './AnimeDetailsSections';
import type { AnimePageTab, PlayerProvider, WatchState } from './AnimeHero.types';
import { PlayerProviderSelect, WatchSources, WatchStatusSelect } from './AnimePlayerControls';
import styles from './AnimeHero.module.css';

export function AnimeOverviewPanel({
  anime,
  details,
  detailsLoading,
  detailsError,
  onOpenSimilar,
}: {
  anime: AnimeTitle;
  details: AnimeExtendedDetails | null;
  detailsLoading: boolean;
  detailsError: boolean;
  onOpenSimilar: (path: string) => void;
}) {
  const { t } = useI18n();

  return (
    <div className={styles.sidebarInfoPanel}>
      <section className={styles.detailsSection}>
        <h3>{t('anime.description')}</h3>
        <p>{anime.description || t('random.noDescription')}</p>
      </section>
      <AnimeDetailsSections details={details} loading={detailsLoading} error={detailsError} section="rest" onOpenSimilar={onOpenSimilar} />
      <AnimeDetailsSections details={details} loading={detailsLoading} error={detailsError} section="similar" onOpenSimilar={onOpenSimilar} />
      <WatchSources anime={anime} />
    </div>
  );
}

export function AnimeDiaryPanel({
  status,
  diaryScore,
  diaryReview,
  saving,
  onStatusChange,
  onScoreChange,
  onReviewChange,
  onSave,
}: {
  status: WatchState['status'];
  diaryScore: number | null;
  diaryReview: string;
  saving: boolean;
  onStatusChange: (status: WatchState['status']) => void;
  onScoreChange: (score: number | null) => void;
  onReviewChange: (review: string) => void;
  onSave: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className={styles.sidebarInfoPanel}>
      <div className={styles.watchStatusTools}>
        <h3>{t('catalog.status')}</h3>
        <WatchStatusSelect value={status} onChange={onStatusChange} />
      </div>
      <section className={styles.diaryField}>
        <h3>{t('anime.diaryScore')}</h3>
        <div
          className={styles.diaryScoreRange}
          style={{
            '--score-progress': `${((diaryScore ?? 0) / 10) * 100}%`,
            '--score-thumb-position': `${((diaryScore ?? 0) / 10) * 100}%`,
          } as CSSProperties}
        >
          <span className={styles.diaryScoreHeader}>
            <span>
              <img src={starIcon} alt="" aria-hidden="true" />
              {diaryScore == null ? t('common.none') : `${diaryScore}/10`}
            </span>
            <button type="button" onClick={onSave} disabled={saving}>
              {saving ? '...' : t('anime.diarySave')}
            </button>
          </span>
          <span className={styles.diaryScoreRangeTrack}>
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={diaryScore ?? 0}
              aria-label={t('anime.diaryScore')}
              onChange={(event) => {
                const score = Number(event.target.value);
                onScoreChange(score > 0 ? score : null);
              }}
            />
          </span>
          <span className={styles.diaryScoreRangeScale} aria-hidden="true">
            <span style={{ left: '0%' }}>{t('common.none')}</span>
            <span style={{ left: '30%' }}>3</span>
            <span style={{ left: '60%' }}>6</span>
            <span style={{ left: '100%' }}>10</span>
          </span>
        </div>
        <h3>{t('anime.diaryReview')}</h3>
        <textarea
          value={diaryReview}
          onChange={(event) => onReviewChange(event.target.value)}
          placeholder={t('anime.diaryReviewPlaceholder')}
          rows={6}
        />
      </section>
    </div>
  );
}

export function AnimeWatchPanel({
  anime,
  players,
  activeProviderName,
  showReviews,
  reviewsCount,
  onProviderChange,
  onToggleReviews,
}: {
  anime: AnimeTitle;
  players: PlayerProviderResult[];
  activeProviderName: PlayerProvider;
  showReviews: boolean;
  reviewsCount: number;
  onProviderChange: (provider: PlayerProvider) => void;
  onToggleReviews: () => void;
}) {
  const { language, t } = useI18n();
  const animeTitle = getLocalizedAnimeTitle(anime, language);
  const animeSecondaryTitle = getAnimeOriginalDisplayTitle(anime, language);

  return (
    <>
      <div className={styles.detailsPoster}>
        <img src={anime.poster} alt="" />
        <div>
          {animeSecondaryTitle ? <p className="eyebrow">{animeSecondaryTitle}</p> : null}
          <h2>{animeTitle}</h2>
        </div>
      </div>
      <div className={styles.detailsContent}>
        <GenreChips genres={anime.genres} ariaLabel={t('catalog.genre')} />
      </div>

      <div className={styles.watchContextGrid}>
        <span>
          <CalendarIcon aria-hidden="true" />
          <small>{t('catalog.season')}</small>
          <strong>{anime.year}</strong>
        </span>
        <span>
          <img src={tvIcon} alt="" aria-hidden="true" />
          <small>{t('anime.episodesCount')}</small>
          <strong>{anime.episodes}</strong>
        </span>
        <span>
          <StudioIcon aria-hidden="true" />
          <small>{t('anime.studio')}</small>
          <strong>{anime.studio}</strong>
        </span>
        <span>
          <img src={starIcon} alt="" aria-hidden="true" />
          <small>{t('catalog.score')}</small>
          <strong>{anime.rating}</strong>
        </span>
      </div>

      <div className={styles.watchTools}>
        <PlayerProviderSelect players={players} value={activeProviderName} onChange={onProviderChange} />
        <button
          className={clsx(styles.reviewsToggle, showReviews && styles.reviewsToggleActive)}
          type="button"
          onClick={onToggleReviews}
          aria-pressed={showReviews}
        >
          {showReviews ? t('anime.backToPlayer') : t('anime.reviewsButton', { count: reviewsCount })}
        </button>
      </div>
    </>
  );
}

export function AnimeLocalTabs({
  activeTab,
  onChange,
}: {
  activeTab: AnimePageTab;
  onChange: (tab: AnimePageTab) => void;
}) {
  const { t } = useI18n();
  const pageTabs: Array<{ value: AnimePageTab; label: string; Icon: typeof WatchTabIcon }> = [
    { value: 'watch', label: t('anime.tab.watch'), Icon: WatchTabIcon },
    { value: 'overview', label: t('anime.tab.overview'), Icon: InfoIcon },
    { value: 'diary', label: t('anime.tab.diary'), Icon: DiaryIcon },
  ];

  return (
    <div className={styles.localTabs} aria-label={t('anime.localNavigation')}>
      {pageTabs.map((tab) => (
        <Tooltip key={tab.value} label={tab.label} placement="top">
          <button
            className={activeTab === tab.value ? styles.localTabActive : undefined}
            type="button"
            onClick={() => onChange(tab.value)}
            aria-label={tab.label}
            aria-pressed={activeTab === tab.value}
          >
            <tab.Icon aria-hidden="true" />
          </button>
        </Tooltip>
      ))}
    </div>
  );
}

function GenreChips({ genres, ariaLabel }: { genres: string[]; ariaLabel: string }) {
  if (genres.length === 0) return null;

  return (
    <div className={styles.genreChips} aria-label={ariaLabel}>
      {genres.map((genre) => (
        <span key={genre}>{genre}</span>
      ))}
    </div>
  );
}
