import type { CatalogSearchResult } from '../../api';
import randomDiceIcon from '../../assets/random-dice.svg';
import trashIcon from '../../assets/trash.svg';

type RandomAnimePageProps = {
  randomAnime: CatalogSearchResult | null;
  history: CatalogSearchResult[];
  loading: boolean;
  status: string;
  clearing: boolean;
  deletingKey: string;
  onOpenAnime: (result: CatalogSearchResult) => void;
  onRandomize: () => void;
  onClearHistory: () => void;
  onDeleteHistoryEntry: (result: CatalogSearchResult) => void;
};

export function RandomAnimePage({
  randomAnime,
  history,
  loading,
  status,
  clearing,
  deletingKey,
  onOpenAnime,
  onRandomize,
  onClearHistory,
  onDeleteHistoryEntry,
}: RandomAnimePageProps) {
  return (
    <section className="random-page">
      <div className="random-stage">
        <img className="random-dice" src={randomDiceIcon} alt="" aria-hidden="true" />
        <p className="eyebrow">Рандомайзер</p>
        <h2>Не знаешь, что посмотреть?</h2>
        <p>Жми кнопку снизу, а Anima достанет случайный тайтл из каталога Shikimori.</p>

        {randomAnime ? (
          <button className="random-card" onClick={() => onOpenAnime(randomAnime)} type="button">
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

        {status ? <p className="catalog-status">{status}</p> : null}

        <button className="random-button" onClick={onRandomize} disabled={loading}>
          {loading ? 'Рандомим...' : randomAnime ? 'Перерандомить' : 'Срандомить'}
        </button>
      </div>

      <aside className="random-history" aria-label="История случайных аниме">
        <div className="random-history-header">
          <h3>История</h3>
          {history.length > 0 ? (
            <button type="button" onClick={onClearHistory} disabled={clearing}>
              {clearing ? 'Очищаем...' : 'Очистить'}
            </button>
          ) : null}
        </div>
        {history.length === 0 ? (
          <p className="muted-copy">Здесь появятся последние варианты.</p>
        ) : (
          history.map((item) => {
            const key = `${item.provider}-${item.providerId}`;
            return (
              <div key={key} className="random-history-row">
                <button className="random-history-open" onClick={() => onOpenAnime(item)} type="button">
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
                  disabled={deletingKey === key}
                  onClick={() => onDeleteHistoryEntry(item)}
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
