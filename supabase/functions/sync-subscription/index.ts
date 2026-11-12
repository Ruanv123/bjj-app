// Edge Function: o app chama logo após comprar/restaurar, para liberar o
// conteúdo premium sem esperar o webhook do RevenueCat chegar.
// Deploy: supabase functions deploy sync-subscription
// Usa o secret REVENUECAT_SECRET_API_KEY (ver revenuecat-webhook).
import { createAdminClient, syncUserEntitlements } from '../_shared/entitlements.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);

  const admin = createAdminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json({ error: 'unauthorized' }, 401);

  try {
    // Só sincroniza o próprio usuário: o id vem do JWT, não do corpo.
    const isPremium = await syncUserEntitlements(admin, data.user.id);
    return json({ isPremium });
  } catch (e) {
    console.error('[sync-subscription]', data.user.id, e);
    return json({ error: 'sync_failed' }, 502);
  }
});
