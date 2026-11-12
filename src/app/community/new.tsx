import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { GroupedScreen } from '@/components/ui/grouped-screen';
import { ThemedText } from '@/components/ui/themed-text';
import { Toggle } from '@/components/ui/toggle';
import { Spacing } from '@/constants/theme';
import { useCreateCommunity } from '@/features/chat/hooks';
import {
  COMMUNITY_DESCRIPTION_MAX,
  COMMUNITY_NAME_MAX,
  COMMUNITY_NAME_MIN,
} from '@/features/chat/types';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';

export default function NewCommunityScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const create = useCreateCommunity();

  const trimmedName = name.trim();
  const inputStyle = [
    styles.input,
    { backgroundColor: theme.card, color: theme.text },
    Platform.select({ web: { outlineWidth: 0 } }),
  ];

  function handleCreate() {
    if (trimmedName.length < COMMUNITY_NAME_MIN) {
      showAlert(t('chat.nameTooShort', { min: COMMUNITY_NAME_MIN }));
      return;
    }
    create.mutate(
      { name: trimmedName, description: description.trim(), isPrivate },
      {
        // replace: voltar da conversa leva para a lista, não para o formulário.
        onSuccess: (id) => router.replace({ pathname: '/chat/[id]', params: { id } }),
        onError: () => showAlert(t('chat.createError')),
      }
    );
  }

  return (
    <GroupedScreen>
      <Stack.Screen options={{ title: t('chat.newCommunity') }} />

      <View style={styles.field}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
          {t('chat.communityName')}
        </ThemedText>
        <TextInput
          autoFocus
          value={name}
          onChangeText={setName}
          placeholder={t('chat.communityNamePlaceholder')}
          placeholderTextColor={theme.textSecondary}
          maxLength={COMMUNITY_NAME_MAX}
          autoCapitalize="sentences"
          returnKeyType="next"
          editable={!create.isPending}
          accessibilityLabel={t('chat.communityName')}
          style={inputStyle}
        />
      </View>

      <View style={styles.field}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
          {t('chat.communityDescription')}
        </ThemedText>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder={t('chat.communityDescriptionPlaceholder')}
          placeholderTextColor={theme.textSecondary}
          maxLength={COMMUNITY_DESCRIPTION_MAX}
          multiline
          editable={!create.isPending}
          accessibilityLabel={t('chat.communityDescription')}
          style={[inputStyle, styles.multiline]}
        />
      </View>

      <View style={[styles.switchCard, { backgroundColor: theme.card }]}>
        <View style={styles.switchText}>
          <ThemedText>{t('chat.privateCommunity')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('chat.privateCommunityHint')}
          </ThemedText>
        </View>
        <Toggle
          value={isPrivate}
          onValueChange={setIsPrivate}
          disabled={create.isPending}
          accessibilityLabel={t('chat.privateCommunity')}
        />
      </View>

      <Button
        label={t('chat.create')}
        loading={create.isPending}
        disabled={trimmedName.length === 0}
        onPress={handleCreate}
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
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 14,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  switchText: {
    flex: 1,
    gap: Spacing.half,
  },
  multiline: {
    height: 120,
    paddingTop: Spacing.three,
    textAlignVertical: 'top',
  },
});
