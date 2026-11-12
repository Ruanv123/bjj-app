import type { PropsWithChildren } from 'react';
import { act, renderRouter, screen, testRouter } from 'expo-router/testing-library';

import RootLayout from '@/app/_layout';

let mockLoggedIn = false;
let mockSetLoggedIn: (value: boolean) => void;

jest.mock('@/lib/sentry', () => ({ Sentry: { wrap: (component: unknown) => component } }));
jest.mock('@/lib/i18n', () => ({}));
jest.mock('@/stores/preferences', () => ({}));
jest.mock('@/lib/query-client', () => {
  const { QueryClient } = jest.requireActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return { queryClient: new QueryClient() };
});
jest.mock('@/components/app-splash', () => ({ AppSplash: () => null }));
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardProvider: ({ children }: PropsWithChildren) => children,
}));
jest.mock('@/features/subscription/subscription-provider', () => ({
  SubscriptionProvider: ({ children }: PropsWithChildren) => children,
}));
jest.mock('@/features/auth/auth-provider', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Context = React.createContext(false);
  return {
    AuthProvider: ({ children }: PropsWithChildren) => {
      const [loggedIn, setLoggedIn] = React.useState(mockLoggedIn);
      mockSetLoggedIn = setLoggedIn;
      return <Context value={loggedIn}>{children}</Context>;
    },
    useAuth: () => ({
      session: React.use(Context) ? { user: { id: 'test-user' } } : null,
      isLoading: false,
      isDevSkip: false,
    }),
  };
});

// Keep the real root navigator and guard transitions; isolate screen contents
// from network requests and native modules unrelated to routing.
const routes = [
  '(tabs)/index', 'search', 'video/[id]', 'playlist/[id]', 'saved', 'people/[id]',
  'posts/[id]', 'posts/compose', 'chat/[id]/index', 'chat/[id]/info', 'chat/[id]/edit',
  'chat/[id]/search', 'chat/new', 'community/new', 'community/join', 'join/[code]',
  'settings/blocked-users', 'settings/language', 'settings/appearance',
  'settings/edit-profile', 'settings/account', 'welcome', 'login', 'sign-up', 'auth/callback',
];

async function openApp(initialUrl = '/') {
  await renderRouter({
    ...Object.fromEntries(routes.map((route) => [route, () => null])),
    _layout: () => <RootLayout />,
  }, { initialUrl });
}

describe('entrada e saída da sessão', () => {
  beforeEach(() => { mockLoggedIn = false; });

  it('abre as boas-vindas na primeira abertura sem sessão', async () => {
    await openApp();
    expect(screen).toHavePathname('/welcome');
  });

  it('volta às boas-vindas ao sair de uma tela interna', async () => {
    mockLoggedIn = true;
    await openApp('/settings/account');
    expect(screen).toHavePathname('/settings/account');
    await act(() => mockSetLoggedIn(false));
    expect(screen).toHavePathname('/welcome');
  });

  it('abre o conteúdo para quem já tem sessão', async () => {
    mockLoggedIn = true;
    await openApp();
    expect(screen).toHavePathname('/');
  });

  it('permite entrar e criar conta a partir das boas-vindas', async () => {
    await openApp('/welcome');
    await testRouter.push('/login');
    await testRouter.back('/welcome');
    await testRouter.push('/sign-up');
    await testRouter.back('/welcome');
  });
});
