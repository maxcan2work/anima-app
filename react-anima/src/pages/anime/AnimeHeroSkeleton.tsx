import clsx from 'clsx';
import { EPISODES_PER_PAGE } from './AnimeHero.constants';
import styles from './AnimeHero.module.css';

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


