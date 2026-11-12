import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { ComposePrompt } from '@/features/feed/components/compose-prompt';
import { PostCard } from '@/features/feed/components/post-card';
import { Timeline } from '@/features/feed/components/timeline';
import { usePost } from '@/features/feed/hooks';
import { validPostId } from '@/features/feed/types';
import { useTheme } from '@/hooks/use-theme';

export default function PostThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const query = usePost(id);
  const root = usePost(query.data?.parentId ?? undefined);
  const post = query.data?.parentId ? root.data : query.data;
  const error = query.isError || root.isError;
  const loading =
    validPostId(id) && (query.isPending || (!!query.data?.parentId && root.isPending));
  function retry() {
    void query.refetch();
    if (query.data?.parentId) void root.refetch();
  }
  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: t('feed.thread') }} />
      <View style={styles.inner}>
        {loading ? (
          <ActivityIndicator style={styles.state} color={theme.primary} />
        ) : error ? (
          <View style={styles.state}>
            <ThemedText>{t('feed.loadError')}</ThemedText>
            <Button label={t('browse.retry')} onPress={retry} />
          </View>
        ) : !post ? (
          <ThemedText style={styles.state} themeColor="textSecondary">
            {t('feed.unavailable')}
          </ThemedText>
        ) : (
          <Timeline
            filter={{ parentId: post.id }}
            replies
            empty={t('feed.firstReply')}
            header={
              <>
                <PostCard post={post} detail />
                <ComposePrompt parentId={post.id} />
                <ThemedText style={styles.replies} type="smallBold">
                  {t('feed.replies')}
                </ThemedText>
              </>
            }
          />
        )}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1, width: '100%', maxWidth: 640, alignSelf: 'center' },
  state: { padding: Spacing.four, gap: Spacing.three },
  replies: { padding: Spacing.three },
});
