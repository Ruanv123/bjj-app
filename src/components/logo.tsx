import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';

/** Logo do app. Troque `assets/images/icon.png` pela sua marca. */
export function Logo() {
  const { t } = useTranslation();
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="header"
      accessibilityLabel={t('common.appName')}>
      <Image source={require('@/assets/images/icon.png')} style={styles.mark} />
      <ThemedText style={styles.name}>{t('common.appName')}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  mark: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderCurve: 'continuous',
  },
  name: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: 700,
    letterSpacing: -0.4,
  },
});
