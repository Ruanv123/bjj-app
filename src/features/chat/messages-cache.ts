import type { InfiniteData } from '@tanstack/react-query';

import type { MessageCursor } from './api';
import type { Message } from './types';

/** Páginas do cache: cada uma da mais nova para a mais antiga; pages[0] é a mais recente. */
export type MessagePages = InfiniteData<Message[], MessageCursor | null>;

/** Mensagens ainda não confirmadas ficam sempre por último (mais novas) na conversa. */
function sortKey(message: Message) {
  return message.status === 'sent' ? Date.parse(message.createdAt) : Number.POSITIVE_INFINITY;
}

function newestFirst(a: Message, b: Message) {
  const diff = sortKey(b) - sortKey(a);
  if (diff !== 0) return diff;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/**
 * Insere ou substitui mensagens pelo id. Serve para as três origens — envio
 * otimista, resposta do servidor e Realtime — sem nunca duplicar.
 */
export function upsertMessages(data: MessagePages | undefined, messages: Message[]) {
  if (!data || messages.length === 0) return data;

  const incoming = new Map(messages.map((m) => [m.id, m]));
  const pages = data.pages.map((page) =>
    page.map((m) => {
      const next = incoming.get(m.id);
      if (!next) return m;
      incoming.delete(m.id);
      return next;
    })
  );

  const [first = [], ...rest] = pages;
  const firstPage = [...incoming.values(), ...first].sort(newestFirst);

  return { ...data, pages: [firstPage, ...rest] };
}

export function updateMessage(
  data: MessagePages | undefined,
  id: string,
  patch: Partial<Message>
): MessagePages | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => page.map((m) => (m.id === id ? { ...m, ...patch } : m))),
  };
}

/** Lista em ordem cronológica (mais antiga primeiro), como a tela exibe. */
export function toChronological(data: MessagePages): Message[] {
  return data.pages.flat().reverse();
}

/**
 * Aplica mudanças vindas do servidor (Realtime ou recuperação). Substitui as
 * mensagens que já estão no cache e insere as novas; mudanças em mensagens mais
 * antigas que a página mais velha carregada são ignoradas — senão uma edição de
 * mensagem antiga apareceria solta no meio da conversa. Quando a pessoa rolar
 * até lá, a página virá do banco já atualizada.
 */
export function applyServerChanges(data: MessagePages | undefined, changes: Message[]) {
  if (!data || changes.length === 0) return data;

  const loaded = new Set<string>();
  let oldestLoaded = Number.POSITIVE_INFINITY;
  for (const page of data.pages) {
    for (const m of page) {
      loaded.add(m.id);
      if (m.status === 'sent') oldestLoaded = Math.min(oldestLoaded, Date.parse(m.createdAt));
    }
  }
  // Sem nada confirmado carregado (conversa vazia): tudo que chega é novo.
  const hasHistory = Number.isFinite(oldestLoaded);

  const relevant = changes.filter(
    (m) => loaded.has(m.id) || !hasHistory || Date.parse(m.createdAt) >= oldestLoaded
  );
  return upsertMessages(data, relevant);
}

/**
 * Horário da última mudança conhecida (criação, edição ou exclusão): ponto de
 * partida para buscar o que o Realtime não entregou.
 */
export function latestSyncedAt(data: MessagePages | undefined): string | null {
  let latest: string | null = null;
  let latestMs = Number.NEGATIVE_INFINITY;
  for (const page of data?.pages ?? []) {
    for (const m of page) {
      if (m.status !== 'sent') continue;
      const ms = Date.parse(m.updatedAt);
      if (ms > latestMs) {
        latestMs = ms;
        latest = m.updatedAt;
      }
    }
  }
  return latest;
}
