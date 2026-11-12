import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { ProfileLink } from '@/features/profile/components/profile-link';
import { useTheme } from '@/hooks/use-theme';

import { formatMessageTime } from '../format';
import type { Message } from '../types';
import { ChatImage } from './chat-image';
import { ReactionPills } from './reactions';

const AVATAR_SIZE = 28;

type Props = {
  message: Message;
  isMine: boolean;
  /** Primeira de uma sequência do mesmo remetente: mostra nome e foto (só em comunidades). */
  showSender: boolean;
  /** Em DMs não precisa de nome nem foto: só há duas pessoas. */
  isGroup: boolean;
  onRetry: (message: Message) => void;
  /** Toque longo abre o menu (reagir, editar, apagar, denunciar…). */
  onLongPress: (message: Message) => void;
  /** Toque nas reações: mostra quem reagiu. */
  onReactionsPress: (message: Message) => void;
  myId: string | undefined;
  /** Destaque temporário (ex.: resultado da busca). */
  highlighted?: boolean;
};

export function MessageBubble({
  message,
  isMine,
  showSender,
  isGroup,
  onRetry,
  onLongPress,
  onReactionsPress,
  myId,
  highlighted = false,
}: Props) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const failed = message.status === 'failed';
  const deleted = !!message.deletedAt;
  const hasImage = !!message.attachment && !deleted;

  const time = formatMessageTime(message.createdAt, i18n.language);
  const status =
    message.status === 'sending'
      ? t('chat.sending')
      : failed
        ? t('chat.failed')
        : message.editedAt && !deleted
          ? `${t('chat.edited')} · ${time}`
          : time;

  const textColor = deleted ? theme.textSecondary : isMine ? theme.onPrimary : theme.text;

  const bubble = (
    <View
      style={[
        styles.bubble,
        hasImage && styles.imageBubble,
        deleted
          ? { borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth }
          : isMine
            ? { backgroundColor: theme.primary, borderBottomRightRadius: 6 }
            : { backgroundColor: theme.backgroundElement, borderBottomLeftRadius: 6 },
        message.status === 'sending' && styles.pending,
      ]}>
      {hasImage && message.attachment ? (
        <ChatImage attachment={message.attachment} localUri={message.localUri} />
      ) : null}
      {deleted ? (
        <ThemedText style={[styles.body, styles.deleted, { color: textColor }]}>
          {t('chat.deletedMessage')}
        </ThemedText>
      ) : message.body ? (
        <ThemedText style={[styles.body, { color: textColor }, hasImage && styles.imageCaption]}>
          {message.body}
        </ThemedText>
      ) : null}
    </View>
  );

  return (
    <View
      style={[
        styles.row,
        isMine ? styles.mine : styles.theirs,
        showSender && styles.groupStart,
        // Faixa translúcida na linha toda, como o WhatsApp faz ao pular para a mensagem.
        highlighted && { backgroundColor: `${theme.primary}33` },
      ]}>
      {!isMine && isGroup ? (
        <View style={styles.avatarSlot}>
          {showSender ? (
            <ProfileLink
              userId={message.senderId}
              name={message.senderName}
              style={styles.avatarLink}>
              <Avatar name={message.senderName} url={message.senderAvatarUrl} size={AVATAR_SIZE} />
            </ProfileLink>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.column, isMine ? styles.columnMine : styles.columnTheirs]}>
        {!isMine && isGroup && showSender && !deleted ? (
          <ProfileLink
            userId={message.senderId}
            name={message.senderName}
            style={styles.senderLink}>
            <ThemedText type="smallBold" themeColor="primary">
              {message.senderName}
            </ThemedText>
          </ProfileLink>
        ) : null}
        <Pressable
          accessibilityRole={failed ? 'button' : undefined}
          accessibilityLabel={failed ? t('chat.failed') : undefined}
          accessibilityHint={!failed && !deleted ? t('chat.messageActionsHint') : undefined}
          disabled={deleted && !failed}
          onPress={failed ? () => onRetry(message) : undefined}
          onLongPress={
            message.status === 'sent' && !deleted ? () => onLongPress(message) : undefined
          }
          delayLongPress={300}>
          {bubble}
        </Pressable>
        {!deleted ? (
          <ReactionPills
            reactions={message.reactions ?? {}}
            myId={myId}
            onPress={() => onReactionsPress(message)}
          />
        ) : null}
        <ThemedText
          type="small"
          style={[styles.meta, { color: failed ? theme.danger : theme.textSecondary }]}>
          {status}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.half,
  },
  groupStart: {
    paddingTop: Spacing.two + Spacing.one,
  },
  mine: {
    justifyContent: 'flex-end',
  },
  theirs: {
    justifyContent: 'flex-start',
  },
  avatarSlot: {
    width: AVATAR_SIZE,
    // Alinha a foto com o balão, não com o horário embaixo dele.
    marginBottom: 18,
  },
  avatarLink: { minHeight: 44, justifyContent: 'center' },
  senderLink: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.one },
  column: {
    maxWidth: '78%',
    gap: 2,
  },
  columnMine: {
    alignItems: 'flex-end',
  },
  columnTheirs: {
    alignItems: 'flex-start',
  },
  bubble: {
    borderRadius: 18,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.three - Spacing.one,
    paddingVertical: Spacing.two,
  },
  imageBubble: {
    padding: Spacing.one,
    gap: Spacing.one,
  },
  imageCaption: {
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.one,
  },
  pending: {
    opacity: 0.7,
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
  },
  deleted: {
    fontStyle: 'italic',
  },
  meta: {
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: Spacing.one,
  },
});
