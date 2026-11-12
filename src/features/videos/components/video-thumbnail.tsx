import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ui/themed-text';
import { PremiumBadge } from '@/features/subscription/components/premium-badge';
import { useSubscription } from '@/features/subscription/context';
import { useTheme } from '@/hooks/use-theme';

import { formatDuration } from '../format';
import type { Video } from '../types';

type Props = {
  video: Video;
  radius?: number;
  /** Necessário em listas que reciclam células (FlashList/LegendList). */
  recyclingKey?: string;
};

export function VideoThumbnail({ video, radius = 12, recyclingKey }: Props) {
  const theme = useTheme();
  const { isPremium } = useSubscription();
  return (
    <View
      style={[styles.frame, { borderRadius: radius, backgroundColor: theme.backgroundSelected }]}>
      <Image
        source={{ uri: video.thumbnailUrl }}
        recyclingKey={recyclingKey}
        contentFit="cover"
        transition={200}
        style={StyleSheet.absoluteFill}
        accessibilityIgnoresInvertColors
      />
      {video.requiresPremium && !isPremium ? <PremiumBadge style={styles.badge} /> : null}
      {video.durationSeconds ? (
        <View style={styles.duration}>
          <ThemedText style={styles.durationText}>{formatDuration(video.durationSeconds)}</ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 16 / 9,
    overflow: 'hidden',
    borderCurve: 'continuous',
  },
  badge: {
    position: 'absolute',
    left: 6,
    top: 6,
  },
  duration: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  durationText: {
    color: '#fff',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 600,
    fontVariant: ['tabular-nums'],
  },
});
