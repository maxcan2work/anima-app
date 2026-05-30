import clsx from 'clsx';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { getAnimeOriginalDisplayTitle, getLocalizedAnimeTitle, WATCH_STATUS_OPTIONS, type WatchStatus } from '@anima/core';
import {
  getAnimeExtendedDetails,
  getEpisodePlayers,
  importCatalogAnime,
  saveAnimeProgress,
  type AnimeExtendedDetails,
  type CatalogSearchResult,
  type PlayerProviderResult,
  type ServerWatchEntry,
} from '@/api';
import CalendarIcon from '@assets/calendar.svg?react';
import clockIcon from '@assets/clock-three.svg';
import DiaryIcon from '@assets/pencil.svg?react';
import InfoIcon from '@assets/description.svg?react';
import episodeArrowIcon from '@assets/episode-arrow.svg';
import shikimoriIcon from '@assets/shikimori.png';
import SpoilerOffIcon from '@assets/spoiler-off.svg?react';
import SpoilerWarningIcon from '@assets/spoiler-warning.svg?react';
import starIcon from '@assets/star.svg';
import StudioIcon from '@assets/studio.svg?react';
import ThumbUpIcon from '@assets/thumb-up.svg?react';
import WatchTabIcon from '@assets/tv-alt.svg?react';
import tvIcon from '@assets/tv-alt.svg';
import type { AnimeTitle } from '@/data';
import { useNavigation } from '@features/navigation/NavigationProvider';
import { useI18n } from '@shared/i18n/I18nProvider';
import { animeRouteFromCatalog, animeRouteSlug } from '@shared/navigation';
import { Tooltip } from '@shared/ui/Tooltip';
import { useToast } from '@shared/ui/ToastProvider';
import { ControlledVideoPlayer, type PlaybackSync, type PlaybackSyncState } from './ControlledVideoPlayer';
import styles from './AnimeHero.module.css';

type PlayerProvider = PlayerProviderResult['provider'];

type WatchState = {
  episode: number;
  status: WatchStatus;
};

type AnimePageTab = 'watch' | 'overview' | 'diary';
type AnimePageMode = 'info' | 'diary';
type ReviewSortKey = 'recent' | 'score' | 'reaction';
type SortDirection = 'desc' | 'asc';

type ReviewDraft = {
  title: string;
  body: string;
  overallScore: number;
  recommended: boolean;
  hasSpoilers: boolean;
  aspectScores: MockReview['scores'];
};

type AnimeHeroProps = {
  anime: AnimeTitle;
  state: WatchState;
  diaryScore?: number | null;
  diaryReview?: string | null;
  onDiaryEntrySaved?: (entry: ServerWatchEntry) => void;
  onStateChange: (patch: Partial<WatchState>) => void;
  mode?: 'default' | 'watchParty';
  playbackSync?: PlaybackSync;
  sidebarExtra?: ReactNode;
  footerExtra?: ReactNode;
};

const EPISODES_PER_PAGE = 12;
const PLAYER_PROVIDER_OPTIONS: Array<{ value: PlayerProvider; label: string }> = [
  { value: 'kodik', label: 'Kodik' },
  { value: 'anilibria', label: 'AniLiberty' },
];
const TAB_TO_MODE: Partial<Record<AnimePageTab, AnimePageMode>> = {
  overview: 'info',
  diary: 'diary',
};

type MockReview = {
  id: string;
  author: string;
  avatarLabel: string;
  score: number;
  watched: number;
  reviewsCount: number;
  helpfulCount: number;
  likes: number;
  dislikes: number;
  createdAt: string;
  recommended: boolean;
  hasSpoilers: boolean;
  scores: {
    story: number;
    characters: number;
    visuals: number;
    music: number;
    opening: number;
    atmosphere: number;
  };
  title: string;
  excerpt: string;
  body: string;
  bodyExtra?: string[];
};

