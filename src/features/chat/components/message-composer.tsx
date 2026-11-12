import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { IconButton } from '@/components/ui/icon-button';
import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { MAX_MESSAGE_LENGTH, type Message } from '../types';

const SEND_ICON = { ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' } as const;
const CHECK_ICON = { ios: 'checkmark', android: 'check', web: 'check' } as const;

type Props = {
  onSend: (body: string) => void;
  onTyping: (typing: boolean) => void;
  /** Abre a galeria; ausente quando o envio de imagem não está disponível. */
  onPickImage?: () => void;
  /** Mensagem sendo editada: o campo mostra o texto dela e o botão salva a edição. */
  editing: Message | null;
  onSaveEdit: (message: Message, body: string) => void;
  onCancelEdit: () => void;
  /** Ex.: DM com alguém bloqueado. */
  disabledReason?: string | null;
};

export function MessageComposer(props: Props) {
  const theme = useTheme();

  if (props.disabledReason) {
    return (
      <View style={[styles.disabled, { borderTopColor: theme.border }]}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.disabledText}>
          {props.disabledReason}
        </ThemedText>
      </View>
    );
  }

  // `key`: ao entrar/sair da edição, o campo recomeça com o texto certo.
  return <ComposerField key={props.editing?.id ?? 'new'} {...props} />;
}

function ComposerField({
  onSend,
  onTyping,
  onPickImage,
  editing,
  onSaveEdit,
  onCancelEdit,
}: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [body, setBody] = useState(editing?.body ?? '');
  const trimmed = body.trim();
  // Editar uma imagem pode deixar a legenda vazia; texto puro não.
  const canSend = editing
    ? trimmed !== editing.body && (trimmed.length > 0 || !!editing.attachment)
    : trimmed.length > 0;

  function handleChange(text: string) {
    setBody(text);
    if (!editing) onTyping(text.trim().length > 0);
  }

  function handleSend() {
    if (!canSend) return;
    if (editing) {
      onSaveEdit(editing, trimmed);
      return;
    }
    // Limpa na hora: a mensagem já aparece na lista (envio otimista).
    onSend(trimmed);
    setBody('');
    onTyping(false);
  }

  return (
    <View style={[styles.container, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
      {editing ? (
        <View style={styles.editBanner}>
          <SymbolView
            name={{ ios: 'pencil', android: 'edit', web: 'edit' }}
            tintColor={theme.primary}
            size={16}
          />
          <ThemedText type="small" themeColor="primary" style={styles.editLabel}>
            {t('chat.editing')}
          </ThemedText>
          <IconButton
            variant="plain"
            icon={{ ios: 'xmark', android: 'close', web: 'close' }}
            accessibilityLabel={t('chat.cancelEdit')}
            onPress={onCancelEdit}
          />
        </View>
      ) : null}
      <View style={styles.bar}>
        {onPickImage && !editing ? (
          <IconButton
            variant="plain"
            icon={{ ios: 'photo', android: 'image', web: 'image' }}
            accessibilityLabel={t('chat.sendImage')}
            onPress={onPickImage}
          />
        ) : null}
        <View style={[styles.field, { backgroundColor: theme.backgroundElement }]}>
          <TextInput
            value={body}
            onChangeText={handleChange}
            autoFocus={!!editing}
            placeholder={t('chat.placeholder')}
            placeholderTextColor={theme.textSecondary}
            multiline
            maxLength={MAX_MESSAGE_LENGTH}
            accessibilityLabel={t('chat.placeholder')}
            style={[styles.input, { color: theme.text }, Platform.select({ web: { outlineWidth: 0 } })]}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={editing ? t('chat.saveEdit') : t('chat.send')}
          accessibilityState={{ disabled: !canSend }}
          disabled={!canSend}
          onPress={handleSend}
          hitSlop={8}
          style={({ pressed }) => [
            styles.send,
            {
              backgroundColor: canSend ? theme.primary : theme.backgroundElement,
              opacity: pressed ? 0.7 : 1,
            },
          ]}>
          <SymbolView
            name={editing ? CHECK_ICON : SEND_ICON}
            tintColor={canSend ? theme.onPrimary : theme.textSecondary}
            size={20}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one,
  },
  editLabel: {
    flex: 1,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  field: {
    flex: 1,
    borderRadius: 20,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.three,
    minHeight: 40,
    justifyContent: 'center',
  },
  input: {
    fontSize: 16,
    paddingTop: 9,
    paddingBottom: 9,
    maxHeight: 120,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  disabledText: {
    textAlign: 'center',
  },
});
