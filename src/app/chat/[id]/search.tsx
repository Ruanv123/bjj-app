import { FlashList } from '@shopify/flash-list';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { useUser } from '@/features/auth/auth-provider';
import { MIN_MESSAGE_SEARCH_LENGTH } from '@/features/chat/api';
import { formatConversationTime } from '@/features/chat/format';
import { useConversation, useMessageSearch } from '@/features/chat/hooks';
import { useChatSession } from '@/features/chat/store';
import type { Message } from '@/features/chat/types';
import { useTheme } from '@/hooks/use-theme';

/** Caracteres mostrados antes do termo encontrado (o resto é cortado com "…"). */
const SNIPPET_LEAD = 40;

/** Divide o texto em antes / termo / depois, cortando o começo se for longo. */
function splitMatch(body: string, term: string) {
  const index = body.toLocaleLowerCase().indexOf(term.toLocaleLowerCase());
  if (index < 0) return { before: body, match: '', after: '' };
  const start = Math.max(0, index - SNIPPET_LEAD);
  return {
    before: (start > 0 ? '…' : '') + body.slice(start, index),
    match: body.slice(index, index + term.length),
    after: body.slice(index + term.length),
  };
}

export default function MessageSearchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const user = useUser();
  const [term, setTerm] = useState('');
  const deferredTerm = useDeferredValue(term);
  const trimmed = deferredTerm.trim();
  const search = useMessageSearch(id, deferredTerm);
  const conversation = useConversation(id);
  const requestJump = useChatSession((s) => s.requestJump);

  const hasTerm = trimmed.length >= MIN_MESSAGE_SEARCH_LENGTH;
  const results = hasTerm ? (search.data ?? []) : [];
  const isGroup = conversation.data?.kind === 'community';

  function open(message: Message) {
    requestJump({ conversationId: id, messageId: message.id, createdAt: message.createdAt });
    // Volta para a conversa que já está aberta embaixo (ou abre, se não estiver).
    router.dismissTo({ pathname: '/chat/[id]', params: { id } });
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: t('chat.searchMessages') }} />
      <View style={[styles.field, { backgroundColor: theme.backgroundElement }]}>
        <SymbolView
          name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
          tintColor={theme.textSecondary}
          size={18}
        />
        <TextInput
          autoFocus
          value={term}
          onChangeText={setTerm}
          placeholder={t('chat.searchMessagesPlaceholder')}
          placeholderTextColor={theme.textSecondary}
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel={t('chat.searchMessages')}
          style={[styles.input, { color: theme.text }]}
        />
        {search.isFetching && hasTerm ? <ActivityIndicator size="small" /> : null}
      </View>

      {hasTerm && results.length > 0 ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.count}>
          {results.length === 1
            ? t('chat.searchResultOne')
            : t('chat.searchResults', { n: results.length })}
        </ThemedText>
      ) : null}

      <FlashList
        data={results}
        keyExtractor={(m) => m.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => {
          const parts = splitMatch(item.body, trimmed);
          const sender = item.senderId === user?.id ? t('chat.you') : item.senderName;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${sender}: ${item.body}`}
              accessibilityHint={t('chat.openInConversation')}
              onPress={() => open(item)}
              style={({ pressed }) => [
                styles.row,
                { borderBottomColor: theme.border },
                pressed && { backgroundColor: theme.backgroundSelected },
              ]}>
              {isGroup ? (
                <Avatar name={item.senderName} url={item.senderAvatarUrl} size={36} />
              ) : null}
              <View style={styles.rowText}>
                <View style={styles.rowTop}>
                  <ThemedText type="smallBold" numberOfLines={1} style={styles.sender}>
                    {sender}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatConversationTime(item.createdAt, i18n.language)}
                  </ThemedText>
                </View>
                <ThemedText numberOfLines={2} themeColor="textSecondary" style={styles.snippet}>
                  {parts.before}
                  <ThemedText style={[styles.snippet, styles.match, { color: theme.text }]}>
                    {parts.match}
                  </ThemedText>
                  {parts.after}
                </ThemedText>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            {!hasTerm
              ? t('chat.searchMessagesHint')
              : search.isPending
                ? ''
                : search.isError
                  ? t('chat.loadError')
                  : t('chat.noMessagesFound', { term: trimmed })}
          </ThemedText>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    margin: Spacing.three,
    borderRadius: 12,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
    ...Platform.select({ web: { outlineWidth: 0 } }),
  },
  count: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sender: {
    flex: 1,
  },
  snippet: {
    fontSize: 15,
    lineHeight: 20,
  },
  match: {
    fontWeight: 700,
  },
  empty: {
    textAlign: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
  },
});
