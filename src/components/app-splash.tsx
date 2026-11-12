import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { SplashBackground } from '@/constants/theme';
import i18n from '@/lib/i18n';

const MIN_VISIBLE_MS = 900;
const EXIT_MS = 350;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * Splash animada que assume o lugar da splash nativa (mesma cor e logo),
 * permanece até `ready` e então sai com fade + leve zoom.
 */
export function AppSplash({ ready }: { ready: boolean }) {
  const [visible, setVisible] = useState(true);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const reduceMotion = useReducedMotion();

  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(reduceMotion ? 1 : 0.92);
  const overlayOpacity = useSharedValue(1);
  const overlayScale = useSharedValue(1);

  useEffect(() => {
    const t = setTimeout(() => setMinTimeElapsed(true), MIN_VISIBLE_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ready || !minTimeElapsed) return;
    overlayOpacity.set(
      withTiming(0, { duration: EXIT_MS, easing: EASE_OUT }, (finished) => {
        if (finished) scheduleOnRN(setVisible, false);
      })
    );
    if (!reduceMotion) {
      overlayScale.set(withTiming(1.06, { duration: EXIT_MS, easing: EASE_OUT }));
    }
  }, [ready, minTimeElapsed, reduceMotion, overlayOpacity, overlayScale]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.get(),
    transform: [{ scale: overlayScale.get() }],
  }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.get(),
    transform: [{ scale: logoScale.get() }],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents={ready ? 'none' : 'auto'}
      style={[styles.overlay, overlayStyle]}
      onLayout={() => {
        // A overlay já está na tela com o mesmo fundo: troca invisível da splash nativa.
        SplashScreen.hide();
        logoOpacity.set(withTiming(1, { duration: 300, easing: EASE_OUT }));
        logoScale.set(withTiming(1, { duration: 500, easing: EASE_OUT }));
      }}>
      <Animated.View style={[styles.brand, logoStyle]}>
        <Image source={require('@/assets/images/splash-icon.png')} style={styles.logo} />
        <Text style={styles.name}>{i18n.t('common.appName')}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: SplashBackground,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  brand: {
    alignItems: 'center',
    gap: 16,
  },
  logo: {
    width: 76,
    height: 76,
  },
  name: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: -0.3,
  },
});
