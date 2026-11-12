import {
  infiniteQueryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import { useUser } from '@/features/auth/auth-provider';
import { useDisplayProfile } from '@/features/profile/hooks';

import {
  MESSAGES_PAGE_SIZE,
  blockUser,
  createChatImageUrl,
  createCommunity,
  deleteCommunity,
  deleteMessage,
  editMessage,
  fetchBans,
  fetchBlockedUsers,
  fetchCommunities,
  fetchCommunityInvite,
  fetchConversation,
  fetchConversations,
  fetchMembers,
  fetchMessagesPage,
  getOrCreateDm,
  joinCommunity,
  joinCommunityByCode,
  leaveCommunity,
  markConversationRead,
  MIN_MESSAGE_SEARCH_LENGTH,
  reactToMessage,
  regenerateCommunityInvite,
  removeCommunityImage,
  removeMember,
  reportMessage,
  searchMessages,
  searchUsers,
  sendMessage,
  setConversationMuted,
  setMemberRole,
  unbanMember,
  unblockUser,
  updateCommunity,
  uploadChatImage,
  uploadCommunityImage,
  type CommunityImageKind,
  type MessageCursor,
} from './api';
import {
  toChronological,
  updateMessage,
  upsertMessages,
  type MessagePages,
} from './messages-cache';
import { applyReaction, type Conversation, type Message } from './types';

/** Mínimo para a busca usar o índice trigram do banco. */
export const MIN_USER_SEARCH_LENGTH = 3;

/** URLs assinadas valem 1 h; renovamos antes de expirar. */
const SIGNED_URL_SECONDS = 60 * 60;

export const chatKeys = {
  all: ['chat'] as const,
  conversations: () => ['chat', 'conversations'] as const,
  conversation: (id: string) => ['chat', 'conversation', id] as const,
  messages: (id: string) => ['chat', 'messages', id] as const,
  members: (id: string) => ['chat', 'members', id] as const,
  bans: (id: string) => ['chat', 'bans', id] as const,
  communities: () => ['chat', 'communities'] as const,
  invite: (communityId: string) => ['chat', 'invite', communityId] as const,
  blocked: () => ['chat', 'blocked'] as const,
  userSearch: (term: string) => ['chat', 'users', term] as const,
  messageSearch: (id: string, term: string) => ['chat', 'message-search', id, term] as const,
  image: (path: string) => ['chat', 'image', path] as const,
};

function refreshLists(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: chatKeys.conversations() }),
    queryClient.invalidateQueries({ queryKey: ['chat', 'conversation'] }),
    queryClient.invalidateQueries({ queryKey: chatKeys.communities() }),
  ]);
}

// ---------- Conversas ----------

export function useConversations() {
  const user = useUser();
  return useQuery({
    queryKey: chatKeys.conversations(),
    queryFn: fetchConversations,
    enabled: !!user,
    staleTime: 10_000,
  });
}

/** Total de não lidas (sem conversas silenciadas), para o badge da aba. */
export function useUnreadTotal() {
  const user = useUser();
  const { data } = useQuery({
    queryKey: chatKeys.conversations(),
    queryFn: fetchConversations,
    enabled: !!user,
    staleTime: 10_000,
    select: (list) => list.reduce((sum, c) => sum + (c.muted ? 0 : c.unreadCount), 0),
  });
  return data ?? 0;
}

export function useConversation(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: chatKeys.conversation(id),
    queryFn: () => fetchConversation(id),
    // Abre instantâneo quando a conversa já está na lista.
    placeholderData: () =>
      queryClient.getQueryData<Conversation[]>(chatKeys.conversations())?.find((c) => c.id === id),
  });
}

export function useMarkConversationRead(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markConversationRead(id),
    // Invalida (em vez de zerar à mão) para cancelar uma busca antiga em andamento.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chatKeys.conversations() }),
  });
}

export function useSetMuted(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (muted: boolean) => setConversationMuted(id, muted),
    onMutate: (muted) => {
      queryClient.setQueryData<Conversation | null>(chatKeys.conversation(id), (c) =>
        c ? { ...c, muted } : c
      );
    },
    onSettled: () => refreshLists(queryClient),
  });
}

// ---------- Mensagens ----------

export function messagesQueryOptions(conversationId: string) {
  return infiniteQueryOptions({
    queryKey: chatKeys.messages(conversationId),
    queryFn: ({ pageParam }) => fetchMessagesPage(conversationId, pageParam),
    initialPageParam: null as MessageCursor | null,
    getNextPageParam: (lastPage: Message[]) => {
      // A primeira página cresce com as mensagens que chegam pelo Realtime.
      if (lastPage.length < MESSAGES_PAGE_SIZE) return undefined;
      const oldest = [...lastPage].reverse().find((m) => m.status === 'sent');
      return oldest ? { createdAt: oldest.createdAt, id: oldest.id } : undefined;
    },
    // O Realtime mantém o cache atualizado; refazer todas as páginas descartaria
    // mensagens ainda pendentes. A recuperação é feita em useConversationRealtime.
    staleTime: Infinity,
  });
}

