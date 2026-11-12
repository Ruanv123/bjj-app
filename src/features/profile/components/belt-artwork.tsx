import { StyleSheet, View } from 'react-native';

import { BELT_COLORS, type ProfileDetails } from '@/features/profile/details';

export type BeltColor = NonNullable<ProfileDetails['belt']>;

/** Faixa desenhada com Views: costuras, pontas sobrepostas e nó, sem imagens por cor. */
export function BeltArtwork({
  belt,
  degree = 0,
  compact = false,
}: {
  belt: BeltColor;
  degree?: number;
  compact?: boolean;
}) {
  const color = BELT_COLORS[belt];
  const thread =
    belt === 'white' || belt === 'yellow' ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.24)';

  function fabric() {
    return (
      <>
        {belt === 'coral' ? (
          <View style={styles.coral}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View
                key={i}
                style={{ flex: 1, backgroundColor: i % 2 ? BELT_COLORS.black : BELT_COLORS.red }}
              />
            ))}
          </View>
        ) : null}
        {[18, 35, 65, 82].map((top) => (
          <View key={top} style={[styles.stitch, { top: `${top}%`, borderColor: thread }]} />
        ))}
      </>
    );
  }

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.artwork, compact && styles.compact]}>
      <View style={[styles.strap, styles.wrap, { backgroundColor: color }]}>{fabric()}</View>
      <View style={[styles.strap, styles.leftTail, { backgroundColor: color }]}>{fabric()}</View>
      <View style={[styles.strap, styles.rightTail, { backgroundColor: color }]}>
        {fabric()}
        <View
          style={[
            styles.rank,
            { backgroundColor: belt === 'black' ? BELT_COLORS.red : BELT_COLORS.black },
          ]}>
          {Array.from({ length: degree }, (_, i) => (
            <View key={i} style={styles.degree} />
          ))}
        </View>
      </View>
      <View style={[styles.knot, { backgroundColor: color }]}>
        {fabric()}
        <View style={styles.fold} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  artwork: { width: '100%', height: 64 },
  compact: { width: 96, height: 40 },
  strap: {
    position: 'absolute',
    height: '34%',
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.25)',
    overflow: 'hidden',
  },
  wrap: { left: '4%', right: '4%', top: '22%' },
  leftTail: { left: '8%', right: '48%', top: '47%', transform: [{ rotate: '-12deg' }] },
  rightTail: { left: '48%', right: '8%', top: '47%', transform: [{ rotate: '12deg' }] },
  stitch: { position: 'absolute', left: 0, right: 0, borderTopWidth: StyleSheet.hairlineWidth },
  coral: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
  knot: {
    position: 'absolute',
    left: '42%',
    width: '16%',
    top: '18%',
    height: '58%',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.3)',
    transform: [{ rotate: '14deg' }],
    overflow: 'hidden',
  },
  fold: {
    position: 'absolute',
    left: '25%',
    top: 0,
    bottom: 0,
    borderLeftWidth: 2,
    borderRightWidth: 1,
    width: '42%',
    borderColor: 'rgba(0,0,0,0.17)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  rank: {
    position: 'absolute',
    right: '8%',
    top: 0,
    bottom: 0,
    width: '56%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
    paddingHorizontal: 3,
  },
  degree: { flex: 1, maxWidth: 4, height: '100%', backgroundColor: BELT_COLORS.white },
});
