// Edge Function: envia push (Expo) quando chega mensagem no chat.
// Chamada pelo banco (trigger messages_request_push, via pg_net), nunca pelo app.
//
// Deploy (o banco não envia JWT de usuário):
//   supabase functions deploy chat-push --no-verify-jwt
// Secrets:
//   supabase secrets set CHAT_PUSH_SECRET=<mesmo valor do segredo chat_push_secret no Vault>
//   supabase secrets set EXPO_ACCESS_TOKEN=<opcional: só se ativar "Enhanced push security" no Expo>
//
// Quem recebe é decidido no banco (chat_push_targets): todos os membros menos
// quem enviou, quem silenciou a conversa e quem bloqueou o remetente.
import { createClient } from 'npm:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Limite da API do Expo por requisição. */
const EXPO_BATCH_SIZE = 100;
const MAX_BODY_LENGTH = 180;

type Target = {
  token: string;
  language: string;
  conversation_id: string;
  kind: 'dm' | 'community';
  community_name: string | null;
  sender_name: string;
  body: string;
  has_attachment: boolean;
};

type ExpoTicket = { status: 'ok' | 'error'; id?: string; details?: { error?: string } };

const PHOTO_LABEL: Record<string, string> = { pt: '📷 Foto', en: '📷 Photo' };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isAuthorized(req: Request) {
  const expected = Deno.env.get('CHAT_PUSH_SECRET');
  if (!expected) return false;
  const received = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
  return received === expected;
}

function truncate(text: string) {
  return text.length > MAX_BODY_LENGTH ? `${text.slice(0, MAX_BODY_LENGTH - 1)}…` : text;
}

function toExpoMessage(target: Target) {
  const text =
    target.body || (target.has_attachment ? (PHOTO_LABEL[target.language] ?? PHOTO_LABEL.pt) : '');
  const isCommunity = target.kind === 'community';

  return {
    to: target.token,
    // DM: título é quem enviou. Comunidade: título é a comunidade e o corpo diz quem enviou.
    title: isCommunity ? (target.community_name ?? target.sender_name) : target.sender_name,
    body: truncate(isCommunity ? `${target.sender_name}: ${text}` : text),
    data: { conversationId: target.conversation_id, url: `/chat/${target.conversation_id}` },
    sound: 'default',
    priority: 'high',
    // Android: canal criado pelo app. iOS: agrupa as notificações por conversa.
    channelId: 'chat',
    threadId: target.conversation_id,
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!isAuthorized(req)) return json({ error: 'unauthorized' }, 401);

  let messageId: string | undefined;
  try {
    messageId = (await req.json()).message_id;
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  if (!messageId) return json({ error: 'invalid_body' }, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data, error } = await admin.rpc('chat_push_targets', { p_message_id: messageId });
  if (error) return json({ error: 'targets_failed' }, 500);

  const targets = (data ?? []) as Target[];
  if (targets.length === 0) return json({ ok: true, sent: 0 });

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const invalidTokens: string[] = [];
  let sent = 0;

  for (let i = 0; i < targets.length; i += EXPO_BATCH_SIZE) {
    const batch = targets.slice(i, i + EXPO_BATCH_SIZE);
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(batch.map(toExpoMessage)),
      });
      if (!response.ok) {
        console.error('chat-push: Expo respondeu', response.status, await response.text());
        continue;
      }
      // Os tickets vêm na mesma ordem das mensagens enviadas.
      const tickets = ((await response.json()).data ?? []) as ExpoTicket[];
      tickets.forEach((ticket, index) => {
        if (ticket.status === 'ok') sent++;
        else if (ticket.details?.error === 'DeviceNotRegistered') invalidTokens.push(batch[index].token);
      });
    } catch (fetchError) {
      console.error('chat-push: falha ao chamar o Expo', fetchError);
    }
  }

  // App desinstalado ou token revogado: para de enviar para ele.
  if (invalidTokens.length > 0) {
    await admin.from('push_tokens').delete().in('token', invalidTokens);
  }

  return json({ ok: true, sent, removed: invalidTokens.length });
});
