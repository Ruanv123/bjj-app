import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/icon-button';
import { ThemedText } from '@/components/ui/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { CommentComposer } from '@/features/comments/components/comment-composer';
import { CommentItem } from '@/features/comments/components/comment-item';
import { useComments } from '@/features/comments/hooks';
import { VideoPlayer } from '@/features/player/components/video-player';
import { PremiumLock } from '@/features/subscription/components/premium-lock';
import { PlaylistQueue } from '@/features/videos/components/playlist-queue';
import { VideoActions } from '@/features/videos/components/video-actions';
import { formatTimeAgo, formatViews } from '@/features/videos/format';
import { usePlaylists, useVideo } from '@/features/videos/hooks';
import type { Playlist, Video } from '@/features/videos/types';
import { useTheme } from '@/hooks/use-theme';

export default function VideoModal() {
  const { id, playlistId } = useLocalSearchParams<{ id: string; playlistId?: string }>();
  const playlists = usePlaylists();
  // Sem contexto (busca/link), usa a primeira playlist que contém a aula.
  const playlist = playlists.data?.find((p) =>
    (!playlistId || p.id === playlistId) && p.videos.some((v) => v.id === id)
  );
  const { t } = useTranslation();
  const theme = useTheme();
  const { data: video, isPending } = useVideo(id);
  // Insets da janela (provider da raiz). O <SafeAreaView> nativo às vezes mede 0
  // dentro do fullScreenModal (e após girar o player), deixando o X embaixo da
  // barra de status, onde o toque não chega.
  const insets = useSafeAreaInsets();

  function close() {
    if (router.canGoBack()) router.back();
    // Volta para as abas existentes em vez de criar outra instância delas.
    else router.dismissTo('/');
  }

  return (
    <View
      style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <IconButton
          variant="plain"
          icon={{ ios: 'xmark', android: 'close', web: 'close' }}
          accessibilityLabel={t('videos.close')}
          onPress={close}
        />
      </View>

      {isPending ? (
        <ActivityIndicator style={styles.loading} />
      ) : !video ? (
        <ThemedText themeColor="textSecondary" style={styles.notFound}>
          {t('videos.notFound')}
        </ThemedText>
      ) : (
        // `key` garante um player novo se o id mudar.
        <VideoContent key={video.id} video={video} playlist={playlist} />
      )}
    </View>
  );
}

function VideoContent({ video, playlist }: { video: Video; playlist?: Playlist }) {
  const { t, i18n } = useTranslation();
  const comments = useComments(video.id);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.playerWrap}>
        {video.videoUrl ? (
          // `key`: player novo quando a URL chega depois de desbloquear.
          <VideoPlayer key={video.videoUrl} video={video} url={video.videoUrl} />
        ) : (
          <PremiumLock video={video} />
        )}
      </View>

      <FlatList
        style={styles.flex}
        contentContainerStyle={styles.list}
        data={comments.data ?? []}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <CommentItem comment={item} />}
        ItemSeparatorComponent={Separator}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (comments.hasNextPage && !comments.isFetchingNextPage) void comments.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.meta}>
              <ThemedText style={styles.title}>{video.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {video.channel} · {formatViews(video.views, t, i18n.language)} ·{' '}
                {formatTimeAgo(video.publishedAt, t)}
              </ThemedText>
            </View>
            <VideoActions video={video} />
            {video.description ? (
              <ThemedText type="small" themeColor="textSecondary">
                {video.description}
              </ThemedText>
            ) : null}
            <ThemedText type="smallBold" style={styles.commentsTitle} accessibilityRole="header">
              {t('comments.title')}
            </ThemedText>
            <CommentComposer videoId={video.id} />
          </View>
        }
        ListEmptyComponent={
          comments.isPending ? (
            <ActivityIndicator />
          ) : (
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              {comments.isError ? t('comments.loadError') : t('comments.empty')}
            </ThemedText>
          )
        }
        ListFooterComponent={
          comments.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : undefined
        }
      />
      {playlist ? <PlaylistQueue playlist={playlist} videoId={video.id} /> : null}
    </KeyboardAvoidingView>
  );
}

function Separator() {
  return <View style={{ height: Spacing.three }} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.one,
  },
  loading: {
    marginTop: Spacing.six,
  },
  notFound: {
    textAlign: 'center',
    marginTop: Spacing.six,
  },
  playerWrap: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  list: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
  },
  header: {
    gap: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
  },
  meta: {
    gap: Spacing.one,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 700,
  },
  commentsTitle: {
    fontSize: 16,
    marginTop: Spacing.two,
  },
  center: {
    textAlign: 'center',
  },
  footer: {
    marginTop: Spacing.three,
  },
});
