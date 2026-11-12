import { FlashList, type FlashListRef } from '@shopify/flash-list';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet, type ActionSheetAction } from '@/components/ui/action-sheet';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { IconButton } from '@/components/ui/icon-button';
import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { useUser } from '@/features/auth/auth-provider';
import { MessageBubble } from '@/features/chat/components/message-bubble';
import { MessageComposer } from '@/features/chat/components/message-composer';
import { ReactionPicker, ReactionsSheet } from '@/features/chat/components/reactions';
import {
  useBlockUser,
  useBlockedUserIds,
  useConversation,
  useDeleteMessage,
  useEditMessage,
  useMarkConversationRead,
  useMembers,
  useMessages,
  useReactToMessage,
  useReportMessage,
  useSendMessage,
} from '@/features/chat/hooks';
import { useConversationRealtime } from '@/features/chat/realtime';
import { useChatSession } from '@/features/chat/store';
import { isModerator, type Message } from '@/features/chat/types';
import { useRequestPushPermission } from '@/features/notifications/hooks';
import { useDisplayProfile } from '@/features/profile/hooks';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';

/** Quantas páginas antigas buscamos, no máximo, para chegar a um resultado da busca. */
const MAX_JUMP_PAGES = 25;
/** Tempo que a mensagem encontrada fica destacada. */
const HIGHLIGHT_MS = 2000;

/** Mensagens do mesmo remetente com menos que isso de intervalo ficam agrupadas. */
const GROUP_WINDOW_MS = 5 * 60_000;

function startsGroup(messages: Message[], index: number) {
  const previous = messages[index - 1];
  const current = messages[index];
  if (!previous) return true;
  if (previous.senderId !== current.senderId) return true;
  return Date.parse(current.createdAt) - Date.parse(previous.createdAt) > GROUP_WINDOW_MS;
}

function findMessage(items: Message[], id: string) {
  return items.find((m) => m.id === id);
}

