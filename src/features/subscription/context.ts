import { createContext, use } from 'react';

import type { Placement } from './config';

export type ShowPaywallOptions = {
  /**
   * Roda quando o usuário pode seguir: já é assinante, acabou de assinar,
   * ou o Superwall decidiu não mostrar paywall para ele (ex.: grupo de controle).
   */
  onUnlocked?: () => void;
  /** Parâmetros enviados ao placement (usáveis nas regras de público do Superwall). */
  params?: Record<string, string | number | boolean>;
};

export type SubscriptionState = {
  /** `false` no web, no Expo Go ou sem chaves configuradas. */
  isEnabled: boolean;
  /** Verdadeiro enquanto o RevenueCat ainda não respondeu. */
  isLoading: boolean;
  isPremium: boolean;
  showPaywall: (placement: Placement, options?: ShowPaywallOptions) => Promise<void>;
  /** Restaura compras da conta da loja. Retorna se o usuário ficou premium. */
  restorePurchases: () => Promise<boolean>;
};

export const disabledSubscription: SubscriptionState = {
  isEnabled: false,
  isLoading: false,
  isPremium: false,
  showPaywall: async () => {
    if (__DEV__) {
      console.log('[subscription] paywall indisponível: use um development build e defina as chaves.');
    }
  },
  restorePurchases: async () => false,
};

export const SubscriptionContext = createContext<SubscriptionState>(disabledSubscription);

export function useSubscription() {
  return use(SubscriptionContext);
}
