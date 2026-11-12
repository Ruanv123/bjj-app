import { getLocales } from 'expo-localization';
import i18n, { changeLanguage, use as registerPlugin } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { AppState, Platform } from 'react-native';

import { de } from './locales/de';
import { en } from './locales/en';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { it } from './locales/it';
import { pt } from './locales/pt';
import { ptPT } from './locales/pt-PT';

export const defaultNS = 'translation';
export const resources = {
  pt: { translation: pt },
  'pt-PT': { translation: ptPT },
  en: { translation: en },
  de: { translation: de },
  es: { translation: es },
  fr: { translation: fr },
  it: { translation: it },
} as const;

export type Language = keyof typeof resources;
export const supportedLanguages = Object.keys(resources) as Language[];
export const fallbackLanguage: Language = 'pt';

/** Nome de cada idioma escrito nele mesmo (não se traduz). */
export const languageNames: Record<Language, string> = {
  pt: 'Português (Brasil)',
  'pt-PT': 'Português (Portugal)',
  en: 'English',
  de: 'Deutsch',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
};

function isLanguage(value: string | null | undefined): value is Language {
  return !!value && value in resources;
}

export function getSystemLanguage(): Language {
  const locale = getLocales()[0];
  // O tag completo distingue variantes, ex.: pt-PT; o código sozinho vira 'pt'.
  if (isLanguage(locale?.languageTag)) return locale.languageTag;
  const code = locale?.languageCode;
  return isLanguage(code) ? code : fallbackLanguage;
}

let followSystem = true;

/** `null` = seguir o idioma do sistema. */
export function applyLanguage(language: Language | null) {
  followSystem = language === null;
  changeLanguage(language ?? getSystemLanguage());
}

registerPlugin(initReactI18next).init({
  resources,
  defaultNS,
  lng: getSystemLanguage(),
  fallbackLng: fallbackLanguage,
  supportedLngs: supportedLanguages,
  interpolation: { escapeValue: false }, // o React já escapa
  initAsync: false,
});

// No Android, trocar o idioma do sistema não reinicia o app: relemos ao voltar.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active' && followSystem) {
      changeLanguage(getSystemLanguage());
    }
  });
}

export default i18n;