type PendingConfirm =
  | { kind: 'delete'; message: Message }
  | { kind: 'report'; message: Message }
  | { kind: 'block'; message: Message };

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const user = useUser();
  const listRef = useRef<FlashListRef<Message>>(null);

  const [menuFor, setMenuFor] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [reactionsFor, setReactionsFor] = useState<Message | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const jumpPagesRef = useRef(0);

  const conversation = useConversation(id);
  const messages = useMessages(id);
  const { send, sendImage, retry } = useSendMessage(id);
  const { typingNames, setTyping } = useConversationRealtime(id);
  const markRead = useMarkConversationRead(id);
  const editMessage = useEditMessage(id);
  const deleteMessage = useDeleteMessage(id);
  const react = useReactToMessage(id);
  const profile = useDisplayProfile();
  const reportMessage = useReportMessage();
  const blockUser = useBlockUser();
  const blockedIds = useBlockedUserIds();
  const setActiveConversation = useChatSession((s) => s.setActiveConversation);
  const revoked = useChatSession((s) => s.revokedConversationIds.includes(id));
  const clearRevoked = useChatSession((s) => s.clearRevoked);
  const jumpRequest = useChatSession((s) =>
    s.jumpRequest?.conversationId === id ? s.jumpRequest : null
  );
  const clearJump = useChatSession((s) => s.clearJump);

  // Primeira vez no chat: pede permissão para avisar de mensagens novas.
  useRequestPushPermission();

  // Enquanto a conversa está aberta, o push dela não aparece (a pessoa já está lendo).
  useFocusEffect(
    useCallback(() => {
      setActiveConversation(id);
      return () => setActiveConversation(null);
    }, [id, setActiveConversation])
  );

  // Removido/banido (ou comunidade apagada) com a conversa aberta: sai dela.
  useEffect(() => {
    if (!revoked) return;
    showAlert(t('chat.removedFromConversation'));
    // Limpa para que, se a pessoa voltar a entrar (novo convite), a conversa abra normalmente.
    clearRevoked(id);
    if (router.canGoBack()) router.back();
    // dismissTo reaproveita as abas que já estão na pilha (replace criaria outra instância).
    else router.dismissTo('/chat');
  }, [revoked, id, clearRevoked, t]);

  const info = conversation.data;
  const isGroup = info?.kind === 'community';
  const canModerate = isModerator(info?.myRole);
  // Nomes de quem reagiu (só carrega ao abrir a lista de reações de uma comunidade).
  const members = useMembers(id, isGroup && !!reactionsFor);

  // Em comunidades, mensagens de quem a pessoa bloqueou ficam ocultas.
  const items = (messages.data ?? []).filter(
    (m) => !(isGroup && blockedIds.has(m.senderId) && m.senderId !== user?.id)
  );

  let lastIncomingId: string | undefined;
  for (let i = items.length - 1; i >= 0 && !lastIncomingId; i--) {
    if (items[i].senderId !== user?.id) lastIncomingId = items[i].id;
  }
  const { mutate: markAsRead } = markRead;

  // Marca como lida ao abrir e sempre que chega mensagem de outra pessoa.
  useEffect(() => {
    markAsRead();
  }, [lastIncomingId, markAsRead]);

  // Veio da busca: carrega páginas antigas até achar a mensagem, rola até ela e destaca.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = messages;
  const jumpIndex = jumpRequest ? items.findIndex((m) => m.id === jumpRequest.messageId) : -1;
  useEffect(() => {
    if (!jumpRequest || messages.isPending) return;
    if (jumpIndex >= 0) {
      jumpPagesRef.current = 0;
      clearJump();
      const messageId = jumpRequest.messageId;
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({ index: jumpIndex, animated: true, viewPosition: 0.5 });
        setHighlightId(messageId);
      });
      return;
    }
    if (isFetchingNextPage) return;
    if (hasNextPage && jumpPagesRef.current < MAX_JUMP_PAGES) {
      jumpPagesRef.current++;
      fetchNextPage();
    } else {
      jumpPagesRef.current = 0;
      clearJump();
      showAlert(t('chat.messageNotLoaded'));
    }
  }, [
    jumpRequest,
    jumpIndex,
    messages.isPending,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    clearJump,
    t,
  ]);

  useEffect(() => {
    if (!highlightId) return;
    const timer = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlightId]);

  function handleReact(message: Message, emoji: string | null) {
    setMenuFor(null);
    react.mutate(
      { id: message.id, emoji, reactions: message.reactions ?? {} },
      { onError: () => showAlert(t('chat.reactError')) }
    );
  }

  function personFor(userId: string) {
    if (userId === user?.id) {
      return { name: profile.name ?? t('chat.you'), avatarUrl: profile.avatarUrl };
    }
    if (!isGroup && info) return { name: info.title, avatarUrl: info.avatarUrl };
    const member = members.data?.find((m) => m.id === userId);
    return member
      ? { name: member.name, avatarUrl: member.avatarUrl }
      : { name: t('chat.formerMember'), avatarUrl: null };
  }

  function scrollToEnd() {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }

  function handleSend(body: string) {
    send(body);
    scrollToEnd();
  }

  async function handlePickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    sendImage({ uri: asset.uri, width: asset.width, height: asset.height });
    scrollToEnd();
  }

  function handleSaveEdit(message: Message, body: string) {
    setEditing(null);
    editMessage.mutate({ id: message.id, body }, { onError: () => showAlert(t('chat.editError')) });
  }

  function handleConfirm() {
    if (!confirm) return;
    const { kind, message } = confirm;
    setConfirm(null);

    if (kind === 'delete') {
      deleteMessage.mutate({ id: message.id }, { onError: () => showAlert(t('chat.deleteError')) });
    } else if (kind === 'report') {
      reportMessage.mutate(
        { id: message.id, reason: '' },
        {
          onSuccess: () => showAlert(t('chat.reportedTitle'), t('chat.reportedMessage')),
          onError: () => showAlert(t('chat.reportError')),
        }
      );
    } else {
      blockUser.mutate(message.senderId, {
        onSuccess: () => showAlert(t('chat.blockedTitle', { name: message.senderName })),
        onError: () => showAlert(t('chat.blockError')),
      });
    }
  }

  function actionsFor(message: Message): ActionSheetAction[] {
    const mine = message.senderId === user?.id;
    const actions: ActionSheetAction[] = [];
    if (mine) {
      actions.push({
        key: 'edit',
        label: t('chat.edit'),
        icon: { ios: 'pencil', android: 'edit', web: 'edit' },
        onPress: () => setEditing(message),
      });
    }
    if (mine || (isGroup && canModerate)) {
      actions.push({
        key: 'delete',
        label: mine ? t('chat.delete') : t('chat.deleteAsModerator'),
        icon: { ios: 'trash', android: 'delete', web: 'delete' },
        destructive: true,
        onPress: () => setConfirm({ kind: 'delete', message }),
      });
    }
    if (!mine) {
      actions.push(
        {
          key: 'report',
          label: t('chat.report'),
          icon: { ios: 'flag', android: 'flag', web: 'flag' },
          onPress: () => setConfirm({ kind: 'report', message }),
        },
        {
          key: 'block',
          label: t('chat.blockUser', { name: message.senderName }),
          icon: { ios: 'hand.raised', android: 'block', web: 'block' },
          destructive: true,
          onPress: () => setConfirm({ kind: 'block', message }),
        }
      );
    }
    return actions;
  }

  const subtitle =
    typingNames.length === 1
      ? t('chat.typingOne', { name: typingNames[0] })
      : typingNames.length > 1
        ? t('chat.typingMany')
        : isGroup && info
          ? info.memberCount === 1
            ? t('chat.memberOne')
            : t('chat.members', { n: info.memberCount })
          : null;

  const notFound = conversation.isSuccess && !conversation.data;

  const confirmCopy = confirm
    ? {
        delete: {
          title: t('chat.deleteConfirm'),
          message: t('chat.deleteConfirmMessage'),
          action: t('chat.delete'),
          destructive: true,
        },
        report: {
          title: t('chat.reportConfirm'),
          message: t('chat.reportConfirmMessage'),
          action: t('chat.report'),
          destructive: false,
        },
        block: {
          title: t('chat.blockConfirm', { name: confirm.message.senderName }),
          message: t('chat.blockConfirmMessage'),
          action: t('chat.block'),
          destructive: true,
        },
      }[confirm.kind]
    : null;

  return (
    // Ocupa a tela inteira (sem cabeçalho nativo) para o cálculo do teclado ser exato.
    // O offset negativo desconta a área segura de baixo, que o teclado já cobre.
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={-insets.bottom}
      style={[styles.root, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + Spacing.one, borderBottomColor: theme.border },
        ]}>
        <IconButton
          variant="plain"
          icon={{ ios: 'chevron.backward', android: 'arrow_back', web: 'arrow_back' }}
          accessibilityLabel={t('chat.back')}
          onPress={() => router.back()}
        />
        {info ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={info.title}
            accessibilityHint={t(
              !isGroup && info.otherUserId ? 'socialProfile.view' : 'chat.infoHint'
            )}
            onPress={() =>
              !isGroup && info.otherUserId
                ? router.push({ pathname: '/people/[id]', params: { id: info.otherUserId } })
                : router.push({ pathname: '/chat/[id]/info', params: { id } })
            }
            style={({ pressed }) => [styles.headerInfo, { opacity: pressed ? 0.6 : 1 }]}>
            <Avatar name={info.title} url={info.avatarUrl} size={36} />
            <View style={styles.headerText}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {info.title}
              </ThemedText>
              {subtitle ? (
                <ThemedText
                  type="small"
                  numberOfLines={1}
                  accessibilityLiveRegion="polite"
                  style={{ color: typingNames.length ? theme.primary : theme.textSecondary }}>
                  {subtitle}
                </ThemedText>
              ) : null}
            </View>
          </Pressable>
        ) : (
          <View style={styles.headerInfo} />
        )}
        {info && !isGroup ? (
          <IconButton
            variant="plain"
            icon={{ ios: 'info.circle', android: 'info_outline', web: 'info_outline' }}
            accessibilityLabel={t('chat.info')}
            onPress={() => router.push({ pathname: '/chat/[id]/info', params: { id } })}
          />
        ) : null}
        {info ? (
          <IconButton
            variant="plain"
            icon={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
            accessibilityLabel={t('chat.searchMessages')}
            onPress={() => router.push({ pathname: '/chat/[id]/search', params: { id } })}
          />
        ) : null}
      </View>

      {notFound ? (
        <View style={styles.center}>
          <ThemedText themeColor="textSecondary">{t('chat.notFound')}</ThemedText>
        </View>
      ) : messages.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : messages.isError ? (
        <View style={styles.center}>
          <ThemedText themeColor="textSecondary">{t('chat.loadError')}</ThemedText>
          <Button variant="outline" label={t('chat.retry')} onPress={() => messages.refetch()} />
        </View>
      ) : (
        <FlashList
          ref={listRef}
          data={items}
          keyExtractor={(m) => m.id}
          getItemType={(m) =>
            m.attachment ? 'image' : m.senderId === user?.id ? 'mine' : 'theirs'
          }
          renderItem={({ item, index }) => (
            <MessageBubble
              message={item}
              isMine={item.senderId === user?.id}
              showSender={startsGroup(items, index)}
              isGroup={isGroup}
              onRetry={retry}
              onLongPress={setMenuFor}
              onReactionsPress={setReactionsFor}
              myId={user?.id}
              highlighted={item.id === highlightId}
            />
          )}
          // Chat sem "inverted": começa no fim e mantém a posição ao carregar mensagens antigas.
          maintainVisibleContentPosition={{
            startRenderingFromBottom: true,
            autoscrollToBottomThreshold: 0.2,
          }}
          onStartReached={() => {
            if (messages.hasNextPage && !messages.isFetchingNextPage) messages.fetchNextPage();
          }}
          onStartReachedThreshold={0.5}
          ListHeaderComponent={
            messages.isFetchingNextPage ? <ActivityIndicator style={styles.olderLoader} /> : null
          }
          ListEmptyComponent={
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              {t('chat.emptyChat')}
            </ThemedText>
          }
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
        />
      )}

      {notFound ? null : (
        <View style={{ paddingBottom: insets.bottom, backgroundColor: theme.background }}>
          <MessageComposer
            onSend={handleSend}
            onTyping={setTyping}
            onPickImage={handlePickImage}
            editing={editing}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={() => setEditing(null)}
            disabledReason={info?.kind === 'dm' && info.isBlocked ? t('chat.youBlocked') : null}
          />
        </View>
      )}

      <ActionSheet
        visible={!!menuFor}
        header={
          menuFor ? (
            <ReactionPicker
              key={menuFor.id}
              selected={(user && menuFor.reactions?.[user.id]) || null}
              onPick={(emoji) => handleReact(menuFor, emoji)}
            />
          ) : null
        }
        title={menuFor?.body || undefined}
        actions={menuFor ? actionsFor(menuFor) : []}
        cancelLabel={t('chat.cancel')}
        onClose={() => setMenuFor(null)}
      />

      <ReactionsSheet
        reactions={reactionsFor ? (findMessage(items, reactionsFor.id)?.reactions ?? null) : null}
        myId={user?.id}
        people={personFor}
        onRemoveMine={() => {
          const current = reactionsFor && findMessage(items, reactionsFor.id);
          if (current) handleReact(current, null);
        }}
        onClose={() => setReactionsFor(null)}
      />

      <ConfirmDialog
        visible={!!confirmCopy}
        destructive={confirmCopy?.destructive}
        title={confirmCopy?.title ?? ''}
        message={confirmCopy?.message}
        confirmLabel={confirmCopy?.action ?? ''}
        cancelLabel={t('chat.cancel')}
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headerText: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  list: {
    paddingVertical: Spacing.two,
  },
  olderLoader: {
    paddingVertical: Spacing.three,
  },
  empty: {
    textAlign: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
  },
});
