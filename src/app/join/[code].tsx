import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { useJoinCommunityByCode } from '@/features/chat/hooks';
import { chatErrorCode } from '@/features/chat/types';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';

/** Link de convite (appmobile://join/<código>): entra na comunidade e abre a conversa. */
export default function JoinByLinkScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const join = useJoinCommunityByCode();
  const { mutate } = join;
  const started = useRef(false);

  // Dispara uma única vez ao abrir o link (o efeito sincroniza com a navegação externa).
  useEffect(() => {
    if (started.current || !code) return;
    started.current = true;
    mutate(code, {
      onSuccess: (id) => router.replace({ pathname: '/chat/[id]', params: { id } }),
      onError: (error) => {
        const reason = chatErrorCode(error);
        showAlert(
          reason === 'banned'
            ? t('chat.bannedError')
            : reason === 'invalid_code'
              ? t('chat.invalidInvite')
              : t('chat.joinError')
        );
        router.dismissTo('/chat');
      },
    });
  }, [code, mutate, t]);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ActivityIndicator />
      <ThemedText themeColor="textSecondary">{t('chat.joining')}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
});
