type Status = 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT';

type FakeChannel = {
  topic: string;
  on: jest.Mock;
  subscribe: jest.Mock;
  emit: (status: Status) => void;
};

const created: FakeChannel[] = [];
let resolveRemoval: (() => void) | null = null;

jest.mock('@/lib/supabase', () => ({
  supabase: {
    realtime: { setAuth: jest.fn(() => Promise.resolve()) },
    channel: jest.fn((topic: string) => {
      let callback: ((status: Status) => void) | null = null;
      const channel: FakeChannel = {
        topic: `realtime:${topic}`,
        on: jest.fn(() => channel),
        subscribe: jest.fn((cb: (status: Status) => void) => {
          callback = cb;
          return channel;
        }),
        emit: (status) => callback?.(status),
      };
      created.push(channel);
      return channel;
    }),
    // A remoção só termina quando o teste mandar (simula o unsubscribe assíncrono).
    removeChannel: jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRemoval = resolve;
        })
    ),
  },
}));

// Os hooks do módulo puxam auth/perfil; aqui só testamos manageChannel.
jest.mock('@/features/auth/auth-provider', () => ({ useUser: () => null }));
jest.mock('@/features/profile/hooks', () => ({ useDisplayProfile: () => ({}) }));

// eslint-disable-next-line import/first
import { manageChannel } from '../realtime';

/** Deixa as promises pendentes (setAuth, remoção) andarem. */
const flush = () => new Promise<void>((resolve) => setImmediate(() => resolve()));

beforeEach(() => {
  created.length = 0;
  resolveRemoval = null;
  jest.clearAllMocks();
});

describe('manageChannel', () => {
  it('recria o canal quando o servidor o fecha (ex.: limite de presence)', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate'] });
    const onSubscribed = jest.fn();
    const stop = manageChannel({
      topic: 'conversation:reconnect',
      config: { private: true },
      setup: jest.fn(),
      onSubscribed,
    });

    await flush();
    created[0].emit('SUBSCRIBED');
    expect(onSubscribed).toHaveBeenCalledTimes(1);

    created[0].emit('CLOSED');
    resolveRemoval?.();
    await flush();
    jest.advanceTimersByTime(1000);
    await flush();

    expect(created).toHaveLength(2);
    created[1].emit('SUBSCRIBED');
    // Reconectou: busca de novo o que pode ter perdido.
    expect(onSubscribed).toHaveBeenCalledTimes(2);

    stop();
    jest.useRealTimers();
  });

  it('ao reabrir o mesmo tópico, espera o canal anterior terminar de sair', async () => {
    const stopFirst = manageChannel({ topic: 'conversation:reopen', config: {}, setup: jest.fn() });
    await flush();
    created[0].emit('SUBSCRIBED');

    stopFirst();
    const stopSecond = manageChannel({ topic: 'conversation:reopen', config: {}, setup: jest.fn() });
    await flush();
    // Ainda removendo o primeiro: não pode criar (o supabase devolveria o canal moribundo).
    expect(created).toHaveLength(1);

    resolveRemoval?.();
    await flush();
    expect(created).toHaveLength(2);

    stopSecond();
  });

  it('ignora o CLOSED provocado pela própria limpeza', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate'] });
    const stop = manageChannel({ topic: 'user:1', config: {}, setup: jest.fn() });
    await flush();
    created[0].emit('SUBSCRIBED');

    stop();
    created[0].emit('CLOSED');
    resolveRemoval?.();
    jest.advanceTimersByTime(60_000);
    await flush();

    expect(created).toHaveLength(1);
    jest.useRealTimers();
  });
});
