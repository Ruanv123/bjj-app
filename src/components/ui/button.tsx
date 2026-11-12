import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ButtonVariant = 'primary' | 'inverted' | 'outline' | 'secondary' | 'danger' | 'destructive';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
}: ButtonProps) {
  const theme = useTheme();

  const palette = {
    primary: { bg: theme.primary, fg: theme.onPrimary, border: theme.primary },
    inverted: { bg: theme.text, fg: theme.background, border: theme.text },
    outline: { bg: theme.background, fg: theme.text, border: theme.border },
    secondary: { bg: theme.backgroundSelected, fg: theme.text, border: theme.backgroundSelected },
    danger: { bg: theme.background, fg: theme.danger, border: theme.border },
    destructive: { bg: theme.danger, fg: '#ffffff', border: theme.danger },
  }[variant];

  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: disabled && !loading ? 0.6 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}>
      {loading ? (
        <ActivityIndicator testID="button-loading" color={palette.fg} />
      ) : (
        <>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <ThemedText style={[styles.label, { color: palette.fg }]}>{label}</ThemedText>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  icon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: 600,
  },
});
