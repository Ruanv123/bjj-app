import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { GroupedScreen } from '@/components/ui/grouped-screen';
import { SettingsSection } from '@/components/ui/settings-list';
import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { useBlockedUsers, useUnblockUser } from '@/features/chat/hooks';
import { showAlert } from '@/lib/alert';

export default function BlockedUsersScreen() {
  const { t } = useTranslation();
  const blocked = useBlockedUsers();
  const unblock = useUnblockUser();

  return (
    <GroupedScreen>
      <Stack.Screen options={{ title: t('chat.blockedUsers') }} />
      {blocked.isPending ? (
        <ActivityIndicator />
      ) : (blocked.data ?? []).length === 0 ? (
        <ThemedText themeColor="textSecondary" style={styles.empty}>
          {t('chat.noBlockedUsers')}
        </ThemedText>
      ) : (
        <SettingsSection withIcons={false}>
          {(blocked.data ?? []).map((user) => (
            <View key={user.id} style={styles.row}>
              <Avatar name={user.name} url={user.avatarUrl} size={36} />
              <ThemedText numberOfLines={1} style={styles.name}>
                {user.name}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t('chat.unblock')} ${user.name}`}
                hitSlop={8}
                disabled={unblock.isPending}
                onPress={() =>
                  unblock.mutate(user.id, { onError: () => showAlert(t('chat.blockError')) })
                }>
                <ThemedText type="smallBold" themeColor="primary">
                  {t('chat.unblock')}
                </ThemedText>
              </Pressable>
            </View>
          ))}
        </SettingsSection>
      )}
      <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
        {t('chat.blockedHint')}
      </ThemedText>
    </GroupedScreen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
  },
  name: {
    flex: 1,
  },
  empty: {
    textAlign: 'center',
    paddingTop: Spacing.four,
  },
  hint: {
    paddingHorizontal: Spacing.one,
  },
});
