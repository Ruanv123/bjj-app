import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { AppState, Platform } from 'react-native';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 2,
    },
  },
});

if (Platform.OS !== 'web') {
  // Refaz queries "stale" quando o app volta ao primeiro plano.
  AppState.addEventListener('change', (status) => {
    focusManager.setFocused(status === 'active');
  });

  // Pausa queries/mutations sem internet e retoma quando a conexão volta.
  onlineManager.setEventListener((setOnline) => {
    const subscription = Network.addNetworkStateListener((state) => {
      setOnline(!!state.isConnected);
    });
    return () => subscription.remove();
  });
}
