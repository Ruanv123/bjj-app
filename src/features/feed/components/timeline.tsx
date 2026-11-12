import { FlashList } from '@shopify/flash-list';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { useFeed } from '../hooks';
import type { FeedFilter } from '../types';
import { PostCard } from './post-card';

export function Timeline({
  filter = {},
  header,
  empty,
  replies = false,
}: {
  filter?: FeedFilter;
  header?: ReactElement;
  empty?: string;
  replies?: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const query = useFeed(filter);
  const posts = query.data?.pages.flat() ?? [];
  return (
    <FlashList
      style={{ flex: 1 }}
      data={posts}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => <PostCard post={item} detail={replies} />}
      ListHeaderComponent={header}
      refreshControl={
        <RefreshControl
          tintColor={theme.primary}
          refreshing={query.isRefetching}
          onRefresh={() => {
            void query.refetch();
          }}
        />
      }
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage && !query.isFetchNextPageError)
          void query.fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={
        <View style={styles.state}>
          {query.isPending ? (
            <ActivityIndicator color={theme.primary} />
          ) : query.isError ? (
            <>
              <ThemedText themeColor="textSecondary">{t('feed.loadError')}</ThemedText>
              <Button
                label={t('browse.retry')}
                variant="outline"
                onPress={() => {
                  void query.refetch();
                }}
              />
            </>
          ) : (
            <>
              <ThemedText style={styles.emptyTitle}>
                {t(replies ? 'feed.noReplies' : 'feed.emptyTitle')}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.emptyHint}>
                {empty ?? t('feed.emptyHint')}
              </ThemedText>
            </>
          )}
        </View>
      }
      ListFooterComponent={
        query.isFetchingNextPage ? (
          <ActivityIndicator style={styles.loader} />
        ) : query.isFetchNextPageError ? (
          <Button
            label={t('browse.retry')}
            variant="outline"
            onPress={() => {
              void query.fetchNextPage();
            }}
          />
        ) : null
      }
      contentContainerStyle={{ paddingBottom: Spacing.five }}
      keyboardShouldPersistTaps="handled"
    />
  );
}
const styles = StyleSheet.create({
  state: { padding: Spacing.four, paddingVertical: Spacing.six, gap: Spacing.three },
  emptyTitle: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  emptyHint: { fontSize: 15, lineHeight: 22 },
  loader: { padding: Spacing.four },
});
