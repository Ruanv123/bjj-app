import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ui/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

import { formatTimeAgo, formatViews } from '../format';
import type { Video } from '../types';
import { VideoThumbnail } from './video-thumbnail';

/** Item de lista vertical (resultados de busca). */
type Props = { video: Video; playlistId?: string; onPress?: () => void; selected?: boolean; lesson?: boolean };

export function VideoRow({ video, playlistId, onPress, selected, lesson = false }: Props) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${video.title}. ${video.channel}`}
      accessibilityState={{ selected }}
      onPress={onPress ?? (() => router.push({ pathname: '/video/[id]', params: { id: video.id, ...(playlistId ? { playlistId } : {}) } }))}
      style={({ pressed }) => [styles.row, { backgroundColor: selected ? theme.backgroundElement : undefined, opacity: pressed ? 0.85 : 1 }]}>
      <View style={styles.thumb}>
        <VideoThumbnail video={video} radius={10} recyclingKey={video.id} />
      </View>
      <View style={styles.text}>
        <ThemedText type="smallBold" numberOfLines={2}>
          {video.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {video.channel}
        </ThemedText>
        {selected ? <ThemedText type="smallBold" themeColor="primary">{t('playlist.playing')}</ThemedText> : null}
        {!lesson ? <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {formatViews(video.views, t, i18n.language)} · {formatTimeAgo(video.publishedAt, t)}
        </ThemedText> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    minHeight: 48,
    gap: Spacing.three - Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  thumb: {
    width: '36%',
    maxWidth: 160,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
});
