import {
  applyServerChanges,
  latestSyncedAt,
  toChronological,
  updateMessage,
  upsertMessages,
  type MessagePages,
} from '../messages-cache';
import type { Message } from '../types';

function msg(id: string, createdAt: string, overrides: Partial<Message> = {}): Message {
  return {
    id,
    conversationId: 'c1',
    senderId: 'u1',
    body: id,
    senderName: 'Ana',
    senderAvatarUrl: null,
    createdAt,
    updatedAt: createdAt,
    editedAt: null,
    deletedAt: null,
    attachment: null,
    reactions: {},
    status: 'sent',
    ...overrides,
  };
}

function pages(...p: Message[][]): MessagePages {
  return { pages: p, pageParams: p.map(() => null) };
}

const ids = (data: MessagePages | undefined) => toChronological(data!).map((m) => m.id);

describe('upsertMessages', () => {
  it('adiciona mensagem nova no fim da conversa', () => {
    const data = pages([msg('b', '2026-11-11T10:01:00+00:00'), msg('a', '2026-11-11T10:00:00+00:00')]);
    const result = upsertMessages(data, [msg('c', '2026-11-11T10:02:00+00:00')]);
    expect(ids(result)).toEqual(['a', 'b', 'c']);
  });

  it('não duplica quando a mesma mensagem chega pelo Realtime e pela resposta do envio', () => {
    const data = pages([msg('a', '2026-11-11T10:00:00+00:00')]);
    const once = upsertMessages(data, [msg('b', '2026-11-11T10:01:00+00:00')]);
    const twice = upsertMessages(once, [msg('b', '2026-11-11T10:01:00+00:00')]);
    expect(ids(twice)).toEqual(['a', 'b']);
  });

  it('troca a mensagem otimista pela confirmada do servidor', () => {
    const data = pages([msg('a', '2026-11-11T10:00:00+00:00')]);
    const pending = upsertMessages(data, [
      msg('b', '2026-11-11T09:00:00.000Z', { status: 'sending' }),
    ]);
    const confirmed = upsertMessages(pending, [msg('b', '2026-11-11T10:05:00+00:00')]);
    const list = toChronological(confirmed!);
    expect(list.map((m) => m.id)).toEqual(['a', 'b']);
    expect(list[1].status).toBe('sent');
  });

  it('mantém mensagens pendentes no fim mesmo com relógio do aparelho atrasado', () => {
    const data = pages([msg('a', '2026-11-11T10:00:00+00:00')]);
    const result = upsertMessages(data, [
      msg('pending', '2026-11-11T09:00:00.000Z', { status: 'sending' }),
    ]);
    const withIncoming = upsertMessages(result, [msg('b', '2026-11-11T10:01:00+00:00')]);
    expect(ids(withIncoming)).toEqual(['a', 'b', 'pending']);
  });

  it('atualiza mensagens que estão em páginas antigas sem movê-las', () => {
    const data = pages([msg('b', '2026-11-11T10:01:00+00:00')], [msg('a', '2026-11-11T10:00:00+00:00')]);
    const result = upsertMessages(data, [msg('a', '2026-11-11T10:00:00+00:00', { body: 'editada' })]);
    expect(result!.pages[1][0].body).toBe('editada');
    expect(ids(result)).toEqual(['a', 'b']);
  });

  it('ignora quando o cache ainda não existe', () => {
    expect(upsertMessages(undefined, [msg('a', '2026-11-11T10:00:00+00:00')])).toBeUndefined();
  });
});

describe('updateMessage', () => {
  it('marca uma mensagem como falha', () => {
    const data = pages([msg('a', '2026-11-11T10:00:00+00:00', { status: 'sending' })]);
    expect(updateMessage(data, 'a', { status: 'failed' })!.pages[0][0].status).toBe('failed');
  });
});

describe('latestSyncedAt', () => {
  it('usa a mudança mais recente (inclusive edição/exclusão de mensagem antiga)', () => {
    const data = pages([
      msg('b', '2026-11-11T10:01:00+00:00'),
      msg('a', '2026-11-11T10:00:00+00:00', { updatedAt: '2026-11-11T10:30:00+00:00' }),
    ]);
    expect(latestSyncedAt(data)).toBe('2026-11-11T10:30:00+00:00');
  });

  it('ignora pendentes', () => {
    const data = upsertMessages(pages([msg('a', '2026-11-11T10:00:00+00:00')]), [
      msg('p', '2026-11-11T11:00:00.000Z', { status: 'sending' }),
    ]);
    expect(latestSyncedAt(data)).toBe('2026-11-11T10:00:00+00:00');
  });

  it('devolve null sem mensagens confirmadas', () => {
    expect(latestSyncedAt(pages([]))).toBeNull();
  });
});

describe('applyServerChanges', () => {
  const loaded = () =>
    pages([msg('c', '2026-11-11T10:02:00+00:00'), msg('b', '2026-11-11T10:01:00+00:00')]);

  it('aplica a exclusão de uma mensagem que está na tela', () => {
    const result = applyServerChanges(loaded(), [
      msg('b', '2026-11-11T10:01:00+00:00', { body: '', deletedAt: '2026-11-11T10:05:00+00:00' }),
    ]);
    const deleted = toChronological(result!).find((m) => m.id === 'b');
    expect(deleted?.deletedAt).toBe('2026-11-11T10:05:00+00:00');
  });

  it('insere mensagens novas', () => {
    const result = applyServerChanges(loaded(), [msg('d', '2026-11-11T10:03:00+00:00')]);
    expect(ids(result)).toEqual(['b', 'c', 'd']);
  });

  it('ignora mudança em mensagem mais antiga que as carregadas (evita mensagem solta)', () => {
    const result = applyServerChanges(loaded(), [
      msg('old', '2026-11-11T09:00:00+00:00', { deletedAt: '2026-11-11T10:05:00+00:00' }),
    ]);
    expect(ids(result)).toEqual(['b', 'c']);
  });

  it('com a conversa vazia, aceita tudo', () => {
    const result = applyServerChanges(pages([]), [msg('a', '2026-11-11T10:00:00+00:00')]);
    expect(ids(result)).toEqual(['a']);
  });
});

describe('edição e exclusão vindas do Realtime', () => {
  it('substitui a mensagem pelo id mantendo a posição', () => {
    const data = pages([msg('b', '2026-11-11T10:01:00+00:00'), msg('a', '2026-11-11T10:00:00+00:00')]);
    const result = upsertMessages(data, [
      msg('a', '2026-11-11T10:00:00+00:00', { body: '', deletedAt: '2026-11-11T10:05:00+00:00' }),
    ]);
    const list = toChronological(result!);
    expect(list.map((m) => m.id)).toEqual(['a', 'b']);
    expect(list[0].deletedAt).not.toBeNull();
  });
});
