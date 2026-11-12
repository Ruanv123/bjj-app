import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { GroupedScreen } from '@/components/ui/grouped-screen';
import { SettingsOption, SettingsSection } from '@/components/ui/settings-list';
import { languageNames, supportedLanguages } from '@/lib/i18n';
import { usePreferences } from '@/stores/preferences';

export default function LanguageScreen() {
  const { t } = useTranslation();
  const language = usePreferences((s) => s.language);
  const setLanguage = usePreferences((s) => s.setLanguage);

  return (
    <GroupedScreen>
      <Stack.Screen options={{ title: t('settings.language') }} />
      <SettingsSection withIcons={false}>
        <SettingsOption
          label={t('settings.system')}
          selected={language === null}
          onPress={() => setLanguage(null)}
        />
        {supportedLanguages.map((code) => (
          <SettingsOption
            key={code}
            label={languageNames[code]}
            selected={language === code}
            onPress={() => setLanguage(code)}
          />
        ))}
      </SettingsSection>
    </GroupedScreen>
  );
}
