import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { useDisplayProfile } from '@/features/profile/hooks';
import { useTheme } from '@/hooks/use-theme';

export function ComposePrompt({ parentId }: { parentId?: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const profile = useDisplayProfile();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(parentId ? 'feed.reply' : 'feed.compose')}
      onPress={() =>
        router.push({ pathname: '/posts/compose', params: parentId ? { parentId } : {} })
      }
      style={({ pressed }) => [
        styles.prompt,
        { borderBottomColor: theme.border, opacity: pressed ? 0.6 : 1 },
      ]}>
      <Avatar name={profile.name ?? t('profile.defaultName')} url={profile.avatarUrl} size={44} />
      <ThemedText themeColor="textSecondary" style={styles.placeholder}>
        {t(parentId ? 'feed.replyPlaceholder' : 'feed.placeholder')}
      </ThemedText>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  prompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 100,
    padding: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  placeholder: { flex: 1, fontSize: 16, lineHeight: 23 },
});
