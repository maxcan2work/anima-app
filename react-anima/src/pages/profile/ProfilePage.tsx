import clsx from 'clsx';
import { useState, type ChangeEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { fromServerWatchStatus, getLocalizedAnimeTitle, type WatchStatus } from '@anima/core';
import { saveAnimeProgress, type ServerWatchEntry } from '@/api';
import clockIcon from '@assets/clock-three.svg';
import detachIcon from '@assets/detach.svg';
import directionIcon from '@assets/episode-arrow.svg';
import importIcon from '@assets/import.svg';
import profileCheckIcon from '@assets/profile-check.svg';
import profileEyeIcon from '@assets/profile-eye.svg';
import profileNoteIcon from '@assets/profile-note.svg';
import profileFriendsIcon from '@assets/circled-group.svg';
import profileStatsIcon from '@assets/stats.svg';
import reviewIcon from '@assets/chat-audio.svg';
import scoreIcon from '@assets/star.svg';
import settingsIcon from '@assets/settings.svg';
import shikimoriIcon from '@assets/shikimori.png';
import trashIcon from '@assets/trash.svg';
import episodeIcon from '@assets/tv-alt.svg';
import leaveRoomIcon from '@assets/leave-room.svg';
import { useAuth } from '@features/auth/AuthProvider';
import { useNavigation } from '@features/navigation/NavigationProvider';
import { useI18n } from '@shared/i18n/I18nProvider';
import { upsertDiaryEntry } from '@shared/animeMappers';
import { animeRouteSlug } from '@shared/navigation';
import { Tooltip } from '@shared/ui/Tooltip';
import { useToast } from '@shared/ui/ToastProvider';
import styles from './ProfilePage.module.css';

type SortDirection = 'desc' | 'asc';

export function ProfilePage() {
  const { user, authStatus, diaryEntries: entries, setDiaryEntries, login, logout } = useAuth();
  const { requestRoute } = useNavigation();
  const { language, t } = useI18n();
  const toast = useToast();
  const profileFilters: Array<{ status: WatchStatus; label: string; count: number; icon: string }> = [
    { status: 'watching', label: t('profile.status.watching'), count: entries.filter((entry) => entry.status === 'WATCHING').length, icon: profileEyeIcon },
    { status: 'completed', label: t('profile.status.completed'), count: entries.filter((entry) => entry.status === 'COMPLETED').length, icon: profileCheckIcon },
    { status: 'dropped', label: t('profile.status.dropped'), count: entries.filter((entry) => entry.status === 'DROPPED').length, icon: trashIcon },
    { status: 'planned', label: t('profile.status.planned'), count: entries.filter((entry) => entry.status === 'PLANNED').length, icon: profileNoteIcon },
  ];
  const profileFriends = [
    { id: 'mira', name: 'Mira', status: 'online' },
    { id: 'kira', name: 'Kira', status: 'online' },
    { id: 'ren', name: 'Ren', status: 'offline' },
    { id: 'yuki', name: 'Yuki', status: 'offline' },
    { id: 'sora', name: 'Sora', status: 'offline' },
  ];
  const sortedFriends = [...profileFriends].sort((left, right) => Number(right.status === 'online') - Number(left.status === 'online'));
  const [selectedStatus, setSelectedStatus] = useState<WatchStatus>('watching');
  const [sidebarMode, setSidebarMode] = useState<'stats' | 'friends' | 'settings'>('stats');
  const [activeRatingEntryId, setActiveRatingEntryId] = useState<string | null>(null);
  const [savingRatingId, setSavingRatingId] = useState<string | null>(null);
  const [activeDateEntryId, setActiveDateEntryId] = useState<string | null>(null);
  const [savingDateId, setSavingDateId] = useState<string | null>(null);
  const [dateDraft, setDateDraft] = useState({ startedAt: '', completedAt: '' });
  const [diarySearchQuery, setDiarySearchQuery] = useState('');
  const [reviewedOnly, setReviewedOnly] = useState(false);
  const [scoreSortDirection, setScoreSortDirection] = useState<SortDirection>('desc');
  const [recentSortDirection, setRecentSortDirection] = useState<SortDirection | null>(null);
  const selectedFilter = profileFilters.find((filter) => filter.status === selectedStatus) ?? profileFilters[0];
  const statusEntries = entries.filter((entry) => fromServerWatchStatus(entry.status) === selectedStatus);
  const filteredEntries = statusEntries
    .filter((entry) => matchesDiarySearch(entry, diarySearchQuery))
    .filter((entry) => !reviewedOnly || Boolean(entry.review))
    .sort((left, right) => compareDiaryEntries(left, right, { scoreSortDirection, recentSortDirection }));
  const getStatusLabel = (status: WatchStatus) => profileFilters.find((filter) => filter.status === status)?.label ?? status;
  const getEntryStatusLabel = (entry: ServerWatchEntry) => {
    const status = fromServerWatchStatus(entry.status);
    const label = getStatusLabel(status);
    const totalViews = Math.max((entry.rewatches ?? 0) + 1, 1);

    return status === 'completed' && totalViews > 1 ? `${label} x${totalViews}` : label;
  };
  const formatDiaryDate = (value: string | null) => {
    if (!value) return '';
    return new Intl.DateTimeFormat(language === 'ja' ? 'ja-JP' : language === 'en' ? 'en-US' : 'ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    }).format(new Date(value));
  };
  const formatDateInput = (value: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return [
      String(date.getUTCDate()).padStart(2, '0'),
      String(date.getUTCMonth() + 1).padStart(2, '0'),
      String(date.getUTCFullYear()),
    ].join('.');
  };
  const maskDateInput = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    const day = digits.slice(0, 2);
    const month = digits.slice(2, 4);
    const year = digits.slice(4, 8);

    return [day, month, year].filter(Boolean).join('.');
  };
  const dateInputToIso = (value: string) => {
    if (!value) return null;

    const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!match) return undefined;

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return undefined;
    }

    return date.toISOString();
  };
  const getStartedDate = (entry: ServerWatchEntry) => entry.startedAt ?? entry.createdAt;
  const getCompletedDate = (entry: ServerWatchEntry) => (
    entry.completedAt ?? (entry.status === 'COMPLETED' ? entry.updatedAt : null)
  );
  const stopDiaryAction = (event: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };
  const toggleRatingMenu = (event: MouseEvent<HTMLButtonElement>, entryId: string) => {
    event.stopPropagation();
    setActiveRatingEntryId((current) => (current === entryId ? null : entryId));
    setActiveDateEntryId(null);
  };
  const beginDateEdit = (entry: ServerWatchEntry) => {
    if (activeDateEntryId !== entry.id) {
      setDateDraft({
        startedAt: formatDateInput(entry.startedAt ?? entry.createdAt),
        completedAt: formatDateInput(entry.completedAt ?? (entry.status === 'COMPLETED' ? entry.updatedAt : null)),
      });
    }
    setActiveDateEntryId(entry.id);
    setActiveRatingEntryId(null);
  };
  const handleDateFocus = (entry: ServerWatchEntry) => {
    beginDateEdit(entry);
  };
  const handleDateClick = (event: MouseEvent<HTMLInputElement>, entry: ServerWatchEntry) => {
    event.stopPropagation();
    beginDateEdit(entry);
  };
  const updateDateDraft = (field: 'startedAt' | 'completedAt') => (event: ChangeEvent<HTMLInputElement>) => {
    setDateDraft((current) => ({ ...current, [field]: maskDateInput(event.target.value) }));
  };
  const handleDateKeyDown = (event: KeyboardEvent<HTMLInputElement>, entry: ServerWatchEntry) => {
    event.stopPropagation();

    if (event.key === 'Enter') {
      event.preventDefault();
      saveEntryDates(entry);
    }

    if (event.key === 'Escape') {
      setActiveDateEntryId(null);
    }
  };
  const openDiaryAnime = (entry: (typeof entries)[number]) => {
    if (!entry.anime) return;

    requestRoute(`/anime/${animeRouteSlug({
      id: entry.anime.id,
      title: entry.anime.title,
      originalTitle: entry.anime.originalTitle ?? entry.anime.title,
      titleRu: entry.anime.titleRu,
      titleEn: entry.anime.titleEn,
      titleJa: entry.anime.titleJa,
      titleRomaji: entry.anime.titleRomaji,
      year: 0,
      episodes: entry.anime.episodes,
      studio: '',
      rating: '',
      genres: [],
      description: '',
      poster: entry.anime.posterUrl ?? '',
      backdrop: '',
      sampleEpisodeTitle: '',
      watchSources: [],
    })}`, 'watch');
  };
  const handleDiaryKeyDown = (event: KeyboardEvent<HTMLElement>, entry: (typeof entries)[number]) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;

    event.preventDefault();
    openDiaryAnime(entry);
  };
  const saveEntryScore = async (event: MouseEvent<HTMLButtonElement>, entry: ServerWatchEntry, score: number | null) => {
    event.stopPropagation();
    if (savingRatingId) return;

    setSavingRatingId(entry.id);
    try {
      const { entry: savedEntry } = await saveAnimeProgress(entry.animeId, {
        status: entry.status,
        currentEpisode: entry.currentEpisode,
        score,
        rewatches: entry.rewatches,
        startedAt: entry.startedAt,
        completedAt: entry.completedAt,
        review: entry.review,
      });
      setDiaryEntries((current) => upsertDiaryEntry(current, savedEntry));
      setActiveRatingEntryId(null);
      toast({ message: t('profile.ratingSaved'), variant: 'success' });
    } catch {
      toast({ message: t('profile.ratingSaveFailed'), variant: 'danger' });
    } finally {
      setSavingRatingId(null);
    }
  };
  const saveEntryDates = async (entry: ServerWatchEntry) => {
    if (savingDateId) return;
    const startedAt = dateInputToIso(dateDraft.startedAt);
    const completedAt = dateInputToIso(dateDraft.completedAt);

    if (startedAt === undefined || completedAt === undefined) {
      toast({ message: t('profile.invalidDate'), variant: 'danger' });
      return;
    }

    if (startedAt && completedAt && new Date(startedAt).getTime() > new Date(completedAt).getTime()) {
      toast({ message: t('profile.invalidDateRange'), variant: 'danger' });
      return;
    }

    setSavingDateId(entry.id);
    try {
      const { entry: savedEntry } = await saveAnimeProgress(entry.animeId, {
        status: entry.status,
        currentEpisode: entry.currentEpisode,
        score: entry.score,
        rewatches: entry.rewatches,
        startedAt,
        completedAt,
        review: entry.review,
      });
      setDiaryEntries((current) => upsertDiaryEntry(current, savedEntry));
      setActiveDateEntryId(null);
      toast({ message: t('profile.datesSaved'), variant: 'success' });
    } catch {
      toast({ message: t('profile.datesSaveFailed'), variant: 'danger' });
    } finally {
      setSavingDateId(null);
    }
  };

  if (authStatus === 'loading') {
    return <ProfilePageSkeleton />;
  }

  if (!user) {
    return (
      <section className={clsx(styles.page, styles.emptyState)}>
        <h2>{t('profile.title')}</h2>
        <p>{t('profile.authDescription')}</p>
        <button className={styles.discordButton} onClick={login}>{t('sidebar.loginDiscord')}</button>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <section className={styles.diaryList}>
        <div className={styles.diaryHeader}>
          <h3>{selectedFilter.label}</h3>
          <div className={styles.diaryToolbar}>
            <label className={styles.diarySearch} aria-label={t('profile.search')}>
              <input
                type="search"
                value={diarySearchQuery}
                onChange={(event) => setDiarySearchQuery(event.target.value)}
                placeholder={t('profile.search')}
              />
            </label>
            <div className={styles.diarySorts} aria-label={t('profile.sort.label')}>
              <Tooltip label={t('profile.sort.reviewed')} placement="bottom">
                <button
                  className={clsx(styles.iconSortButton, reviewedOnly && styles.activeSort)}
                  type="button"
                  onClick={() => setReviewedOnly((current) => !current)}
                  aria-label={t('profile.sort.reviewed')}
                  aria-pressed={reviewedOnly}
                >
                  <img src={reviewIcon} alt="" aria-hidden="true" />
                </button>
              </Tooltip>
              <Tooltip key={`score-${scoreSortDirection}`} label={scoreSortDirection === 'asc' ? t('profile.sort.scoreAsc') : t('profile.sort.scoreDesc')} placement="bottom">
                <button
                  className={clsx(styles.iconSortButton, styles.activeSort)}
                  type="button"
                  onClick={() => setScoreSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'))}
                  aria-label={scoreSortDirection === 'asc' ? t('profile.sort.scoreAsc') : t('profile.sort.scoreDesc')}
                  aria-pressed="true"
                >
                  <img src={scoreIcon} alt="" aria-hidden="true" />
                  <img className={clsx(styles.sortDirection, scoreSortDirection === 'asc' && styles.sortDirectionUp)} src={directionIcon} alt="" aria-hidden="true" />
                </button>
              </Tooltip>
              <Tooltip key={`recent-${recentSortDirection ?? 'off'}`} label={recentSortDirection === 'asc' ? t('profile.sort.recentAsc') : t('profile.sort.recentDesc')} placement="bottom" align="end">
                <button
                  className={clsx(styles.iconSortButton, recentSortDirection && styles.activeSort)}
                  type="button"
                  onClick={() => setRecentSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'))}
                  aria-label={recentSortDirection === 'asc' ? t('profile.sort.recentAsc') : t('profile.sort.recentDesc')}
                  aria-pressed={Boolean(recentSortDirection)}
                >
                  <img src={clockIcon} alt="" aria-hidden="true" />
                  <img className={clsx(styles.sortDirection, recentSortDirection === 'asc' && styles.sortDirectionUp)} src={directionIcon} alt="" aria-hidden="true" />
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
        {entries.length === 0 ? (
          <p className={styles.mutedCopy}>{t('profile.emptyAll')}</p>
        ) : statusEntries.length === 0 ? (
          <p className={styles.mutedCopy}>{t('profile.emptyStatus')}</p>
        ) : filteredEntries.length === 0 ? (
          <p className={styles.mutedCopy}>{t('profile.emptySearch')}</p>
        ) : (
          filteredEntries.map((entry) => (
            <article
              key={entry.id}
              className={styles.diaryRow}
              role="button"
              tabIndex={0}
              onClick={() => openDiaryAnime(entry)}
              onKeyDown={(event) => handleDiaryKeyDown(event, entry)}
            >
              {(() => {
                const startedDate = getStartedDate(entry);
                const completedDate = getCompletedDate(entry);

                return (
                  <>
              {entry.anime?.posterUrl ? <img src={entry.anime.posterUrl} alt="" /> : <div className={styles.posterFallback} />}
              <span>
                <strong>{entry.anime ? getLocalizedAnimeTitle(entry.anime, language) : entry.animeId}</strong>
                <small className={styles.diaryProgress}>
                  <span>{getEntryStatusLabel(entry)}</span>
                  <span>
                    <img src={episodeIcon} alt="" aria-hidden="true" />
                    {t('profile.episode', { episode: entry.currentEpisode })}
                  </span>
                </small>
              </span>
              <div className={styles.diaryDates}>
                <input
                  inputMode="numeric"
                  placeholder={t('profile.startedAtPlaceholder')}
                  value={activeDateEntryId === entry.id ? dateDraft.startedAt : formatDateInput(startedDate)}
                  onFocus={() => handleDateFocus(entry)}
                  onClick={(event) => handleDateClick(event, entry)}
                  onChange={updateDateDraft('startedAt')}
                  onKeyDown={(event) => handleDateKeyDown(event, entry)}
                  aria-label={t('profile.startedAt')}
                  disabled={savingDateId === entry.id}
                />
                <i aria-hidden="true">{'\u2014'}</i>
                <input
                  inputMode="numeric"
                  placeholder={t('profile.completedAtPlaceholder')}
                  value={activeDateEntryId === entry.id ? dateDraft.completedAt : formatDateInput(completedDate)}
                  onFocus={() => handleDateFocus(entry)}
                  onClick={(event) => handleDateClick(event, entry)}
                  onChange={updateDateDraft('completedAt')}
                  onKeyDown={(event) => handleDateKeyDown(event, entry)}
                  aria-label={t('profile.completedAt')}
                  disabled={savingDateId === entry.id}
                />
              </div>
              <div className={styles.diaryActions}>
                <button
                  className={clsx(styles.diaryActionButton, styles.diaryReviewAction)}
                  type="button"
                  onClick={stopDiaryAction}
                  onKeyDown={stopDiaryAction}
                  aria-label="Review"
                >
                  <img src={reviewIcon} alt="" />
                </button>
                <button
                  className={clsx(styles.diaryActionButton, styles.diaryScore)}
                  type="button"
                  onClick={(event) => toggleRatingMenu(event, entry.id)}
                  onKeyDown={stopDiaryAction}
                  aria-expanded={activeRatingEntryId === entry.id}
                >
                  <img src={scoreIcon} alt="" aria-hidden="true" />
                  {savingRatingId === entry.id ? '...' : entry.score ? `${entry.score}/10` : t('common.none')}
                </button>
                {activeRatingEntryId === entry.id ? (
                  <div className={styles.ratingMenu} onClick={(event) => event.stopPropagation()}>
                    {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
                      <button
                        key={score}
                        className={clsx(styles.ratingOption, entry.score === score && styles.activeRating)}
                        type="button"
                        onClick={(event) => saveEntryScore(event, entry, score)}
                        disabled={savingRatingId === entry.id}
                      >
                        {score}
                      </button>
                    ))}
                    <button
                      className={clsx(styles.ratingOption, entry.score == null && styles.activeRating)}
                      type="button"
                      onClick={(event) => saveEntryScore(event, entry, null)}
                      disabled={savingRatingId === entry.id}
                    >
                      {t('common.none')}
                    </button>
                  </div>
                ) : null}
              </div>
                  </>
                );
              })()}
            </article>
          ))
        )}
      </section>

      <aside className={styles.sidebar}>
        <header className={styles.header}>
          <div className={styles.avatarFrame}>
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" />
            ) : (
              <div className={styles.avatarFallbackLarge}>{user.displayName[0]}</div>
            )}
            <h2>{user.displayName}</h2>
          </div>
        </header>

        <div className={clsx(styles.sidebarContent, sidebarMode === 'settings' ? styles.slideUp : styles.slideDown)} key={sidebarMode}>
          {sidebarMode === 'stats' ? (
            <>
              <section className={styles.section} aria-labelledby="profile-watch-section">
                <h3 id="profile-watch-section">{t('profile.watchSection')}</h3>
                <div className={styles.stats} aria-label={t('profile.diaryFilter')}>
                  {profileFilters.map((filter) => (
                    <button
                      key={filter.status}
                      className={clsx(filter.status === selectedStatus && styles.activeStat)}
                      type="button"
                      onClick={() => setSelectedStatus(filter.status)}
                    >
                      <img className={styles.statIcon} src={filter.icon} alt="" aria-hidden="true" />
                      <span>{filter.label}</span>
                      <strong>{filter.count}</strong>
                    </button>
                  ))}
                </div>
              </section>
            </>
          ) : sidebarMode === 'friends' ? (
            <>
              <section className={clsx(styles.section, styles.friendsSection)} aria-labelledby="profile-friends-section">
                <div className={styles.sectionTitle}>
                  <h3 id="profile-friends-section">Друзья</h3>
                  <span>{profileFriends.length}</span>
                </div>
                <div className={styles.friendsList}>
                  {sortedFriends.slice(0, 5).map((friend) => (
                    <article key={friend.id} className={styles.friendRow}>
                      <span className={styles.friendAvatar}>{friend.name[0]}</span>
                      <span className={styles.friendName}>{friend.name}</span>
                      <span className={clsx(styles.friendStatus, friend.status === 'online' && styles.online)}>
                        {friend.status === 'online' ? 'Онлайн' : 'Оффлайн'}
                      </span>
                    </article>
                  ))}
                </div>
                <button className={styles.showAll} type="button">
                  Показать всех
                </button>
              </section>
            </>
          ) : (
            <>
              <section className={styles.section} aria-labelledby="profile-edit-section">
                <h3 id="profile-edit-section">{t('profile.title')}</h3>
                <div className={styles.settingsCard}>
                  <span>{t('profile.editSoon')}</span>
                </div>
              </section>

              <section className={clsx(styles.section, styles.integrationSection)} aria-labelledby="profile-integrations-section">
                <h3 id="profile-integrations-section">{t('profile.integrations')}</h3>
                <ShikimoriIntegration />
              </section>
            </>
          )}
        </div>

        <div className={styles.actions}>
          <Tooltip className={styles.sidebarActionTooltip} label={t('profile.stats')} placement="top" align="start">
            <button
              className={clsx(styles.sidebarAction, sidebarMode === 'stats' && styles.activeToggle)}
              type="button"
              onClick={() => setSidebarMode('stats')}
              aria-label={t('profile.stats')}
            >
              <img src={profileStatsIcon} alt="" aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip className={styles.sidebarActionTooltip} label={t('profile.friends')} placement="top">
            <button
              className={clsx(styles.sidebarAction, sidebarMode === 'friends' && styles.activeToggle)}
              type="button"
              onClick={() => setSidebarMode('friends')}
              aria-label={t('profile.friends')}
            >
              <img src={profileFriendsIcon} alt="" aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip className={styles.sidebarActionTooltip} label={t('profile.profileSettings')} placement="top">
            <button
              className={clsx(styles.sidebarAction, sidebarMode === 'settings' && styles.activeToggle)}
              type="button"
              onClick={() => setSidebarMode('settings')}
              aria-label={t('profile.profileSettings')}
            >
              <img src={settingsIcon} alt="" aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip className={styles.sidebarActionTooltip} label={t('profile.logout')} placement="top" align="end">
            <button className={clsx(styles.sidebarAction, styles.logout)} type="button" onClick={logout} aria-label={t('profile.logout')}>
              <img src={leaveRoomIcon} alt="" aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      </aside>
    </section>
  );
}

