import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { showAlert } from '@/lib/alert';

import { useFollow, useSocialStats } from '../hooks';

export function SocialProfileBar({ userId, own }: { userId: string; own: boolean }) {
  const { t } = useTranslation();
  const stats = useSocialStats(userId);
  const follow = useFollow();
  if (stats.isPending) return <ActivityIndicator />;
  if (stats.isError)
    return (
      <Button
        label={t('browse.retry')}
        variant="outline"
        onPress={() => {
          void stats.refetch();
        }}
      />
    );
  if (!stats.data) return null;
  return (
    <View style={styles.root}>
      <View style={styles.stats}>
        {[
          { value: stats.data.postCount, label: t('feed.posts') },
          { value: stats.data.followerCount, label: t('feed.followers') },
          { value: stats.data.followingCount, label: t('feed.following') },
        ].map((item) => (
          <View key={item.label} style={styles.stat}>
            <ThemedText style={styles.count}>{item.value}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {item.label}
            </ThemedText>
          </View>
        ))}
      </View>
      {!own ? (
        <Button
          label={t(stats.data.isFollowing ? 'feed.unfollow' : 'feed.follow')}
          variant={stats.data.isFollowing ? 'outline' : 'primary'}
          loading={follow.isPending}
          onPress={() =>
            follow.mutate(
              { userId, following: !stats.data!.isFollowing },
              { onError: () => showAlert(t('feed.actionError')) }
            )
          }
        />
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { gap: Spacing.three, alignSelf: 'stretch' },
  stats: { flexDirection: 'row', gap: Spacing.four, flexWrap: 'wrap' },
  stat: { gap: Spacing.one },
  count: { fontSize: 18, lineHeight: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
