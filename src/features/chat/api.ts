import { decode } from 'base64-arraybuffer';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from '@/lib/supabase';

import {
  MESSAGE_COLUMNS,
  mapCommunity,
  mapConversation,
  mapMessage,
  type Attachment,
  type BannedUser,
  type ChatUser,
  type Community,
  type CommunityRow,
  type Conversation,
  type ConversationRow,
  type Member,
  type MemberRole,
  type Message,
  type MessageRow,
} from './types';

export const MESSAGES_PAGE_SIZE = 40;
export const CHAT_MEDIA_BUCKET = 'chat-media';
/** Lado maior da imagem enviada: boa nitidez no celular sem pesar no plano. */
const MAX_IMAGE_SIDE = 1600;

/** Posição da mensagem mais antiga já carregada: a próxima página começa antes dela. */
export type MessageCursor = { createdAt: string; id: string };

type UserRow = { id: string; name: string; avatar_url: string | null };

function mapUser(row: UserRow): ChatUser {
  return { id: row.id, name: row.name, avatarUrl: row.avatar_url };
}

// ---------- Conversas ----------

export async function fetchConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase.rpc('list_conversations');
  if (error) throw error;
  return (data as ConversationRow[]).map(mapConversation);
}

export async function fetchConversation(id: string): Promise<Conversation | null> {
  const { data, error } = await supabase.rpc('list_conversations', { p_conversation_id: id });
  if (error) throw error;
  const row = (data as ConversationRow[])[0];
  return row ? mapConversation(row) : null;
}

export async function markConversationRead(id: string) {
  const { error } = await supabase.rpc('mark_conversation_read', { p_conversation_id: id });
  if (error) throw error;
}

export async function setConversationMuted(id: string, muted: boolean) {
  const { error } = await supabase.rpc('set_conversation_muted', {
    p_conversation_id: id,
    p_muted: muted,
  });
  if (error) throw error;
}

// ---------- Mensagens ----------

