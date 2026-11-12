import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { useUser } from '@/features/auth/auth-provider';
import { useDisplayProfile } from '@/features/profile/hooks';
import { useTheme } from '@/hooks/use-theme';

export function ProfileCard({ onEdit }: { onEdit: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const user = useUser();

  const profile = useDisplayProfile();
  const name = profile.name ?? t('profile.defaultName');

  return (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      <Avatar name={name} url={profile.avatarUrl} size={56} />
      <View style={styles.info}>
        <ThemedText style={styles.name} numberOfLines={1}>
          {user ? name : t('settings.guest')}
        </ThemedText>
        {user?.email ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {user.email}
          </ThemedText>
        ) : null}
        {user ? (
          <Pressable
            accessibilityRole="button"
            onPress={onEdit}
            hitSlop={8}
            style={({ pressed }) => [styles.edit, { opacity: pressed ? 0.6 : 1 }]}>
            <SymbolView
              name={{ ios: 'pencil', android: 'edit', web: 'edit' }}
              tintColor={theme.primary}
              size={13}
            />
            <ThemedText type="small" style={{ color: theme.primary }}>
              {t('settings.editProfile')}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  info: {
    flex: 1,
    gap: Spacing.half,
  },
  name: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 700,
  },
  edit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
    marginTop: Spacing.half,
  },
});
