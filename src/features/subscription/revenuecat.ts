import type { CustomPurchaseControllerContext, OnPurchaseParams } from 'expo-superwall';
import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PRODUCT_CATEGORY,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesError,
} from 'react-native-purchases';

import { PREMIUM_ENTITLEMENT, revenueCatKeys } from './config';

let configured = false;

/**
 * Configura o RevenueCat uma única vez. Chamado no carregamento do módulo do
 * provider, antes de qualquer efeito que use `Purchases`.
 */
export function configureRevenueCat() {
  if (configured) return;
  const apiKey = Platform.OS === 'ios' ? revenueCatKeys.ios : revenueCatKeys.android;
  if (!apiKey) return;
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  Purchases.configure({ apiKey });
  configured = true;
}

export function getActiveEntitlements(info: CustomerInfo) {
  return Object.keys(info.entitlements.active);
}

export function hasPremium(info: CustomerInfo) {
  return info.entitlements.active[PREMIUM_ENTITLEMENT] !== undefined;
}

function isPurchasesError(error: unknown): error is PurchasesError {
  return typeof error === 'object' && error !== null && 'code' in error;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function findStoreProduct(params: OnPurchaseParams) {
  const [subscriptions, oneTime] = await Promise.all([
    Purchases.getProducts([params.productId], PRODUCT_CATEGORY.SUBSCRIPTION),
    Purchases.getProducts([params.productId], PRODUCT_CATEGORY.NON_SUBSCRIPTION),
  ]);
  const products = [...subscriptions, ...oneTime];

  if (params.platform === 'android') {
    // No Google Play o RevenueCat identifica assinaturas como "produto:planoBase".
    return (
      products.find((p) => p.identifier === `${params.productId}:${params.basePlanId}`) ??
      products.find((p) => p.identifier === params.productId)
    );
  }
  return products.find((p) => p.identifier === params.productId);
}

/**
 * O Superwall mostra o paywall; quem efetua a compra é o RevenueCat.
 * O status de assinatura volta para o Superwall pelo listener de CustomerInfo
 * (ver `SubscriptionBridge`).
 */
export const revenueCatPurchaseController: CustomPurchaseControllerContext = {
  async onPurchase(params) {
    try {
      const product = await findStoreProduct(params);
      if (!product) {
        return { type: 'failed', error: `Produto ${params.productId} não encontrado no RevenueCat.` };
      }

      // No Android, compra exatamente a oferta escolhida no paywall (e não a
      // oferta padrão do RevenueCat).
      if (params.platform === 'android' && product.subscriptionOptions?.length) {
        const optionId = params.offerId
          ? `${params.basePlanId}:${params.offerId}`
          : params.basePlanId;
        const option = product.subscriptionOptions.find((o) => o.id === optionId);
        if (option) {
          await Purchases.purchaseSubscriptionOption(option);
          return { type: 'purchased' };
        }
      }

      await Purchases.purchaseStoreProduct(product);
      return { type: 'purchased' };
    } catch (error) {
      if (isPurchasesError(error)) {
        if (error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return { type: 'cancelled' };
        if (error.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) return { type: 'pending' };
      }
      return { type: 'failed', error: errorMessage(error) };
    }
  },

  async onPurchaseRestore() {
    try {
      await Purchases.restorePurchases();
      return { type: 'restored' };
    } catch (error) {
      return { type: 'failed', error: errorMessage(error) };
    }
  },
};
