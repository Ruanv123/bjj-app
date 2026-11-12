import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { GroupedScreen } from '@/components/ui/grouped-screen';
import { SettingsOption, SettingsSection } from '@/components/ui/settings-list';
import type { ColorSchemePreference } from '@/lib/appearance';
import { usePreferences } from '@/stores/preferences';

const OPTIONS: ColorSchemePreference[] = ['system', 'light', 'dark'];

export default function AppearanceScreen() {
  const { t } = useTranslation();
  const colorScheme = usePreferences((s) => s.colorScheme);
  const setColorScheme = usePreferences((s) => s.setColorScheme);

  return (
    <GroupedScreen>
      <Stack.Screen options={{ title: t('settings.appearance') }} />
      <SettingsSection withIcons={false}>
        {OPTIONS.map((option) => (
          <SettingsOption
            key={option}
            label={t(`settings.${option}`)}
            selected={colorScheme === option}
            onPress={() => setColorScheme(option)}
          />
        ))}
      </SettingsSection>
    </GroupedScreen>
  );
}
