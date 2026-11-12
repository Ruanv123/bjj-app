import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { applyColorScheme, type ColorSchemePreference } from '@/lib/appearance';
import { applyLanguage, type Language } from '@/lib/i18n';
import { storage } from '@/lib/storage';

type PreferencesState = {
  /** `null` = seguir o idioma do sistema. */
  language: Language | null;
  colorScheme: ColorSchemePreference;
  setLanguage: (language: Language | null) => void;
  setColorScheme: (colorScheme: ColorSchemePreference) => void;
};

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      language: null,
      colorScheme: 'system',
      setLanguage: (language) => {
        applyLanguage(language);
        set({ language });
      },
      setColorScheme: (colorScheme) => {
        applyColorScheme(colorScheme);
        set({ colorScheme });
      },
    }),
    {
      name: 'preferences',
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({ language: state.language, colorScheme: state.colorScheme }),
      onRehydrateStorage: () => (state) => {
        if (state?.language) applyLanguage(state.language);
        if (state?.colorScheme) applyColorScheme(state.colorScheme);
      },
    }
  )
);
