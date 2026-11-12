import * as AppleAuthentication from 'expo-apple-authentication';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { SocialButton } from '@/features/auth/components/social-button';
import { useNativeAppleAvailable, useSignIn, type AuthProvider } from '@/features/auth/hooks';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';
import { getErrorMessage } from '@/lib/errors';

/** Divisor "ou" + botões de Apple e Google, usados no login e no cadastro. */
export function SocialSignIn({ disabled = false }: { disabled?: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const scheme = useColorScheme();
  const nativeAppleAvailable = useNativeAppleAvailable();
  const signIn = useSignIn();

  const pendingProvider = signIn.isPending ? signIn.variables : null;
  const isDisabled = disabled || signIn.isPending;

  function handleSignIn(provider: AuthProvider) {
    signIn.mutate(provider, {
      onError: (error) =>
        showAlert(t('login.errorTitle'), getErrorMessage(error, t('common.tryAgain'))),
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.divider}>
        <View style={[styles.line, { backgroundColor: theme.border }]} />
        <ThemedText type="small" themeColor="textSecondary">
          {t('auth.or')}
        </ThemedText>
        <View style={[styles.line, { backgroundColor: theme.border }]} />
      </View>

      {nativeAppleAvailable ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={
            scheme === 'dark'
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={14}
          style={styles.appleButton}
          onPress={() => {
            if (!isDisabled) handleSignIn('apple');
          }}
        />
      ) : (
        <SocialButton
          provider="apple"
          label={t('login.continueWithApple')}
          loading={pendingProvider === 'apple'}
          disabled={isDisabled}
          onPress={() => handleSignIn('apple')}
        />
      )}

      <SocialButton
        provider="google"
        label={t('login.continueWithGoogle')}
        loading={pendingProvider === 'google'}
        disabled={isDisabled}
        onPress={() => handleSignIn('google')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  appleButton: {
    width: '100%',
    height: 52,
  },
});
