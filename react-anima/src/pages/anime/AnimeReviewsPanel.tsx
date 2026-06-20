import clsx from 'clsx';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { saveAnimeReview, type AnimeReview, type AnimeReviewScores, type SaveAnimeReviewPayload } from '@/api';
import clockIcon from '@assets/clock-three.svg';
import episodeArrowIcon from '@assets/episode-arrow.svg';
import SpoilerOffIcon from '@assets/spoiler-off.svg?react';
import SpoilerWarningIcon from '@assets/spoiler-warning.svg?react';
import starIcon from '@assets/star.svg';
import ThumbUpIcon from '@assets/thumb-up.svg?react';
import type { AnimeTitle } from '@/data';
import { useI18n } from '@shared/i18n/I18nProvider';
import { Button, Tooltip } from '@shared/ui';
import { useToast } from '@shared/ui/ToastProvider';
import type { ReviewDraft, ReviewSortKey, SortDirection } from './AnimeHero.types';
import styles from './AnimeHero.module.css';

export function ReviewsPanel({
  anime,
  reviews,
  loading,
  error,
  selectedReview,
  onSelectReview,
  onBack,
  onReviewSaved,
  composeReviewId,
  signedIn,
}: {
  anime: AnimeTitle;
  reviews: AnimeReview[];
  loading: boolean;
  error: boolean;
  selectedReview: AnimeReview | null;
  onSelectReview: (reviewId: string) => void;
  onBack: () => void;
  onReviewSaved: (review: AnimeReview) => void;
  composeReviewId?: string | null;
  signedIn: boolean;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [reviewSortKey, setReviewSortKey] = useState<ReviewSortKey>('recent');
  const [reviewSortDirection, setReviewSortDirection] = useState<SortDirection>('desc');
  const [isComposing, setIsComposing] = useState(false);
  const composeReview = composeReviewId && composeReviewId !== 'new'
    ? reviews.find((review) => review.id === composeReviewId) ?? null
    : null;
  const sortedReviews = useMemo(
    () => sortReviews(reviews, reviewSortKey, reviewSortDirection),
    [reviewSortDirection, reviewSortKey, reviews],
  );
  const startReview = () => {
    if (!signedIn) {
      toast({ message: t('anime.reviewLoginRequired'), variant: 'warning' });
      return;
    }

    setIsComposing(true);
  };

  useEffect(() => {
    if (composeReviewId && signedIn) {
      setIsComposing(true);
    }
  }, [composeReviewId, signedIn]);

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
                {splitReviewBody(selectedReview.body).map((paragraph, index) => (
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
        <ReviewComposeForm
          key={`${reviewDraftStorageKey(anime)}:${composeReview?.id ?? 'new'}`}
          animeId={anime.id}
          draftKey={reviewDraftStorageKey(anime)}
          initialReview={composeReview}
          onBack={() => {
            setIsComposing(false);
            onBack();
          }}
          onSaved={(review) => {
            setIsComposing(false);
            onReviewSaved(review);
          }}
        />
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
            <Button className={styles.reviewWriteButton} variant="tonal" size="sm" onClick={startReview}>
              {t('anime.reviewWrite')}
            </Button>
          </div>
          <div className={styles.reviewsGrid} aria-label={t('anime.reviews')}>
          {loading ? (
            Array.from({ length: 4 }, (_, index) => (
              <div key={`review-placeholder-${index}`} className={clsx(styles.reviewCard, styles.reviewCardPlaceholder)} />
            ))
          ) : error ? (
            <div className={styles.reviewsErrorState} role="status">
              <ReviewSadIcon />
              <p>{t('anime.reviewsLoadFailed')}</p>
            </div>
          ) : sortedReviews.length === 0 ? (
            <div className={styles.reviewsEmptyState}>
              <ReviewSadIcon />
              <strong>{t('anime.reviewsEmpty')}</strong>
              <p>{t('anime.reviewsEmptyDescription')}</p>
              <Button className={styles.reviewsEmptyAction} onClick={startReview}>
                {t('anime.reviewWriteFirst')}
              </Button>
            </div>
          ) : sortedReviews.map((review, index) => (
            <button
              key={review.id}
              className={styles.reviewCard}
              type="button"
              style={{ '--review-card-delay': `${Math.min(index, 8) * 45 + 40}ms` } as CSSProperties}
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

function ReviewSadIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="24" />
      <path d="M23 27.5H23.1" />
      <path d="M41 27.5H41.1" />
      <path d="M23.5 43C25.8 39.8 28.6 38.25 32 38.25C35.4 38.25 38.2 39.8 40.5 43" />
    </svg>
  );
}

function ReviewComposeForm({
  animeId,
  draftKey,
  initialReview,
  onBack,
  onSaved,
}: {
  animeId: string;
  draftKey: string;
  initialReview?: AnimeReview | null;
  onBack: () => void;
  onSaved: (review: AnimeReview) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const initialDraft = useMemo(() => initialReview ? null : readReviewDraft(draftKey), [draftKey, initialReview]);
  const defaultAspectScores: AnimeReviewScores = {
    story: 8,
    characters: 8,
    visuals: 8,
    music: 8,
    opening: 8,
    atmosphere: 8,
  };
  const [reviewTitle, setReviewTitle] = useState(initialDraft?.title ?? initialReview?.title ?? '');
  const [reviewBody, setReviewBody] = useState(initialDraft?.body ?? initialReview?.body ?? '');
  const [overallScore, setOverallScore] = useState(initialDraft?.overallScore ?? initialReview?.score ?? 8);
  const [recommended, setRecommended] = useState(initialDraft?.recommended ?? initialReview?.recommended ?? true);
  const [hasSpoilers, setHasSpoilers] = useState(initialDraft?.hasSpoilers ?? initialReview?.hasSpoilers ?? false);
  const [aspectScores, setAspectScores] = useState<AnimeReviewScores>(initialDraft?.aspectScores ?? initialReview?.scores ?? defaultAspectScores);
  const [saving, setSaving] = useState(false);
  const aspects: Array<{ key: keyof AnimeReviewScores; label: string }> = [
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

  async function submitReview() {
    if (saving) return;

    const payload: SaveAnimeReviewPayload = {
      title: reviewTitle.trim(),
      body: reviewBody.trim(),
      score: overallScore,
      recommended,
      hasSpoilers,
      scores: aspectScores,
    };

    if (!payload.title || !payload.body) {
      toast({ message: t('anime.reviewSaveRequired'), variant: 'danger' });
      return;
    }

    setSaving(true);
    try {
      const { review } = await saveAnimeReview(animeId, payload);
      clearReviewDraft(draftKey);
      toast({ message: t('anime.reviewSaved'), variant: 'success' });
      onSaved(review);
    } catch {
      toast({ message: t('anime.reviewSaveFailed'), variant: 'danger' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className={styles.reviewCompose}
      onSubmit={(event) => {
        event.preventDefault();
        void submitReview();
      }}
    >
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
          <button type="submit" disabled={saving}>{saving ? '...' : t('anime.reviewPublish')}</button>
        </div>
      </aside>
    </form>
  );
}

function sortReviews(reviews: AnimeReview[], sortKey: ReviewSortKey, direction: SortDirection) {
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

function splitReviewBody(body: string) {
  return body.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
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

function clearReviewDraft(storageKey: string) {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // localStorage can be unavailable in private mode.
  }
}

function normalizeReviewScore(value: unknown, fallback: number) {
  return Math.min(10, Math.max(1, Math.round(Number(value) || fallback)));
}

function normalizeAspectScores(value: unknown): AnimeReviewScores {
  const source = typeof value === 'object' && value ? value as Partial<AnimeReviewScores> : {};

  return {
    story: normalizeReviewScore(source.story, 8),
    characters: normalizeReviewScore(source.characters, 8),
    visuals: normalizeReviewScore(source.visuals, 8),
    music: normalizeReviewScore(source.music, 8),
    opening: normalizeReviewScore(source.opening, 8),
    atmosphere: normalizeReviewScore(source.atmosphere, 8),
  };
}

function ReviewScores({ review }: { review: AnimeReview }) {
  const { t } = useI18n();
  const scores: Array<{ key: keyof AnimeReviewScores; label: string }> = [
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

function ReviewReactions({ review }: { review: AnimeReview }) {
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
