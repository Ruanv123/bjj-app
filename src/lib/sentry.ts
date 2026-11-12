import * as Sentry from '@sentry/react-native';
import { isRunningInExpoGo } from 'expo';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  environment: __DEV__ ? 'development' : 'production',
  // Não enviamos IP/cookies automaticamente; o usuário é definido em setSentryUser.
  sendDefaultPii: false,
  tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  enableNativeFramesTracking: !isRunningInExpoGo(),
  integrations: [
    Sentry.expoRouterIntegration({ enableTimeToInitialDisplay: !isRunningInExpoGo() }),
  ],
});

export function setSentryUser(user: { id: string } | null) {
  Sentry.setUser(user ? { id: user.id } : null);
}

export { Sentry };
