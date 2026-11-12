import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import i18n from '@/lib/i18n';
import { showAlert } from '@/lib/alert';
import { PostEditor } from '../components/post-editor';

const mockMutate = jest.fn();
const mockDisablePrevention = jest.fn();
jest.mock('../hooks', () => ({ usePublishPost: () => ({ mutate: mockMutate, isPending: false }) }));
jest.mock('@/features/profile/hooks', () => ({
  useDisplayProfile: () => ({ name: 'Ana', avatarUrl: null }),
}));
jest.mock('@/lib/alert', () => ({ showAlert: jest.fn() }));
jest.mock('expo-router', () => ({
  router: { canGoBack: () => true, back: jest.fn(), dismissTo: jest.fn() },
  usePreventRemove: () => mockDisablePrevention,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardAvoidingView: jest.requireActual('react-native').View,
}));
beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('pt');
});

describe('escrever uma publicação', () => {
  it('não publica texto vazio', async () => {
    await render(<PostEditor />);
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar' }));
    expect(mockMutate).not.toHaveBeenCalled();
  });
  it('publica o texto e abre a publicação criada após sucesso', async () => {
    mockMutate.mockImplementationOnce((_input, options) =>
      options.onSuccess('e0000000-0000-4000-8000-000000000010')
    );
    await render(<PostEditor />);
    await fireEvent.changeText(
      screen.getByLabelText('O que está acontecendo no seu tatame?'),
      '  Hoje conquistei meu primeiro grau.  '
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar' }));
    expect(mockMutate).toHaveBeenCalledWith(
      { body: 'Hoje conquistei meu primeiro grau.', parentId: undefined, editId: undefined },
      expect.anything()
    );
    expect(router.dismissTo).toHaveBeenCalledWith({
      pathname: '/posts/[id]',
      params: { id: 'e0000000-0000-4000-8000-000000000010' },
    });
    expect(mockDisablePrevention).toHaveBeenCalled();
  });
  it('mantém o texto quando o servidor falha', async () => {
    mockMutate.mockImplementationOnce((_input, options) => options.onError());
    await render(<PostEditor />);
    await fireEvent.changeText(
      screen.getByLabelText('O que está acontecendo no seu tatame?'),
      'Texto que não quero perder.'
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar' }));
    expect(screen.getByDisplayValue('Texto que não quero perder.')).toBeTruthy();
    expect(showAlert).toHaveBeenCalled();
    expect(router.dismissTo).not.toHaveBeenCalled();
  });
});
