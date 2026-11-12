import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import PublicProfileScreen from '@/app/people/[id]';
import i18n from '@/lib/i18n';
import type { PublicProfile } from '../api';

const mockViewerId = 'f0000000-0000-4000-8000-000000000001';
let mockId = 'f0000000-0000-4000-8000-000000000002';
const mockSendMessage = jest.fn();
const mockRefetch = jest.fn();
let mockQuery: {
  data: PublicProfile | null;
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
};

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/features/notifications/push', () => ({ unregisterPushAsync: jest.fn() }));
jest.mock('@/features/feed/components/timeline', () => ({
  Timeline: ({ header }: { header: import('react').ReactNode }) => header,
}));
jest.mock('@/features/feed/components/social-profile-bar', () => ({
  SocialProfileBar: () => null,
}));
jest.mock('../hooks', () => ({ usePublicProfile: () => mockQuery }));
jest.mock('@/features/chat/hooks', () => ({
  useOpenDm: () => ({ mutate: mockSendMessage, isPending: false }),
}));
jest.mock('@/features/auth/auth-provider', () => ({ useUser: () => ({ id: mockViewerId }) }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: mockId }),
}));

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('pt');
  mockId = 'f0000000-0000-4000-8000-000000000002';
  mockQuery = {
    data: {
      id: mockId,
      displayName: 'Bia',
      avatarUrl: null,
      bio: 'Judoca desde 2020.',
      instagram: 'bia.judo',
      belt: 'black',
      beltDegree: 2,
      disciplines: ['judo'],
      competitions: [{ name: 'Open', year: 2024, result: 'gold' }],
    },
    isPending: false,
    isError: false,
    refetch: mockRefetch,
  };
});

describe('perfil de outra pessoa', () => {
  it('mostra a pessoa visitada, sua faixa, graus e conquistas', async () => {
    await render(<PublicProfileScreen />);
    expect(screen.getByRole('header', { name: 'Bia' })).toBeTruthy();
    expect(screen.getByText('Judoca desde 2020.')).toBeTruthy();
    expect(screen.getByText('Faixa Preta · 2 graus')).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'Sobre' }));
    expect(screen.getByText('Judô')).toBeTruthy();
    expect(screen.getByText('Open')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Instagram @bia.judo' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Editar perfil' })).toBeNull();
  });

  it('abre uma conversa com a pessoa visitada', async () => {
    await render(<PublicProfileScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar mensagem' }));
    expect(mockSendMessage).toHaveBeenCalledWith(mockId, expect.anything());
    mockSendMessage.mock.calls[0][1].onSuccess('conversation-id');
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/chat/[id]',
      params: { id: 'conversation-id' },
    });
  });

  it('permite editar somente quando visita o próprio perfil', async () => {
    mockId = mockViewerId;
    mockQuery.data = { ...mockQuery.data!, id: mockViewerId };
    await render(<PublicProfileScreen />);
    expect(screen.queryByRole('button', { name: 'Enviar mensagem' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Editar perfil' }));
    expect(router.push).toHaveBeenCalledWith('/settings/edit-profile');
  });

  it('mostra indisponibilidade sem ações quando o perfil está bloqueado ou não existe', async () => {
    mockQuery.data = null;
    await render(<PublicProfileScreen />);
    expect(screen.getByText('Perfil indisponível')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Enviar mensagem' })).toBeNull();
  });

  it('permite tentar novamente após erro', async () => {
    mockQuery.data = null;
    mockQuery.isError = true;
    await render(<PublicProfileScreen />);
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('browse.retry') }));
    expect(mockRefetch).toHaveBeenCalled();
  });
});
