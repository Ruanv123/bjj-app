import { useQuery } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { ThemedView } from '@/components/ui/themed-view';
import { createSessionFromUrl } from '@/features/auth/api';

/**
 * Destino do deep link `appmobile://auth/callback` quando o sistema abre o app
 * pelo link (em vez de devolver o resultado ao openAuthSessionAsync).
 */
export default function AuthCallbackScreen() {
  const url = Linking.useLinkingURL();

  const { isFetched } = useQuery({
    queryKey: ['auth', 'callback', url],
    queryFn: () =>
      createSessionFromUrl(url!)
        // O código pode já ter sido trocado pelo fluxo do navegador.
        .catch((error: unknown) => {
          if (__DEV__) console.log('[auth] erro ao criar sessão pelo deep link:', error);
          return null;
        })
        .then(() => true),
    enabled: !!url,
    retry: false,
    gcTime: 0,
  });

  if (!url || isFetched) return <Redirect href="/" />;

  return (
    <ThemedView style={styles.container}>
      <ActivityIndicator />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
