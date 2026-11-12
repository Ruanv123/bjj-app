import type { RealtimeChannel } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useUser } from '@/features/auth/auth-provider';
import { useDisplayProfile } from '@/features/profile/hooks';
import { supabase } from '@/lib/supabase';

import { fetchMessagesChangedSince } from './api';
import { chatKeys, messagesQueryOptions } from './hooks';
import { applyServerChanges, latestSyncedAt, type MessagePages } from './messages-cache';
import { useChatSession } from './store';
import { mapMessage, type MessageRow } from './types';

/** Depois de quanto tempo sem digitar o "digitando…" some. */
const TYPING_IDLE_MS = 4000;
/**
 * Intervalo mínimo entre dois track() de presence do mesmo cliente. O Realtime
 * tem limite de eventos de presence por cliente e, ao estourar, derruba o canal
 * (ClientPresenceRateLimitReached) — a conversa parava de receber mensagens.
 */
const PRESENCE_MIN_INTERVAL_MS = 3000;
/** Espera antes de recriar um canal que caiu (cresce a cada falha seguida). */
const RETRY_DELAYS_MS = [1000, 2000, 5000, 10_000, 30_000];

type PresencePayload = { typing?: boolean; name?: string };
type ChannelConfig = NonNullable<Parameters<typeof supabase.channel>[1]>['config'];

// ---------- Canal gerenciado ----------

/**
 * Remoções em andamento, por tópico. `supabase.channel(topic)` devolve o canal
 * existente com o mesmo tópico, e `removeChannel` é assíncrono: sem esperar,
 * reabrir a mesma conversa logo depois de sair dela pegava o canal que estava
 * sendo desmontado — e ele "morria" sem erro nenhum.
 */
const pendingRemovals = new Map<string, Promise<unknown>>();

function removeChannelSafely(channel: RealtimeChannel) {
  const topic = channel.topic;
  const removal: Promise<unknown> = supabase
    .removeChannel(channel)
    .catch(() => {})
    .finally(() => {
      if (pendingRemovals.get(topic) === removal) pendingRemovals.delete(topic);
    });
  pendingRemovals.set(topic, removal);
}

type ManagedChannelOptions = {
  /** Sem o prefixo "realtime:" (ex.: "conversation:<id>"). */
  topic: string;
  config: ChannelConfig;
  /** Registra os listeners (.on) no canal recém-criado. */
  setup: (channel: RealtimeChannel) => void;
  /** Canal ativo (ou null quando caiu/foi fechado). */
  onChannel?: (channel: RealtimeChannel | null) => void;
  /** Conectou ou reconectou: hora de buscar o que pode ter sido perdido. */
  onSubscribed?: () => void;
};

/**
 * Assina um canal privado e o mantém vivo: se o servidor fechar o canal, der
 * erro ou timeout, recria com espera crescente. Devolve a função de limpeza.
 */
export function manageChannel(options: ManagedChannelOptions): () => void {
  let active = true;
  let channel: RealtimeChannel | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let failures = 0;

  async function connect() {
    await pendingRemovals.get(`realtime:${options.topic}`);
    if (!active) return;
    // Garante que o canal use o token da sessão atual (Realtime Authorization).
    await supabase.realtime.setAuth().catch(() => {});
    if (!active) return;

    const current = supabase.channel(options.topic, { config: options.config });
    channel = current;
    options.setup(current);

    current.subscribe((status, error) => {
      if (!active || channel !== current) return;

      if (status === 'SUBSCRIBED') {
        failures = 0;
        options.onChannel?.(current);
        options.onSubscribed?.();
        return;
      }

      // CLOSED também chega quando o servidor encerra o canal (ex.: limite de
      // presence); nesse caso o realtime-js não tenta de novo sozinho.
      if (__DEV__) console.warn(`[realtime] ${options.topic}: ${status}`, error?.message ?? '');
      options.onChannel?.(null);
      channel = null;
      removeChannelSafely(current);
      const delay = RETRY_DELAYS_MS[Math.min(failures, RETRY_DELAYS_MS.length - 1)];
      failures++;
      retryTimer = setTimeout(connect, delay);
    });
  }

  connect();

  return () => {
    active = false;
    if (retryTimer) clearTimeout(retryTimer);
    options.onChannel?.(null);
    if (channel) removeChannelSafely(channel);
    channel = null;
  };
}

// ---------- Conversa ----------

/**
 * Assina o canal privado da conversa. O Realtime não garante entrega, então
 * sempre que o canal (re)conecta ou o app volta ao primeiro plano buscamos no
 * banco o que chegou desde a última mensagem conhecida.
 *
 * O useEffect é legítimo aqui: sincroniza o React com um sistema externo (o WebSocket).
 */
