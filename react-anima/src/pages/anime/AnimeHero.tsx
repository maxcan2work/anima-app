import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  getAnimeExtendedDetails,
  getAnimeReviews,
  getEpisodePlayers,
  saveAnimeProgress,
  type AnimeExtendedDetails,
  type AnimeReview,
  type PlayerProviderResult,
} from '@/api';
import episodeArrowIcon from '@assets/episode-arrow.svg';
import type { AnimeTitle } from '@/data';
import { useNavigation } from '@features/navigation/NavigationProvider';
import { useI18n } from '@shared/i18n/I18nProvider';
import { animeRouteSlug } from '@shared/navigation';
import { useToast } from '@shared/ui/ToastProvider';

import { EPISODES_PER_PAGE, TAB_TO_MODE } from './AnimeHero.constants';
import type { AnimeHeroProps, AnimePageTab, PlayerProvider } from './AnimeHero.types';
import { PlayerMessage, PlayerLoader, VideoPlayer, isPlayablePlayer, orderWatchPartyPlayers } from './AnimePlayerControls';
import { ReviewsPanel } from './AnimeReviewsPanel';
import { AnimeDiaryPanel, AnimeLocalTabs, AnimeOverviewPanel, AnimeWatchPanel } from './AnimeSidebarPanels';
import styles from './AnimeHero.module.css';

export { AnimeHeroSkeleton } from './AnimeHeroSkeleton';

