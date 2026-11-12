import { Alert, Platform } from 'react-native';

type Choice<T> = { label: string; value: T; destructive?: boolean };

/**
 * Pergunta com até 2 opções + cancelar (limite do Alert no Android).
 * Na web, onde Alert com botões não existe, devolve a primeira opção.
 */
export function chooseOption<T>(options: {
  title: string;
  cancelLabel: string;
  choices: Choice<T>[];
}): Promise<T | null> {
  if (Platform.OS === 'web') {
    return Promise.resolve(options.choices[0]?.value ?? null);
  }
  return new Promise((resolve) => {
    Alert.alert(options.title, undefined, [
      ...options.choices.map((c) => ({
        text: c.label,
        style: c.destructive ? ('destructive' as const) : ('default' as const),
        onPress: () => resolve(c.value),
      })),
      { text: options.cancelLabel, style: 'cancel' as const, onPress: () => resolve(null) },
    ], { cancelable: true, onDismiss: () => resolve(null) });
  });
}
