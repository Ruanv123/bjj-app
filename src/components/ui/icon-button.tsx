import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type Props = {
  icon: ComponentProps<typeof SymbolView>['name'];
  accessibilityLabel: string;
  onPress: () => void;
  variant?: 'filled' | 'plain';
};

export function IconButton({ icon, accessibilityLabel, onPress, variant = 'filled' }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'filled' && { backgroundColor: theme.backgroundElement },
        { opacity: pressed ? 0.6 : 1 },
      ]}>
      <SymbolView name={icon} tintColor={theme.text} size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