function matchesDiarySearch(entry: ServerWatchEntry, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const titles = [
    entry.anime?.title,
    entry.anime?.originalTitle,
    entry.anime?.titleRu,
    entry.anime?.titleEn,
    entry.anime?.titleJa,
    entry.anime?.titleRomaji,
    entry.animeId,
  ];

  return titles.some((title) => title?.toLowerCase().includes(normalizedQuery));
}

function compareDiaryEntries(
  left: ServerWatchEntry,
  right: ServerWatchEntry,
  options: { scoreSortDirection: SortDirection; recentSortDirection: SortDirection | null },
) {
  if (options.recentSortDirection) {
    const recentCompare = options.recentSortDirection === 'asc'
      ? dateValue(left.completedAt ?? left.updatedAt) - dateValue(right.completedAt ?? right.updatedAt)
      : dateValue(right.completedAt ?? right.updatedAt) - dateValue(left.completedAt ?? left.updatedAt);

    if (recentCompare !== 0) return recentCompare;
  }

  const scoreCompare = options.scoreSortDirection === 'asc'
    ? scoreValue(left.score, 11) - scoreValue(right.score, 11)
    : scoreValue(right.score, -1) - scoreValue(left.score, -1);

  return scoreCompare || compareUpdatedAt(left, right);
}