/** Uma página de mensagens, da mais nova para a mais antiga. */
export async function fetchMessagesPage(
  conversationId: string,
  cursor: MessageCursor | null
): Promise<Message[]> {
  let query = supabase
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(MESSAGES_PAGE_SIZE);

  if (cursor) {
    // (created_at, id) < cursor — o id desempata mensagens com o mesmo horário.
    // Aspas porque o timestamp tem caracteres reservados do PostgREST (":" e "+").
    const at = `"${cursor.createdAt}"`;
    query = query.or(`created_at.lt.${at},and(created_at.eq.${at},id.lt.${cursor.id})`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as MessageRow[]).map(mapMessage);
}

/** Máximo de mudanças buscadas numa recuperação (o resto chega na próxima). */
const MAX_CHANGES_PER_SYNC = 1000;
const CHANGES_PAGE_SIZE = 200;

/**
 * Tudo o que mudou na conversa a partir de um horário (inclusive): mensagens
 * novas, editadas e apagadas. Usado para recuperar o que o Realtime não entregou.
 */
export async function fetchMessagesChangedSince(
  conversationId: string,
  since: string
): Promise<Message[]> {
  const changes: Message[] = [];
  let cursor = since;

  while (changes.length < MAX_CHANGES_PER_SYNC) {
    const { data, error } = await supabase
      .from('messages')
      .select(MESSAGE_COLUMNS)
      .eq('conversation_id', conversationId)
      .gte('updated_at', cursor)
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(CHANGES_PAGE_SIZE);
    if (error) throw error;

    const page = (data as MessageRow[]).map(mapMessage);
    changes.push(...page);
    if (page.length < CHANGES_PAGE_SIZE) break;

    const last = page[page.length - 1].updatedAt;
    // Página inteira com o mesmo horário: avançar pelo cursor entraria em loop.
    if (last === cursor) break;
    cursor = last;
  }
  return changes;
}

export async function sendMessage(input: {
  id: string;
  conversationId: string;
  body: string;
  attachment: Attachment | null;
}): Promise<Message> {
  // Remetente, nome, foto e horário são definidos pelo trigger no banco.
  const { data, error } = await supabase
    .from('messages')
    .insert({
      id: input.id,
      conversation_id: input.conversationId,
      body: input.body,
      attachment_path: input.attachment?.path ?? null,
      attachment_width: input.attachment?.width ?? null,
      attachment_height: input.attachment?.height ?? null,
    })
    .select(MESSAGE_COLUMNS)
    .single();

  if (error) {
    // Chave duplicada: uma tentativa anterior chegou ao banco, mas a resposta se perdeu.
    if (error.code === '23505') return fetchMessage(input.id);
    throw error;
  }
  return mapMessage(data as MessageRow);
}

async function fetchMessage(id: string): Promise<Message> {
  const { data, error } = await supabase.from('messages').select(MESSAGE_COLUMNS).eq('id', id).single();
  if (error) throw error;
  return mapMessage(data as MessageRow);
}

export async function editMessage(id: string, body: string) {
  const { error } = await supabase.rpc('edit_message', { p_message_id: id, p_body: body });
  if (error) throw error;
}

/** Apaga a mensagem e, se tinha imagem, remove o arquivo do Storage. */
export async function deleteMessage(id: string) {
  const { data, error } = await supabase.rpc('delete_message', { p_message_id: id });
  if (error) throw error;
  const path = data as string | null;
  // Se falhar, só sobra um arquivo órfão — a mensagem já não aponta para ele.
  if (path) await supabase.storage.from(CHAT_MEDIA_BUCKET).remove([path]);
}

export async function reportMessage(id: string, reason: string) {
  const { error } = await supabase.rpc('report_message', { p_message_id: id, p_reason: reason });
  if (error) throw error;
}

// ---------- Imagens ----------

/**
 * Reduz a imagem (JPEG) e envia para `chat-media/<conversationId>/<messageId>.jpg`.
 * Usa o id da mensagem no nome: reenviar depois de uma falha não cria arquivo duplicado.
 */
export async function uploadChatImage(
  conversationId: string,
  messageId: string,
  sourceUri: string,
  size: { width: number; height: number }
): Promise<Attachment> {
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(size.width, size.height));
  const context = ImageManipulator.manipulate(sourceUri);
  if (scale < 1) {
    context.resize({ width: Math.round(size.width * scale), height: Math.round(size.height * scale) });
  }
  const rendered = await context.renderAsync();
  const image = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.75, base64: true });
  if (!image.base64) throw new Error('Falha ao processar a imagem.');

  const path = `${conversationId}/${messageId}.jpg`;
  const { error } = await supabase.storage
    .from(CHAT_MEDIA_BUCKET)
    .upload(path, decode(image.base64), { contentType: 'image/jpeg', cacheControl: '31536000' });

  // Já existe: a tentativa anterior subiu o arquivo e falhou depois.
  const storageError = error as { statusCode?: string; status?: number; message?: string } | null;
  const alreadyUploaded =
    storageError?.statusCode === '409' ||
    storageError?.status === 409 ||
    /already exists/i.test(storageError?.message ?? '');
  if (error && !alreadyUploaded) throw error;

  return { path, width: image.width, height: image.height };
}