/** Mensagens em ordem cronológica (mais antiga primeiro). */
export function useMessages(conversationId: string) {
  return useInfiniteQuery({
    ...messagesQueryOptions(conversationId),
    select: toChronological,
  });
}

type LocalImage = { uri: string; width: number; height: number };

type SendInput = { id: string; body: string; image: LocalImage | null };

export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();
  const user = useUser();
  const profile = useDisplayProfile();
  const key = chatKeys.messages(conversationId);

  const mutation = useMutation({
    mutationFn: async ({ id, body, image }: SendInput) => {
      const attachment = image ? await uploadChatImage(conversationId, id, image.uri, image) : null;
      return sendMessage({ id, conversationId, body, attachment });
    },
    onMutate: async ({ id, body, image }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const optimistic: Message = {
        id,
        conversationId,
        senderId: user?.id ?? '',
        body,
        senderName: profile.name ?? user?.email ?? '',
        senderAvatarUrl: profile.avatarUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        editedAt: null,
        deletedAt: null,
        attachment: image ? { path: '', width: image.width, height: image.height } : null,
        reactions: {},
        localUri: image?.uri,
        status: 'sending',
      };
      queryClient.setQueryData<MessagePages>(key, (data) => upsertMessages(data, [optimistic]));
    },
    onSuccess: (message, { image }) => {
      // Mantém a imagem local enquanto a remota não carrega (evita "piscar").
      const withLocal = image ? { ...message, localUri: image.uri } : message;
      queryClient.setQueryData<MessagePages>(key, (data) => upsertMessages(data, [withLocal]));
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
    onError: (_error, { id }) => {
      queryClient.setQueryData<MessagePages>(key, (data) =>
        updateMessage(data, id, { status: 'failed' })
      );
    },
  });

  return {
    send: (body: string) => mutation.mutate({ id: Crypto.randomUUID(), body, image: null }),
    sendImage: (image: LocalImage, body = '') =>
      mutation.mutate({ id: Crypto.randomUUID(), body, image }),
    /** Reenvia com o mesmo id: se a primeira tentativa chegou ao banco, não duplica. */
    retry: (message: Message) =>
      mutation.mutate({
        id: message.id,
        body: message.body,
        image:
          message.localUri && message.attachment
            ? {
                uri: message.localUri,
                width: message.attachment.width ?? 0,
                height: message.attachment.height ?? 0,
              }
            : null,
      }),
  };
}

/** Atualiza a mensagem no cache na hora; se o servidor recusar, volta como estava. */
function useOptimisticMessageMutation<TVariables extends { id: string }>(
  conversationId: string,
  mutationFn: (variables: TVariables) => Promise<unknown>,
  patch: (variables: TVariables) => Partial<Message>
) {
  const queryClient = useQueryClient();
  const key = chatKeys.messages(conversationId);

  return useMutation({
    mutationFn,
    onMutate: async (variables: TVariables) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MessagePages>(key);
      queryClient.setQueryData<MessagePages>(key, (data) =>
        updateMessage(data, variables.id, patch(variables))
      );
      return { previous };
    },
    onError: (_error, _variables, context) => queryClient.setQueryData(key, context?.previous),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chatKeys.conversations() }),
  });
}

export function useEditMessage(conversationId: string) {
  return useOptimisticMessageMutation(
    conversationId,
    ({ id, body }: { id: string; body: string }) => editMessage(id, body),
    ({ body }) => ({ body, editedAt: new Date().toISOString() })
  );
}

export function useDeleteMessage(conversationId: string) {
  return useOptimisticMessageMutation(
    conversationId,
    ({ id }: { id: string }) => deleteMessage(id),
    () => ({ body: '', attachment: null, localUri: undefined, deletedAt: new Date().toISOString() })
  );
}

/** Reage com um emoji; o mesmo emoji de novo (ou null) remove a reação. */
export function useReactToMessage(conversationId: string) {
  const userId = useUser()?.id ?? '';
  return useOptimisticMessageMutation(
    conversationId,
    ({ id, emoji }: { id: string; emoji: string | null; reactions: Message['reactions'] }) =>
      reactToMessage(id, emoji),
    ({ emoji, reactions }) => ({ reactions: applyReaction(reactions, userId, emoji) })
  );
}

export function useMessageSearch(conversationId: string, term: string) {
  const trimmed = term.trim();
  return useQuery({
    queryKey: chatKeys.messageSearch(conversationId, trimmed),
    queryFn: () => searchMessages(conversationId, trimmed),
    enabled: trimmed.length >= MIN_MESSAGE_SEARCH_LENGTH,
    placeholderData: (previous) => previous,
  });
}

export function useReportMessage() {
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => reportMessage(id, reason),
  });
}