function compareUpdatedAt(left: ServerWatchEntry, right: ServerWatchEntry) {
  return dateValue(right.updatedAt) - dateValue(left.updatedAt);
}

function scoreValue(score: number | null, fallback: number) {
  return score ?? fallback;
}

function dateValue(value: string | null) {
  return value ? new Date(value).getTime() || 0 : 0;
}

function ProfilePageSkeleton() {
  return (
    <section className={styles.page} aria-hidden="true">
      <section className={styles.diaryList}>
        <span className={styles.diaryTitlePlaceholder} />
        {Array.from({ length: 6 }, (_, index) => (
          <article key={index} className={clsx(styles.diaryRow, styles.diarySkeleton)}>
            <div className={styles.diaryPosterPlaceholder} />
            <span className={styles.diarySkeletonContent}>
              <span className={styles.diaryLineLarge} />
              <span className={styles.diaryLineSmall} />
              <span className={styles.diaryChipPlaceholder} />
            </span>
            <div className={styles.diaryActions}>
              <span className={clsx(styles.diaryReviewAction, styles.diaryActionPlaceholder)} />
              <span className={clsx(styles.diaryScore, styles.diaryActionPlaceholder)} />
            </div>
          </article>
        ))}
      </section>

      <aside className={styles.sidebar}>
        <header className={styles.header}>
          <div className={styles.avatarFrame}>
            <span className={styles.avatarSkeleton} />
            <span className={styles.nameSkeleton} />
          </div>
        </header>
        <div className={styles.sidebarContent}>
          <section className={styles.section}>
            <span className={styles.sidebarTitlePlaceholder} />
            <div className={styles.stats}>
              {Array.from({ length: 4 }, (_, index) => (
                <span key={index} className={styles.statPlaceholder} />
              ))}
            </div>
          </section>
        </div>
        <div className={styles.actions}>
          {Array.from({ length: 4 }, (_, index) => (
            <span key={index} className={styles.sidebarActionPlaceholder} />
          ))}
        </div>
      </aside>
    </section>
  );
}

