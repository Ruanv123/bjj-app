import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { useUser } from '@/features/auth/auth-provider';
import { useTheme } from '@/hooks/use-theme';

import { formatConversationTime, formatUnread } from '../format';
import type { Conversation } from '../types';

export function ConversationRow({ conversation }: { conversation: Conversation }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const user = useUser();
  const unread = conversation.unreadCount > 0;

  const lastText =
    conversation.lastMessageType === 'deleted'
      ? t('chat.deletedMessage')
      : conversation.lastMessageType === 'image' && !conversation.lastMessageBody
        ? t('chat.photo')
        : conversation.lastMessageBody;

  const preview = !conversation.lastMessageType
    ? t('chat.noMessagesYet')
    : conversation.lastMessageSenderId === user?.id
      ? `${t('chat.you')}: ${lastText}`
      : lastText;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        unread
          ? `${conversation.title}, ${t('chat.unreadA11y', { n: conversation.unreadCount })}`
          : conversation.title
      }
      onPress={() => router.push({ pathname: '/chat/[id]', params: { id: conversation.id } })}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
      <Avatar name={conversation.title} url={conversation.avatarUrl} size={48} />
      <View style={styles.content}>
        <View style={styles.header}>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.title}>
            {conversation.title}
          </ThemedText>
          {conversation.muted ? (
            <SymbolView
              name={{ ios: 'bell.slash', android: 'notifications_off', web: 'notifications_off' }}
              tintColor={theme.textSecondary}
              size={14}
              accessibilityLabel={t('chat.muted')}
            />
          ) : null}
          {conversation.lastMessageAt ? (
            <ThemedText
              type="small"
              style={{ color: unread ? theme.primary : theme.textSecondary }}>
              {formatConversationTime(conversation.lastMessageAt, i18n.language)}
            </ThemedText>
          ) : null}
        </View>
        <View style={styles.header}>
          <ThemedText
            type="small"
            numberOfLines={1}
            style={[styles.title, { color: unread ? theme.text : theme.textSecondary }]}>
            {preview}
          </ThemedText>
          {unread ? (
            <View
              style={[
                styles.badge,
                { backgroundColor: conversation.muted ? theme.textSecondary : theme.primary },
              ]}>
              <ThemedText type="smallBold" style={[styles.badgeText, { color: theme.onPrimary }]}>
                {formatUnread(conversation.unreadCount)}
              </ThemedText>
            </View>
          ) : null}
        </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    lineHeight: 16,
  },
});
