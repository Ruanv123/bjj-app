// Edge Function: exclui a conta de quem chamou.
// Deploy: supabase functions deploy delete-account
//
// Roda no servidor com a service role (nunca vai para o app). Passos:
// 1. valida o JWT de quem chamou;
// 2. apaga os arquivos do usuário no bucket `avatars` (o Supabase não exclui
//    usuários que ainda são donos de objetos no Storage);
// 3. exclui o usuário — perfil, comentários e salvos caem junto (on delete cascade).
import { createClient } from 'npm:@supabase/supabase-js@2';

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

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return json({ error: 'unauthorized' }, 401);

  // Apaga todos os arquivos da pasta do usuário (em lotes).
  const bucket = admin.storage.from('avatars');
  for (;;) {
    const { data: files, error } = await bucket.list(user.id, { limit: 100 });
    if (error) return json({ error: 'storage_list_failed' }, 500);
    const paths = (files ?? []).filter((f) => f.id !== null).map((f) => `${user.id}/${f.name}`);
    if (paths.length === 0) break;
    const { error: removeError } = await bucket.remove(paths);
    if (removeError) return json({ error: 'storage_remove_failed' }, 500);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return json({ error: 'delete_failed' }, 500);

  return json({ ok: true });
});
