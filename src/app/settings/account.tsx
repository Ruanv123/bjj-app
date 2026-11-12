import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { GroupedScreen } from '@/components/ui/grouped-screen';
import { SettingsRow, SettingsSection } from '@/components/ui/settings-list';
import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { useUser } from '@/features/auth/auth-provider';
import { useDeleteAccount, useSignOutEverywhere } from '@/features/profile/hooks';
import { getProviderName } from '@/features/profile/utils';
import { showAlert } from '@/lib/alert';
import { confirmDestructive } from '@/lib/confirm';

export default function AccountScreen() {
  const { t, i18n } = useTranslation();
  const user = useUser();
  const signOutEverywhere = useSignOutEverywhere();
  const deleteAccount = useDeleteAccount();

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(i18n.language, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : undefined;

  async function handleSignOutEverywhere() {
    const confirmed = await confirmDestructive({
      title: t('account.signOutEverywhereConfirm'),
      confirmLabel: t('account.signOutEverywhereAction'),
      cancelLabel: t('account.cancel'),
    });
    if (confirmed) {
      signOutEverywhere.mutate(undefined, { onError: () => showAlert(t('account.genericError')) });
    }
  }

  async function handleDelete() {
    // Duas confirmações: a ação é irreversível.
    const first = await confirmDestructive({
      title: `${t('account.deleteConfirmTitle')}\n\n${t('account.deleteAccountHint')}`,
      confirmLabel: t('account.deleteConfirmAction'),
      cancelLabel: t('account.cancel'),
    });
    if (!first) return;
    const second = await confirmDestructive({
      title: t('account.deleteFinalTitle'),
      confirmLabel: t('account.deleteFinalAction'),
      cancelLabel: t('account.cancel'),
    });
    if (!second) return;
    // Ao terminar, a sessão some e o app volta sozinho para o login.
    deleteAccount.mutate(undefined, { onError: () => showAlert(t('account.deleteError')) });
  }

  const busy = signOutEverywhere.isPending || deleteAccount.isPending;

  return (
    <GroupedScreen>
      <Stack.Screen options={{ title: t('account.title') }} />

      <SettingsSection>
        <SettingsRow
          icon={{ ios: 'envelope', android: 'mail', web: 'mail' }}
          label={t('account.email')}
          value={user?.email ?? '—'}
        />
        <SettingsRow
          icon={{ ios: 'person.badge.key', android: 'key', web: 'key' }}
          label={t('account.signInMethod')}
          value={getProviderName(user) ?? '—'}
        />
        <SettingsRow
          icon={{ ios: 'calendar', android: 'calendar_today', web: 'calendar_today' }}
          label={t('account.memberSince')}
          value={memberSince ?? '—'}
        />
      </SettingsSection>

      <SettingsSection title={t('account.sectionSecurity')}>
        <SettingsRow
          icon={{ ios: 'iphone.and.arrow.forward', android: 'devices', web: 'devices' }}
          label={t('account.signOutEverywhere')}
          onPress={busy ? undefined : handleSignOutEverywhere}
        />
      </SettingsSection>

      <View style={styles.danger}>
        <SettingsSection title={t('account.sectionDanger')}>
          <SettingsRow
            icon={{ ios: 'trash', android: 'delete', web: 'delete' }}
            label={t('account.deleteAccount')}
            destructive
            onPress={busy ? undefined : handleDelete}
          />
        </SettingsSection>
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          {t('account.deleteAccountHint')}
        </ThemedText>
      </View>

      {busy ? <ActivityIndicator /> : null}
    </GroupedScreen>
  );
}

const styles = StyleSheet.create({
  danger: {
    gap: Spacing.two,
  },
  hint: {
    paddingHorizontal: Spacing.one,
  },
});
