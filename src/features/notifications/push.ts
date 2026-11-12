import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import i18n, { t } from 'i18next';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/** Mesmo id usado pela Edge Function chat-push (`channelId`). */
export const CHAT_CHANNEL_ID = 'chat';

export type PushRegistration = 'granted' | 'denied' | 'unavailable';

/** Token registrado neste aparelho (para removê-lo ao sair da conta). */
let registeredToken: string | null = null;

function getProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

function isGranted(settings: Notifications.NotificationPermissionsStatus) {
  return (
    settings.granted || settings.ios?.status === IosAuthorizationStatus.PROVISIONAL
  );
}

/**
 * Registra o aparelho para receber push do chat.
 * `prompt: false` só registra se a permissão já foi dada (não abre o pedido do sistema).
 */
export async function registerForPushAsync({
  prompt,
  force = false,
}: {
  prompt: boolean;
  /** Registra de novo mesmo que já tenha registrado nesta sessão (troca de token). */
  force?: boolean;
}): Promise<PushRegistration> {
  if (Platform.OS === 'web') return 'unavailable';
  if (registeredToken && !force) return 'granted';

  // Android: o canal precisa existir antes de pedir permissão (Android 13+) e de pegar o token.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHAT_CHANNEL_ID, {
      name: t('push.channelName'),
      importance: AndroidImportance.HIGH,
    });
  }

  let settings = await Notifications.getPermissionsAsync();
  if (!isGranted(settings) && prompt && settings.canAskAgain) {
    settings = await Notifications.requestPermissionsAsync();
  }
  if (!isGranted(settings)) return 'denied';

  const projectId = getProjectId();
  if (!projectId) {
    // Falta vincular o projeto ao EAS (`eas init` grava extra.eas.projectId no app.json).
    console.warn('[push] projectId do EAS não encontrado; push desativado.');
    return 'unavailable';
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await saveToken(token);
  return 'granted';
}

export async function saveToken(token: string) {
  const { error } = await supabase.rpc('register_push_token', {
    p_token: token,
    p_platform: Platform.OS,
    p_language: (i18n.language ?? 'pt').slice(0, 2),
  });
  if (error) throw error;
  registeredToken = token;
}

/** Para de enviar push para este aparelho. Chamar ANTES de encerrar a sessão. */
export async function unregisterPushAsync() {
  const token = registeredToken;
  if (!token) return;
  registeredToken = null;
  try {
    await supabase.rpc('unregister_push_token', { p_token: token });
  } catch {
    // Sem rede: o token continua no banco, mas a Edge Function o descarta quando
    // o Expo responder DeviceNotRegistered, e outro login no aparelho o reassume.
  }
}
