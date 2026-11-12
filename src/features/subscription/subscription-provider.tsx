import type { ComponentType, PropsWithChildren } from 'react';

import { isSubscriptionEnabled } from './config';

/**
 * O módulo nativo do Superwall lança erro ao ser importado no Expo Go e no
 * web, então ele só é carregado (require sob demanda) quando vai ser usado.
 * Sem ele, `useSubscription()` devolve o estado "desligado".
 */
const Provider: ComponentType<PropsWithChildren> | null = isSubscriptionEnabled
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('./superwall-provider').SuperwallSubscriptionProvider
  : null;

export function SubscriptionProvider({ children }: PropsWithChildren) {
  return Provider ? <Provider>{children}</Provider> : children;
}
