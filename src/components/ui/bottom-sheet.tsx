import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
} from 'react-native-gesture-handler';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const EASE_SHEET = Easing.bezier(0.32, 0.72, 0, 1);

type Props = {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  dismissRequested?: boolean;
};

/** Montar ao abrir e desmontar em onClose. O gesto fica no cabeçalho para não disputar o scroll do formulário. */
export function BottomSheet({
  title,
  closeLabel,
  onClose,
  children,
  dismissRequested = false,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const translateY = useSharedValue(reduced ? 0 : height);
  const dragStart = useSharedValue(0);
  const sheetHeight = useSharedValue(height);
  const opacity = useSharedValue(0);
  const closing = useRef(false);

  useEffect(() => {
    translateY.set(
      withSpring(0, { duration: 300, dampingRatio: 1, reduceMotion: ReduceMotion.System })
    );
    opacity.set(withTiming(1, { duration: 180 }));
  }, [opacity, translateY]);

  const dismiss = useCallback(
    (velocity = 0) => {
      if (closing.current) return;
      closing.current = true;
      Keyboard.dismiss();
      const duration = reduced ? 150 : 220;
      translateY.set(
        withSpring(reduced ? 0 : height, {
          duration,
          dampingRatio: 1,
          velocity,
          overshootClamping: true,
          reduceMotion: ReduceMotion.System,
        })
      );
      opacity.set(
        withTiming(0, { duration, easing: EASE_SHEET }, (finished) => {
          if (finished) scheduleOnRN(onClose);
        })
      );
    },
    [height, onClose, opacity, reduced, translateY]
  );
  const close = useCallback(() => dismiss(), [dismiss]);

  useEffect(() => {
    if (dismissRequested) close();
  }, [close, dismissRequested]);

  const pan = usePanGesture({
    activeOffsetY: [-10, 10],
    onActivate: () => {
      dragStart.set(translateY.get());
    },
    onUpdate: (event) => {
      const next = dragStart.get() + event.translationY;
      translateY.set(
        next >= 0 ? next : (next * 0.55 * sheetHeight.get()) / (sheetHeight.get() + Math.abs(next))
      );
    },
    onDeactivate: (event) => {
      const projected = translateY.get() + event.velocityY * 0.2;
      if (!event.canceled && projected > sheetHeight.get() * 0.35) {
        scheduleOnRN(dismiss, event.velocityY);
      } else {
        translateY.set(
          withSpring(0, {
            duration: 300,
            dampingRatio: 0.8,
            velocity: event.velocityY,
            reduceMotion: ReduceMotion.System,
          })
        );
      }
    },
  });
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
    opacity: reduced ? opacity.get() : 1,
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.get() * Math.max(0, 1 - translateY.get() / height),
  }));

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={close}
      accessibilityLabel={Platform.OS === 'web' ? title : undefined}>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            tabIndex={-1}
            onPress={close}
          />
        </Animated.View>
        <KeyboardAvoidingView
          behavior="padding"
          style={[styles.position, { paddingTop: insets.top + Spacing.three }]}
          pointerEvents="box-none">
          <Animated.View
            accessibilityViewIsModal
            accessibilityRole={Platform.OS === 'web' ? undefined : 'dialog'}
            accessibilityLabel={title}
            onAccessibilityEscape={close}
            onLayout={(event) => sheetHeight.set(event.nativeEvent.layout.height)}
            style={[
              styles.sheet,
              { backgroundColor: theme.card, paddingBottom: insets.bottom + Spacing.three },
              sheetStyle,
            ]}>
            <GestureDetector gesture={pan}>
              <View collapsable={false} style={styles.header}>
                <View style={[styles.handle, { backgroundColor: theme.border }]} />
                <View style={styles.titleRow}>
                  <ThemedText style={styles.title}>{title}</ThemedText>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={closeLabel}
                    onPress={close}
                    style={({ pressed }) => [
                      styles.close,
                      { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 },
                    ]}>
                    <ThemedText style={styles.closeText}>×</ThemedText>
                  </Pressable>
                </View>
              </View>
            </GestureDetector>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              style={styles.scroll}
              contentContainerStyle={styles.content}>
              {children}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  position: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.48)' },
  sheet: {
    maxHeight: '94%',
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.three,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { flex: 1, fontSize: 22, lineHeight: 28, fontWeight: '700' },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 28, lineHeight: 32 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { gap: Spacing.three, paddingHorizontal: Spacing.four, paddingBottom: Spacing.two },
});
