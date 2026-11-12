import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { ThemedText } from '@/components/ui/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { MORE_REACTIONS, QUICK_REACTIONS, summarizeReactions, type Reactions } from '../types';

// ---------- Barra de escolha (no menu do toque longo) ----------

/** Emojis rápidos + "+" que abre a grade completa. O emoji atual fica destacado. */
export function ReactionPicker({
  selected,
  onPick,
}: {
  selected: string | null;
  /** Mesmo emoji de novo = remover a reação (null). */
  onPick: (emoji: string | null) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  // O emoji atual aparece na barra mesmo que não seja um dos rápidos.
  const quick: string[] =
    selected && !(QUICK_REACTIONS as readonly string[]).includes(selected)
      ? [...QUICK_REACTIONS.slice(0, -1), selected]
      : [...QUICK_REACTIONS];

  function emojiButton(emoji: string, size: 'quick' | 'grid') {
    const active = emoji === selected;
    return (
      <Pressable
        key={emoji}
        accessibilityRole="button"
        accessibilityLabel={
          active ? t('chat.removeReaction', { emoji }) : t('chat.reactWith', { emoji })
        }
        accessibilityState={{ selected: active }}
        onPress={() => onPick(active ? null : emoji)}
        style={({ pressed }) => [
          size === 'quick' ? styles.quickEmoji : styles.gridEmoji,
          active && { backgroundColor: theme.backgroundSelected },
          pressed && { transform: [{ scale: 1.2 }] },
        ]}>
        <ThemedText style={size === 'quick' ? styles.quickText : styles.gridText}>
          {emoji}
        </ThemedText>
      </Pressable>
    );
  }

  return (
    <View style={styles.picker}>
      <View style={[styles.quickBar, { backgroundColor: theme.backgroundElement }]}>
        {quick.map((emoji) => emojiButton(emoji, 'quick'))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('chat.moreReactions')}
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((v) => !v)}
          style={[styles.quickEmoji, { backgroundColor: theme.backgroundSelected }]}>
          <SymbolView
            name={
              expanded
                ? { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' }
                : { ios: 'plus', android: 'add', web: 'add' }
            }
            tintColor={theme.textSecondary}
            size={18}
          />
        </Pressable>
      </View>
      {expanded ? (
        <View style={styles.grid}>{MORE_REACTIONS.map((emoji) => emojiButton(emoji, 'grid'))}</View>
      ) : null}
    </View>
  );
}

// ---------- Contagem embaixo do balão ----------

/** Pílula com até 3 emojis e o total, encostada no balão (como no WhatsApp). */
export function ReactionPills({
  reactions,
  myId,
  onPress,
}: {
  reactions: Reactions;
  myId: string | undefined;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const summary = summarizeReactions(reactions, myId);
  if (summary.length === 0) return null;

  const total = summary.reduce((sum, r) => sum + r.count, 0);
  const mine = summary.some((r) => r.mine);
  const label = summary.map((r) => `${r.emoji} ${r.count}`).join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('chat.reactionsA11y', { list: label })}
      accessibilityHint={t('chat.reactionsHint')}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: mine ? theme.backgroundSelected : theme.backgroundElement,
          borderColor: theme.background,
          opacity: pressed ? 0.7 : 1,
        },
      ]}>
      <ThemedText style={styles.pillEmoji}>
        {summary
          .slice(0, 3)
          .map((r) => r.emoji)
          .join('')}
      </ThemedText>
      {total > 1 ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.pillCount}>
          {total}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

// ---------- Quem reagiu ----------

type Person = { name: string; avatarUrl: string | null };

