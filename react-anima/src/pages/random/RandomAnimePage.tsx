import randomDiceIcon from '@assets/random-dice.svg';
import trashIcon from '@assets/trash.svg';
import { useAuth } from '@features/auth/AuthProvider';
import { useWatchLibrary } from '@features/watch-library/WatchLibraryProvider';
import { useRandomAnime } from '@hooks/useRandomAnime';

export function RandomAnimePage() {
  const { user } = useAuth();
  const { openCatalogAnime } = useWatchLibrary();
  const {
    randomAnime,
    randomHistory,
    randomLoading,
    randomStatus,
    randomClearing,
    deletingRandomKey,
    handleRandomAnime,
    handleClearRandomHistory,
    handleDeleteRandomHistoryEntry,
  } = useRandomAnime(user);

  return (
    <section className="random-page">
      <div className="random-stage">
        <img className="random-dice" src={randomDiceIcon} alt="" aria-hidden="true" />
        <p className="eyebrow">Рандомайзер</p>
        <h2>Не знаешь, что посмотреть?</h2>
        <p>Жми кнопку снизу, а Anima достанет случайный тайтл из каталога Shikimori.</p>

        {randomAnime ? (
          <button className="random-card" onClick={() => openCatalogAnime(randomAnime)} type="button">
            {randomAnime.posterUrl ? <img src={randomAnime.posterUrl} alt="" /> : null}
            <div>
              <strong>{randomAnime.title}</strong>
              <small>{randomAnime.originalTitle}</small>
              <small>
                {randomAnime.episodes} сер. · {randomAnime.score ?? 'без оценки'}
              </small>
            </div>
          </button>
        ) : null}

        {randomStatus ? <p className="catalog-status">{randomStatus}</p> : null}

        <button className="random-button" onClick={handleRandomAnime} disabled={randomLoading}>
          {randomLoading ? 'Рандомим...' : randomAnime ? 'Перерандомить' : 'Срандомить'}
        </button>
      </div>

      <aside className="random-history" aria-label="История случайных аниме">
        <div className="random-history-header">
          <h3>История</h3>
          {randomHistory.length > 0 ? (
            <button type="button" onClick={handleClearRandomHistory} disabled={randomClearing}>
              {randomClearing ? 'Очищаем...' : 'Очистить'}
            </button>
          ) : null}
        </div>
        {randomHistory.length === 0 ? (
          <p className="muted-copy">Здесь появятся последние варианты.</p>
        ) : (
          randomHistory.map((item) => {
            const key = `${item.provider}-${item.providerId}`;
            return (
              <div key={key} className="random-history-row">
                <button className="random-history-open" onClick={() => openCatalogAnime(item)} type="button">
                  {item.posterUrl ? <img src={item.posterUrl} alt="" /> : <div className="poster-fallback" />}
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.score ?? 'без оценки'}</small>
                  </span>
                </button>
                <button
                  className="random-history-delete"
                  type="button"
                  aria-label={`Удалить ${item.title} из истории`}
                  disabled={deletingRandomKey === key}
                  onClick={() => handleDeleteRandomHistoryEntry(item)}
                >
                  <img src={trashIcon} alt="" aria-hidden="true" />
                </button>
              </div>
            );
          })
        )}
      </aside>
    </section>
  );
}
