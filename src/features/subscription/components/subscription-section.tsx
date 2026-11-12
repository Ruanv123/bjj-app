import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { SettingsRow, SettingsSection } from '@/components/ui/settings-list';
import { showAlert } from '@/lib/alert';
import { getErrorMessage } from '@/lib/errors';

import { Placements } from '../config';
import { useSubscription } from '../context';

/** "Seja Premium" e "Restaurar compras" (a App Store exige um botão de restaurar). */
export function SubscriptionSection() {
  const { t } = useTranslation();
  const { isEnabled, isPremium, showPaywall, restorePurchases } = useSubscription();

  const restore = useMutation({ mutationFn: restorePurchases });

  if (!isEnabled) return null;

  function handleRestore() {
    restore.mutate(undefined, {
      onSuccess: (restored) =>
        restored
          ? showAlert(t('subscription.restoredTitle'), t('subscription.restoredMessage'))
          : showAlert(t('subscription.nothingTitle'), t('subscription.nothingMessage')),
      onError: (error) =>
        showAlert(t('subscription.restoreError'), getErrorMessage(error, t('common.tryAgain'))),
    });
  }

  return (
    <SettingsSection title={t('subscription.section')}>
      {isPremium ? (
        <SettingsRow
          icon={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }}
          label={t('subscription.active')}
        />
      ) : (
        <SettingsRow
          icon={{ ios: 'star.fill', android: 'star', web: 'star' }}
          label={t('subscription.upgrade')}
          onPress={() => showPaywall(Placements.upgrade)}
        />
      )}
      <SettingsRow
        icon={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }}
        label={t('subscription.restore')}
        onPress={restore.isPending ? undefined : handleRestore}
      />
    </SettingsSection>
  );
}