function ShikimoriIntegration() {
  const {
    authStatus,
    user,
    connectShikimori,
    disconnectShikimori,
    importShikimoriList,
  } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const canConnect = authStatus === 'ready' && Boolean(user);
  const shikimori = user?.integrations.shikimori ?? null;
  const isAuthLoading = authStatus === 'loading';
  const [disconnecting, setDisconnecting] = useState(false);
  const [importing, setImporting] = useState(false);

  async function handleDisconnect() {
    if (disconnecting) return;

    setDisconnecting(true);
    try {
      await disconnectShikimori();
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleImport() {
    if (importing) return;

    setImporting(true);
    toast(t('profile.shikimori.importPending'));

    try {
      const result = await importShikimoriList();
      const firstError = result.errors?.[0];
      const changed = result.imported + result.updated;

      if (changed > 0) {
        toast({
          message: t('profile.shikimori.importSuccess', {
            imported: result.imported,
            updated: result.updated,
            skipped: result.skipped,
          }),
          variant: 'success',
        });
      } else {
        const reason = firstError ? ` ${t('profile.shikimori.importReason', { reason: firstError.reason })}` : '';
        toast({ message: `${t('profile.shikimori.importFailed')}${reason}`, variant: 'danger' });
      }
    } catch {
      toast({ message: t('profile.shikimori.importFailedReconnect'), variant: 'danger' });
    } finally {
      setImporting(false);
    }
  }

  if (isAuthLoading) {
    return (
      <div className={clsx(styles.connectedAccount, styles.accountPlaceholder)} aria-hidden="true">
        <span className={styles.placeholderAvatar} />
        <span className={styles.placeholderCopy}>
          <span />
          <strong />
        </span>
      </div>
    );
  }

  if (shikimori) {
    return (
      <div className={styles.connectedAccount}>
        <a className={styles.connectedMain} href={shikimori.profileUrl} target="_blank" rel="noreferrer">
          <span className={styles.connectedAvatar}>
            {shikimori.avatarUrl ? <img src={shikimori.avatarUrl} alt="" /> : <span className={styles.connectedFallback}>{shikimori.nickname[0]}</span>}
            <img className={styles.connectedBadge} src={shikimoriIcon} alt="" aria-hidden="true" />
          </span>
          <span>
            <strong>{shikimori.nickname}</strong>
          </span>
        </a>
        <div className={styles.connectedActions}>
          <Tooltip className={styles.iconTooltip} label={importing ? t('profile.shikimori.importing') : t('profile.shikimori.importList')} placement="top">
            <button className={styles.iconButton} type="button" onClick={handleImport} disabled={importing}>
              {importing ? <span className={styles.buttonLoader} aria-hidden="true" /> : <img src={importIcon} alt="" aria-hidden="true" />}
            </button>
          </Tooltip>
          <Tooltip className={styles.iconTooltip} label={disconnecting ? t('profile.shikimori.disconnecting') : t('profile.shikimori.disconnect')} placement="top" align="end">
            <button className={styles.iconButton} type="button" onClick={handleDisconnect} disabled={disconnecting}>
              <img src={detachIcon} alt="" aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.integrationEmpty}>
      <p>{t('profile.shikimori.empty')}</p>
      <button className={styles.connectButton} type="button" onClick={connectShikimori} disabled={!canConnect}>
        {canConnect ? t('profile.shikimori.connect') : t('profile.shikimori.needLogin')}
      </button>
    </div>
  );
}
