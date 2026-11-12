import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';

import { useJoinCommunity } from '../hooks';
import { chatErrorCode, type Community } from '../types';

function openConversation(id: string) {
  router.push({ pathname: '/chat/[id]', params: { id } });
}

export function CommunityRow({ community }: { community: Community }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const join = useJoinCommunity();

  function handlePress() {
    if (community.isMember) {
      openConversation(community.conversationId);
      return;
    }
    join.mutate(community.id, {
      onSuccess: openConversation,
      onError: (error) =>
        showAlert(chatErrorCode(error) === 'banned' ? t('chat.bannedError') : t('chat.joinError')),
    });
  }

  const members =
    community.memberCount === 1 ? t('chat.memberOne') : t('chat.members', { n: community.memberCount });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={community.name}
      accessibilityHint={community.isMember ? t('chat.open') : t('chat.join')}
      onPress={handlePress}
      disabled={join.isPending}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
      <Avatar name={community.name} url={community.avatarUrl} size={48} />
      <View style={styles.content}>
        <View style={styles.nameRow}>
          {community.isPrivate ? (
            <SymbolView
              name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
              tintColor={theme.textSecondary}
              size={13}
              accessibilityLabel={t('chat.private')}
            />
          ) : null}
          <ThemedText type="smallBold" numberOfLines={1} style={styles.name}>
            {community.name}
          </ThemedText>
        </View>
        {community.description ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {community.description}
          </ThemedText>
        ) : null}
        <ThemedText type="small" themeColor="textSecondary">
          {members}
        </ThemedText>
      </View>
      <View
        style={[
          styles.action,
          { backgroundColor: community.isMember ? theme.backgroundElement : theme.primary },
        ]}>
        {join.isPending ? (
          <ActivityIndicator size="small" color={theme.onPrimary} />
        ) : (
          <ThemedText
            type="smallBold"
            style={{ color: community.isMember ? theme.text : theme.onPrimary }}>
            {community.isMember ? t('chat.open') : t('chat.join')}
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
  },
  content: {
    flex: 1,
    gap: Spacing.half,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  name: {
    flexShrink: 1,
  },
  action: {
    minWidth: 72,
    height: 32,
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
