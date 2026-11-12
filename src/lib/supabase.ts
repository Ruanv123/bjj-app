import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { storage } from '@/lib/storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY no arquivo .env.local'
  );
}

/**
 * Um único cliente por processo. Sem isso, cada Fast Refresh deste módulo cria
 * outro cliente com o próprio timer de renovação: dois clientes renovando o
 * mesmo refresh token fazem o Supabase detectar "reuso" do token, revogar a
 * sessão inteira e deslogar o usuário.
 */
const globalForSupabase = globalThis as typeof globalThis & {
  __supabase?: SupabaseClient;
  __supabaseAppStateListener?: boolean;
};

export const supabase =
  globalForSupabase.__supabase ??
  createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
      flowType: 'pkce',
    },
  });
globalForSupabase.__supabase = supabase;

// Renova o token apenas enquanto o app está em primeiro plano (listener registrado uma vez só).
if (Platform.OS !== 'web' && !globalForSupabase.__supabaseAppStateListener) {
  globalForSupabase.__supabaseAppStateListener = true;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
