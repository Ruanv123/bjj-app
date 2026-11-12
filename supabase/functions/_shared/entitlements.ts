// Sincroniza `public.user_entitlements` com o estado atual do RevenueCat.
// Usado pelo webhook (revenuecat-webhook) e pelo app logo após uma compra
// (sync-subscription), para não depender do tempo de entrega do webhook.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Só ids do Supabase interessam; `$RCAnonymousID:...` e afins são ignorados. */
export function isSupabaseUserId(id: unknown): id is string {
  return typeof id === 'string' && UUID.test(id);
}

export function createAdminClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type RevenueCatEntitlement = {
  expires_date: string | null;
  grace_period_expires_date: string | null;
  product_identifier: string;
  purchase_date: string;
};

async function fetchEntitlements(appUserId: string) {
  const response = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    { headers: { Authorization: `Bearer ${Deno.env.get('REVENUECAT_SECRET_API_KEY')}` } }
  );
  if (!response.ok) {
    throw new Error(`RevenueCat respondeu ${response.status} para ${appUserId}`);
  }
  const body = await response.json();
  return (body.subscriber?.entitlements ?? {}) as Record<string, RevenueCatEntitlement>;
}

/** A data mais tardia entre expiração e carência; null = vitalício. */
function accessUntil(e: RevenueCatEntitlement) {
  if (e.expires_date === null) return null;
  const dates = [e.expires_date, e.grace_period_expires_date].filter(Boolean) as string[];
  return new Date(Math.max(...dates.map((d) => Date.parse(d)))).toISOString();
}

/**
 * Grava todas as entitlements do usuário (inclusive expiradas, com a data) e
 * remove as que o RevenueCat não conhece mais. Retorna se `premium` está ativa.
 */
export async function syncUserEntitlements(admin: SupabaseClient, userId: string) {
  const entitlements = await fetchEntitlements(userId);
  const now = new Date().toISOString();

  const rows = Object.entries(entitlements).map(([entitlement, e]) => ({
    user_id: userId,
    entitlement,
    product_id: e.product_identifier,
    expires_at: accessUntil(e),
    updated_at: now,
  }));

  if (rows.length > 0) {
    const { error } = await admin.from('user_entitlements').upsert(rows);
    if (error) throw error;
  }

  const keep = rows.map((r) => r.entitlement);
  let remove = admin.from('user_entitlements').delete().eq('user_id', userId);
  if (keep.length > 0) remove = remove.not('entitlement', 'in', `(${keep.map((k) => `"${k}"`).join(',')})`);
  const { error: deleteError } = await remove;
  if (deleteError) throw deleteError;

  const premium = rows.find((r) => r.entitlement === 'premium');
  return !!premium && (premium.expires_at === null || premium.expires_at > now);
}
