import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function ProfileOptions<T extends string | number | null>({
  options,
  selected,
  onSelect,
  disabled = false,
}: {
  options: { value: T; label: string; color?: string }[];
  selected: T[];
  onSelect: (value: T) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.options}>
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: active, disabled }}
            disabled={disabled}
            onPress={() => onSelect(option.value)}
            style={({ pressed }) => [
              styles.option,
              {
                backgroundColor: active ? theme.backgroundSelected : theme.card,
                borderColor: active ? theme.primary : theme.border,
                opacity: pressed || disabled ? 0.6 : 1,
              },
            ]}>
            {option.color ? (
              <View
                style={[
                  styles.swatch,
                  {
                    backgroundColor: option.color,
                    borderColor: theme.textSecondary,
                  },
                ]}
              />
            ) : null}
            <ThemedText type="smallBold">{option.label}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: 12,
  },
  swatch: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
