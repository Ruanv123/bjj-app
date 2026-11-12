import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Chips } from '@/components/ui/chips';
import { IconButton } from '@/components/ui/icon-button';
import { ThemedText } from '@/components/ui/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { VideoCarousel, VideoCarouselSkeleton } from '@/features/videos/components/video-carousel';
import { usePlaylists, useSavedVideos } from '@/features/videos/hooks';
import { useTheme } from '@/hooks/use-theme';

export default function BrowseScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const playlists = usePlaylists();
  const saved = useSavedVideos();
  // `null` = mostrar todas as playlists.
  const [selected, setSelected] = useState<string | null>(null);

  const visible = (playlists.data ?? []).filter((p) => selected === null || p.id === selected);
  const savedVideos = selected === null ? (saved.data ?? []) : [];

  const chipOptions = [
    { key: 'all', value: null, label: t('browse.all') },
    ...(playlists.data ?? []).map((p) => ({
      key: p.id,
      value: p.id as string | null,
      label: p.title,
    })),
  ];

  function refresh() {
    void playlists.refetch();
    void saved.refetch();
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <Logo />
          <IconButton
            icon={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
            accessibilityLabel={t('browse.searchButton')}
            onPress={() => router.push('/search')}
          />
        </View>
      </SafeAreaView>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={playlists.isRefetching} onRefresh={refresh} />}>
        <View style={styles.inner}>
          {playlists.isPending ? (
            <>
              <VideoCarouselSkeleton />
              <VideoCarouselSkeleton />
            </>
          ) : playlists.isError ? (
            <View style={styles.message}>
              <ThemedText themeColor="textSecondary">{t('browse.loadError')}</ThemedText>
              <Button variant="outline" label={t('browse.retry')} onPress={refresh} />
            </View>
          ) : playlists.data.length === 0 ? (
            <View style={styles.message}>
              <ThemedText themeColor="textSecondary">{t('browse.empty')}</ThemedText>
            </View>
          ) : (
            <>
              <Chips options={chipOptions} value={selected} onChange={setSelected} />
              <View style={styles.shelves}>
                {savedVideos.length > 0 ? (
                  <VideoCarousel title={t('shelves.saved')} videos={savedVideos} onSeeAll={() => router.push('/saved')} />
                ) : null}
                {visible.map((playlist, index) => (
                  <VideoCarousel
                    key={playlist.id}
                    title={playlist.title}
                    playlistId={playlist.id}
                    onSeeAll={() => router.push({ pathname: '/playlist/[id]', params: { id: playlist.id } })}
                    subtitle={playlist.description}
                    videos={playlist.videos}
                    premium={playlist.isPremium}
                    // A primeira playlist (ou a selecionada) ganha cards grandes.
                    size={index === 0 ? 'large' : 'regular'}
                  />
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerSafe: {
    alignItems: 'center',
  },
  header: {
    width: '100%',
    maxWidth: MaxContentWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  content: {
    alignItems: 'center',
    paddingTop: Spacing.two,
    paddingBottom: Spacing.four,
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
  },
  shelves: {
    gap: Spacing.four + Spacing.one,
  },
  message: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
  },
});