/** Lista de quem reagiu, com filtro por emoji. Tocar na própria reação remove. */
export function ReactionsSheet({
  reactions,
  myId,
  people,
  onRemoveMine,
  onClose,
}: {
  /** null = fechado. */
  reactions: Reactions | null;
  myId: string | undefined;
  /** Nome e foto por id (membros da conversa). */
  people: (userId: string) => Person;
  onRemoveMine: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<string | null>(null);

  const entries = Object.entries(reactions ?? {})
    // Minha reação primeiro.
    .sort(([a], [b]) => (a === myId ? -1 : b === myId ? 1 : 0))
    .filter(([, emoji]) => !filter || emoji === filter);
  const summary = summarizeReactions(reactions ?? {}, myId);
  const total = summary.reduce((sum, r) => sum + r.count, 0);

  function close() {
    setFilter(null);
    onClose();
  }

  function tab(key: string | null, label: string) {
    const active = filter === key;
    return (
      <Pressable
        key={key ?? 'all'}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        onPress={() => setFilter(key)}
        style={[styles.tab, { borderBottomColor: active ? theme.primary : 'transparent' }]}>
        <ThemedText
          type={active ? 'smallBold' : 'small'}
          themeColor={active ? 'text' : 'textSecondary'}>
          {label}
        </ThemedText>
      </Pressable>
    );
  }

  return (
    <Modal visible={!!reactions} transparent animationType="fade" onRequestClose={close}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('chat.cancel')}
        style={styles.backdrop}
        onPress={close}
      />
      <View
        style={[
          styles.sheet,
          { backgroundColor: theme.card, paddingBottom: insets.bottom + Spacing.two },
        ]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.tabs, { borderBottomColor: theme.border }]}
          contentContainerStyle={styles.tabsContent}>
          {tab(null, t('chat.reactionsAll', { n: total }))}
          {summary.map((r) => tab(r.emoji, `${r.emoji} ${r.count}`))}
        </ScrollView>
        <ScrollView style={styles.list}>
          {entries.map(([userId, emoji]) => {
            const isMe = userId === myId;
            const person = people(userId);
            return (
              <Pressable
                key={userId}
                accessibilityRole="button"
                accessibilityLabel={
                  isMe
                    ? t('chat.tapToRemoveReaction')
                    : t('socialProfile.viewOf', { name: person.name })
                }
                accessibilityHint={isMe ? t('chat.tapToRemoveReaction') : undefined}
                onPress={() => {
                  close();
                  if (isMe) onRemoveMine();
                  else router.push({ pathname: '/people/[id]', params: { id: userId } });
                }}
                style={({ pressed }) => [
                  styles.person,
                  pressed && { backgroundColor: theme.backgroundSelected },
                ]}>
                <Avatar name={person.name} url={person.avatarUrl} size={36} />
                <View style={styles.personText}>
                  <ThemedText numberOfLines={1}>{isMe ? t('chat.you') : person.name}</ThemedText>
                  {isMe ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('chat.tapToRemoveReaction')}
                    </ThemedText>
                  ) : null}
                </View>
                <ThemedText style={styles.personEmoji}>{emoji}</ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  picker: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  quickBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  quickEmoji: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickText: {
    fontSize: 26,
    lineHeight: 32,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  gridEmoji: {
    width: '12.5%',
    aspectRatio: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridText: {
    fontSize: 24,
    lineHeight: 30,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 999,
    borderWidth: 2,
    paddingHorizontal: 6,
    minHeight: 26,
    // Encosta no balão, como no WhatsApp.
    marginTop: -8,
    marginHorizontal: Spacing.two,
  },
  pillEmoji: {
    fontSize: 14,
    lineHeight: 20,
  },
  pillCount: {
    fontSize: 12,
    lineHeight: 16,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    width: '100%',
    maxWidth: MaxContentWidth,
    maxHeight: '70%',
    alignSelf: 'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderCurve: 'continuous',
    paddingTop: Spacing.two,
  },
  tabs: {
    flexGrow: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabsContent: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  tab: {
    paddingVertical: Spacing.two + Spacing.one,
    borderBottomWidth: 2,
  },
  list: {
    flexGrow: 0,
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 56,
    paddingHorizontal: Spacing.four,
  },
  personText: {
    flex: 1,
  },
  personEmoji: {
    fontSize: 24,
    lineHeight: 30,
  },
});
