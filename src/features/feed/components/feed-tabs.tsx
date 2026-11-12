import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function FeedTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.tabs, { borderBottomColor: theme.border }]}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === option.value }}
          onPress={() => onChange(option.value)}
          style={({ pressed }) => [
            styles.tab,
            {
              borderBottomColor: value === option.value ? theme.primary : 'transparent',
              opacity: pressed ? 0.6 : 1,
            },
          ]}>
          <ThemedText
            type="smallBold"
            style={{ color: value === option.value ? theme.text : theme.textSecondary }}>
            {option.label}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.two,
    borderBottomWidth: 2,
  },
});
