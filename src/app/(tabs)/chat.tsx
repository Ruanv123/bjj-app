import { FlashList } from '@shopify/flash-list';
import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Chips } from '@/components/ui/chips';
import { IconButton } from '@/components/ui/icon-button';
import { ThemedText } from '@/components/ui/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth, useUser } from '@/features/auth/auth-provider';
import { CommunityRow } from '@/features/chat/components/community-row';
import { ConversationRow } from '@/features/chat/components/conversation-row';
import { useCommunities, useConversations } from '@/features/chat/hooks';
import { useTheme } from '@/hooks/use-theme';

type Section = 'conversations' | 'communities';

export default function ChatScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const user = useUser();
  const { setDevSkip } = useAuth();
  const [section, setSection] = useState<Section>('conversations');

  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <ThemedText type="subtitle" style={styles.title}>
          {t('chat.title')}
        </ThemedText>
        {user ? (
          <IconButton
            icon={
              section === 'conversations'
                ? { ios: 'square.and.pencil', android: 'edit_square', web: 'edit_square' }
                : { ios: 'plus', android: 'add', web: 'add' }
            }
            accessibilityLabel={
              section === 'conversations' ? t('chat.newMessage') : t('chat.newCommunity')
            }
            onPress={() => router.push(section === 'conversations' ? '/chat/new' : '/community/new')}
          />
        ) : null}
      </View>

      {user ? (
        <>
          <View style={styles.chips}>
            <Chips
              value={section}
              onChange={setSection}
              options={[
                { key: 'conversations', value: 'conversations', label: t('chat.tabConversations') },
                { key: 'communities', value: 'communities', label: t('chat.tabCommunities') },
              ]}
            />
          </View>
          {section === 'conversations' ? <ConversationList /> : <CommunityList />}
        </>
      ) : (
        // Sem sessão real (ex.: "Pular login" em dev).
        <View style={styles.center}>
          <ThemedText themeColor="textSecondary" style={styles.centerText}>
            {t('chat.signIn')}
          </ThemedText>
          <Button variant="outline" label={t('videos.signIn')} onPress={() => setDevSkip(false)} />
        </View>
      )}
    </SafeAreaView>
  );
}

function ConversationList() {
  const { t } = useTranslation();
  const conversations = useConversations();
  const { refetch } = conversations;

  // Comunidades não avisam pelo canal pessoal (custaria uma mensagem por membro);
  // a lista é atualizada sempre que a aba ganha foco.
  useFocusEffect(
    useCallback(() => {
      refetch({ cancelRefetch: false });
    }, [refetch])
  );

  if (conversations.isPending) return <Loading />;
  if (conversations.isError) return <LoadError onRetry={() => conversations.refetch()} />;

  return (
    <FlashList
      data={conversations.data}
      keyExtractor={(c) => c.id}
      renderItem={({ item }) => <ConversationRow conversation={item} />}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={conversations.isRefetching}
          onRefresh={() => void conversations.refetch()}
        />
      }
      ListEmptyComponent={<Empty text={t('chat.emptyConversations')} />}
    />
  );
}

function CommunityList() {
  const { t } = useTranslation();
  const theme = useTheme();
  const communities = useCommunities();

  if (communities.isPending) return <Loading />;
  if (communities.isError) return <LoadError onRetry={() => communities.refetch()} />;

  return (
    <FlashList
      data={communities.data}
      keyExtractor={(c) => c.id}
      renderItem={({ item }) => <CommunityRow community={item} />}
      ListHeaderComponent={
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/community/join')}
          style={({ pressed }) => [styles.joinCode, { opacity: pressed ? 0.6 : 1 }]}>
          <SymbolView
            name={{ ios: 'ticket', android: 'confirmation_number', web: 'confirmation_number' }}
            tintColor={theme.primary}
            size={20}
          />
          <ThemedText type="smallBold" themeColor="primary">
            {t('chat.joinWithCode')}
          </ThemedText>
        </Pressable>
      }
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={communities.isRefetching}
          onRefresh={() => void communities.refetch()}
        />
      }
      ListEmptyComponent={<Empty text={t('chat.emptyCommunities')} />}
    />
  );
}

function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator />
    </View>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.center}>
      <ThemedText themeColor="textSecondary" style={styles.centerText}>
        {t('chat.loadError')}
      </ThemedText>
      <Button variant="outline" label={t('chat.retry')} onPress={onRetry} />
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <ThemedText themeColor="textSecondary" style={styles.empty}>
      {text}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  title: {
    flex: 1,
  },
  chips: {
    paddingBottom: Spacing.two,
    paddingHorizontal: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  list: {
    paddingBottom: Spacing.five,
  },
  joinCode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  centerText: {
    textAlign: 'center',
  },
  empty: {
    textAlign: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
  },
});
