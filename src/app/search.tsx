import { router } from 'expo-router';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Platform, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/icon-button';
import { ThemedText } from '@/components/ui/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { VideoRow } from '@/features/videos/components/video-row';
import { MIN_SEARCH_LENGTH, useVideoSearch } from '@/features/videos/hooks';
import { useTheme } from '@/hooks/use-theme';

export default function SearchScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [term, setTerm] = useState('');
  // Sem debounce manual nem useEffect: o React adia a busca enquanto a pessoa digita.
  const deferredTerm = useDeferredValue(term);
  const search = useVideoSearch(deferredTerm);

  const hasTerm = deferredTerm.trim().length >= MIN_SEARCH_LENGTH;
  const results = hasTerm ? (search.data ?? []) : [];

  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.bar}>
        <IconButton
          variant="plain"
          icon={{ ios: 'chevron.backward', android: 'arrow_back', web: 'arrow_back' }}
          accessibilityLabel={t('search.back')}
          onPress={() => router.back()}
        />
        <View style={[styles.field, { backgroundColor: theme.backgroundElement }]}>
          <TextInput
            autoFocus
            value={term}
            onChangeText={setTerm}
            placeholder={t('search.placeholder')}
            placeholderTextColor={theme.textSecondary}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="never"
            accessibilityLabel={t('search.placeholder')}
            style={[styles.input, { color: theme.text }]}
          />
          {search.isFetching && hasTerm ? <ActivityIndicator size="small" /> : null}
          {term ? (
            <IconButton
              variant="plain"
              icon={{ ios: 'xmark.circle.fill', android: 'close', web: 'close' }}
              accessibilityLabel={t('search.clear')}
              onPress={() => setTerm('')}
            />
          ) : null}
        </View>
      </View>

      <FlatList
        data={results}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => <VideoRow video={item} />}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            {!hasTerm
              ? t('search.hint')
              : search.isPending
                ? ''
                : t('search.noResults', { term: deferredTerm.trim() })}
          </ThemedText>
        }
      />
    </SafeAreaView>
  );
}

function Separator() {
  return <View style={{ height: Spacing.three }} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 12,
    borderCurve: 'continuous',
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one,
    gap: Spacing.one,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
    // O campo já tem fundo próprio; o contorno de foco do navegador fica redundante.
    ...Platform.select({ web: { outlineWidth: 0 } }),
  },
  list: {
    paddingTop: Spacing.two,
    paddingBottom: Spacing.five,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  empty: {
    textAlign: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
  },
});
