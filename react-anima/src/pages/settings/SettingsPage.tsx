import flagEnIcon from '@assets/flag-en.svg';
import flagJaIcon from '@assets/flag-ja.svg';
import flagRuIcon from '@assets/flag-ru.svg';
import settingsIcon from '@assets/settings.svg';
import { APP_LANGUAGES, useI18n, type AppLanguage } from '@shared/i18n/I18nProvider';
import { Button, IconButton, SectionHeader } from '@shared/ui';
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
        <SectionHeader
          title={t('settings.theme')}
          description={t('settings.themeDescription')}
          action={<Button variant="neutral" disabled>{t('common.soon')}</Button>}
        />
      </section>

      <section className={styles.panel}>
        <SectionHeader
          title={t('settings.language')}
          description={t('settings.languageDescription')}
          action={(
            <div className={styles.languageList} aria-label={t('settings.language')}>
              {APP_LANGUAGES.map((item) => (
                <IconButton
                  key={item.value}
                  className={styles.languageButton}
                  active={language === item.value}
                  aria-label={item.nativeLabel}
                  aria-pressed={language === item.value}
                  title={item.nativeLabel}
                  onClick={() => setLanguage(item.value)}
                >
                  <img src={LANGUAGE_FLAG_ICONS[item.value]} alt="" aria-hidden="true" />
                </IconButton>
              ))}
            </div>
          )}
        />
      </section>
    </section>
  );
}
