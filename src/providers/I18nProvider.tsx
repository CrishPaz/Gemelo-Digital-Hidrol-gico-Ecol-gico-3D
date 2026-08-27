/**
 * I18nProvider - Idioma de la interfaz (español / inglés).
 *
 * Deliberadamente mínimo: un diccionario plano y una función `t`. No se añade una
 * librería de i18n porque el proyecto no necesita pluralización, formatos de fecha
 * por locale ni carga diferida de catálogos, y una dependencia más complicaría el
 * build sin aportar nada aquí.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DICTIONARY, Locale, TranslationKey } from '../i18n/dictionary';

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  toggleLocale: () => void;
  t: (key: TranslationKey) => string;
  /**
   * Traducción de CONTENIDO, no de interfaz.
   *
   * Los expedientes oficiales de `reportsData.ts` se redactan en español porque son
   * documentos institucionales peruanos: ese archivo es la fuente de verdad. En vez
   * de duplicarlo, el inglés se superpone desde el diccionario y, si falta una
   * cadena, se devuelve el original en español en lugar de la clave cruda.
   */
  td: (key: TranslationKey, fallback: string) => string;
}

const STORAGE_KEY = 'hydrotwin.locale';

const I18nContext = createContext<I18nContextValue>({
  locale: 'es',
  setLocale: () => undefined,
  toggleLocale: () => undefined,
  t: (key: TranslationKey) => DICTIONARY.es[key] ?? key,
  td: (_key: TranslationKey, fallback: string) => fallback,
});

function readInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'es' || stored === 'en') return stored;
    // El proyecto es peruano: el español es el predeterminado salvo que el
    // navegador declare explícitamente inglés.
    if (navigator.language?.toLowerCase().startsWith('en')) return 'en';
  } catch {
    /* sin acceso a localStorage o navigator: se usa español */
  }
  return 'es';
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(readInitialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* preferencia no persistida */
    }
  }, [locale]);

  const setLocale = useCallback((l: Locale) => setLocaleState(l), []);
  const toggleLocale = useCallback(
    () => setLocaleState(l => (l === 'es' ? 'en' : 'es')),
    []
  );

  const t = useCallback(
    (key: TranslationKey) => {
      const table = DICTIONARY[locale] as Record<string, string>;
      // Si falta una cadena en inglés se cae al español antes que a la clave cruda:
      // una etiqueta en el idioma equivocado es menos dañina que ver "twin.title".
      return table[key] ?? (DICTIONARY.es as Record<string, string>)[key] ?? key;
    },
    [locale]
  );

  const td = useCallback(
    (key: TranslationKey, fallback: string) => {
      const table = DICTIONARY[locale] as Record<string, string>;
      return table[key] ?? fallback;
    },
    [locale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, toggleLocale, t, td }),
    [locale, setLocale, toggleLocale, t, td]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
