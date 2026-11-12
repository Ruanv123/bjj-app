import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { useUser } from '@/features/auth/auth-provider';
import { formatTimeAgo } from '@/features/videos/format';
import { ProfileLink } from '@/features/profile/components/profile-link';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';

import { useDeleteComment } from '../hooks';
import type { Comment } from '../types';

const TRASH_ICON = { ios: 'trash', android: 'delete_outline', web: 'delete_outline' } as const;

export function CommentItem({ comment }: { comment: Comment }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const user = useUser();
  const deleteComment = useDeleteComment(comment.videoId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isOwner = user?.id === comment.userId;

  function handleConfirmDelete() {
    setConfirmOpen(false);
    // Remoção otimista: some na hora; volta se o servidor recusar.
    deleteComment.mutate(comment.id, { onError: () => showAlert(t('comments.deleteError')) });
  }

  return (
    <View style={styles.row}>
      <ProfileLink userId={comment.userId} name={comment.authorName}>
        <Avatar name={comment.authorName} url={comment.authorAvatarUrl} size={32} />
      </ProfileLink>
      <View style={styles.content}>
        <View style={styles.header}>
          <ProfileLink userId={comment.userId} name={comment.authorName} style={styles.name}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {comment.authorName}
            </ThemedText>
          </ProfileLink>
          <ThemedText type="small" themeColor="textSecondary">
            {formatTimeAgo(comment.createdAt, t)}
          </ThemedText>
        </View>
        <ThemedText type="small">{comment.body}</ThemedText>
      </View>

      {isOwner ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('comments.deleteA11y')}
          onPress={() => setConfirmOpen(true)}
          hitSlop={10}
          style={({ pressed }) => [styles.trash, { opacity: pressed ? 0.5 : 1 }]}>
          <SymbolView name={TRASH_ICON} tintColor={theme.textSecondary} size={18} />
        </Pressable>
      ) : null}

      <ConfirmDialog
        visible={confirmOpen}
        destructive
        icon={TRASH_ICON}
        title={t('comments.deleteConfirm')}
        message={t('comments.deleteMessage')}
        confirmLabel={t('comments.delete')}
        cancelLabel={t('comments.cancel')}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two + Spacing.one,
  },
  content: {
    flex: 1,
    gap: Spacing.half,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  name: {
    flexShrink: 1,
  },
  trash: {
    alignSelf: 'flex-start',
    padding: Spacing.one,
    marginTop: -Spacing.one,
    marginRight: -Spacing.one,
  },
});
