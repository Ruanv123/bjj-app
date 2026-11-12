import {
  CustomPurchaseControllerProvider,
  SuperwallProvider,
  usePlacement,
  useUser as useSuperwallUser,
  type PartialSuperwallOptions,
} from 'expo-superwall';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import Purchases, { type CustomerInfo } from 'react-native-purchases';

import { useUser } from '@/features/auth/auth-provider';
import { Sentry } from '@/lib/sentry';

import { refreshPremiumAccess } from './api';
import { superwallKeys } from './config';
import { SubscriptionContext, type SubscriptionState } from './context';
import {
  configureRevenueCat,
  getActiveEntitlements,
  hasPremium,
  revenueCatPurchaseController,
} from './revenuecat';

// Antes de qualquer efeito: o RevenueCat precisa estar pronto quando os
// listeners abaixo forem registrados.
configureRevenueCat();

// Fora do componente: o SuperwallProvider reconfigura se `options` mudar de identidade.
const superwallOptions: PartialSuperwallOptions = {};

function report(error: unknown) {
  if (__DEV__) console.warn('[subscription]', error);
  Sentry.captureException(error);
}

/**
 * Superwall (paywalls) + RevenueCat (compras e entitlements).
 * Carregado só quando `isSubscriptionEnabled` — ver `subscription-provider.tsx`.
 */
export function SuperwallSubscriptionProvider({ children }: PropsWithChildren) {
  return (
    <CustomPurchaseControllerProvider controller={revenueCatPurchaseController}>
      <SuperwallProvider apiKeys={superwallKeys} options={superwallOptions} onConfigurationError={report}>
        <SubscriptionBridge>{children}</SubscriptionBridge>
      </SuperwallProvider>
    </CustomPurchaseControllerProvider>
  );
}

/**
 * Mantém RevenueCat e Superwall em sincronia com o app:
 * - mesmo usuário nos dois (o id do Supabase), para a compra seguir a conta;
 * - entitlements ativas do RevenueCat → status de assinatura no Superwall.
 * Os useEffect aqui são sincronização com sistemas externos (os SDKs).
 */
function SubscriptionBridge({ children }: PropsWithChildren) {
  const userId = useUser()?.id ?? null;
  const { identify, signOut, setSubscriptionStatus } = useSuperwallUser();
  const { registerPlacement } = usePlacement({ onError: report });
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const previousUserId = useRef<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const previous = previousUserId.current;
    previousUserId.current = userId;

    if (userId) {
      Promise.all([Purchases.logIn(userId), identify(userId)]).catch(report);
    } else if (previous) {
      (async () => {
        if (!(await Purchases.isAnonymous())) await Purchases.logOut();
        await signOut();
      })().catch(report);
    }
  }, [userId, identify, signOut]);

  useEffect(() => {
    const listener = (info: CustomerInfo) => {
      setCustomerInfo(info);
      const ids = getActiveEntitlements(info);
      setSubscriptionStatus(
        ids.length
          ? { status: 'ACTIVE', entitlements: ids.map((id) => ({ id, type: 'SERVICE_LEVEL' })) }
          : { status: 'INACTIVE' }
      ).catch(report);
    };
    Purchases.addCustomerInfoUpdateListener(listener);
    Purchases.getCustomerInfo().then(listener, report);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [setSubscriptionStatus]);

  // Sempre que o RevenueCat mudar o status (compra, restauração, expiração),
  // atualiza o servidor e os vídeos. Cobre também quem já era assinante antes
  // de o webhook existir.
  const premium = customerInfo ? hasPremium(customerInfo) : null;
  useEffect(() => {
    if (!userId || premium === null) return;
    refreshPremiumAccess(queryClient).catch(report);
  }, [userId, premium, queryClient]);

  const value: SubscriptionState = {
    isEnabled: true,
    isLoading: premium === null,
    isPremium: premium ?? false,
    showPaywall: (placement, options) =>
      registerPlacement({ placement, params: options?.params, feature: options?.onUnlocked }),
    restorePurchases: async () => hasPremium(await Purchases.restorePurchases()),
  };

  return <SubscriptionContext value={value}>{children}</SubscriptionContext>;
}