/** URL temporária (bucket privado). */
export async function createChatImageUrl(path: string, expiresInSeconds: number) {
  const { data, error } = await supabase.storage
    .from(CHAT_MEDIA_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

// ---------- Pessoas, DMs e bloqueio ----------

export async function searchUsers(query: string): Promise<ChatUser[]> {
  const { data, error } = await supabase.rpc('search_users', { p_query: query });
  if (error) throw error;
  return (data as UserRow[]).map(mapUser);
}

/** Abre (ou cria) a DM com outra pessoa e devolve o id da conversa. */
export async function getOrCreateDm(otherUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_dm', { p_other_user_id: otherUserId });
  if (error) throw error;
  return data as string;
}

export async function blockUser(userId: string) {
  const { error } = await supabase.rpc('block_user', { p_user_id: userId });
  if (error) throw error;
}

export async function unblockUser(userId: string) {
  const { error } = await supabase.rpc('unblock_user', { p_user_id: userId });
  if (error) throw error;
}

export async function fetchBlockedUsers(): Promise<ChatUser[]> {
  const { data, error } = await supabase.rpc('list_blocked_users');
  if (error) throw error;
  return (data as UserRow[]).map(mapUser);
}

// ---------- Comunidades ----------

export async function fetchCommunities(): Promise<Community[]> {
  const { data, error } = await supabase.rpc('list_communities');
  if (error) throw error;
  return (data as CommunityRow[]).map(mapCommunity);
}

/** Entra na comunidade (pública) e devolve o id da conversa dela. */
export async function joinCommunity(communityId: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_community', { p_community_id: communityId });
  if (error) throw error;
  return data as string;
}

/** Entra com o código de convite e devolve o id da conversa. */
export async function joinCommunityByCode(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_community_by_code', { p_code: code });
  if (error) throw error;
  return data as string;
}

export async function leaveCommunity(communityId: string) {
  const { error } = await supabase.rpc('leave_community', { p_community_id: communityId });
  if (error) throw error;
}

/** Cria a comunidade e devolve o id da conversa dela. */
export async function createCommunity(input: {
  name: string;
  description: string;
  isPrivate: boolean;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_community', {
    p_name: input.name,
    p_description: input.description,
    p_is_private: input.isPrivate,
  });
  if (error) throw error;
  return data as string;
}

export async function deleteCommunity(communityId: string) {
  const { error } = await supabase.rpc('delete_community', { p_community_id: communityId });
  if (error) throw error;
}

export async function fetchCommunityInvite(communityId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_community_invite', {
    p_community_id: communityId,
  });
  if (error) throw error;
  return data as string;
}

export async function regenerateCommunityInvite(communityId: string): Promise<string> {
  const { data, error } = await supabase.rpc('regenerate_community_invite', {
    p_community_id: communityId,
  });
  if (error) throw error;
  return data as string;
}

// ---------- Membros e moderação ----------

export async function fetchMembers(conversationId: string): Promise<Member[]> {
  const { data, error } = await supabase.rpc('list_conversation_members', {
    p_conversation_id: conversationId,
  });
  if (error) throw error;
  return (
    data as {
      user_id: string;
      name: string;
      avatar_url: string | null;
      role: MemberRole;
      joined_at: string;
    }[]
  ).map((m) => ({
    id: m.user_id,
    name: m.name,
    avatarUrl: m.avatar_url,
    role: m.role,
    joinedAt: m.joined_at,
  }));
}

export async function setMemberRole(conversationId: string, userId: string, role: 'moderator' | 'member') {
  const { error } = await supabase.rpc('set_member_role', {
    p_conversation_id: conversationId,
    p_user_id: userId,
    p_role: role,
  });
  if (error) throw error;
}

export async function removeMember(conversationId: string, userId: string, ban: boolean) {
  const { error } = await supabase.rpc('remove_member', {
    p_conversation_id: conversationId,
    p_user_id: userId,
    p_ban: ban,
  });
  if (error) throw error;
}

export async function fetchBans(conversationId: string): Promise<BannedUser[]> {
  const { data, error } = await supabase.rpc('list_community_bans', {
    p_conversation_id: conversationId,
  });
  if (error) throw error;
  return (
    data as {
      user_id: string;
      name: string;
      avatar_url: string | null;
      reason: string;
      created_at: string;
    }[]
  ).map((b) => ({
    id: b.user_id,
    name: b.name,
    avatarUrl: b.avatar_url,
    reason: b.reason,
    bannedAt: b.created_at,
  }));
}

export async function unbanMember(conversationId: string, userId: string) {
  const { error } = await supabase.rpc('unban_member', {
    p_conversation_id: conversationId,
    p_user_id: userId,
  });
  if (error) throw error;
}

// ---------- Reações e busca ----------

