import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/ui/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { VideoRow } from '@/features/videos/components/video-row';
import { usePlaylists } from '@/features/videos/hooks';
import { useTheme } from '@/hooks/use-theme';

export default function PlaylistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const playlists = usePlaylists();
  const playlist = playlists.data?.find((item) => item.id === id);

  return (
    <>
      <Stack.Screen options={{ title: playlist?.title ?? '' }} />
      <FlatList
        style={{ backgroundColor: theme.background }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + Spacing.four }]}
        data={playlist?.videos ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <VideoRow video={item} playlistId={id} lesson />}
        refreshing={playlists.isRefetching}
        onRefresh={() => void playlists.refetch()}
        ListHeaderComponent={playlist?.description ? (
          <ThemedText themeColor="textSecondary" style={styles.description}>{playlist.description}</ThemedText>
        ) : undefined}
        ListEmptyComponent={
          <View style={styles.message}>
            {playlists.isPending ? <ActivityIndicator /> : (
              <>
                <ThemedText themeColor="textSecondary">{t(playlists.isError ? 'browse.loadError' : 'playlist.notFound')}</ThemedText>
                {playlists.isError ? <Button variant="outline" label={t('browse.retry')} onPress={() => void playlists.refetch()} /> : null}
              </>
            )}
          </View>
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingTop: Spacing.three },
  description: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three },
  message: { alignItems: 'center', gap: Spacing.three, padding: Spacing.four, marginTop: Spacing.five },
});
