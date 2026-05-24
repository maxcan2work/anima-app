import settingsIcon from '../../assets/settings.svg';

export function SettingsPage() {
  return (
    <section className="settings-page">
      <header className="settings-hero">
        <span className="settings-icon" aria-hidden="true">
          <img src={settingsIcon} alt="" />
        </span>
        <div>
          <p className="eyebrow">Anima</p>
          <h2>Настройки</h2>
          <p>Здесь будут общие параметры приложения.</p>
        </div>
      </header>

      <section className="settings-panel">
        <div>
          <h3>Тема</h3>
          <p>Позже добавим выбор светлой, тёмной и системной темы.</p>
        </div>
        <button type="button" disabled>
          Скоро
        </button>
      </section>

      <section className="settings-panel">
        <div>
          <h3>Язык</h3>
          <p>Здесь будет выбор языка интерфейса.</p>
        </div>
        <button type="button" disabled>
          Скоро
        </button>
      </section>
    </section>
  );
}
