import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

/** Identificador da entitlement criada no painel do RevenueCat. */
export const PREMIUM_ENTITLEMENT = 'premium';

/**
 * Placements do painel do Superwall. `campaign_trigger` já vem criado em todo
 * projeto novo; crie outros (ex.: `premium_video`) e acrescente aqui.
 */
export const Placements = {
  /** "Seja Premium" nas configurações. */
  upgrade: 'campaign_trigger',
  /** Ao abrir um vídeo ou trilha premium. Crie este placement no Superwall. */
  premiumContent: 'premium_content',
} as const;

export type Placement = (typeof Placements)[keyof typeof Placements];

export const superwallKeys = {
  ios: process.env.EXPO_PUBLIC_SUPERWALL_IOS_KEY,
  android: process.env.EXPO_PUBLIC_SUPERWALL_ANDROID_KEY,
};

export const revenueCatKeys = {
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
};

function hasKeys() {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  return !!superwallKeys[Platform.OS] && !!revenueCatKeys[Platform.OS];
}

/**
 * Superwall e RevenueCat só funcionam em development build ou build de loja,
 * no iOS e no Android. No web, no Expo Go ou sem as chaves, o app roda com
 * as assinaturas desligadas (ninguém é premium e o paywall não abre).
 */
export const isSubscriptionEnabled = hasKeys() && !isRunningInExpoGo();