export function AnimeHero({
  anime,
  state,
  diaryScore: savedDiaryScore = null,
  diaryReview: savedDiaryReview = null,
  onDiaryEntrySaved,
  onStateChange,
  mode = 'default',
  playbackSync,
  sidebarExtra,
  footerExtra,
}: AnimeHeroProps) {
  const { t } = useI18n();
  const { requestAnimeRoute } = useNavigation();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const initialReviewRoute = getReviewRoute(location.pathname);
  const [searchParams, setSearchParams] = useSearchParams();
  const [players, setPlayers] = useState<PlayerProviderResult[]>([]);
  const [playersStatus, setPlayersStatus] = useState('');
  const [selectedProviderName, setSelectedProviderName] = useState<PlayerProvider>('kodik');
  const [episodePage, setEpisodePage] = useState(0);
  const [episodePageDirection, setEpisodePageDirection] = useState<'next' | 'prev'>('next');
  const [activeTab, setActiveTab] = useState<AnimePageTab>('watch');
  const [details, setDetails] = useState<AnimeExtendedDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(false);
  const [diaryScore, setDiaryScore] = useState<number | null>(savedDiaryScore);
  const [diaryReview, setDiaryReview] = useState(savedDiaryReview ?? '');
  const [diarySaving, setDiarySaving] = useState(false);
  const [reviews, setReviews] = useState<AnimeReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState(false);
  const [showReviews, setShowReviews] = useState(Boolean(initialReviewRoute));
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(initialReviewRoute?.reviewId ?? null);
  const playablePlayers = players.filter((player) => isPlayablePlayer(player) && (mode !== 'watchParty' || player.provider === 'anilibria'));
  const preferredPlayers = mode === 'watchParty' ? orderWatchPartyPlayers(playablePlayers) : playablePlayers;
  const selectedProviderPlayer = preferredPlayers.find((player) => player.provider === selectedProviderName);
  const selectedPlayer = mode === 'watchParty'
    ? preferredPlayers[0]
    : selectedProviderPlayer ?? preferredPlayers[0] ?? players[0];
  const activeProviderName = selectedPlayer?.provider ?? selectedProviderName;
  const selectedReview = reviews.find((review) => review.id === selectedReviewId) ?? null;
  const episodePages = Math.max(1, Math.ceil(anime.episodes / EPISODES_PER_PAGE));
  const visibleEpisodes = useMemo(() => {
    const start = episodePage * EPISODES_PER_PAGE + 1;
    const end = Math.min(anime.episodes, start + EPISODES_PER_PAGE - 1);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [anime.episodes, episodePage]);

  useEffect(() => {
    setActiveTab(getTabFromMode(searchParams.get('mode')));
  }, [searchParams]);

  useEffect(() => {
    setDiaryScore(savedDiaryScore);
    setDiaryReview(savedDiaryReview ?? '');
  }, [anime.id, savedDiaryReview, savedDiaryScore]);

  useEffect(() => {
    setEpisodePage((currentPage) => {
      const nextPage = Math.min(episodePages - 1, Math.floor((state.episode - 1) / EPISODES_PER_PAGE));
      if (nextPage !== currentPage) {
        setEpisodePageDirection(nextPage > currentPage ? 'next' : 'prev');
      }
      return nextPage;
    });
  }, [anime.id, episodePages, state.episode]);

  function changeEpisodePage(nextPage: number) {
    setEpisodePage((currentPage) => {
      const clampedPage = Math.min(Math.max(nextPage, 0), episodePages - 1);
      if (clampedPage !== currentPage) {
        setEpisodePageDirection(clampedPage > currentPage ? 'next' : 'prev');
      }
      return clampedPage;
    });
  }

  function changeTab(tab: AnimePageTab) {
    setActiveTab(tab);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      const modeParam = TAB_TO_MODE[tab];
      if (modeParam) {
        next.set('mode', modeParam);
      } else {
        next.delete('mode');
      }
      return next;
    }, { replace: true });
  }

  async function saveDiaryEntry() {
    setDiarySaving(true);
    try {
      const { entry } = await saveAnimeProgress(anime.id, {
        status: state.status,
        currentEpisode: state.episode,
        score: diaryScore,
        review: diaryReview.trim() || null,
      });
      onDiaryEntrySaved?.(entry);
      toast({ message: t('anime.diarySaved'), variant: 'success' });
    } catch {
      toast({ message: t('anime.diarySaveFailed'), variant: 'danger' });
    } finally {
      setDiarySaving(false);
    }
  }

  useEffect(() => {
    let ignore = false;

    async function loadPlayers() {
      setPlayers([]);
      setPlayersStatus('');
      try {
        const response = await getEpisodePlayers(anime.id, state.episode);
        if (ignore) return;

        setPlayers(response.providers);
        const hasPlayableProvider = response.providers.some((player) => isPlayablePlayer(player) && (mode !== 'watchParty' || player.provider === 'anilibria'));
        setPlayersStatus(hasPlayableProvider ? '' : 'Видео с данным тайтлом не найдено');
      } catch {
        if (!ignore) {
          setPlayers([]);
          setPlayersStatus('Не удалось загрузить плеер');
        }
      }
    }

    loadPlayers();

    return () => {
      ignore = true;
    };
  }, [anime.id, mode, state.episode]);

  useEffect(() => {
    setDetails(null);
    setDetailsError(false);
    setReviews([]);
    setReviewsError(false);
    setShowReviews(false);
    setSelectedReviewId(null);
  }, [anime.id]);

  useEffect(() => {
    const reviewRoute = getReviewRoute(location.pathname);
    if (!reviewRoute) {
      setShowReviews(false);
      setSelectedReviewId(null);
      return;
    }

    const routeSlug = animeRouteSlug(anime);
    if (reviewRoute.animeId !== anime.id && reviewRoute.animeId !== routeSlug) return;

    setShowReviews(true);
    setSelectedReviewId(reviewRoute.reviewId ?? null);
  }, [anime, location.pathname]);

  useEffect(() => {
    if (mode !== 'default' || !showReviews) return;

    let ignore = false;
    setReviewsLoading(true);
    setReviewsError(false);

    getAnimeReviews(anime.id)
      .then((response) => {
        if (ignore) return;
        setReviews(response.reviews);
      })
      .catch(() => {
        if (!ignore) setReviewsError(true);
      })
      .finally(() => {
        if (!ignore) setReviewsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [anime.id, mode, showReviews]);

  useEffect(() => {
    if (mode !== 'default' || activeTab !== 'overview' || details) return;

    let ignore = false;
    setDetailsLoading(true);
    setDetailsError(false);

    getAnimeExtendedDetails(anime.id)
      .then((response) => {
        if (!ignore) setDetails(response.details);
      })
      .catch(() => {
        if (!ignore) setDetailsError(true);
      })
      .finally(() => {
        if (!ignore) setDetailsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [activeTab, anime.id, details, mode]);

  const episodeControls = (
    <section className={styles.episodes} aria-label="Серии">
      <button
        className={styles.episodeScroll}
        type="button"
        onClick={() => changeEpisodePage(episodePage - 1)}
        disabled={episodePage === 0}
        aria-label="Предыдущие серии"
      >
        <img src={episodeArrowIcon} alt="" aria-hidden="true" />
      </button>
      <div key={episodePage} className={clsx(styles.episodeGrid, episodePageDirection === 'next' ? styles.pageNext : styles.pagePrev)}>
        {visibleEpisodes.map((episode) => (
          <button
            key={episode}
            className={clsx(episode === state.episode && styles.currentEpisode)}
            onClick={() => onStateChange({ episode, status: 'watching' })}
          >
            {episode}
          </button>
        ))}
      </div>
      <button
        className={clsx(styles.episodeScroll, styles.episodeScrollNext)}
        type="button"
        onClick={() => changeEpisodePage(episodePage + 1)}
        disabled={episodePage >= episodePages - 1}
        aria-label="Следующие серии"
      >
        <img src={episodeArrowIcon} alt="" aria-hidden="true" />
      </button>
    </section>
  );
  return (
    <div className={clsx(styles.layout, mode === 'watchParty' && styles.watchPartyLayout)}>
      <section className={clsx(styles.player, showReviews && mode === 'default' && styles.playerReviews)}>
        {showReviews && mode === 'default' ? (
          <ReviewsPanel
            anime={anime}
            reviews={reviews}
            loading={reviewsLoading}
            error={reviewsError}
            selectedReview={selectedReview}
            onSelectReview={(reviewId) => {
              navigate(`${animeReviewBaseRoute(anime)}/${encodeURIComponent(reviewId)}`);
            }}
            onBack={() => {
              navigate(animeReviewBaseRoute(anime));
            }}
            onReviewSaved={(review) => {
              setReviews((current) => {
                const exists = current.some((item) => item.id === review.id);
                return exists
                  ? current.map((item) => item.id === review.id ? review : item)
                  : [review, ...current];
              });
              setSelectedReviewId(review.id);
              navigate(`${animeReviewBaseRoute(anime)}/${encodeURIComponent(review.id)}`);
            }}
          />
        ) : selectedPlayer && isPlayablePlayer(selectedPlayer) ? (
          <VideoPlayer anime={anime} player={selectedPlayer} playbackSync={mode === 'watchParty' ? playbackSync : undefined} />
        ) : (
          <div className={styles.videoFrame}>
            {playersStatus ? <PlayerMessage message={playersStatus} /> : <PlayerLoader />}
          </div>
        )}

        {mode === 'default' && !showReviews ? episodeControls : null}
      </section>

      <aside className={styles.detailsPanel}>
        <div className={styles.detailsPanelContent}>
          {activeTab === 'overview' ? (
            <AnimeOverviewPanel
              anime={anime}
              details={details}
              detailsLoading={detailsLoading}
              detailsError={detailsError}
              onOpenSimilar={requestAnimeRoute}
            />
          ) : activeTab === 'diary' ? (
            <AnimeDiaryPanel
              status={state.status}
              diaryScore={diaryScore}
              diaryReview={diaryReview}
              saving={diarySaving}
              onStatusChange={(status) => onStateChange({ status })}
              onScoreChange={setDiaryScore}
              onReviewChange={setDiaryReview}
              onSave={() => void saveDiaryEntry()}
            />
          ) : mode === 'default' ? (
            <AnimeWatchPanel
              anime={anime}
              players={players}
              activeProviderName={activeProviderName}
              showReviews={showReviews}
              reviewsCount={reviews.length}
              onProviderChange={setSelectedProviderName}
              onToggleReviews={() => {
                navigate(showReviews ? `/anime/${animeRouteSlug(anime)}` : animeReviewBaseRoute(anime));
              }}
            />
          ) : null}
          {sidebarExtra ? <div className={styles.watchPartyPanel}>{sidebarExtra}</div> : null}
        </div>
        {mode === 'default' ? (
          <AnimeLocalTabs activeTab={activeTab} onChange={changeTab} />
        ) : null}
      </aside>
      {mode === 'watchParty' ? (
        <div className={styles.watchPartyFooter}>
          {episodeControls}
          {footerExtra ? <div className={styles.watchPartyActions}>{footerExtra}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

function getTabFromMode(mode: string | null): AnimePageTab {
  if (mode === 'info' || mode === 'overview') return 'overview';
  if (mode === 'diary') return 'diary';
  return 'watch';
}

function animeReviewBaseRoute(anime: AnimeTitle) {
  return `/anime/${animeRouteSlug(anime)}/reviews`;
}

function getReviewRoute(pathname: string) {
  const match = pathname.match(/^\/anime\/([^/]+)\/reviews(?:\/([^/]+))?$/);
  if (!match?.[1]) return null;

  return {
    animeId: decodeURIComponent(match[1]),
    reviewId: match[2] ? decodeURIComponent(match[2]) : null,
  };
}
