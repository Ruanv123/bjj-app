import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Botão de confirmação vermelho e ícone de alerta. */
  destructive?: boolean;
  icon?: ComponentProps<typeof SymbolView>['name'];
  loading?: boolean;
};

/** Modal de confirmação com o visual do app (funciona no iOS, Android e web). */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  destructive = false,
  icon,
  loading = false,
}: Props) {
  const theme = useTheme();
  const accent = destructive ? theme.danger : theme.primary;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}>
      <View style={styles.root}>
        {/* Tocar fora fecha, como cancelar. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={loading ? undefined : onCancel}
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
        />
        <View
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={[styles.card, { backgroundColor: theme.card }]}>
          {icon ? (
            <View style={[styles.iconCircle, { backgroundColor: `${accent}1F` }]}>
              <SymbolView name={icon} tintColor={accent} size={22} />
            </View>
          ) : null}
          <ThemedText style={styles.title}>{title}</ThemedText>
          {message ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.message}>
              {message}
            </ThemedText>
          ) : null}
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button variant="secondary" label={cancelLabel} onPress={onCancel} disabled={loading} />
            </View>
            <View style={styles.action}>
              <Button
                variant={destructive ? 'destructive' : 'primary'}
                label={confirmLabel}
                onPress={onConfirm}
                loading={loading}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    borderCurve: 'continuous',
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: 700,
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two + Spacing.one,
    marginTop: Spacing.three,
    alignSelf: 'stretch',
  },
  action: {
    flex: 1,
  },
});