/** URL assinada da imagem (bucket privado), renovada antes de expirar. */
export function useChatImageUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: chatKeys.image(path ?? ''),
    queryFn: () => createChatImageUrl(path!, SIGNED_URL_SECONDS),
    enabled: !!path,
    staleTime: (SIGNED_URL_SECONDS - 10 * 60) * 1000,
    gcTime: (SIGNED_URL_SECONDS - 10 * 60) * 1000,
  });
}

// ---------- Pessoas, DMs e bloqueio ----------

export function useUserSearch(term: string) {
  const trimmed = term.trim();
  return useQuery({
    queryKey: chatKeys.userSearch(trimmed),
    queryFn: () => searchUsers(trimmed),
    enabled: trimmed.length >= MIN_USER_SEARCH_LENGTH,
    placeholderData: (previous) => previous,
  });
}

export function useOpenDm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: getOrCreateDm,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chatKeys.conversations() }),
  });
}

export function useBlockedUsers() {
  const user = useUser();
  return useQuery({
    queryKey: chatKeys.blocked(),
    queryFn: fetchBlockedUsers,
    enabled: !!user,
  });
}

/** Ids bloqueados: as mensagens dessas pessoas ficam ocultas nas comunidades. */
export function useBlockedUserIds() {
  const { data } = useBlockedUsers();
  return new Set((data ?? []).map((u) => u.id));
}

function useBlockMutation(mutationFn: (userId: string) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.resetQueries({ queryKey: ['public-profile'] }),
        queryClient.resetQueries({ queryKey: ['social'] }),
        queryClient.invalidateQueries({ queryKey: chatKeys.blocked() }),
        refreshLists(queryClient),
      ]),
  });
}

export function useBlockUser() {
  return useBlockMutation(blockUser);
}

export function useUnblockUser() {
  return useBlockMutation(unblockUser);
}

// ---------- Comunidades ----------

export function useCommunities() {
  const user = useUser();
  return useQuery({
    queryKey: chatKeys.communities(),
    queryFn: fetchCommunities,
    enabled: !!user,
  });
}

function useCommunityMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>
) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => refreshLists(queryClient) });
}

export function useJoinCommunity() {
  return useCommunityMutation(joinCommunity);
}

export function useJoinCommunityByCode() {
  return useCommunityMutation(joinCommunityByCode);
}

export function useLeaveCommunity() {
  return useCommunityMutation(leaveCommunity);
}

export function useCreateCommunity() {
  return useCommunityMutation(createCommunity);
}

export function useDeleteCommunity() {
  return useCommunityMutation(deleteCommunity);
}

export function useUpdateCommunity() {
  return useCommunityMutation(updateCommunity);
}

export function useCommunityImage(communityId: string | null) {
  const queryClient = useQueryClient();
  const onSuccess = () => refreshLists(queryClient);
  return {
    upload: useMutation({
      mutationFn: ({
        kind,
        image,
      }: {
        kind: CommunityImageKind;
        image: { uri: string; width: number; height: number };
      }) => uploadCommunityImage(communityId!, kind, image),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (kind: CommunityImageKind) => removeCommunityImage(communityId!, kind),
      onSuccess,
    }),
  };
}

export function useCommunityInvite(communityId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: chatKeys.invite(communityId ?? ''),
    queryFn: () => fetchCommunityInvite(communityId!),
    enabled: !!communityId && enabled,
  });
}

export function useRegenerateInvite(communityId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => regenerateCommunityInvite(communityId!),
    onSuccess: (code) => queryClient.setQueryData(chatKeys.invite(communityId ?? ''), code),
  });
}

// ---------- Membros e moderação ----------

export function useMembers(conversationId: string, enabled = true) {
  return useQuery({
    queryKey: chatKeys.members(conversationId),
    queryFn: () => fetchMembers(conversationId),
    enabled,
  });
}

export function useBans(conversationId: string, enabled: boolean) {
  return useQuery({
    queryKey: chatKeys.bans(conversationId),
    queryFn: () => fetchBans(conversationId),
    enabled,
  });
}

function useModerationMutation<TVariables>(
  conversationId: string,
  mutationFn: (variables: TVariables) => Promise<void>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: chatKeys.members(conversationId) }),
        queryClient.invalidateQueries({ queryKey: chatKeys.bans(conversationId) }),
        refreshLists(queryClient),
      ]),
  });
}

export function useSetMemberRole(conversationId: string) {
  return useModerationMutation(
    conversationId,
    ({ userId, role }: { userId: string; role: 'moderator' | 'member' }) =>
      setMemberRole(conversationId, userId, role)
  );
}

export function useRemoveMember(conversationId: string) {
  return useModerationMutation(
    conversationId,
    ({ userId, ban }: { userId: string; ban: boolean }) => removeMember(conversationId, userId, ban)
  );
}

export function useUnbanMember(conversationId: string) {
  return useModerationMutation(conversationId, (userId: string) =>
    unbanMember(conversationId, userId)
  );
}
