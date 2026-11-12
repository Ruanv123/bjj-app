import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth, useUser } from '@/features/auth/auth-provider';
import { useDisplayProfile } from '@/features/profile/hooks';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';

import { useAddComment } from '../hooks';
import { MAX_COMMENT_LENGTH } from '../types';

export function CommentComposer({ videoId }: { videoId: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const user = useUser();
  const { setDevSkip } = useAuth();
  const [body, setBody] = useState('');
  const addComment = useAddComment(videoId);
  const profile = useDisplayProfile();

  if (!user) {
    // Sem sessão real (ex.: "Pular login" em dev): volta para o login.
    return (
      <Button variant="outline" label={t('comments.signInToComment')} onPress={() => setDevSkip(false)} />
    );
  }

  const trimmed = body.trim();
  const canSend = trimmed.length > 0 && !addComment.isPending;

  function handleSend() {
    if (!canSend) return;
    addComment.mutate(trimmed, {
      onSuccess: () => setBody(''),
      onError: () => showAlert(t('comments.sendError')),
    });
  }

  const name = profile.name ?? user.email ?? '';

  return (
    <View style={styles.row}>
      <Avatar name={name} url={profile.avatarUrl} size={32} />
      <View style={[styles.field, { backgroundColor: theme.backgroundElement }]}>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder={t('comments.placeholder')}
          placeholderTextColor={theme.textSecondary}
          multiline
          maxLength={MAX_COMMENT_LENGTH}
          editable={!addComment.isPending}
          accessibilityLabel={t('comments.placeholder')}
          style={[
            styles.input,
            { color: theme.text },
            Platform.select({ web: { outlineWidth: 0 } }),
          ]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('comments.send')}
          accessibilityState={{ disabled: !canSend }}
          disabled={!canSend}
          onPress={handleSend}
          hitSlop={8}
          style={styles.send}>
          {addComment.isPending ? (
            <ActivityIndicator size="small" />
          ) : (
            <ThemedText
              type="smallBold"
              style={{ color: canSend ? theme.primary : theme.textSecondary }}>
              {t('comments.send')}
            </ThemedText>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two + Spacing.one,
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 18,
    borderCurve: 'continuous',
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two,
    minHeight: 40,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 120,
  },
  send: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 10,
  },
});
