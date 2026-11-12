import { fireEvent, render, screen } from '@testing-library/react-native';

import i18n from '@/lib/i18n';
import { ProfileForm } from '../components/profile-form';
import { emptyProfileDetails } from '../details';

const mockMutate = jest.fn();
jest.mock('../hooks', () => ({
  useUpdateProfileDetails: () => ({ mutate: mockMutate, isPending: false }),
}));
// A animação e os gestos são verificados no navegador; aqui exercitamos o formulário dentro da folha.
jest.mock('@/components/ui/bottom-sheet', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    BottomSheet: function MockBottomSheet({
      children,
      onClose,
      dismissRequested,
    }: {
      children: import('react').ReactNode;
      onClose: () => void;
      dismissRequested: boolean;
    }) {
      useEffect(() => {
        if (dismissRequested) onClose();
      }, [dismissRequested, onClose]);
      return children;
    },
  };
});
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('@/lib/alert', () => ({ showAlert: jest.fn() }));

beforeEach(async () => {
  mockMutate.mockClear();
  await i18n.changeLanguage('pt');
});

describe('edição do perfil esportivo', () => {
  it('salva faixa, modalidades, Instagram normalizado e uma conquista', async () => {
    await render(<ProfileForm initial={emptyProfileDetails('Ana')} />);
    await fireEvent.changeText(screen.getByLabelText('Bio'), 'Treino desde 2020.');
    await fireEvent.changeText(
      screen.getByLabelText('Instagram'),
      'https://instagram.com/ana.luta/'
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Azul' }));
    await fireEvent.press(screen.getByRole('button', { name: '2' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Jiu-jítsu com kimono' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Jiu-jítsu sem kimono' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar campeonato' }));
    await fireEvent.changeText(screen.getByLabelText('Nome do campeonato'), 'Brasileiro');
    await fireEvent.changeText(screen.getByLabelText('Ano'), '2024');
    await fireEvent.press(screen.getByRole('button', { name: 'Ouro' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar ao perfil' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: 'Ana',
        bio: 'Treino desde 2020.',
        instagram: 'ana.luta',
        belt: 'blue',
        beltDegree: 2,
        disciplines: ['gi', 'nogi'],
        competitions: [{ name: 'Brasileiro', year: 2024, result: 'gold' }],
      }),
      expect.anything()
    );
  });

  it('carrega dados existentes e permite removê-los', async () => {
    await render(
      <ProfileForm
        initial={{
          ...emptyProfileDetails('Ana'),
          belt: 'blue',
          beltDegree: 2,
          bio: 'Bio antiga',
          instagram: 'ana',
          disciplines: ['gi'],
          competitions: [{ name: 'Open', year: 2024, result: 'silver' }],
        }}
      />
    );
    await fireEvent.changeText(screen.getByLabelText('Bio'), '');
    await fireEvent.changeText(screen.getByLabelText('Instagram'), '');
    await fireEvent.press(screen.getByRole('button', { name: 'Sem faixa' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Jiu-jítsu com kimono' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Remover campeonato 1' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        bio: '',
        instagram: '',
        belt: null,
        beltDegree: 0,
        disciplines: [],
        competitions: [],
      }),
      expect.anything()
    );
  });

  it('impede salvar um campeonato incompleto', async () => {
    await render(<ProfileForm initial={emptyProfileDetails('Ana')} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar campeonato' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar ao perfil' }));
    expect(mockMutate).not.toHaveBeenCalled();
    expect(screen.getByText('Preencha este campo.')).toBeTruthy();
  });
  it('edita um campeonato pela folha sem duplicar o registro', async () => {
    await render(
      <ProfileForm
        initial={{
          ...emptyProfileDetails('Ana'),
          competitions: [{ name: 'Open', year: 2024, result: 'participated' }],
        }}
      />
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Editar campeonato 1' }));
    await fireEvent.changeText(screen.getByLabelText('Nome do campeonato'), 'Open de Judô');
    await fireEvent.press(screen.getByRole('button', { name: 'Prata' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Concluir edição' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        competitions: [{ name: 'Open de Judô', year: 2024, result: 'silver' }],
      }),
      expect.anything()
    );
    expect(screen.queryByLabelText('Nome do campeonato')).toBeNull();
  });

  it('oferece somente jiu-jítsu e judô, sem campo para outras modalidades', async () => {
    await render(<ProfileForm initial={emptyProfileDetails('Ana')} />);
    expect(screen.getByRole('button', { name: 'Judô' })).toBeTruthy();
    for (const name of ['Wrestling', 'MMA', 'Muay Thai', 'Boxe']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
    expect(screen.queryByLabelText('Outras modalidades')).toBeNull();
  });
});
