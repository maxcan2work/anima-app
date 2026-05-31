import clsx from 'clsx';
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { getLocalizedAnimeTitle } from '@anima/core';
import { importCatalogAnime, type AnimeExtendedDetails, type CatalogSearchResult } from '@/api';
import type { AnimeTitle } from '@/data';
import { useI18n } from '@shared/i18n/I18nProvider';
import { animeRouteFromCatalog, animeRouteSlug } from '@shared/navigation';
import styles from './AnimeHero.module.css';

export function AnimeDetailsSections({
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
      const currentText = textRef.current;
      if (!currentText) return;

      const offset = Math.max(0, currentText.scrollWidth - currentText.clientWidth);
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
      } as CSSProperties}
    >
      <strong ref={textRef}>
        <em>{name}</em>
      </strong>
    </span>
  );
}
