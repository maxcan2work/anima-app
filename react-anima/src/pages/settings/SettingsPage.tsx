import clsx from 'clsx';
import flagEnIcon from '@assets/flag-en.svg';
import flagJaIcon from '@assets/flag-ja.svg';
import flagRuIcon from '@assets/flag-ru.svg';
import settingsIcon from '@assets/settings.svg';
import { APP_LANGUAGES, useI18n, type AppLanguage } from '@shared/i18n/I18nProvider';
import styles from './SettingsPage.module.css';

const LANGUAGE_FLAG_ICONS: Record<AppLanguage, string> = {
  ru: flagRuIcon,
  en: flagEnIcon,
  ja: flagJaIcon,
};

export function SettingsPage() {
  const { language, setLanguage, t } = useI18n();

  return (
    <section className={styles.page}>
      <header className={styles.hero}>
        <span className={styles.icon} aria-hidden="true">
          <img src={settingsIcon} alt="" />
        </span>
        <div>
          <p className="eyebrow">Anima</p>
          <h2>{t('settings.title')}</h2>
          <p>{t('settings.description')}</p>
        </div>
      </header>

      <section className={styles.panel}>
        <div>
          <h3>{t('settings.theme')}</h3>
          <p>{t('settings.themeDescription')}</p>
        </div>
        <button type="button" disabled>
          {t('common.soon')}
        </button>
      </section>

      <section className={styles.panel}>
        <div>
          <h3>{t('settings.language')}</h3>
          <p>{t('settings.languageDescription')}</p>
        </div>
        <div className={styles.languageList} aria-label={t('settings.language')}>
          {APP_LANGUAGES.map((item) => (
            <button
              key={item.value}
              className={clsx(styles.languageButton, language === item.value && styles.languageButtonActive)}
              type="button"
              aria-label={item.nativeLabel}
              aria-pressed={language === item.value}
              title={item.nativeLabel}
              onClick={() => setLanguage(item.value)}
            >
              <img src={LANGUAGE_FLAG_ICONS[item.value]} alt="" aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}
