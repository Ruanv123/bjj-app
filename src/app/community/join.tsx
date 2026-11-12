import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { GroupedScreen } from '@/components/ui/grouped-screen';
import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { useJoinCommunityByCode } from '@/features/chat/hooks';
import { chatErrorCode } from '@/features/chat/types';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';

/** Aceita o código puro ou o link inteiro colado (…/join/<código>). */
function extractCode(input: string) {
  const trimmed = input.trim();
  const match = trimmed.match(/join\/([A-Za-z0-9]+)/);
  return (match?.[1] ?? trimmed).toLowerCase();
}

export default function JoinCommunityScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [value, setValue] = useState('');
  const join = useJoinCommunityByCode();
  const code = extractCode(value);

  function handleJoin() {
    if (!code) return;
    join.mutate(code, {
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
      },
    });
  }

  return (
    <GroupedScreen>
      <Stack.Screen options={{ title: t('chat.joinWithCode') }} />
      <View style={styles.field}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
          {t('chat.inviteCode')}
        </ThemedText>
        <TextInput
          autoFocus
          value={value}
          onChangeText={setValue}
          placeholder={t('chat.inviteCodePlaceholder')}
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={handleJoin}
          editable={!join.isPending}
          accessibilityLabel={t('chat.inviteCode')}
          style={[
            styles.input,
            { backgroundColor: theme.card, color: theme.text },
            Platform.select({ web: { outlineWidth: 0 } }),
          ]}
        />
        <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
          {t('chat.inviteCodeHint')}
        </ThemedText>
      </View>
      <Button
        label={t('chat.join')}
        loading={join.isPending}
        disabled={!code}
        onPress={handleJoin}
      />
    </GroupedScreen>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.two,
  },
  label: {
    paddingHorizontal: Spacing.one,
  },
  input: {
    height: 52,
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
});
