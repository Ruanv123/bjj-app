import { router, usePreventRemove } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { useDisplayProfile } from '@/features/profile/hooks';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';

import { usePublishPost } from '../hooks';
import { MAX_POST_LENGTH, postBodySchema, type Post } from '../types';

export function PostEditor({
  context,
  editId,
  parentId,
}: {
  context?: Post | null;
  editId?: string;
  parentId?: string;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const profile = useDisplayProfile();
  const initial = editId ? (context?.body ?? '') : '';
  const [body, setBody] = useState(initial);
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);
  const [allowLeave, setAllowLeave] = useState(false);
  const publish = usePublishPost();
  const changed = body !== initial;
  const disablePrevention = usePreventRemove(
    (changed || publish.isPending) && !allowLeave,
    ({ repeat }) => {
      if (!publish.isPending) setPendingLeave(() => repeat);
    }
  );
  function discard() {
    setAllowLeave(true);
    disablePrevention();
    pendingLeave?.();
  }
  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }
  function submit() {
    const parsed = postBodySchema.safeParse(body);
    if (!parsed.success || publish.isPending) return;
    publish.mutate(
      { body: parsed.data, parentId, editId },
      {
        onSuccess: (id) => {
          setAllowLeave(true);
          disablePrevention();
          router.dismissTo({
            pathname: '/posts/[id]',
            params: { id: parentId ?? context?.parentId ?? id },
          });
        },
        onError: () => showAlert(t('feed.publishError')),
      }
    );
  }
  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        <View style={styles.inner}>
          {parentId && context ? (
            <View style={[styles.context, { borderColor: theme.border }]}>
              <ThemedText type="smallBold">
                {t('feed.replyingTo', { name: context.authorName })}
              </ThemedText>
              <ThemedText themeColor="textSecondary" numberOfLines={4}>
                {context.body}
              </ThemedText>
            </View>
          ) : null}
          <View style={styles.editorRow}>
            <Avatar
              name={profile.name ?? t('profile.defaultName')}
              url={profile.avatarUrl}
              size={44}
            />
            <View style={styles.editor}>
              <ThemedText type="smallBold">{profile.name ?? t('profile.defaultName')}</ThemedText>
              <TextInput
                accessibilityLabel={t(parentId ? 'feed.replyPlaceholder' : 'feed.placeholder')}
                placeholder={t(parentId ? 'feed.replyPlaceholder' : 'feed.placeholder')}
                placeholderTextColor={theme.textSecondary}
                value={body}
                onChangeText={setBody}
                maxLength={MAX_POST_LENGTH}
                multiline
                textAlignVertical="top"
                autoFocus
                editable={!publish.isPending}
                style={[styles.input, { color: theme.text }]}
              />
            </View>
          </View>
        </View>
      </ScrollView>
      <View
        style={[
          styles.footer,
          { borderTopColor: theme.border, paddingBottom: insets.bottom + Spacing.three },
        ]}>
        <View style={styles.footerInner}>
          <View style={styles.counter}>
            <ThemedText
              themeColor={body.length === MAX_POST_LENGTH ? 'danger' : 'textSecondary'}
              type="small">
              {body.length}/{MAX_POST_LENGTH}
            </ThemedText>
          </View>
          <View style={styles.cancel}>
            <Button
              variant="outline"
              label={t('settings.cancel')}
              disabled={publish.isPending}
              onPress={leave}
            />
          </View>
          <View style={styles.submit}>
            <Button
              label={t(editId ? 'settings.save' : parentId ? 'feed.sendReply' : 'feed.publish')}
              loading={publish.isPending}
              disabled={!postBodySchema.safeParse(body).success || (!!editId && !changed)}
              onPress={submit}
            />
          </View>
        </View>
      </View>
      <ConfirmDialog
        visible={!!pendingLeave}
        title={t('feed.discardConfirm')}
        confirmLabel={t('feed.discard')}
        cancelLabel={t('feed.keepWriting')}
        destructive
        onCancel={() => setPendingLeave(null)}
        onConfirm={discard}
      />
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { alignItems: 'center' },
  inner: { width: '100%', maxWidth: 640, padding: Spacing.three, gap: Spacing.four },
  context: { padding: Spacing.three, borderLeftWidth: 2, gap: Spacing.two },
  editorRow: { flexDirection: 'row', gap: Spacing.three },
  editor: { flex: 1, gap: Spacing.two },
  input: { minHeight: 200, fontSize: 17, lineHeight: 26, padding: 0 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  footerInner: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  counter: { width: '100%', alignItems: 'flex-end', marginBottom: Spacing.two },
  cancel: { flex: 1 },
  submit: { flex: 1 },
});
