import clsx from 'clsx';
import styles from './GenreMarquee.module.css';

type GenreMarqueeProps = {
  ariaLabel: string;
  className?: string;
  genres: string[];
};

export function GenreMarquee({ ariaLabel, className, genres }: GenreMarqueeProps) {
  if (genres.length === 0) return null;

  return (
    <div className={clsx(styles.genres, className)} tabIndex={0} aria-label={ariaLabel}>
      <div className={styles.track}>
        {genres.map((genre) => (
          <span key={genre}>{genre}</span>
        ))}
      </div>
    </div>
  );
}