export function useConversationRealtime(conversationId: string) {
  const queryClient = useQueryClient();
  const user = useUser();
  const profile = useDisplayProfile();
  const name = profile.name ?? user?.email?.split('@')[0];
  const userId = user?.id;
  const [typingNames, setTypingNames] = useState<string[]>([]);

  const channelRef = useRef<RealtimeChannel | null>(null);
  // "digitando…": o que queremos publicar × o que já foi publicado.
  const desiredTypingRef = useRef(false);
  const publishedTypingRef = useRef(false);
  const lastTrackAtRef = useRef(0);
  const trailingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;
    const options = messagesQueryOptions(conversationId);
    let active = true;

    async function catchUp() {
      try {
        // Espera a primeira página (se ainda estiver carregando) para não abrir um buraco
        // entre o que a busca inicial viu e o momento em que o canal conectou.
        const data = await queryClient.ensureInfiniteQueryData(options);
        const since = latestSyncedAt(data);
        if (!since || !active) return;
        // Novas, editadas e apagadas desde a última mudança conhecida.
        const changes = await fetchMessagesChangedSince(conversationId, since);
        queryClient.setQueryData<MessagePages>(options.queryKey, (current) =>
          applyServerChanges(current, changes)
        );
      } catch {
        // Sem rede: tentamos de novo na próxima reconexão.
      }
    }

    const stop = manageChannel({
      topic: `conversation:${conversationId}`,
      config: { private: true, presence: { key: userId } },
      setup: (channel) => {
        channel
          .on('broadcast', { event: 'message' }, ({ payload }) => {
            queryClient.setQueryData<MessagePages>(options.queryKey, (current) =>
              applyServerChanges(current, [mapMessage(payload as MessageRow)])
            );
          })
          .on('presence', { event: 'sync' }, () => {
            const state = channel.presenceState<PresencePayload>();
            const names = Object.entries(state)
              .filter(([key]) => key !== userId)
              .map(([, presences]) => presences.find((p) => p.typing)?.name)
              .filter((n): n is string => !!n);
            setTypingNames(names);
          });
      },
      onChannel: (channel) => {
        channelRef.current = channel;
        // Canal novo começa sem presença publicada.
        publishedTypingRef.current = false;
        lastTrackAtRef.current = 0;
        if (!channel) setTypingNames([]);
      },
      onSubscribed: catchUp,
    });

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') catchUp();
    });

    return () => {
      active = false;
      appState.remove();
      if (trailingTimerRef.current) clearTimeout(trailingTimerRef.current);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      trailingTimerRef.current = null;
      idleTimerRef.current = null;
      desiredTypingRef.current = false;
      stop();
    };
  }, [conversationId, userId, queryClient]);

  /** Publica o estado desejado respeitando o intervalo mínimo entre track(). */
  function publishTyping() {
    const channel = channelRef.current;
    if (!channel || desiredTypingRef.current === publishedTypingRef.current) return;

    const wait = lastTrackAtRef.current + PRESENCE_MIN_INTERVAL_MS - Date.now();
    if (wait > 0) {
      // Agenda uma única atualização no fim do intervalo, com o estado mais recente.
      trailingTimerRef.current ??= setTimeout(() => {
        trailingTimerRef.current = null;
        publishTyping();
      }, wait);
      return;
    }

    publishedTypingRef.current = desiredTypingRef.current;
    lastTrackAtRef.current = Date.now();
    channel
      .track({ typing: desiredTypingRef.current, name } satisfies PresencePayload)
      .catch(() => {});
  }

  function setTyping(typing: boolean) {
    desiredTypingRef.current = typing;
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = typing ? setTimeout(() => setTyping(false), TYPING_IDLE_MS) : null;
    publishTyping();
  }

  return { typingNames, setTyping };
}

// ---------- Canal pessoal ----------

/**
 * Canal pessoal (user:<id>). O banco avisa aqui quando:
 * - uma DM recebe mensagem → recarrega a lista de conversas;
 * - a pessoa foi removida/banida de uma comunidade, ou ela foi apagada → sai da
 *   conversa na hora (o Realtime só revalida a permissão quando o JWT expira).
 * Fica montado enquanto as abas existem.
 */
export function useInboxRealtime() {
  const queryClient = useQueryClient();
  const userId = useUser()?.id;
  const markRevoked = useChatSession((state) => state.markRevoked);

  useEffect(() => {
    if (!userId) return;
    const refresh = () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: chatKeys.conversations() }),
        queryClient.invalidateQueries({ queryKey: chatKeys.communities() }),
      ]);

    return manageChannel({
      topic: `user:${userId}`,
      config: { private: true },
      setup: (channel) => {
        channel
          .on('broadcast', { event: 'conversation_updated' }, refresh)
          .on('broadcast', { event: 'membership_revoked' }, ({ payload }) => {
            const conversationId = (payload as { conversation_id?: string }).conversation_id;
            if (conversationId) {
              markRevoked(conversationId);
              queryClient.removeQueries({ queryKey: chatKeys.messages(conversationId) });
            }
            refresh();
          });
      },
      // Reconectou: pode ter perdido avisos enquanto estava fora.
      onSubscribed: refresh,
    });
  }, [userId, queryClient, markRevoked]);
}
