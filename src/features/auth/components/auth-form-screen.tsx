import { useHeaderHeight } from 'expo-router/react-navigation';
import { useState, type PropsWithChildren, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ui/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = PropsWithChildren<{
  title: string;
  subtitle: string;
  footer?: ReactNode;
}>;

/** Sem rolagem quando cabe; preserva acesso com teclado, fontes grandes ou telas pequenas. */
export function AuthFormScreen({ title, subtitle, footer, children }: Props) {
  const theme = useTheme();
  const headerHeight = useHeaderHeight();
  const { height } = useWindowDimensions();
  const compact = height < 760;
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const canScroll = contentHeight > viewportHeight + 1;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, compact && styles.compactContent]}
        onLayout={({ nativeEvent }) => setViewportHeight(nativeEvent.layout.height)}
        onContentSizeChange={(_, height) => setContentHeight(height)}
        scrollEnabled={canScroll}
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="never">
        <SafeAreaView edges={['bottom']} style={[styles.inner, compact && styles.compactInner]}>
          <View style={styles.header}>
            <ThemedText type="subtitle" style={compact && styles.compactTitle}>{title}</ThemedText>
            <ThemedText themeColor="textSecondary">{subtitle}</ThemedText>
          </View>
          {children}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </SafeAreaView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  inner: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth / 2,
    gap: Spacing.three,
  },
  compactContent: { paddingTop: Spacing.one, paddingBottom: Spacing.two },
  compactInner: { gap: Spacing.two },
  compactTitle: { fontSize: 28, lineHeight: 36 },
  header: { gap: Spacing.one },
  footer: {
    marginTop: 'auto',
    paddingTop: Spacing.two,
    alignItems: 'center',
  },
});
