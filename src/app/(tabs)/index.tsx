import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/icon-button';
import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { useUser } from '@/features/auth/auth-provider';
import { ComposePrompt } from '@/features/feed/components/compose-prompt';
import { FeedTabs } from '@/features/feed/components/feed-tabs';
import { Timeline } from '@/features/feed/components/timeline';
import { useTheme } from '@/hooks/use-theme';

export default function FeedScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const user = useUser();
  const [tab, setTab] = useState<'all' | 'following'>('all');
  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <ThemedText accessibilityRole="header" style={styles.title}>
            {t('feed.title')}
          </ThemedText>
          {user ? (
            <IconButton
              icon={{ ios: 'square.and.pencil', android: 'edit_square', web: 'edit_square' }}
              accessibilityLabel={t('feed.compose')}
              onPress={() => router.push('/posts/compose')}
            />
          ) : null}
        </View>
        <FeedTabs
          options={[
            { value: 'all', label: t('feed.all') },
            { value: 'following', label: t('feed.following') },
          ]}
          value={tab}
          onChange={setTab}
        />
        {user ? (
          <Timeline
            key={tab}
            filter={{ following: tab === 'following' }}
            header={<ComposePrompt />}
            empty={t(tab === 'following' ? 'feed.emptyFollowing' : 'feed.emptyHint')}
          />
        ) : (
          <ThemedText style={styles.guest} themeColor="textSecondary">
            {t('feed.signIn')}
          </ThemedText>
        )}
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1, width: '100%', maxWidth: 640, alignSelf: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
  },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.5 },
  guest: { padding: Spacing.four },
});
