import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { Pressable, FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/ui/themed-text';
import { PremiumBadge } from '@/features/subscription/components/premium-badge';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { Video } from '../types';
import { VideoCard } from './video-card';

const GAP = Spacing.three - Spacing.one; // 12
const SIDE = Spacing.three; // 16

type Props = {
  title: string;
  onSeeAll?: () => void;
  playlistId?: string;
  subtitle?: string;
  videos: Video[];
  size?: 'large' | 'regular';
  /** Trilha premium: mostra o selo ao lado do título. */
  premium?: boolean;
};

/** Carrossel horizontal com "snap" por card; o próximo card aparece cortado para indicar rolagem. */
export function VideoCarousel({ title, subtitle, videos, size = 'regular', premium = false, onSeeAll, playlistId }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const maxWidth = Math.min(screenWidth, 800);
  const cardWidth =
    size === 'large' ? Math.round(maxWidth - SIDE * 2 - 24) : Math.round(Math.min(maxWidth * 0.62, 280));

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Pressable
          disabled={!onSeeAll}
          accessibilityRole={onSeeAll ? 'button' : 'header'}
          accessibilityLabel={onSeeAll ? t('playlist.seeAll', { title }) : title}
          onPress={onSeeAll}
          style={({ pressed }) => [styles.headingButton, { opacity: pressed ? 0.65 : 1 }]}>
          <View style={styles.titleRow}>
            <ThemedText type="smallBold" style={styles.title} accessibilityRole="header">
              {title}
            </ThemedText>
            {premium ? <PremiumBadge /> : null}
          </View>
          {onSeeAll ? (
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              size={20}
              tintColor={theme.textSecondary}
            />
          ) : null}
        </Pressable>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      <FlatList
        horizontal
        data={videos}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => <VideoCard video={item} playlistId={playlistId} width={cardWidth} size={size} />}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={Separator}
        snapToInterval={cardWidth + GAP}
        snapToAlignment="start"
        decelerationRate="fast"
        initialNumToRender={3}
        windowSize={5}
      />
    </View>
  );
}

function Separator() {
  return <View style={{ width: GAP }} />;
}

/** Placeholder do carrossel enquanto os dados carregam. */
export function VideoCarouselSkeleton({ size = 'regular' }: { size?: 'large' | 'regular' }) {
  const theme = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const maxWidth = Math.min(screenWidth, 800);
  const cardWidth =
    size === 'large' ? maxWidth - SIDE * 2 - 24 : Math.min(maxWidth * 0.62, 280);

  return (
    <View style={styles.section} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.skeletonTitle, { backgroundColor: theme.backgroundElement }]} />
      <View style={[styles.content, styles.skeletonRow]}>
        {[0, 1].map((i) => (
          <View key={i} style={{ width: cardWidth, gap: Spacing.two }}>
            <View
              style={{
                aspectRatio: 16 / 9,
                borderRadius: size === 'large' ? 16 : 12,
                backgroundColor: theme.backgroundElement,
              }}
            />
            <View style={[styles.skeletonLine, { backgroundColor: theme.backgroundElement }]} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two + Spacing.one,
  },
  heading: {
    paddingHorizontal: SIDE,
  },
  headingButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  titleRow: {
    flex: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    flexShrink: 1,
    fontSize: 18,
    lineHeight: 24,
  },
  content: {
    paddingHorizontal: SIDE,
  },
  skeletonTitle: {
    width: 140,
    height: 20,
    borderRadius: 6,
    marginHorizontal: SIDE,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: GAP,
    overflow: 'hidden',
  },
  skeletonLine: {
    width: '80%',
    height: 14,
    borderRadius: 4,
  },
});
