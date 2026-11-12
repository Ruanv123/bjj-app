import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/ui/themed-text';

export default function NotificationsScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('tabs.notifications')}>
      <ThemedText themeColor="textSecondary">{t('notifications.empty')}</ThemedText>
    </Screen>
  );
}
