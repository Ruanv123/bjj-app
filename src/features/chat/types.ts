export type MessageStatus = 'sent' | 'sending' | 'failed';

export type Attachment = {
  /** Caminho no bucket `chat-media`: `<conversationId>/<messageId>.jpg`. */
  path: string;
  width: number | null;
  height: number | null;
};

export type Reactions = Record<string, string>;

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  senderName: string;
  senderAvatarUrl: string | null;
  createdAt: string;
  /** Última mudança no servidor (criação, edição ou exclusão): base da sincronização. */
  updatedAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  attachment: Attachment | null;
  /** Reações: id de quem reagiu → emoji (uma por pessoa, como no WhatsApp). */
  reactions: Reactions;
  /** Só existe no app: envio otimista. Mensagens vindas do banco são sempre 'sent'. */
  status: MessageStatus;
  /** Só existe no app: imagem local mostrada enquanto o envio não termina. */
  localUri?: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  sender_name: string;
  sender_avatar_url: string | null;
  created_at: string;
  updated_at: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  attachment_path: string | null;
  attachment_width: number | null;
  attachment_height: number | null;
  reactions?: Reactions | null;
};

export const MESSAGE_COLUMNS =
  'id,conversation_id,sender_id,body,sender_name,sender_avatar_url,created_at,updated_at,edited_at,deleted_at,attachment_path,attachment_width,attachment_height,reactions';

export const MAX_MESSAGE_LENGTH = 2000;

export function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body,
    senderName: row.sender_name,
    senderAvatarUrl: row.sender_avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
    editedAt: row.edited_at ?? null,
    deletedAt: row.deleted_at ?? null,
    attachment: row.attachment_path
      ? {
          path: row.attachment_path,
          width: row.attachment_width ?? null,
          height: row.attachment_height ?? null,
        }
      : null,
    reactions: row.reactions ?? {},
    status: 'sent',
  };
}

/** Emojis da barra rápida (toque longo na mensagem). */
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

/** Grade completa, ao tocar em "+". */
export const MORE_REACTIONS = [
  '👍', '👎', '❤️', '🔥', '😂', '🤣', '😮', '😢', '😡', '🙏', '👏', '💪',
  '🥋', '🏆', '🥇', '💯', '🎉', '🤝', '👀', '🤔', '😅', '😎', '🙌', '✅',
] as const;

export type ReactionSummary = { emoji: string; count: number; mine: boolean };

/** Agrupa por emoji, do mais usado para o menos usado. */
export function summarizeReactions(reactions: Reactions, myId: string | undefined): ReactionSummary[] {
  const byEmoji = new Map<string, ReactionSummary>();
  for (const [userId, emoji] of Object.entries(reactions)) {
    const entry = byEmoji.get(emoji) ?? { emoji, count: 0, mine: false };
    entry.count++;
    if (userId === myId) entry.mine = true;
    byEmoji.set(emoji, entry);
  }
  return [...byEmoji.values()].sort((a, b) => b.count - a.count);
}

/** Reação nova (ou removida, com emoji nulo) aplicada localmente. */
export function applyReaction(reactions: Reactions, userId: string, emoji: string | null): Reactions {
  const next = { ...reactions };
  if (emoji) next[userId] = emoji;
  else delete next[userId];
  return next;
}

export type ConversationKind = 'dm' | 'community';
export type MemberRole = 'owner' | 'moderator' | 'member';
export type LastMessageType = 'text' | 'image' | 'deleted';

export type Conversation = {
  id: string;
  kind: ConversationKind;
  title: string;
  avatarUrl: string | null;
  communityId: string | null;
  description: string;
  bannerUrl: string | null;
  isPrivate: boolean;
  otherUserId: string | null;
  /** DM: eu bloqueei a outra pessoa. */
  isBlocked: boolean;
  memberCount: number;
  myRole: MemberRole;
  muted: boolean;
  lastMessageBody: string | null;
  lastMessageType: LastMessageType | null;
  lastMessageAt: string | null;
  lastMessageSenderId: string | null;
  unreadCount: number;
};

export type ConversationRow = {
  id: string;
  kind: ConversationKind;
  title: string;
  avatar_url: string | null;
  community_id: string | null;
  description: string | null;
  banner_url: string | null;
  is_private: boolean;
  other_user_id: string | null;
  is_blocked: boolean;
  member_count: number;
  my_role: MemberRole;
  muted: boolean;
  last_message_body: string | null;
  last_message_type: LastMessageType | null;
  last_message_at: string | null;
  last_message_sender_id: string | null;
  unread_count: number;
};

export function mapConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    avatarUrl: row.avatar_url,
    communityId: row.community_id,
    description: row.description ?? '',
    bannerUrl: row.banner_url ?? null,
    isPrivate: row.is_private,
    otherUserId: row.other_user_id,
    isBlocked: row.is_blocked,
    memberCount: row.member_count,
    myRole: row.my_role,
    muted: row.muted,
    lastMessageBody: row.last_message_body,
    lastMessageType: row.last_message_type,
    lastMessageAt: row.last_message_at,
    lastMessageSenderId: row.last_message_sender_id,
    unreadCount: row.unread_count,
  };
}

export function isModerator(role: MemberRole | null | undefined) {
  return role === 'owner' || role === 'moderator';
}

export type Community = {
  id: string;
  name: string;
  description: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  isPrivate: boolean;
  conversationId: string;
  memberCount: number;
  isMember: boolean;
  myRole: MemberRole | null;
};

export type CommunityRow = {
  id: string;
  name: string;
  description: string;
  avatar_url: string | null;
  banner_url: string | null;
  is_private: boolean;
  conversation_id: string;
  member_count: number;
  is_member: boolean;
  my_role: MemberRole | null;
};

export function mapCommunity(row: CommunityRow): Community {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    avatarUrl: row.avatar_url,
    bannerUrl: row.banner_url ?? null,
    isPrivate: row.is_private,
    conversationId: row.conversation_id,
    memberCount: row.member_count,
    isMember: row.is_member,
    myRole: row.my_role,
  };
}

export type ChatUser = { id: string; name: string; avatarUrl: string | null };

export type Member = ChatUser & { role: MemberRole; joinedAt: string };

export type BannedUser = ChatUser & { reason: string; bannedAt: string };

export const COMMUNITY_NAME_MIN = 3;
export const COMMUNITY_NAME_MAX = 60;
export const COMMUNITY_DESCRIPTION_MAX = 280;

/** Erros que o banco devolve pelo texto (raise exception '<código>'). */
export type ChatErrorCode =
  | 'blocked'
  | 'banned'
  | 'private_community'
  | 'invalid_code'
  | 'owner_cannot_leave'
  | 'forbidden';

export function chatErrorCode(error: unknown): ChatErrorCode | null {
  const message = (error as { message?: unknown } | null)?.message;
  const known: ChatErrorCode[] = [
    'blocked',
    'banned',
    'private_community',
    'invalid_code',
    'owner_cannot_leave',
    'forbidden',
  ];
  return typeof message === 'string' && (known as string[]).includes(message)
    ? (message as ChatErrorCode)
    : null;
}