const MOCK_REVIEWS: MockReview[] = [
  {
    id: 'quiet-aftertaste',
    author: 'Mira',
    avatarLabel: 'M',
    score: 8,
    watched: 142,
    reviewsCount: 18,
    helpfulCount: 64,
    likes: 48,
    dislikes: 3,
    createdAt: '2026-05-28',
    recommended: true,
    hasSpoilers: false,
    scores: { story: 8, characters: 8, visuals: 7, music: 9, opening: 8, atmosphere: 9 },
    bodyExtra: [
      'Дальше тайтл особенно хорошо раскрывается через мелкие повторяющиеся детали: взгляды, короткие паузы, бытовые сцены и то, как персонажи постепенно меняют отношение друг к другу. В таких моментах сериал не пытается объяснить каждую эмоцию напрямую, а даёт зрителю собрать впечатление самостоятельно.',
      'Отдельно хочется отметить работу с темпом. Здесь почти нет ощущения, что серия просто заполняет хронометраж: даже спокойные эпизоды либо двигают отношения, либо добавляют новый оттенок к уже знакомому конфликту. Из-за этого история воспринимается цельной, хотя формально в ней много небольших сцен.',
      'Визуально тайтл не всегда пытается удивлять сложной постановкой, но у него есть аккуратность. Фоны, цветовые акценты и композиция часто работают на настроение, а не просто закрывают техническую задачу. Особенно хорошо смотрятся тихие сцены, где камера будто оставляет героям немного воздуха.',
      'Музыка тоже держит правильную дистанцию. Она редко перетягивает внимание на себя, зато хорошо подхватывает кульминации и делает некоторые сцены теплее. Опенинг после нескольких серий начинает восприниматься не как отдельный клип, а как часть общего настроения.',
      'Если искать минусы, то часть второстепенных линий можно было бы раскрыть смелее. Иногда кажется, что авторы останавливаются ровно в тот момент, когда конфликт мог стать глубже. Но это не ломает общий эффект: скорее оставляет ощущение, что у мира и персонажей есть запас, который хочется увидеть дальше.',
      'В итоге это не тот тайтл, который обязательно поражает одной большой сценой. Он работает иначе: собирает доверие постепенно и выигрывает за счёт аккуратного настроения. Именно поэтому после просмотра остаётся желание не спорить о сильных и слабых сторонах, а просто ещё немного побыть в этой истории.',
      'Во второй половине особенно заметно, что история держится не только на главной линии, но и на том, как меняется поведение персонажей в обычных ситуациях. Кто-то начинает говорить прямее, кто-то наоборот замыкается, и эти маленькие сдвиги работают сильнее, чем очередной большой монолог о чувствах.',
      'Мне понравилось, что тайтл не боится оставлять некоторые сцены недосказанными. Не каждый конфликт получает мгновенное объяснение, не каждая реплика сразу становится очевидной. Благодаря этому появляется ощущение живого пространства, где персонажи существуют не только ради следующего сюжетного поворота.',
      'При этом сериал не идеален в распределении внимания. Иногда второстепенные герои появляются ровно настолько, чтобы напомнить о себе, но не получают полноценного эпизода. Это немного расстраивает, потому что у многих из них есть потенциал, и хочется, чтобы камера задерживалась на них дольше.',
      'С эмоциональной стороны тайтл работает аккуратно. Он не выкручивает каждую драматичную сцену на максимум и не требует от зрителя обязательной реакции. Скорее он складывает настроение слой за слоем, и уже ближе к финалу понимаешь, что привязался к происходящему сильнее, чем ожидал в начале.',
      'Отдельно стоит сказать про повторный просмотр. Некоторые ранние сцены после знания дальнейших событий воспринимаются иначе: жесты, интонации и паузы получают дополнительный смысл. Это хороший признак для истории, которая хочет быть не просто набором событий, а цельным переживанием.',
      'Я бы рекомендовал смотреть этот тайтл без спешки. Он лучше раскрывается, если не пытаться проглотить всё за один вечер, а дать сериям немного отлежаться. Тогда спокойный темп перестаёт казаться недостатком и становится частью того, зачем вообще включать именно эту историю.',
    ],
    title: 'Хороший темп и сильная атмосфера',
    excerpt: 'Сначала кажется, что история разгоняется медленно, но ближе к середине становится понятно, зачем она так бережно собирает детали.',
    body: 'Сначала кажется, что история разгоняется медленно, но ближе к середине становится понятно, зачем она так бережно собирает детали. Здесь хорошо работает настроение: сцены не пытаются постоянно давить драмой, но оставляют приятное послевкусие после каждой серии. Особенно понравилось, как тайтл обращается с паузами и маленькими бытовыми моментами.',
  },
  {
    id: 'visual-pulse',
    author: 'Kaito',
    avatarLabel: 'K',
    score: 9,
    watched: 318,
    reviewsCount: 42,
    helpfulCount: 217,
    likes: 156,
    dislikes: 12,
    createdAt: '2026-05-21',
    recommended: true,
    hasSpoilers: false,
    scores: { story: 7, characters: 8, visuals: 10, music: 9, opening: 9, atmosphere: 8 },
    title: 'Визуально цепляет сильнее сюжета',
    excerpt: 'Самое заметное здесь — постановка сцен. Даже простые разговоры выглядят живо, а экшен не разваливается на шум.',
    body: 'Самое заметное здесь — постановка сцен. Даже простые разговоры выглядят живо, а экшен не разваливается на шум. Сюжет местами идёт знакомыми дорогами, зато режиссура и музыка вытаскивают почти каждую важную сцену. Для меня это тот случай, когда стиль не заменяет содержание, а аккуратно держит его в тонусе.',
  },
  {
    id: 'warm-characters',
    author: 'Nika',
    avatarLabel: 'N',
    score: 7,
    watched: 86,
    reviewsCount: 11,
    helpfulCount: 39,
    likes: 31,
    dislikes: 8,
    createdAt: '2026-04-12',
    recommended: true,
    hasSpoilers: true,
    scores: { story: 7, characters: 9, visuals: 7, music: 7, opening: 6, atmosphere: 8 },
    title: 'Персонажи делают половину работы',
    excerpt: 'Не все арки одинаково сильные, зато герои быстро становятся своими. За ними приятно наблюдать даже вне главного конфликта.',
    body: 'Не все арки одинаково сильные, зато герои быстро становятся своими. За ними приятно наблюдать даже вне главного конфликта. Иногда хочется чуть меньше объяснений и чуть больше доверия к зрителю, но в целом эмоциональные сцены попадают туда, куда нужно.',
  },
  {
    id: 'mixed-ending',
    author: 'Rei',
    avatarLabel: 'R',
    score: 6,
    watched: 204,
    reviewsCount: 27,
    helpfulCount: 91,
    likes: 73,
    dislikes: 19,
    createdAt: '2026-03-30',
    recommended: false,
    hasSpoilers: true,
    scores: { story: 6, characters: 7, visuals: 8, music: 7, opening: 7, atmosphere: 6 },
    title: 'Финал спорный, но путь стоил того',
    excerpt: 'К концовке есть вопросы: часть решений выглядит резковато. Но отдельные серии до неё всё равно очень крепкие.',
    body: 'К концовке есть вопросы: часть решений выглядит резковато. Но отдельные серии до неё всё равно очень крепкие. Если смотреть ради атмосферы, персонажей и отдельных сцен, тайтл работает хорошо. Если ждать идеально собранной развязки, впечатление может быть неровным.',
  },
];

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
  const { language, t } = useI18n();
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
  const [showReviews, setShowReviews] = useState(Boolean(initialReviewRoute));
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(
    initialReviewRoute?.reviewId && MOCK_REVIEWS.some((review) => review.id === initialReviewRoute.reviewId) ? initialReviewRoute.reviewId : null,
  );
  const playablePlayers = players.filter((player) => isPlayablePlayer(player) && (mode !== 'watchParty' || player.provider === 'anilibria'));
  const preferredPlayers = mode === 'watchParty' ? orderWatchPartyPlayers(playablePlayers) : playablePlayers;
  const selectedProviderPlayer = preferredPlayers.find((player) => player.provider === selectedProviderName);
  const selectedPlayer = mode === 'watchParty'
    ? preferredPlayers[0]
    : selectedProviderPlayer ?? preferredPlayers[0] ?? players[0];
  const activeProviderName = selectedPlayer?.provider ?? selectedProviderName;
  const animeTitle = getLocalizedAnimeTitle(anime, language);
  const animeSecondaryTitle = getAnimeOriginalDisplayTitle(anime, language);
  const selectedReview = MOCK_REVIEWS.find((review) => review.id === selectedReviewId) ?? null;
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
    setSelectedReviewId(reviewRoute.reviewId && MOCK_REVIEWS.some((review) => review.id === reviewRoute.reviewId) ? reviewRoute.reviewId : null);
  }, [anime, location.pathname]);

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
  const pageTabs: Array<{ value: AnimePageTab; label: string; Icon: typeof WatchTabIcon }> = [
    { value: 'watch', label: t('anime.tab.watch'), Icon: WatchTabIcon },
    { value: 'overview', label: t('anime.tab.overview'), Icon: InfoIcon },
    { value: 'diary', label: t('anime.tab.diary'), Icon: DiaryIcon },
  ];

  return (
    <div className={clsx(styles.layout, mode === 'watchParty' && styles.watchPartyLayout)}>
      <section className={clsx(styles.player, showReviews && mode === 'default' && styles.playerReviews)}>
        {showReviews && mode === 'default' ? (
          <ReviewsPanel
            anime={anime}
            reviews={MOCK_REVIEWS}
            selectedReview={selectedReview}
            onSelectReview={(reviewId) => {
              navigate(`${animeReviewBaseRoute(anime)}/${encodeURIComponent(reviewId)}`);
            }}
            onBack={() => {
              navigate(animeReviewBaseRoute(anime));
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
            <div className={styles.sidebarInfoPanel}>
              <section className={styles.detailsSection}>
                <h3>{t('anime.description')}</h3>
                <p>{anime.description || t('random.noDescription')}</p>
              </section>
              <AnimeDetailsSections details={details} loading={detailsLoading} error={detailsError} section="rest" onOpenSimilar={requestAnimeRoute} />
              <AnimeDetailsSections details={details} loading={detailsLoading} error={detailsError} section="similar" onOpenSimilar={requestAnimeRoute} />
              <WatchSources anime={anime} />
            </div>
          ) : activeTab === 'diary' ? (
            <div className={styles.sidebarInfoPanel}>
              <div className={styles.watchStatusTools}>
                <h3>{t('catalog.status')}</h3>
                <WatchStatusSelect value={state.status} onChange={(status) => onStateChange({ status })} />
              </div>
              <section className={styles.diaryField}>
                <h3>{t('anime.diaryScore')}</h3>
                <div
                  className={styles.diaryScoreRange}
                  style={{
                    '--score-progress': `${((diaryScore ?? 0) / 10) * 100}%`,
                    '--score-thumb-position': `${((diaryScore ?? 0) / 10) * 100}%`,
                  } as React.CSSProperties}
                >
                  <span className={styles.diaryScoreHeader}>
                    <span>
                      <img src={starIcon} alt="" aria-hidden="true" />
                      {diaryScore == null ? t('common.none') : `${diaryScore}/10`}
                    </span>
                    <button type="button" onClick={saveDiaryEntry} disabled={diarySaving}>
                      {diarySaving ? '...' : t('anime.diarySave')}
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
                        setDiaryScore(score > 0 ? score : null);
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
                  onChange={(event) => setDiaryReview(event.target.value)}
                  placeholder={t('anime.diaryReviewPlaceholder')}
                  rows={6}
                />
              </section>
            </div>
          ) : mode === 'default' ? (
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
                <PlayerProviderSelect players={players} value={activeProviderName} onChange={setSelectedProviderName} />
                <button
                  className={clsx(styles.reviewsToggle, showReviews && styles.reviewsToggleActive)}
                  type="button"
                  onClick={() => {
                    navigate(showReviews ? `/anime/${animeRouteSlug(anime)}` : animeReviewBaseRoute(anime));
                  }}
                  aria-pressed={showReviews}
                >
                  {showReviews ? t('anime.backToPlayer') : t('anime.reviewsButton', { count: MOCK_REVIEWS.length })}
                </button>
              </div>
            </>
          ) : null}
          {sidebarExtra ? <div className={styles.watchPartyPanel}>{sidebarExtra}</div> : null}
        </div>
        {mode === 'default' ? (
          <div className={styles.localTabs} aria-label={t('anime.localNavigation')}>
            {pageTabs.map((tab) => (
              <Tooltip key={tab.value} label={tab.label} placement="top">
                <button
                  className={activeTab === tab.value ? styles.localTabActive : undefined}
                  type="button"
                  onClick={() => changeTab(tab.value)}
                  aria-label={tab.label}
                  aria-pressed={activeTab === tab.value}
                >
                  <tab.Icon aria-hidden="true" />
                </button>
              </Tooltip>
            ))}
          </div>
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

function ReviewsPanel({
  anime,
  reviews,
  selectedReview,
  onSelectReview,
  onBack,
}: {
  anime: AnimeTitle;
  reviews: MockReview[];
  selectedReview: MockReview | null;
  onSelectReview: (reviewId: string) => void;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const [reviewSortKey, setReviewSortKey] = useState<ReviewSortKey>('recent');
  const [reviewSortDirection, setReviewSortDirection] = useState<SortDirection>('desc');
  const [isComposing, setIsComposing] = useState(false);
  const sortedReviews = useMemo(
    () => sortReviews(reviews, reviewSortKey, reviewSortDirection),
    [reviewSortDirection, reviewSortKey, reviews],
  );

  return (
    <section className={clsx(styles.reviewsPanel, selectedReview && styles.reviewsPanelExpanded)}>
      {selectedReview ? (
        <div key={selectedReview.id}>
          <article className={styles.reviewDetail}>
            <aside className={styles.reviewAuthor}>
              <div className={styles.reviewAuthorProfile}>
                <span className={styles.reviewAuthorAvatar}>{selectedReview.avatarLabel}</span>
                <strong>{selectedReview.author}</strong>
              </div>
              <div className={styles.reviewAuthorStats}>
                <span>
                  <small>{t('anime.reviewWatchedLabel')}</small>
                  <strong>{selectedReview.watched}</strong>
                </span>
                <span>
                  <small>{t('anime.reviewReviewsLabel')}</small>
                  <strong>{selectedReview.reviewsCount}</strong>
                </span>
                <span>
                  <small>{t('anime.reviewHelpfulLabel')}</small>
                  <strong>{selectedReview.helpfulCount}</strong>
                </span>
              </div>
            </aside>
            <div className={styles.reviewText}>
              <h2>{selectedReview.title}</h2>
              <div className={styles.reviewBodyScroll}>
                {[selectedReview.body, ...(selectedReview.bodyExtra ?? [])].map((paragraph, index) => (
                  <p key={`${selectedReview.id}-paragraph-${index}`}>{paragraph}</p>
                ))}
              </div>
            </div>
            <div className={styles.reviewScoreColumn}>
              <ReviewScores review={selectedReview} />
              <ReviewReactions review={selectedReview} />
              <button className={styles.reviewBack} type="button" onClick={onBack}>
                {t('anime.backToReviews')}
              </button>
            </div>
          </article>
        </div>
      ) : isComposing ? (
        <ReviewComposeForm key={reviewDraftStorageKey(anime)} draftKey={reviewDraftStorageKey(anime)} onBack={() => setIsComposing(false)} />
      ) : (
        <div className={styles.reviewsList}>
          <div className={styles.reviewToolbar}>
            <div className={styles.reviewSorts} aria-label={t('anime.reviewSort.label')}>
              <button
                className={clsx(styles.reviewSortButton, reviewSortKey === 'recent' && styles.reviewSortActive)}
                type="button"
                onClick={() => {
                  setReviewSortKey('recent');
                  setReviewSortDirection((current) => (reviewSortKey === 'recent' && current === 'desc' ? 'asc' : 'desc'));
                }}
                aria-label={reviewSortDirection === 'asc' && reviewSortKey === 'recent' ? t('anime.reviewSort.recentAsc') : t('anime.reviewSort.recentDesc')}
                aria-pressed={reviewSortKey === 'recent'}
              >
                <img src={clockIcon} alt="" aria-hidden="true" />
                <span>{reviewSortKey === 'recent' && reviewSortDirection === 'asc' ? t('anime.reviewSort.recentAsc') : t('anime.reviewSort.recentDesc')}</span>
                <img className={clsx(styles.reviewSortDirection, reviewSortKey === 'recent' && reviewSortDirection === 'asc' && styles.reviewSortDirectionUp)} src={episodeArrowIcon} alt="" aria-hidden="true" />
              </button>
              <button
                className={clsx(styles.reviewSortButton, reviewSortKey === 'score' && styles.reviewSortActive)}
                type="button"
                onClick={() => {
                  setReviewSortKey('score');
                  setReviewSortDirection((current) => (reviewSortKey === 'score' && current === 'desc' ? 'asc' : 'desc'));
                }}
                aria-label={reviewSortDirection === 'asc' && reviewSortKey === 'score' ? t('anime.reviewSort.scoreAsc') : t('anime.reviewSort.scoreDesc')}
                aria-pressed={reviewSortKey === 'score'}
              >
                <img src={starIcon} alt="" aria-hidden="true" />
                <span>{reviewSortKey === 'score' && reviewSortDirection === 'asc' ? t('anime.reviewSort.scoreAsc') : t('anime.reviewSort.scoreDesc')}</span>
                <img className={clsx(styles.reviewSortDirection, reviewSortKey === 'score' && reviewSortDirection === 'asc' && styles.reviewSortDirectionUp)} src={episodeArrowIcon} alt="" aria-hidden="true" />
              </button>
              <button
                className={clsx(styles.reviewSortButton, reviewSortKey === 'reaction' && styles.reviewSortActive)}
                type="button"
                onClick={() => {
                  setReviewSortKey('reaction');
                  setReviewSortDirection((current) => (reviewSortKey === 'reaction' && current === 'desc' ? 'asc' : 'desc'));
                }}
                aria-label={reviewSortDirection === 'asc' && reviewSortKey === 'reaction' ? t('anime.reviewSort.reactionAsc') : t('anime.reviewSort.reactionDesc')}
                aria-pressed={reviewSortKey === 'reaction'}
              >
                <ThumbUpIcon aria-hidden="true" />
                <span>{reviewSortKey === 'reaction' && reviewSortDirection === 'asc' ? t('anime.reviewSort.reactionAsc') : t('anime.reviewSort.reactionDesc')}</span>
                <img className={clsx(styles.reviewSortDirection, reviewSortKey === 'reaction' && reviewSortDirection === 'asc' && styles.reviewSortDirectionUp)} src={episodeArrowIcon} alt="" aria-hidden="true" />
              </button>
            </div>
            <button className={styles.reviewWriteButton} type="button" onClick={() => setIsComposing(true)}>
              {t('anime.reviewWrite')}
            </button>
          </div>
          <div className={styles.reviewsGrid} aria-label={t('anime.reviews')}>
          {sortedReviews.map((review, index) => (
            <button
              key={review.id}
              className={styles.reviewCard}
              type="button"
              style={{ '--review-card-delay': `${Math.min(index, 8) * 45 + 40}ms` } as React.CSSProperties}
              onClick={() => onSelectReview(review.id)}
            >
              <span className={styles.reviewCardHeader}>
                <span className={styles.reviewAvatar} aria-hidden="true">{review.avatarLabel}</span>
                <span className={styles.reviewCardAuthor}>
                  <strong>{review.author}</strong>
                </span>
                <span className={styles.reviewCardFlags} aria-hidden="true">
                  <span className={clsx(styles.reviewCardFlag, review.recommended ? styles.reviewCardFlagGood : styles.reviewCardFlagBad)}>
                    <ThumbUpIcon className={clsx(!review.recommended && styles.reviewThumbDown)} aria-hidden="true" />
                  </span>
                  <span className={clsx(styles.reviewCardFlag, review.hasSpoilers ? styles.reviewCardFlagBad : styles.reviewCardFlagGood)}>
                    {review.hasSpoilers ? <SpoilerWarningIcon aria-hidden="true" /> : <SpoilerOffIcon aria-hidden="true" />}
                  </span>
                </span>
                <span className={styles.reviewCardScore}>
                  <img src={starIcon} alt="" aria-hidden="true" />
                  {review.score}/10
                </span>
              </span>
              <span className={styles.reviewCardBody}>
                <strong>{review.title}</strong>
                <span>{review.excerpt}</span>
              </span>
              <span className={styles.reviewCardMeta} aria-hidden="true">
                <span className={styles.reviewCardVotes}>
                  <strong className={styles.reviewCardVotesLike}>+{review.likes}</strong>
                  <span>/</span>
                  <strong className={styles.reviewCardVotesDislike}>-{review.dislikes}</strong>
                </span>
              </span>
            </button>
          ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ReviewComposeForm({ draftKey, onBack }: { draftKey: string; onBack: () => void }) {
  const { t } = useI18n();
  const initialDraft = useMemo(() => readReviewDraft(draftKey), [draftKey]);
  const defaultAspectScores: MockReview['scores'] = {
    story: 8,
    characters: 8,
    visuals: 8,
    music: 8,
    opening: 8,
    atmosphere: 8,
  };
  const [reviewTitle, setReviewTitle] = useState(initialDraft?.title ?? '');
  const [reviewBody, setReviewBody] = useState(initialDraft?.body ?? '');
  const [overallScore, setOverallScore] = useState(initialDraft?.overallScore ?? 8);
  const [recommended, setRecommended] = useState(initialDraft?.recommended ?? true);
  const [hasSpoilers, setHasSpoilers] = useState(initialDraft?.hasSpoilers ?? false);
  const [aspectScores, setAspectScores] = useState<MockReview['scores']>(initialDraft?.aspectScores ?? defaultAspectScores);
  const aspects: Array<{ key: keyof MockReview['scores']; label: string }> = [
    { key: 'story', label: t('anime.reviewAspect.story') },
    { key: 'characters', label: t('anime.reviewAspect.characters') },
    { key: 'visuals', label: t('anime.reviewAspect.visuals') },
    { key: 'music', label: t('anime.reviewAspect.music') },
    { key: 'opening', label: t('anime.reviewAspect.opening') },
    { key: 'atmosphere', label: t('anime.reviewAspect.atmosphere') },
  ];
  const updateOverallScore = (value: number) => {
    setOverallScore(Math.min(10, Math.max(1, Math.round(value || 1))));
  };
  useEffect(() => {
    writeReviewDraft(draftKey, {
      title: reviewTitle,
      body: reviewBody,
      overallScore,
      recommended,
      hasSpoilers,
      aspectScores,
    });
  }, [aspectScores, draftKey, hasSpoilers, overallScore, recommended, reviewBody, reviewTitle]);

  return (
    <form className={styles.reviewCompose} onSubmit={(event) => event.preventDefault()}>
      <div className={styles.reviewComposeMain}>
        <label className={styles.reviewComposeField}>
          <span>{t('anime.reviewTitleLabel')}</span>
          <input type="text" value={reviewTitle} onChange={(event) => setReviewTitle(event.target.value)} placeholder={t('anime.reviewTitlePlaceholder')} />
        </label>
        <label className={styles.reviewComposeField}>
          <span>{t('anime.reviewBodyLabel')}</span>
          <textarea rows={14} value={reviewBody} onChange={(event) => setReviewBody(event.target.value)} placeholder={t('anime.reviewBodyPlaceholder')} />
        </label>
      </div>
      <aside className={styles.reviewComposeSidebar}>
        <section className={styles.reviewComposeScore}>
          <div className={styles.reviewComposeScoreHeader}>
            <span>
              <small>{t('anime.reviewOverall')}</small>
              <strong>
                <input
                  type="number"
                  min="1"
                  max="10"
                  step="1"
                  value={overallScore}
                  onChange={(event) => updateOverallScore(Number(event.target.value))}
                  aria-label={t('anime.reviewOverall')}
                />
                /10
              </strong>
            </span>
          </div>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={overallScore}
              onChange={(event) => updateOverallScore(Number(event.target.value))}
              aria-label={t('anime.reviewOverall')}
              tabIndex={-1}
            />
        </section>
        <div className={styles.reviewComposeFlags}>
          <button
            className={clsx(styles.reviewComposeFlag, recommended ? styles.reviewComposeFlagActive : styles.reviewComposeFlagDanger)}
            type="button"
            onClick={() => setRecommended((current) => !current)}
            aria-pressed={recommended}
          >
            <ThumbUpIcon className={clsx(!recommended && styles.reviewThumbDown)} aria-hidden="true" />
            <span>{recommended ? t('anime.reviewRecommended') : t('anime.reviewNotRecommended')}</span>
          </button>
          <button
            className={clsx(styles.reviewComposeFlag, hasSpoilers && styles.reviewComposeFlagWarning)}
            type="button"
            onClick={() => setHasSpoilers((current) => !current)}
            aria-pressed={hasSpoilers}
          >
            {hasSpoilers ? <SpoilerWarningIcon aria-hidden="true" /> : <SpoilerOffIcon aria-hidden="true" />}
            <span>{hasSpoilers ? t('anime.reviewHasSpoilers') : t('anime.reviewNoSpoilers')}</span>
          </button>
        </div>
        <section className={styles.reviewComposeAspects}>
          {aspects.map((aspect) => (
            <label key={aspect.key} className={styles.reviewComposeAspect}>
              <span>
                <small>{aspect.label}</small>
                <strong>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    step="1"
                    value={aspectScores[aspect.key]}
                    onChange={(event) => {
                      const value = Math.min(10, Math.max(1, Math.round(Number(event.target.value) || 1)));
                      setAspectScores((current) => ({ ...current, [aspect.key]: value }));
                    }}
                    aria-label={aspect.label}
                  />
                </strong>
              </span>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={aspectScores[aspect.key]}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setAspectScores((current) => ({ ...current, [aspect.key]: value }));
                }}
                aria-label={aspect.label}
                tabIndex={-1}
              />
            </label>
          ))}
        </section>
        <div className={styles.reviewComposeActions}>
          <button type="button" onClick={onBack}>{t('common.cancel')}</button>
          <button type="submit">{t('anime.reviewPublish')}</button>
        </div>
      </aside>
    </form>
  );
}

function sortReviews(reviews: MockReview[], sortKey: ReviewSortKey, direction: SortDirection) {
  const directionMultiplier = direction === 'asc' ? 1 : -1;

  return [...reviews].sort((left, right) => {
    if (sortKey === 'score') {
      return (left.score - right.score) * directionMultiplier;
    }

    if (sortKey === 'reaction') {
      return ((left.likes - left.dislikes) - (right.likes - right.dislikes)) * directionMultiplier;
    }

    return (new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()) * directionMultiplier;
  });
}

function reviewDraftStorageKey(anime: AnimeTitle) {
  return `anima:review-draft:${anime.id}`;
}

function readReviewDraft(storageKey: string): ReviewDraft | null {
  try {
    const rawDraft = window.localStorage.getItem(storageKey);
    if (!rawDraft) {
      return null;
    }

    const parsed = JSON.parse(rawDraft) as Partial<ReviewDraft>;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return {
      title: typeof parsed.title === 'string' ? parsed.title : '',
      body: typeof parsed.body === 'string' ? parsed.body : '',
      overallScore: normalizeReviewScore(parsed.overallScore, 8),
      recommended: typeof parsed.recommended === 'boolean' ? parsed.recommended : true,
      hasSpoilers: typeof parsed.hasSpoilers === 'boolean' ? parsed.hasSpoilers : false,
      aspectScores: normalizeAspectScores(parsed.aspectScores),
    };
  } catch {
    return null;
  }
}

function writeReviewDraft(storageKey: string, draft: ReviewDraft) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(draft));
  } catch {
    // localStorage can be unavailable in private mode or full storage.
  }
}

function normalizeReviewScore(value: unknown, fallback: number) {
  return Math.min(10, Math.max(1, Math.round(Number(value) || fallback)));
}

function normalizeAspectScores(value: unknown): MockReview['scores'] {
  const source = typeof value === 'object' && value ? value as Partial<MockReview['scores']> : {};

  return {
    story: normalizeReviewScore(source.story, 8),
    characters: normalizeReviewScore(source.characters, 8),
    visuals: normalizeReviewScore(source.visuals, 8),
    music: normalizeReviewScore(source.music, 8),
    opening: normalizeReviewScore(source.opening, 8),
    atmosphere: normalizeReviewScore(source.atmosphere, 8),
  };
}

function ReviewScores({ review }: { review: MockReview }) {
  const { t } = useI18n();
  const scores: Array<{ key: keyof MockReview['scores']; label: string }> = [
    { key: 'story', label: t('anime.reviewAspect.story') },
    { key: 'characters', label: t('anime.reviewAspect.characters') },
    { key: 'visuals', label: t('anime.reviewAspect.visuals') },
    { key: 'music', label: t('anime.reviewAspect.music') },
    { key: 'opening', label: t('anime.reviewAspect.opening') },
    { key: 'atmosphere', label: t('anime.reviewAspect.atmosphere') },
  ];

  return (
    <aside className={styles.reviewScores} aria-label={t('anime.reviewDetails')}>
      <div className={styles.reviewScoreTop}>
        <div className={styles.reviewFlags}>
          <Tooltip label={review.recommended ? t('anime.reviewRecommended') : t('anime.reviewNotRecommended')} placement="bottom">
            <span className={clsx(styles.reviewFlagIcon, review.recommended ? styles.reviewFlagPositive : styles.reviewFlagWarning)}>
              <ThumbUpIcon className={clsx(!review.recommended && styles.reviewThumbDown)} aria-hidden="true" />
            </span>
          </Tooltip>
          <Tooltip label={review.hasSpoilers ? t('anime.reviewHasSpoilers') : t('anime.reviewNoSpoilers')} placement="bottom" align="end">
            <span className={clsx(styles.reviewFlagIcon, review.hasSpoilers ? styles.reviewFlagSpoiler : styles.reviewFlagNoSpoiler)}>
              {review.hasSpoilers ? <SpoilerWarningIcon aria-hidden="true" /> : <SpoilerOffIcon aria-hidden="true" />}
            </span>
          </Tooltip>
        </div>
        <div className={styles.reviewScoreSummary}>
          <small>{t('anime.reviewOverall')}</small>
          <strong>{review.score}/10</strong>
        </div>
      </div>
      <div className={styles.reviewScoreList}>
        {scores.map((item) => {
          const value = review.scores[item.key];

          return (
            <div key={item.key} className={styles.reviewScoreItem}>
              <span>
                <small>{item.label}</small>
                <strong>{value}</strong>
              </span>
              <div className={styles.reviewScoreTrack} aria-hidden="true">
                <i style={{ width: `${value * 10}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function ReviewReactions({ review }: { review: MockReview }) {
  const { t } = useI18n();
  const [reaction, setReaction] = useState<'like' | 'dislike' | null>(null);
  const likes = review.likes + (reaction === 'like' ? 1 : 0);
  const dislikes = review.dislikes + (reaction === 'dislike' ? 1 : 0);

  return (
    <div className={styles.reviewReactions} aria-label={t('anime.reviewReaction')}>
      <Tooltip label={t('anime.reviewLike')} placement="bottom">
        <button
          className={clsx(styles.reviewReactionButton, reaction === 'like' && styles.reviewReactionActive)}
          type="button"
          onClick={() => setReaction((current) => (current === 'like' ? null : 'like'))}
          aria-pressed={reaction === 'like'}
          aria-label={t('anime.reviewLike')}
        >
          <ThumbUpIcon aria-hidden="true" />
          <span>{likes}</span>
        </button>
      </Tooltip>
      <Tooltip label={t('anime.reviewDislike')} placement="bottom" align="end">
        <button
          className={clsx(styles.reviewReactionButton, styles.reviewReactionDislike, reaction === 'dislike' && styles.reviewReactionActive)}
          type="button"
          onClick={() => setReaction((current) => (current === 'dislike' ? null : 'dislike'))}
          aria-pressed={reaction === 'dislike'}
          aria-label={t('anime.reviewDislike')}
        >
          <ThumbUpIcon aria-hidden="true" />
          <span>{dislikes}</span>
        </button>
      </Tooltip>
    </div>
  );
}

export function AnimeHeroSkeleton() {
  return (
    <div className={clsx(styles.layout)} aria-busy="true">
      <section className={styles.player}>
        <div className={clsx(styles.videoFrame, styles.playerFrameSkeleton)}>
          <span />
        </div>
        <section className={clsx(styles.episodes, styles.episodesSkeleton)} aria-hidden="true">
          <span className={clsx(styles.episodeScroll, styles.skeletonBlock)} />
          <div className={styles.episodeGrid}>
            {Array.from({ length: EPISODES_PER_PAGE }, (_, index) => (
              <span className={styles.skeletonBlock} key={`episode-skeleton-${index}`} />
            ))}
          </div>
          <span className={clsx(styles.episodeScroll, styles.skeletonBlock)} />
        </section>
      </section>

      <aside className={clsx(styles.detailsPanel, styles.detailsPanelSkeleton)}>
        <div className={clsx(styles.detailsPoster, styles.skeletonPanel)} />
        <div className={styles.genres} aria-hidden="true">
          <div className={styles.genresTrack}>
            {Array.from({ length: 5 }, (_, index) => (
              <span className={styles.skeletonPill} key={`genre-skeleton-${index}`} />
            ))}
          </div>
        </div>
        <div className={styles.metaGrid}>
          {Array.from({ length: 4 }, (_, index) => (
            <span className={styles.skeletonMeta} key={`meta-skeleton-${index}`} />
          ))}
        </div>
        <div className={styles.watchTools}>
          <span className={styles.skeletonControl} />
          <span className={styles.skeletonControl} />
        </div>
        <div className={styles.sourcesBlock}>
          <span className={styles.skeletonSource} />
        </div>
      </aside>
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

function AnimeDetailsSections({
  details,
  loading,
  error,
  section = 'all',
  onOpenSimilar,
}: {
  details: AnimeExtendedDetails | null;
  loading: boolean;
  error: boolean;
  section?: 'all' | 'similar' | 'rest';
  onOpenSimilar?: (path: string) => void;
}) {
  const { language, t } = useI18n();

  if (loading) {
    return <ExtendedDetailsSkeleton section={section} />;
  }

  if (error) {
    if (section === 'rest') return null;
    return <p className={styles.detailsEmpty}>{t('anime.detailsError')}</p>;
  }

  if (!details) return null;

  const hasContent =
    details.similar.length > 0 ||
    details.characters.length > 0 ||
    details.people.length > 0 ||
    details.screenshots.length > 0;

  if (!hasContent) {
    if (section !== 'all') return null;
    return <p className={styles.detailsEmpty}>{t('anime.detailsEmpty')}</p>;
  }

  return (
    <div className={styles.extendedDetails}>
      {section !== 'rest' && details.similar.length > 0 ? (
        <DetailsSection title={t('anime.similar')}>
          <div className={styles.similarList}>
            {details.similar.map((item) => (
              <button key={item.providerId} type="button" onClick={() => openSimilarAnime(item, onOpenSimilar)}>
                {item.posterUrl ? <img src={item.posterUrl} alt="" loading="lazy" /> : null}
                <span>
                  <strong>{getLocalizedAnimeTitle(item, language)}</strong>
                  <small>{item.score ? `${t('catalog.score')}: ${item.score}` : item.kind}</small>
                </span>
              </button>
            ))}
          </div>
        </DetailsSection>
      ) : null}

      {section !== 'similar' && details.characters.length > 0 ? (
        <DetailsSection title={t('anime.characters')}>
          <CharacterGrid items={details.characters} />
        </DetailsSection>
      ) : null}

      {section !== 'similar' && details.screenshots.length > 0 ? (
        <DetailsSection title={t('anime.screenshots')}>
          <div className={styles.screenshotGrid}>
            {details.screenshots.map((screenshot) => (
              <a key={screenshot.originalUrl} href={screenshot.originalUrl} target="_blank" rel="noreferrer">
                <img src={screenshot.previewUrl} alt="" loading="lazy" />
              </a>
            ))}
          </div>
        </DetailsSection>
      ) : null}

      {section !== 'similar' && details.people.length > 0 ? (
        <DetailsSection title={t('anime.people')}>
          <RoleGrid items={details.people} />
        </DetailsSection>
      ) : null}
    </div>
  );
}

function ExtendedDetailsSkeleton({ section }: { section: 'all' | 'similar' | 'rest' }) {
  if (section === 'similar') {
    return (
      <div className={styles.extendedDetailsSkeleton} aria-hidden="true">
        <section className={styles.detailsSection}>
          <span className={styles.skeletonHeading} />
          <div className={styles.skeletonSimilarList}>
            <span />
            <span />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.extendedDetailsSkeleton} aria-hidden="true">
      <section className={styles.detailsSection}>
        <span className={styles.skeletonHeading} />
        <div className={styles.skeletonCharacterGrid}>
          <span />
          <span />
          <span />
          <span />
        </div>
      </section>
      <section className={styles.detailsSection}>
        <span className={styles.skeletonHeading} />
        <div className={styles.skeletonScreenshotGrid}>
          <span />
          <span />
        </div>
      </section>
      <section className={styles.detailsSection}>
        <span className={styles.skeletonHeading} />
        <div className={styles.skeletonSimilarList}>
          <span />
          <span />
        </div>
      </section>
    </div>
  );
}

async function openSimilarAnime(item: CatalogSearchResult, onOpenSimilar?: (path: string) => void) {
  if (!onOpenSimilar) return;
  onOpenSimilar(animeRouteFromCatalog(item));

  try {
    const response = await importCatalogAnime(item.provider, item.providerId);
    onOpenSimilar(`/anime/${animeRouteSlug({
      id: response.anime.id,
      title: response.anime.title,
      originalTitle: response.anime.originalTitle,
    } as AnimeTitle)}`);
  } catch {
    // The route loader can still import by catalog slug, so this is only an eager optimization.
  }
}

function DetailsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.detailsSection}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function RoleGrid({
  items,
}: {
  items: Array<{ id: number | null; name: string; imageUrl: string | null; url: string | null; roles: string[] }>;
}) {
  return (
    <div className={styles.roleGrid}>
      {items.map((item, index) => {
        const profile = (
          <>
            {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <span className={styles.roleAvatarFallback} />}
            <span>
              <strong>{item.name}</strong>
              {item.roles.length > 0 ? <small>{item.roles.join(', ')}</small> : null}
            </span>
          </>
        );

        return (
          <div key={`${item.id ?? item.name}-${index}`} className={styles.roleCard}>
            {item.url ? (
              <a href={item.url} target="_blank" rel="noreferrer">
                {profile}
              </a>
            ) : (
              <div>{profile}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CharacterGrid({
  items,
}: {
  items: Array<{ id: number | null; name: string; imageUrl: string | null; url: string | null; roles: string[] }>;
}) {
  return (
    <div className={styles.characterGrid}>
      {items.map((item, index) => {
        const content = (
          <>
            {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <span className={styles.characterAvatarFallback} />}
            <CharacterName name={item.name} />
          </>
        );

        return (
          <article key={`${item.id ?? item.name}-${index}`} className={styles.characterCard}>
            {item.url ? (
              <a href={item.url} target="_blank" rel="noreferrer">
                {content}
              </a>
            ) : (
              <div>{content}</div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function CharacterName({ name }: { name: string }) {
  const textRef = useRef<HTMLElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [overflowOffset, setOverflowOffset] = useState(0);

  useLayoutEffect(() => {
    const text = textRef.current;
    if (!text) return;

    function updateOverflow() {
      const offset = Math.max(0, text.scrollWidth - text.clientWidth);
      setOverflowing(offset > 1);
      setOverflowOffset(offset);
    }

    updateOverflow();

    const observer = new ResizeObserver(updateOverflow);
    observer.observe(text);

    return () => {
      observer.disconnect();
    };
  }, [name]);

  return (
    <span
      className={clsx(overflowing && styles.characterNameScrollable)}
      style={{
        '--character-name-offset': `${overflowOffset + 4}px`,
        '--character-name-duration': `${Math.max(1.2, (overflowOffset + 4) / 14)}s`,
      } as React.CSSProperties}
    >
      <strong ref={textRef}>
        <em>{name}</em>
      </strong>
    </span>
  );
}

function PlayerProviderSelect({
  players,
  value,
  onChange,
}: {
  players: PlayerProviderResult[];
  value: PlayerProvider;
  onChange: (value: PlayerProvider) => void;
}) {
  return (
    <div className={styles.providerSelect} aria-label="Плеер">
      {PLAYER_PROVIDER_OPTIONS.map((option) => {
        const available = players.some((player) => player.provider === option.value && isPlayablePlayer(player));
        return (
          <button
            key={option.value}
            className={clsx(option.value === value && styles.selectedProvider)}
            type="button"
            disabled={!available}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function WatchStatusSelect({
  value,
  onChange,
}: {
  value: WatchState['status'];
  onChange: (value: WatchState['status']) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = WATCH_STATUS_OPTIONS.find((option) => option.value === value) ?? WATCH_STATUS_OPTIONS[0];

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
    <div className={styles.statusSelect} ref={rootRef}>
      <button
        className={styles.statusSelectTrigger}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected.label}</span>
        <span className={styles.statusSelectChevron} aria-hidden="true" />
      </button>

      {open ? (
        <div className={styles.statusSelectMenu} role="listbox" aria-label="Статус просмотра">
          {WATCH_STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={clsx(option.value === value && styles.selectedStatus)}
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

function VideoPlayer({
  anime,
  player,
  playbackSync,
}: {
  anime: AnimeTitle;
  player: PlayerProviderResult;
  playbackSync?: PlaybackSync;
}) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
  }, [player.embedUrl, player.streamUrl]);

  if (player.streamType === 'iframe' && player.embedUrl) {
    return (
      <div className={styles.videoFrame}>
        <iframe
          src={player.embedUrl}
          title={player.title}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          onLoad={() => setIsLoading(false)}
        />
        {isLoading ? <PlayerLoader /> : null}
      </div>
    );
  }

  return (
    <ControlledVideoPlayer
      anime={anime}
      player={player}
      isLoading={isLoading}
      onReady={() => setIsLoading(false)}
      playbackSync={playbackSync}
    />
  );
}

function PlayerLoader() {
  return (
    <div className={clsx(styles.playerLoader, styles.playerLoaderSkeleton)} aria-label="Загрузка плеера">
      <span />
    </div>
  );
}

function PlayerMessage({ message }: { message: string }) {
  return (
    <div className={styles.playerMessage} role="status">
      <p>{message}</p>
    </div>
  );
}

function isPlayablePlayer(player: PlayerProviderResult) {
  return Boolean(player.streamUrl || player.embedUrl);
}

function orderWatchPartyPlayers(players: PlayerProviderResult[]) {
  return [...players].sort((left, right) => watchPartyProviderPriority(left.provider) - watchPartyProviderPriority(right.provider));
}

function watchPartyProviderPriority(provider: PlayerProvider) {
  return provider === 'anilibria' ? 0 : 1;
}

function WatchSources({ anime }: { anime: AnimeTitle }) {
  return (
    <div className={styles.sourcesBlock}>
      <h3>Источники</h3>
      {anime.watchSources.map((source) => {
        const isShikimoriSource = source.name.toLocaleLowerCase().includes('shikimori');

        return (
          <a key={source.name} href={source.url} target="_blank" rel="noreferrer" className={styles.sourceLink}>
            {isShikimoriSource ? <img src={shikimoriIcon} alt="" aria-hidden="true" /> : null}
            <span>
              <strong>{source.name}</strong>
            </span>
          </a>
        );
      })}
    </div>
  );
}
