// Edge Function: recebe os webhooks do RevenueCat e atualiza `user_entitlements`.
// Deploy (o RevenueCat não envia JWT do Supabase):
//   supabase functions deploy revenuecat-webhook --no-verify-jwt
// Secrets:
//   supabase secrets set REVENUECAT_WEBHOOK_AUTH=<valor longo e aleatório>
//   supabase secrets set REVENUECAT_SECRET_API_KEY=<chave secreta v1 do RevenueCat>
// No RevenueCat (Integrations → Webhooks): URL desta função e o mesmo valor
// de REVENUECAT_WEBHOOK_AUTH no campo "Authorization header".
//
// Seguindo a recomendação do RevenueCat, não interpretamos cada tipo de evento:
// para todo evento, buscamos o estado atual do cliente na API e gravamos.
// Isso também resolve eventos repetidos ou fora de ordem.
import { createAdminClient, isSupabaseUserId, syncUserEntitlements } from '../_shared/entitlements.ts';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isAuthorized(req: Request) {
  const expected = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
  if (!expected) return false;
  // Aceita o valor puro ou com "Bearer " na frente.
  const received = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
  return received === expected.replace(/^Bearer\s+/i, '').trim();
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!isAuthorized(req)) return json({ error: 'unauthorized' }, 401);

  let event: Record<string, unknown>;
  try {
    event = (await req.json()).event ?? {};
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  // Todos os ids envolvidos (inclui os dois lados de uma TRANSFER).
  const candidates = [
    event.app_user_id,
    event.original_app_user_id,
    ...((event.aliases as unknown[]) ?? []),
    ...((event.transferred_from as unknown[]) ?? []),
    ...((event.transferred_to as unknown[]) ?? []),
  ];
  const userIds = [...new Set(candidates.filter(isSupabaseUserId))];

  // TEST e compras de usuários anônimos não têm id do Supabase: nada a fazer.
  if (userIds.length === 0) return json({ ok: true, synced: 0 });

  const admin = createAdminClient();
  const failures: string[] = [];

  for (const userId of userIds) {
    try {
      await syncUserEntitlements(admin, userId);
    } catch (error) {
      // Usuário já excluído do Supabase (violação de FK): não adianta repetir.
      if ((error as { code?: string }).code === '23503') continue;
      console.error('[revenuecat-webhook]', event.type, userId, error);
      failures.push(userId);
    }
  }

  // Status diferente de 200 faz o RevenueCat reenviar mais tarde.
  if (failures.length > 0) return json({ error: 'sync_failed' }, 500);
  return json({ ok: true, synced: userIds.length });
});
