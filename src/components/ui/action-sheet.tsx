import { SymbolView } from 'expo-symbols';
import type { ComponentProps, ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ui/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ActionSheetAction = {
  key: string;
  label: string;
  icon?: ComponentProps<typeof SymbolView>['name'];
  destructive?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  title?: string;
  /** Conteúdo acima das ações (ex.: barra de reações). */
  header?: ReactNode;
  actions: ActionSheetAction[];
  cancelLabel: string;
  onClose: () => void;
};

/**
 * Lista de ações que sobe de baixo (iOS, Android e web). O `Alert` do Android
 * só aceita 3 botões, e menus de mensagem precisam de mais.
 */
export function ActionSheet({ visible, title, header, actions, cancelLabel, onClose }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={cancelLabel}
        style={styles.backdrop}
        onPress={onClose}
      />
      <View
        style={[
          styles.sheet,
          { backgroundColor: theme.card, paddingBottom: insets.bottom + Spacing.two },
        ]}>
        {header}
        {title ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2} style={styles.title}>
            {title}
          </ThemedText>
        ) : null}
        {actions.map((action) => {
          const color = action.destructive ? theme.danger : theme.text;
          return (
            <Pressable
              key={action.key}
              accessibilityRole="button"
              onPress={() => {
                onClose();
                action.onPress();
              }}
              style={({ pressed }) => [
                styles.action,
                { backgroundColor: pressed ? theme.backgroundSelected : 'transparent' },
              ]}>
              {action.icon ? <SymbolView name={action.icon} tintColor={color} size={20} /> : null}
              <ThemedText style={{ color }}>{action.label}</ThemedText>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={({ pressed }) => [
            styles.action,
            styles.cancel,
            { borderTopColor: theme.border, opacity: pressed ? 0.6 : 1 },
          ]}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {cancelLabel}
          </ThemedText>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderCurve: 'continuous',
    paddingTop: Spacing.two,
  },
  title: {
    textAlign: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 52,
    paddingHorizontal: Spacing.four,
  },
  cancel: {
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.one,
  },
});
