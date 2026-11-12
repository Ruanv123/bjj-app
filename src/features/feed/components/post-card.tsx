import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { ActionSheet } from '@/components/ui/action-sheet';
import { Avatar } from '@/components/ui/avatar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { IconButton } from '@/components/ui/icon-button';
import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { useUser } from '@/features/auth/auth-provider';
import { useBlockUser } from '@/features/chat/hooks';
import { ProfileLink } from '@/features/profile/components/profile-link';
import { BELT_COLORS } from '@/features/profile/details';
import { formatTimeAgo } from '@/features/videos/format';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';

import { useDeletePost, useLikePost, useReportPost } from '../hooks';
import type { Post } from '../types';

export function PostCard({ post, detail = false }: { post: Post; detail?: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const user = useUser();
  const like = useLikePost();
  const remove = useDeletePost();
  const report = useReportPost();
  const block = useBlockUser();
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState<'delete' | 'block' | 'report' | null>(null);
  const own = post.authorId === user?.id;
  const threadId = post.parentId ?? post.id;
  const openThread = () => router.push({ pathname: '/posts/[id]', params: { id: threadId } });
  const reply = () => router.push({ pathname: '/posts/compose', params: { parentId: threadId } });

  function performConfirmed() {
    const action = confirm;
    setConfirm(null);
    if (action === 'delete')
      remove.mutate(post.id, {
        onSuccess: () => {
          if (detail && !post.parentId) router.back();
        },
        onError: () => showAlert(t('feed.actionError')),
      });
    if (action === 'report')
      report.mutate(post.id, {
        onSuccess: () => showAlert(t('feed.reported')),
        onError: () => showAlert(t('feed.actionError')),
      });
    if (action === 'block')
      block.mutate(post.authorId, { onError: () => showAlert(t('chat.blockError')) });
  }
  return (
    <View style={[styles.post, { borderBottomColor: theme.border }]}>
      <View style={styles.avatarColumn}>
        <ProfileLink userId={post.authorId} name={post.authorName}>
          <Avatar name={post.authorName} url={post.authorAvatarUrl} size={44} />
        </ProfileLink>
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <ProfileLink userId={post.authorId} name={post.authorName} style={styles.authorLink}>
            <ThemedText style={styles.author} numberOfLines={1}>
              {post.authorName}
            </ThemedText>
          </ProfileLink>
          <ThemedText type="small" themeColor="textSecondary" style={styles.time}>
            {formatTimeAgo(post.createdAt, t)}
          </ThemedText>
          <IconButton
            variant="plain"
            icon={{ ios: 'ellipsis', android: 'more_horiz', web: 'more_horiz' }}
            accessibilityLabel={t('feed.options')}
            onPress={() => setMenu(true)}
          />
        </View>
        {post.authorBelt ? (
          <View style={styles.belt}>
            <View
              style={[
                styles.beltDot,
                { backgroundColor: BELT_COLORS[post.authorBelt], borderColor: theme.textSecondary },
              ]}
            />
            <ThemedText themeColor="textSecondary" style={styles.beltText}>
              {t('athlete.beltLabel', { color: t(`athlete.belts.${post.authorBelt}`) })}
              {post.authorBeltDegree
                ? ` · ${t('athlete.degreeCount', { count: post.authorBeltDegree })}`
                : ''}
            </ThemedText>
          </View>
        ) : null}
        {detail ? (
          <ThemedText selectable style={styles.body}>
            {post.body}
          </ThemedText>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('feed.openPost')}
            onPress={openThread}>
            <ThemedText style={styles.body}>{post.body}</ThemedText>
          </Pressable>
        )}
        {post.editedAt ? (
          <ThemedText type="small" themeColor="textSecondary">
            {t('feed.edited')}
          </ThemedText>
        ) : null}
        <View style={styles.actions}>
          <PostAction
            icon={{
              ios: post.liked ? 'heart.fill' : 'heart',
              android: post.liked ? 'favorite' : 'favorite_border',
              web: post.liked ? 'favorite' : 'favorite_border',
            }}
            label={t(post.liked ? 'feed.unlike' : 'feed.like')}
            count={post.likeCount}
            selected={post.liked}
            disabled={like.isPending}
            onPress={() =>
              like.mutate(
                { postId: post.id, liked: !post.liked },
                { onError: () => showAlert(t('feed.actionError')) }
              )
            }
          />
          <PostAction
            icon={{ ios: 'bubble', android: 'chat_bubble_outline', web: 'chat_bubble_outline' }}
            label={t('feed.reply')}
            count={post.replyCount}
            onPress={reply}
          />
          <PostAction
            icon={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }}
            label={t('feed.share')}
            onPress={() => {
              void Share.share({
                message: `${post.authorName}: ${post.body}\n${Linking.createURL(`posts/${threadId}`)}`,
              }).catch(() => showAlert(t('feed.actionError')));
            }}
          />
        </View>
      </View>
      <ActionSheet
        visible={menu}
        title={post.authorName}
        onClose={() => setMenu(false)}
        cancelLabel={t('settings.cancel')}
        actions={
          own
            ? [
                {
                  key: 'edit',
                  label: t('feed.edit'),
                  onPress: () =>
                    router.push({ pathname: '/posts/compose', params: { editId: post.id } }),
                },
                {
                  key: 'delete',
                  label: t('feed.delete'),
                  destructive: true,
                  onPress: () => setConfirm('delete'),
                },
              ]
            : [
                {
                  key: 'profile',
                  label: t('socialProfile.view'),
                  onPress: () =>
                    router.push({ pathname: '/people/[id]', params: { id: post.authorId } }),
                },
                { key: 'report', label: t('feed.report'), onPress: () => setConfirm('report') },
                {
                  key: 'block',
                  label: t('chat.blockUser', { name: post.authorName }),
                  destructive: true,
                  onPress: () => setConfirm('block'),
                },
              ]
        }
      />
      <ConfirmDialog
        visible={!!confirm}
        title={t(
          confirm === 'delete'
            ? 'feed.deleteConfirm'
            : confirm === 'block'
              ? 'chat.blockConfirm'
              : 'feed.reportConfirm',
          { name: post.authorName }
        )}
        message={confirm === 'delete' ? t('feed.deleteHint') : undefined}
        confirmLabel={t(
          confirm === 'delete' ? 'feed.delete' : confirm === 'block' ? 'chat.block' : 'feed.report'
        )}
        destructive={confirm !== 'report'}
        cancelLabel={t('settings.cancel')}
        onCancel={() => setConfirm(null)}
        onConfirm={performConfirmed}
      />
    </View>
  );
}
function PostAction({
  icon,
  label,
  count,
  selected = false,
  disabled = false,
  onPress,
}: {
  icon: ComponentProps<typeof SymbolView>['name'];
  label: string;
  count?: number;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const color = selected ? theme.danger : theme.textSecondary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count !== undefined ? `${label} · ${count}` : label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.action, { opacity: pressed || disabled ? 0.6 : 1 }]}>
      <SymbolView name={icon} tintColor={color} size={20} />
      {count !== undefined ? (
        <ThemedText type="small" style={{ color, fontVariant: ['tabular-nums'] }}>
          {count}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  post: {
    flexDirection: 'row',
    gap: Spacing.two + Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarColumn: { paddingTop: Spacing.two },
  content: { flex: 1, gap: Spacing.two },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  authorLink: { flex: 1, minHeight: 44, justifyContent: 'center' },
  author: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  time: { fontSize: 11 },
  belt: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  beltDot: { width: 12, height: 12, borderRadius: 3, borderWidth: StyleSheet.hairlineWidth },
  beltText: { fontSize: 12, lineHeight: 17, flexShrink: 1 },
  body: { fontSize: 16, lineHeight: 24 },
  actions: { flexDirection: 'row', gap: Spacing.four },
  action: { minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
});