/** Reage (ou remove a reação, com emoji nulo). Uma reação por pessoa. */
export async function reactToMessage(id: string, emoji: string | null) {
  const { error } = await supabase.rpc('react_to_message', { p_message_id: id, p_emoji: emoji });
  if (error) throw error;
}

export const MIN_MESSAGE_SEARCH_LENGTH = 2;

/** Mensagens da conversa que contêm o texto, da mais nova para a mais antiga. */
export async function searchMessages(conversationId: string, query: string): Promise<Message[]> {
  const { data, error } = await supabase.rpc('search_messages', {
    p_conversation_id: conversationId,
    p_query: query,
  });
  if (error) throw error;
  return (data as MessageRow[]).map(mapMessage);
}

// ---------- Perfil da comunidade ----------

export const COMMUNITY_MEDIA_BUCKET = 'community-media';
export type CommunityImageKind = 'avatar' | 'banner';

/** Foto: quadrada 512px. Banner: 3:1, 1500px de largura. */
const COMMUNITY_IMAGE_SIZE: Record<CommunityImageKind, { width: number; aspect: number }> = {
  avatar: { width: 512, aspect: 1 },
  banner: { width: 1500, aspect: 3 },
};

export async function updateCommunity(input: {
  communityId: string;
  name: string;
  description: string;
  isPrivate: boolean;
}) {
  const { error } = await supabase.rpc('update_community', {
    p_community_id: input.communityId,
    p_name: input.name,
    p_description: input.description,
    p_is_private: input.isPrivate,
  });
  if (error) throw error;
}

/**
 * Recorta no centro (proporção do tipo), reduz, envia para
 * `community-media/<communityId>/<tipo>-<timestamp>.jpg` e grava na comunidade.
 * Um nome novo a cada envio evita cache antigo na CDN.
 */
export async function uploadCommunityImage(
  communityId: string,
  kind: CommunityImageKind,
  source: { uri: string; width: number; height: number }
) {
  const { width: targetWidth, aspect } = COMMUNITY_IMAGE_SIZE[kind];

  // Maior retângulo com a proporção desejada, centralizado.
  let cropWidth = source.width;
  let cropHeight = Math.round(source.width / aspect);
  if (cropHeight > source.height) {
    cropHeight = source.height;
    cropWidth = Math.round(source.height * aspect);
  }
  const context = ImageManipulator.manipulate(source.uri);
  if (source.width > 0 && source.height > 0) {
    context.crop({
      originX: Math.round((source.width - cropWidth) / 2),
      originY: Math.round((source.height - cropHeight) / 2),
      width: cropWidth,
      height: cropHeight,
    });
  }
  context.resize({ width: Math.min(targetWidth, cropWidth || targetWidth) });
  const rendered = await context.renderAsync();
  const image = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  if (!image.base64) throw new Error('Falha ao processar a imagem.');

  const path = `${communityId}/${kind}-${Date.now()}.jpg`;
  const bucket = supabase.storage.from(COMMUNITY_MEDIA_BUCKET);
  const { error: uploadError } = await bucket.upload(path, decode(image.base64), {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
  });
  if (uploadError) throw uploadError;

  const { data } = bucket.getPublicUrl(path);
  try {
    await setCommunityImage(communityId, kind, path, data.publicUrl);
  } catch (error) {
    await bucket.remove([path]);
    throw error;
  }
}

export function removeCommunityImage(communityId: string, kind: CommunityImageKind) {
  return setCommunityImage(communityId, kind, null, null);
}

async function setCommunityImage(
  communityId: string,
  kind: CommunityImageKind,
  path: string | null,
  url: string | null
) {
  const { data, error } = await supabase.rpc('set_community_image', {
    p_community_id: communityId,
    p_kind: kind,
    p_path: path,
    p_url: url,
  });
  if (error) throw error;
  const previous = data as string | null;
  // Se falhar, só sobra um arquivo órfão — a comunidade já não aponta para ele.
  if (previous && previous !== path) {
    await supabase.storage.from(COMMUNITY_MEDIA_BUCKET).remove([previous]);
  }
}
