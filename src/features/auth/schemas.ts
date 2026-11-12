import { z } from 'zod';

export const MIN_PASSWORD_LENGTH = 8;

/**
 * As mensagens dos schemas são chaves de `auth.fieldErrors.*`: a tela traduz
 * na hora de exibir, assim o idioma pode mudar sem recriar o schema.
 */
export type FieldErrorKey = 'required' | 'invalidEmail' | 'passwordTooShort';

const message = (key: FieldErrorKey) => key;

const email = z
  .string()
  .trim()
  .min(1, message('required'))
  .pipe(z.email(message('invalidEmail')));

export const loginSchema = z.object({
  email,
  // No login não checamos o tamanho: contas antigas podem ter senhas menores.
  password: z.string().min(1, message('required')),
});

export const signUpSchema = z.object({
  name: z.string().trim().min(1, message('required')),
  email,
  password: z
    .string()
    .min(1, message('required'))
    .min(MIN_PASSWORD_LENGTH, message('passwordTooShort')),
});

export type LoginInput = z.input<typeof loginSchema>;
export type LoginValues = z.output<typeof loginSchema>;
export type SignUpInput = z.input<typeof signUpSchema>;
export type SignUpValues = z.output<typeof signUpSchema>;
