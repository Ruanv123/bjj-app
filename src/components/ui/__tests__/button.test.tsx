import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '../button';

describe('<Button />', () => {
  it('mostra o texto e chama onPress', async () => {
    const onPress = jest.fn();
    await render(<Button label="Entrar" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('em loading mostra o indicador e não dispara onPress', async () => {
    const onPress = jest.fn();
    await render(<Button label="Entrar" onPress={onPress} loading />);

    expect(screen.getByTestId('button-loading')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));

    expect(onPress).not.toHaveBeenCalled();
  });
});
