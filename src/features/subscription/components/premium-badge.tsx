import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/ui/themed-text';

/** Selo "Premium" com cadeado, para miniaturas e títulos de trilha. */
export function PremiumBadge({ style }: { style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();
  return (
    <View
      style={[styles.badge, style]}
      accessible
      accessibilityLabel={t('subscription.premiumBadge')}>
      <SymbolView
        name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
        tintColor="#1a1200"
        size={10}
      />
      <ThemedText style={styles.text}>{t('subscription.premiumBadge')}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderCurve: 'continuous',
    backgroundColor: '#F5C451',
  },
  text: {
    color: '#1a1200',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 700,
  },
});
