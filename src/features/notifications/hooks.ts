import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useUser } from '@/features/auth/auth-provider';
import { useChatSession } from '@/features/chat/store';

import { registerForPushAsync } from './push';

type PushData = { conversationId?: string };

// Com o app aberto: mostra o push, menos o da conversa que a pessoa está lendo.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data as PushData | undefined;
      const isReading =
        !!data?.conversationId &&
        data.conversationId === useChatSession.getState().activeConversationId;
      return {
        shouldShowBanner: !isReading,
        shouldShowList: !isReading,
        shouldPlaySound: !isReading,
        shouldSetBadge: false,
      };
    },
  });
}

/**
 * Registra o aparelho sem pedir permissão (só se ela já foi dada) e acompanha
 * trocas de token. O pedido de permissão em si acontece na aba de Chat.
 */
export function usePushRegistration() {
  const userId = useUser()?.id;

  useEffect(() => {
    if (!userId || Platform.OS === 'web') return;
    registerForPushAsync({ prompt: false }).catch(() => {});

    // O token do Expo pode mudar (reinstalação, restauração de backup…).
    const subscription = Notifications.addPushTokenListener(() => {
      registerForPushAsync({ prompt: false, force: true }).catch(() => {});
    });
    return () => subscription.remove();
  }, [userId]);
}

/** Pede permissão de notificação (uma vez) quando a pessoa usa o chat. */
export function useRequestPushPermission() {
  const userId = useUser()?.id;
  useEffect(() => {
    if (!userId || Platform.OS === 'web') return;
    registerForPushAsync({ prompt: true }).catch(() => {});
  }, [userId]);
}

/** Tocar no push abre a conversa (também quando o toque abriu o app). */
function useNotificationNavigationNative() {
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;

    const data = response.notification.request.content.data as PushData | undefined;
    if (data?.conversationId) {
      router.push({ pathname: '/chat/[id]', params: { id: data.conversationId } });
    }
    // Para não reabrir a mesma conversa na próxima vez que o app iniciar.
    Notifications.clearLastNotificationResponseAsync().catch(() => {});
  }, [response]);
}


/** Na web não há push: o hook vira no-op (escolhido uma vez, sem quebrar as regras de hooks). */
export const useNotificationNavigation =
  Platform.OS === 'web' ? () => {} : useNotificationNavigationNative;
