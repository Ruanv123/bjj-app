import type { QueryClient } from '@tanstack/react-query';

import { videoKeys } from '@/features/videos/hooks';
import { supabase } from '@/lib/supabase';

/**
 * Pede ao servidor para ler o estado atual no RevenueCat e gravar em
 * `user_entitlements` (Edge Function `sync-subscription`). O webhook faz o
 * mesmo, mas pode levar alguns segundos depois da compra.
 */
export async function syncSubscription() {
  const { data, error } = await supabase.functions.invoke<{ isPremium: boolean }>(
    'sync-subscription',
    { method: 'POST' }
  );
  if (error) throw error;
  return data?.isPremium ?? false;
}

/** Sincroniza no servidor e recarrega os vídeos (as URLs dependem da assinatura). */
export async function refreshPremiumAccess(queryClient: QueryClient) {
  await syncSubscription();
  await queryClient.invalidateQueries({ queryKey: videoKeys.all });
}
