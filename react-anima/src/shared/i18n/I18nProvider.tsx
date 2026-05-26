import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { dictionaries, type TranslationKey } from './dictionaries';

export type AppLanguage = 'ru' | 'en' | 'ja';

type I18nContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
};

export const APP_LANGUAGES: Array<{ value: AppLanguage; label: string; nativeLabel: string }> = [
  { value: 'ru', label: 'Russian', nativeLabel: 'Русский' },
  { value: 'en', label: 'English', nativeLabel: 'English' },
  { value: 'ja', label: 'Japanese', nativeLabel: '日本語' },
];

const LANGUAGE_STORAGE_KEY = 'anima-language';
const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(loadLanguage);

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<I18nContextValue>(() => ({
    language,
    setLanguage: setLanguageState,
    t: (key, params) => {
      const template = dictionaries[language][key] ?? dictionaries.ru[key] ?? key;
      if (!params) return template;

      return Object.entries(params).reduce(
        (text, [paramKey, paramValue]) => text.replaceAll(`{${paramKey}}`, String(paramValue)),
        template,
      );
    },
  }), [language]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return context;
}

function loadLanguage(): AppLanguage {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (isAppLanguage(stored)) return stored;

  const browserLanguage = navigator.language.toLowerCase();
  if (browserLanguage.startsWith('ja')) return 'ja';
  if (browserLanguage.startsWith('en')) return 'en';
  return 'ru';
}

function isAppLanguage(value: string | null): value is AppLanguage {
  return value === 'ru' || value === 'en' || value === 'ja';
}
