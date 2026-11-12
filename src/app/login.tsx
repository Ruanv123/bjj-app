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
import { useEmailSignIn } from '@/features/auth/hooks';
import { loginSchema, type LoginInput, type LoginValues } from '@/features/auth/schemas';
import { showAlert } from '@/lib/alert';
import { getErrorMessage } from '@/lib/errors';

export default function LoginScreen() {
  const { t } = useTranslation();
  const signIn = useEmailSignIn();
  const { control, handleSubmit, setFocus } = useForm<LoginInput, unknown, LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit((values) =>
    signIn.mutate(values, {
      onError: (error) => {
        const key = getAuthErrorKey(error);
        showAlert(
          t('login.errorTitle'),
          key ? t(`auth.errors.${key}`) : getErrorMessage(error, t('common.tryAgain'))
        );
      },
    })
  );

  return (
    <AuthFormScreen
      title={t('login.title')}
      subtitle={t('login.subtitle')}
      footer={
        <Pressable accessibilityRole="link" onPress={() => router.replace('/sign-up')}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('login.noAccount')}{' '}
            <ThemedText type="smallBold" themeColor="primary">
              {t('welcome.createAccount')}
            </ThemedText>
          </ThemedText>
        </Pressable>
      }>
      <View style={styles.form}>
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
          editable={!signIn.isPending}
        />
        <FormTextField
          control={control}
          name="password"
          label={t('auth.password')}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={() => onSubmit()}
          editable={!signIn.isPending}
        />
        <Button label={t('login.submit')} loading={signIn.isPending} onPress={onSubmit} />
      </View>

      <SocialSignIn disabled={signIn.isPending} />
    </AuthFormScreen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.three,
  },
});
