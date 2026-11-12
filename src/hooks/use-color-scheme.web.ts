import { useSyncExternalStore } from "react";
import { useColorScheme as useRNColorScheme } from "react-native";

import { usePreferences } from "@/stores/preferences";

const subscribe = () => () => {};

/**
 * Na web o tema é recalculado no cliente (renderização estática) e respeita
 * a preferência salva, já que `Appearance.setColorScheme` não existe aqui.
 */
export function useColorScheme() {
  const hasHydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const systemScheme = useRNColorScheme();
  const preference = usePreferences((s) => s.colorScheme);

  if (!hasHydrated) return "light";
  return preference === "system" ? systemScheme : preference;
}
