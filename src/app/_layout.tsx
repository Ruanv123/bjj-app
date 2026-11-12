// Precisam vir primeiro: inicializam Sentry e i18n antes de qualquer tela.
import { Sentry } from '@/lib/sentry';
import '@/lib/i18n';
import '@/stores/preferences';

import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { AppSplash } from '@/components/app-splash';
import { AuthProvider, useAuth } from '@/features/auth/auth-provider';
import { SubscriptionProvider } from '@/features/subscription/subscription-provider';
import { useTheme } from '@/hooks/use-theme';
import { queryClient } from '@/lib/query-client';

SplashScreen.preventAutoHideAsync();

function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SubscriptionProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <KeyboardProvider>
              <RootNavigator />
            </KeyboardProvider>
          </ThemeProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function RootNavigator() {
  const { session, isLoading, isDevSkip } = useAuth();
  const theme = useTheme();

  // Telas internas com cabeçalho nativo e botão de voltar.
  const detailHeader = {
    headerShown: true,
    headerBackButtonDisplayMode: 'minimal',
    headerShadowVisible: false,
    headerTitleAlign: 'center',
    headerStyle: { backgroundColor: theme.background },
    headerTintColor: theme.text,
  } as const;
  const groupedHeader = {
    ...detailHeader,
    headerStyle: { backgroundColor: theme.groupedBackground },
  } as const;
  const isLoggedIn = !!session || isDevSkip;

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          // O app fica sempre em pé; só a tela cheia do player deita (ver VideoPlayer).
          // Por isso app.json usa "orientation": "default" — no iOS a rotação do
          // player só funciona se o app declarar suporte a paisagem.
          orientation: 'portrait_up',
        }}>
        <Stack.Protected guard={isLoggedIn} redirectTo="/welcome">
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="search" options={{ animation: 'fade_from_bottom' }} />
          <Stack.Screen
            name="video/[id]"
            options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="playlist/[id]" options={detailHeader} />
          <Stack.Screen name="saved" options={detailHeader} />
          <Stack.Screen name="people/[id]" options={groupedHeader} />
          <Stack.Screen name="posts/[id]" options={detailHeader} />
          <Stack.Screen name="posts/compose" options={{ ...detailHeader, presentation: 'modal' }} />
          {/* Conversa tem cabeçalho próprio (ocupa a tela toda para o teclado). */}
          <Stack.Screen name="chat/[id]/index" />
          <Stack.Screen name="chat/[id]/info" options={groupedHeader} />
          <Stack.Screen name="chat/[id]/edit" options={groupedHeader} />
          <Stack.Screen name="chat/[id]/search" options={detailHeader} />
          <Stack.Screen name="chat/new" options={detailHeader} />
          <Stack.Screen name="community/new" options={groupedHeader} />
          <Stack.Screen name="community/join" options={groupedHeader} />
          <Stack.Screen name="join/[code]" options={{ animation: 'fade' }} />
          <Stack.Screen name="settings/blocked-users" options={groupedHeader} />
          <Stack.Screen name="settings/language" options={groupedHeader} />
          <Stack.Screen name="settings/appearance" options={groupedHeader} />
          <Stack.Screen name="settings/edit-profile" options={groupedHeader} />
          <Stack.Screen name="settings/account" options={groupedHeader} />
        </Stack.Protected>
        <Stack.Protected guard={!isLoggedIn}>
          {/* Destino explícito das rotas internas quando não há sessão. */}
          <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
          <Stack.Screen name="login" options={{ ...detailHeader, title: '' }} />
          <Stack.Screen name="sign-up" options={{ ...detailHeader, title: '' }} />
        </Stack.Protected>
        <Stack.Screen name="auth/callback" />
      </Stack>
      <AppSplash ready={!isLoading} />
    </>
  );
}

export default Sentry.wrap(RootLayout);
