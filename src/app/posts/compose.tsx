import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { useUser } from '@/features/auth/auth-provider';
import { PostEditor } from '@/features/feed/components/post-editor';
import { usePost } from '@/features/feed/hooks';
import { validPostId } from '@/features/feed/types';
import { useTheme } from '@/hooks/use-theme';

export default function ComposeScreen() {
  const { parentId, editId } = useLocalSearchParams<{ parentId?: string; editId?: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const user = useUser();
  const reference = editId ?? parentId;
  const post = usePost(reference);
  const unavailable =
    !!reference &&
    (!validPostId(reference) ||
      (!post.isPending && !post.data) ||
      (!!editId && post.data?.authorId !== user?.id && !post.isPending));
  return (
    <>
      <Stack.Screen
        options={{ title: t(editId ? 'feed.edit' : parentId ? 'feed.reply' : 'feed.compose') }}
      />
      {!user || (reference && (post.isPending || post.isError || unavailable)) ? (
        <View style={[styles.state, { backgroundColor: theme.background }]}>
          {reference && validPostId(reference) && post.isPending ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <>
              <ThemedText>{t(post.isError ? 'feed.loadError' : 'feed.unavailable')}</ThemedText>
              {post.isError ? (
                <Button
                  label={t('browse.retry')}
                  onPress={() => {
                    void post.refetch();
                  }}
                />
              ) : null}
            </>
          )}
        </View>
      ) : (
        <PostEditor
          key={reference ?? 'new'}
          context={post.data}
          editId={editId}
          parentId={parentId}
        />
      )}
    </>
  );
}
const styles = StyleSheet.create({
  state: { flex: 1, justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
});
