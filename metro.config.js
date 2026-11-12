const { getSentryExpoConfig } = require('@sentry/react-native/metro');

// Envolve o ErrorBoundary do Expo Router para que erros de tela cheguem ao Sentry.
const config = getSentryExpoConfig(__dirname, { autoWrapExpoRouterErrorBoundary: true });

module.exports = config;
