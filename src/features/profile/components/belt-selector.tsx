import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { BELTS, type ProfileDetails } from '@/features/profile/details';
import { useTheme } from '@/hooks/use-theme';

import { BeltArtwork } from './belt-artwork';

export function BeltSelector({
  value,
  degree,
  disabled,
  onChange,
}: {
  value: ProfileDetails['belt'];
  degree: number;
  disabled: boolean;
  onChange: (belt: ProfileDetails['belt']) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={styles.grid}>
      {BELTS.map((belt) => {
        const selected = value === belt;
        return (
          <Pressable
            key={belt}
            accessibilityRole="button"
            accessibilityLabel={t(`athlete.belts.${belt}`)}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(belt)}
            style={({ pressed }) => [
              styles.option,
              {
                backgroundColor: theme.card,
                borderColor: selected ? theme.primary : theme.border,
                opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
              },
            ]}>
            <BeltArtwork belt={belt} degree={selected ? degree : 0} />
            <View style={styles.caption}>
              <ThemedText type="smallBold">{t(`athlete.belts.${belt}`)}</ThemedText>
              <View
                style={[
                  styles.check,
                  {
                    backgroundColor: selected ? theme.primary : theme.backgroundElement,
                    borderColor: selected ? theme.primary : theme.border,
                  },
                ]}>
                {selected ? (
                  <ThemedText style={[styles.checkText, { color: theme.onPrimary }]}>✓</ThemedText>
                ) : null}
              </View>
            </View>
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('athlete.noBelt')}
        accessibilityState={{ selected: value === null, disabled }}
        disabled={disabled}
        onPress={() => onChange(null)}
        style={({ pressed }) => [
          styles.option,
          styles.empty,
          {
            backgroundColor: theme.card,
            borderColor: value === null ? theme.primary : theme.border,
            opacity: pressed || disabled ? 0.6 : 1,
          },
        ]}>
        <ThemedText themeColor="textSecondary" style={styles.emptyMark}>
          —
        </ThemedText>
        <ThemedText type="smallBold">{t('athlete.noBelt')}</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  option: {
    flexBasis: '46%',
    flexGrow: 1,
    minWidth: 132,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: Spacing.two,
  },
  caption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: { fontSize: 12, lineHeight: 18, fontWeight: '700' },
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyMark: { fontSize: 32, lineHeight: 48 },
});
