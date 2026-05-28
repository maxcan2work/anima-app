import clsx from 'clsx';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAnimeOriginalDisplayTitle, getLocalizedAnimeTitle, WATCH_STATUS_OPTIONS, type WatchStatus } from '@anima/core';
import { getAnimeExtendedDetails, getEpisodePlayers, importCatalogAnime, type AnimeExtendedDetails, type CatalogSearchResult, type PlayerProviderResult } from '@/api';
import CalendarIcon from '@assets/calendar.svg?react';
import DiaryIcon from '@assets/pencil.svg?react';
import InfoIcon from '@assets/description.svg?react';
import episodeArrowIcon from '@assets/episode-arrow.svg';
import shikimoriIcon from '@assets/shikimori.png';
import starIcon from '@assets/star.svg';
import StudioIcon from '@assets/studio.svg?react';
import WatchTabIcon from '@assets/tv-alt.svg?react';
import tvIcon from '@assets/tv-alt.svg';
import type { AnimeTitle } from '@/data';
import { useNavigation } from '@features/navigation/NavigationProvider';
import { useI18n } from '@shared/i18n/I18nProvider';
import { animeRouteFromCatalog, animeRouteSlug } from '@shared/navigation';
import { Tooltip } from '@shared/ui/Tooltip';
import { ControlledVideoPlayer, type PlaybackSync, type PlaybackSyncState } from './ControlledVideoPlayer';
import styles from './AnimeHero.module.css';

type PlayerProvider = PlayerProviderResult['provider'];

type WatchState = {
  episode: number;
  status: WatchStatus;
};

type AnimePageTab = 'watch' | 'overview' | 'diary';
type AnimePageMode = 'info' | 'diary';

type AnimeHeroProps = {
  anime: AnimeTitle;
  state: WatchState;
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

export function AnimeHero({
  anime,
  state,
  onStateChange,
  mode = 'default',
  playbackSync,
  sidebarExtra,
  footerExtra,
}: AnimeHeroProps) {
  const { language, t } = useI18n();
  const { requestAnimeRoute } = useNavigation();
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
  const playablePlayers = players.filter((player) => isPlayablePlayer(player) && (mode !== 'watchParty' || player.provider === 'anilibria'));
  const preferredPlayers = mode === 'watchParty' ? orderWatchPartyPlayers(playablePlayers) : playablePlayers;
  const selectedProviderPlayer = preferredPlayers.find((player) => player.provider === selectedProviderName);
  const selectedPlayer = mode === 'watchParty'
    ? preferredPlayers[0]
    : selectedProviderPlayer ?? preferredPlayers[0] ?? players[0];
  const activeProviderName = selectedPlayer?.provider ?? selectedProviderName;
  const animeTitle = getLocalizedAnimeTitle(anime, language);
  const animeSecondaryTitle = getAnimeOriginalDisplayTitle(anime, language);
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
  }, [anime.id]);

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
      <section className={styles.player}>
        {selectedPlayer && isPlayablePlayer(selectedPlayer) ? (
          <VideoPlayer anime={anime} player={selectedPlayer} playbackSync={mode === 'watchParty' ? playbackSync : undefined} />
        ) : (
          <div className={styles.videoFrame}>
            {playersStatus ? <PlayerMessage message={playersStatus} /> : <PlayerLoader />}
          </div>
        )}

        {mode === 'default' ? episodeControls : null}
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
              <p className="eyebrow">{t('anime.tab.diary')}</p>
              <h2>{t('anime.diaryTitle')}</h2>
              <div className={styles.watchStatusTools}>
                <WatchStatusSelect value={state.status} onChange={(status) => onStateChange({ status })} />
              </div>
              <p>{t('anime.diaryDescription')}</p>
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
