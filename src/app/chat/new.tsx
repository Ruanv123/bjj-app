import { FlashList } from '@shopify/flash-list';
import { router, Stack } from 'expo-router';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { MIN_USER_SEARCH_LENGTH, useOpenDm, useUserSearch } from '@/features/chat/hooks';
import type { ChatUser } from '@/features/chat/types';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';

export default function NewConversationScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [term, setTerm] = useState('');
  // Sem debounce manual: o React adia a busca enquanto a pessoa digita.
  const deferredTerm = useDeferredValue(term);
  const search = useUserSearch(deferredTerm);
  const openDm = useOpenDm();

  const hasTerm = deferredTerm.trim().length >= MIN_USER_SEARCH_LENGTH;
  const results = hasTerm ? (search.data ?? []) : [];

  function handleSelect(user: ChatUser) {
    if (openDm.isPending) return;
    openDm.mutate(user.id, {
      // replace: voltar da conversa leva para a lista, não para a busca.
      onSuccess: (id) => router.replace({ pathname: '/chat/[id]', params: { id } }),
      onError: () => showAlert(t('chat.openDmError')),
    });
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: t('chat.newMessage') }} />
      <View style={[styles.field, { backgroundColor: theme.backgroundElement }]}>
        <TextInput
          autoFocus
          value={term}
          onChangeText={setTerm}
          placeholder={t('chat.searchPlaceholder')}
          placeholderTextColor={theme.textSecondary}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel={t('chat.searchPlaceholder')}
          style={[styles.input, { color: theme.text }]}
        />
        {search.isFetching && hasTerm ? <ActivityIndicator size="small" /> : null}
      </View>

      <FlashList
        data={results}
        keyExtractor={(u) => u.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.name}
            onPress={() => handleSelect(item)}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
            <Avatar name={item.name} url={item.avatarUrl} size={44} />
            <ThemedText type="smallBold" numberOfLines={1} style={styles.name}>
              {item.name}
            </ThemedText>
            {openDm.isPending && openDm.variables === item.id ? <ActivityIndicator /> : null}
          </Pressable>
        )}
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            {!hasTerm
              ? t('chat.searchHint')
              : search.isPending
                ? ''
                : t('chat.noUsers', { term: deferredTerm.trim() })}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  name: {
    flex: 1,
  },
  empty: {
    textAlign: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
  },
});
