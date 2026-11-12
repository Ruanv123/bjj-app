import { Appearance, Platform } from 'react-native';

export type ColorSchemePreference = 'system' | 'light' | 'dark';

/**
 * Força o tema do app (iOS/Android). Afeta também componentes nativos
 * (alertas, teclado, player). Na web, `useColorScheme.web` lê a preferência.
 */
export function applyColorScheme(preference: ColorSchemePreference) {
  if (Platform.OS === 'web') return;
  Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
}
