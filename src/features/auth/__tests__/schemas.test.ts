import { loginSchema, signUpSchema } from '../schemas';

function firstError(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  return Object.fromEntries((result.error?.issues ?? []).map((i) => [i.path[0], i.message]));
}

describe('loginSchema', () => {
  it('exige e-mail e senha', () => {
    const result = loginSchema.safeParse({ email: '  ', password: '' });
    expect(firstError(result)).toEqual({ email: 'required', password: 'required' });
  });

  it('rejeita e-mail inválido', () => {
    const result = loginSchema.safeParse({ email: 'joao@site', password: 'x' });
    expect(firstError(result)).toEqual({ email: 'invalidEmail' });
  });

  it('remove espaços do e-mail e não checa tamanho da senha', () => {
    const result = loginSchema.safeParse({ email: '  joao@site.com ', password: '123' });
    expect(result.success && result.data.email).toBe('joao@site.com');
  });
});

describe('signUpSchema', () => {
  it('exige nome', () => {
    const result = signUpSchema.safeParse({ name: ' ', email: 'a@b.com', password: '12345678' });
    expect(firstError(result)).toEqual({ name: 'required' });
  });

  it('exige senha com tamanho mínimo', () => {
    const result = signUpSchema.safeParse({ name: 'Ana', email: 'a@b.com', password: '1234567' });
    expect(firstError(result)).toEqual({ password: 'passwordTooShort' });
  });

  it('aceita dados válidos', () => {
    const result = signUpSchema.safeParse({ name: ' Ana ', email: 'a@b.com', password: '12345678' });
    expect(result.success && result.data.name).toBe('Ana');
  });
});
