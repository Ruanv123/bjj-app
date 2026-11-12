import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';

import { formatTimeAgo, formatViews } from '../format';
import type { Video } from '../types';
import { VideoThumbnail } from './video-thumbnail';

type Props = {
  video: Video;
  playlistId?: string;
  width: number;
  size?: 'large' | 'regular';
};

export function VideoCard({ video, width, playlistId, size = 'regular' }: Props) {
  const { t, i18n } = useTranslation();
  const meta = `${video.channel} · ${formatViews(video.views, t, i18n.language)} · ${formatTimeAgo(video.publishedAt, t)}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${video.title}. ${meta}`}
      onPress={() => router.push({ pathname: '/video/[id]', params: { id: video.id, ...(playlistId ? { playlistId } : {}) } })}
      style={({ pressed }) => [{ width, opacity: pressed ? 0.85 : 1 }]}>
      <VideoThumbnail video={video} radius={size === 'large' ? 16 : 12} />
      <View style={styles.text}>
        <ThemedText type={size === 'large' ? 'default' : 'smallBold'} numberOfLines={2}>
          {video.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {meta}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: {
    paddingTop: Spacing.two,
    gap: Spacing.half,
  },
});
