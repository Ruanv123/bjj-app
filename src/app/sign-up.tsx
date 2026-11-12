import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { AuthFormScreen } from '@/features/auth/components/auth-form-screen';
import { FormTextField } from '@/features/auth/components/form-text-field';
import { SocialSignIn } from '@/features/auth/components/social-sign-in';
import { getAuthErrorKey } from '@/features/auth/errors';
import { useEmailSignUp } from '@/features/auth/hooks';
import {
  MIN_PASSWORD_LENGTH,
  signUpSchema,
  type SignUpInput,
  type SignUpValues,
} from '@/features/auth/schemas';
import { showAlert } from '@/lib/alert';
import { getErrorMessage } from '@/lib/errors';

export default function SignUpScreen() {
  const { t } = useTranslation();
  const signUp = useEmailSignUp();
  const { control, handleSubmit, setFocus } = useForm<SignUpInput, unknown, SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const onSubmit = handleSubmit((values) =>
    signUp.mutate(values, {
      // Com sessão, o guard do _layout já leva o usuário para dentro do app.
      onSuccess: ({ needsEmailConfirmation }) => {
        if (!needsEmailConfirmation) return;
        showAlert(t('signUp.confirmTitle'), t('signUp.confirmMessage', { email: values.email }));
        router.replace('/login');
      },
      onError: (error) => {
        const key = getAuthErrorKey(error);
        showAlert(
          t('signUp.errorTitle'),
          key ? t(`auth.errors.${key}`) : getErrorMessage(error, t('common.tryAgain'))
        );
      },
    })
  );

  return (
    <AuthFormScreen
      title={t('signUp.title')}
      subtitle={t('signUp.subtitle')}
      footer={
        <Pressable accessibilityRole="link" onPress={() => router.replace('/login')}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('signUp.haveAccount')}{' '}
            <ThemedText type="smallBold" themeColor="primary">
              {t('login.submit')}
            </ThemedText>
          </ThemedText>
        </Pressable>
      }>
      <View style={styles.form}>
        <FormTextField
          control={control}
          name="name"
          label={t('settings.name')}
          placeholder={t('settings.namePlaceholder')}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => setFocus('email')}
          editable={!signUp.isPending}
        />
        <FormTextField
          control={control}
          name="email"
          label={t('auth.email')}
          placeholder={t('auth.emailPlaceholder')}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => setFocus('password')}
          editable={!signUp.isPending}
        />
        <FormTextField
          control={control}
          name="password"
          label={t('auth.password')}
          placeholder={t('signUp.passwordHint', { min: MIN_PASSWORD_LENGTH })}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={() => onSubmit()}
          editable={!signUp.isPending}
        />
        <Button label={t('welcome.createAccount')} loading={signUp.isPending} onPress={onSubmit} />
      </View>

      <SocialSignIn disabled={signUp.isPending} />
    </AuthFormScreen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.three,
  },
});
