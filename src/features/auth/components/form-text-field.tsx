import { useTranslation } from 'react-i18next';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';

import { TextField, type TextFieldProps } from '@/components/ui/text-field';
import { MIN_PASSWORD_LENGTH, type FieldErrorKey } from '@/features/auth/schemas';

type Props<T extends FieldValues> = Omit<
  TextFieldProps,
  'value' | 'onChangeText' | 'onBlur' | 'error' | 'ref'
> & {
  control: Control<T>;
  name: Path<T>;
};

/**
 * TextField ligado ao react-hook-form. Traduz as mensagens dos schemas zod e
 * registra a ref do input, então `setFocus(name)` funciona.
 */
export function FormTextField<T extends FieldValues>({ control, name, ...rest }: Props<T>) {
  const { t } = useTranslation();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          {...rest}
          ref={field.ref}
          value={field.value}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={
            fieldState.error?.message
              ? t(`auth.fieldErrors.${fieldState.error.message as FieldErrorKey}`, {
                  min: MIN_PASSWORD_LENGTH,
                })
              : null
          }
        />
      )}
    />
  );
}
