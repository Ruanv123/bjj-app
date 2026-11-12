import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ui/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useUser } from '@/features/auth/auth-provider';
import { VideoRow } from '@/features/videos/components/video-row';
import { useSavedVideos } from '@/features/videos/hooks';
import { useTheme } from '@/hooks/use-theme';

export default function SavedVideosScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const user = useUser();
  const saved = useSavedVideos();

  const emptyMessage = !user
    ? t('saved.signIn')
    : saved.isError
      ? t('saved.loadError')
      : t('saved.empty');

  return (
    <>
      <Stack.Screen options={{ title: t('settings.savedVideos') }} />
      <FlatList
        style={{ backgroundColor: theme.background }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.list}
        data={saved.data ?? []}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => <VideoRow video={item} />}
        ItemSeparatorComponent={Separator}
        refreshing={saved.isRefetching}
        onRefresh={user ? () => void saved.refetch() : undefined}
        ListEmptyComponent={
          user && saved.isPending ? (
            <ActivityIndicator style={styles.loading} />
          ) : (
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              {emptyMessage}
            </ThemedText>
          )
        }
      />
    </>
  );
}

function Separator() {
  return <View style={{ height: Spacing.three }} />;
}

const styles = StyleSheet.create({
  list: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingVertical: Spacing.three,
  },
  loading: {
    marginTop: Spacing.six,
  },
  empty: {
    textAlign: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
  },
});
