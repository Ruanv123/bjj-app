import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import type { ProfileDetails } from '@/features/profile/details';
import { BeltArtwork } from './belt-artwork';

export function BeltBadge({
  belt,
  degree,
}: {
  belt: NonNullable<ProfileDetails['belt']>;
  degree: number;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <BeltArtwork belt={belt} degree={degree} compact />
      <ThemedText type="smallBold" style={styles.label}>
        {t('athlete.beltLabel', { color: t(`athlete.belts.${belt}`) })}
        {degree ? ` · ${t('athlete.degreeCount', { count: degree })}` : ''}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  label: { flexShrink: 1 },
});
