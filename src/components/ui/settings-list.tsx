import { SymbolView } from 'expo-symbols';
import { Children, Fragment, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ui/themed-text';
import { Toggle } from '@/components/ui/toggle';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const ICON_SIZE = 20;
const ICON_INSET = Spacing.three + ICON_SIZE + Spacing.three;

export type SymbolName = ComponentProps<typeof SymbolView>['name'];

/** Grupo com título e cartão arredondado; insere divisórias entre as linhas. */
export function SettingsSection({
  title,
  children,
  withIcons = true,
}: {
  title?: string;
  children: ReactNode;
  /** Recuo da divisória alinhado ao texto quando as linhas têm ícone. */
  withIcons?: boolean;
}) {
  const theme = useTheme();
  const rows = Children.toArray(children).filter(Boolean);

  return (
    <View style={styles.section}>
      {title ? (
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
          {title}
        </ThemedText>
      ) : null}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? (
              <View
                style={[
                  styles.divider,
                  { backgroundColor: theme.border, marginLeft: withIcons ? ICON_INSET : Spacing.three },
                ]}
              />
            ) : null}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

type RowProps = {
  icon: SymbolName;
  label: string;
  /** Valor atual exibido à direita (ex.: "Português"). */
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
};

export function SettingsRow({ icon, label, value, onPress, destructive = false }: RowProps) {
  const theme = useTheme();
  const color = destructive ? theme.danger : theme.text;

  const content = (
    <>
      <SymbolView name={icon} tintColor={color} size={ICON_SIZE} />
      <ThemedText style={[styles.label, { color }]} numberOfLines={1}>
        {label}
      </ThemedText>
      {value ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.value}>
          {value}
        </ThemedText>
      ) : null}
      {onPress && !destructive ? (
        <SymbolView
          name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
          tintColor={theme.textSecondary}
          size={14}
        />
      ) : null}
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: theme.backgroundSelected },
      ]}>
      {content}
    </Pressable>
  );
}

/** Linha com ícone, texto (e descrição opcional) e interruptor. */
export function SettingsSwitchRow({
  icon,
  label,
  description,
  value,
  onValueChange,
  disabled,
}: {
  icon: SymbolName;
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.row, styles.tallRow]}>
      <SymbolView name={icon} tintColor={theme.text} size={ICON_SIZE} />
      <View style={styles.texts}>
        <ThemedText style={styles.labelText} numberOfLines={1}>
          {label}
        </ThemedText>
        {description ? (
          <ThemedText type="small" themeColor="textSecondary">
            {description}
          </ThemedText>
        ) : null}
      </View>
      <Toggle
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={label}
      />
    </View>
  );
}

/** Linha com marca de seleção, para telas de escolha (idioma, tema). */
export function SettingsOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: theme.backgroundSelected },
      ]}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      {selected ? (
        <SymbolView
          name={{ ios: 'checkmark', android: 'check', web: 'check' }}
          tintColor={theme.primary}
          size={18}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    paddingHorizontal: Spacing.one,
  },
  card: {
    borderRadius: 14,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 52,
    paddingHorizontal: Spacing.three,
  },
  label: {
    flex: 1,
    fontSize: 16,
  },
  tallRow: {
    paddingVertical: Spacing.two + Spacing.one,
  },
  texts: {
    flex: 1,
    gap: Spacing.half,
  },
  labelText: {
    fontSize: 16,
  },
  value: {
    maxWidth: '60%',
  },
});
