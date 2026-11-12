import { Alert, Platform } from 'react-native';

/** Confirmação destrutiva que funciona no iOS, Android e web. */
export function confirmDestructive(options: {
  title: string;
  confirmLabel: string;
  cancelLabel: string;
}): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(options.title));
  }
  return new Promise((resolve) => {
    Alert.alert(options.title, undefined, [
      { text: options.cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: options.confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
