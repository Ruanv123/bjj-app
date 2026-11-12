import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ui/themed-text';
import { useTheme } from '@/hooks/use-theme';

export function Avatar({ name, url, size = 36 }: { name: string; url: string | null; size?: number }) {
  const theme = useTheme();
  const dimensions = { width: size, height: size, borderRadius: size / 2 };

  if (url) {
    return <Image source={{ uri: url }} style={dimensions} accessibilityIgnoresInvertColors />;
  }
  return (
    <View style={[styles.fallback, dimensions, { backgroundColor: theme.primary }]}>
      <ThemedText style={{ color: theme.onPrimary, fontWeight: 700, fontSize: size * 0.42 }}>
        {name.trim().charAt(0).toUpperCase() || '?'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
